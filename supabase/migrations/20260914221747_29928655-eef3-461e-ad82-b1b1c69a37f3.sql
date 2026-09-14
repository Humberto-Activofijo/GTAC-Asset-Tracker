CREATE TYPE public.movement_action AS ENUM ('ENTRADA', 'SALIDA', 'INVENTARIO');

CREATE TABLE public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  asset_number text NOT NULL,
  action public.movement_action NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  site_name text NOT NULL,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_by_email text,
  condition public.asset_condition NOT NULL,
  notes text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  previous_site_id uuid REFERENCES public.sites(id),
  previous_site_name text,
  previous_status public.asset_status,
  previous_condition public.asset_condition,
  protocol_omission boolean NOT NULL DEFAULT false,
  client_operation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX movements_client_operation_id_key ON public.movements (client_operation_id);
CREATE INDEX movements_asset_idx ON public.movements (asset_id, occurred_at DESC);
CREATE INDEX movements_site_idx ON public.movements (site_id, occurred_at DESC);
CREATE INDEX movements_action_idx ON public.movements (action);
CREATE INDEX movements_occurred_idx ON public.movements (occurred_at DESC);
CREATE INDEX movements_performed_by_idx ON public.movements (performed_by);
CREATE INDEX movements_previous_site_idx ON public.movements (previous_site_id);

GRANT SELECT ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY movements_select_admin ON public.movements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY movements_select_assigned ON public.movements
  FOR SELECT TO authenticated
  USING (
    public.is_assigned_site(auth.uid(), site_id)
    OR (previous_site_id IS NOT NULL AND public.is_assigned_site(auth.uid(), previous_site_id))
  );

CREATE OR REPLACE FUNCTION public.register_movement(
  _asset_id uuid,
  _action text,
  _site_id uuid,
  _client_operation_id text,
  _condition text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _photo_url text DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL
)
RETURNS TABLE (
  movement_id uuid,
  duplicate boolean,
  protocol_omission boolean,
  new_status public.asset_status,
  new_site_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _asset public.assets%ROWTYPE;
  _site public.sites%ROWTYPE;
  _prev_site_name text;
  _existing public.movements%ROWTYPE;
  _act public.movement_action;
  _cond public.asset_condition;
  _omission boolean := false;
  _target_site uuid;
  _target_status public.asset_status;
  _email text;
  _op text := btrim(coalesce(_client_operation_id, ''));
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.active) THEN
    RAISE EXCEPTION 'Tu perfil no está activo.' USING ERRCODE = '42501';
  END IF;

  IF _op = '' OR length(_op) > 100 THEN
    RAISE EXCEPTION 'Identificador de operación inválido.' USING ERRCODE = '22023';
  END IF;

  -- Reintento con el mismo identificador: no se crea un segundo movimiento.
  SELECT * INTO _existing FROM public.movements m WHERE m.client_operation_id = _op;
  IF FOUND THEN
    SELECT a.status, a.current_site_id INTO _target_status, _target_site
    FROM public.assets a WHERE a.id = _existing.asset_id;
    RETURN QUERY SELECT _existing.id, true, _existing.protocol_omission, _target_status, _target_site;
    RETURN;
  END IF;

  _act := _action::public.movement_action;

  _is_admin := public.has_role(_uid, 'admin'::public.app_role);
  IF NOT (_is_admin OR public.is_assigned_site(_uid, _site_id)) THEN
    RAISE EXCEPTION 'No tienes permiso para operar desde este sitio.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _site FROM public.sites s WHERE s.id = _site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El sitio seleccionado no existe.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _asset FROM public.assets a WHERE a.id = _asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El activo no existe.' USING ERRCODE = '22023';
  END IF;

  _cond := COALESCE(NULLIF(_condition, '')::public.asset_condition, _asset.condition);
  _target_site := _asset.current_site_id;
  _target_status := _asset.status;

  IF _act = 'SALIDA' THEN
    IF _asset.status = 'EN_TRANSITO' THEN
      RAISE EXCEPTION 'El activo ya está en tránsito: registra primero su entrada.' USING ERRCODE = '22023';
    END IF;
    IF _asset.status <> 'EN_SITIO' OR _asset.current_site_id <> _site_id THEN
      RAISE EXCEPTION 'La salida solo puede registrarse desde el sitio donde está el activo.' USING ERRCODE = '22023';
    END IF;
    _target_status := 'EN_TRANSITO';
    _target_site := _asset.current_site_id;

  ELSIF _act = 'ENTRADA' THEN
    IF _asset.status = 'EN_TRANSITO' THEN
      _target_status := 'EN_SITIO';
      _target_site := _site_id;
    ELSE
      _target_status := 'EN_SITIO';
      IF _asset.current_site_id <> _site_id THEN
        _omission := true;
      END IF;
      _target_site := _site_id;
    END IF;

  ELSIF _act = 'INVENTARIO' THEN
    IF _asset.status = 'EN_TRANSITO' THEN
      _omission := true;
      _target_status := 'EN_SITIO';
      _target_site := _site_id;
    ELSE
      _target_status := 'EN_SITIO';
      IF _asset.current_site_id <> _site_id THEN
        _omission := true;
        _target_site := _site_id;
      END IF;
    END IF;
  END IF;

  SELECT s.name INTO _prev_site_name FROM public.sites s WHERE s.id = _asset.current_site_id;
  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;

  INSERT INTO public.movements (
    asset_id, asset_number, action, site_id, site_name, performed_by, performed_by_email,
    condition, notes, photo_url, latitude, longitude,
    previous_site_id, previous_site_name, previous_status, previous_condition,
    protocol_omission, client_operation_id, occurred_at
  ) VALUES (
    _asset.id, _asset.asset_number, _act, _site_id, _site.name, _uid, _email,
    _cond, NULLIF(btrim(coalesce(_notes, '')), ''), NULLIF(btrim(coalesce(_photo_url, '')), ''),
    _latitude, _longitude,
    _asset.current_site_id, _prev_site_name, _asset.status, _asset.condition,
    _omission, _op, now()
  )
  RETURNING id INTO movement_id;

  UPDATE public.assets a
  SET status = _target_status,
      current_site_id = _target_site,
      condition = _cond,
      last_movement_at = now(),
      updated_at = now()
  WHERE a.id = _asset.id;

  RETURN QUERY SELECT movement_id, false, _omission, _target_status, _target_site;
END;
$$;

REVOKE ALL ON FUNCTION public.register_movement(uuid, text, uuid, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_movement(uuid, text, uuid, text, text, text, text, double precision, double precision) TO authenticated;