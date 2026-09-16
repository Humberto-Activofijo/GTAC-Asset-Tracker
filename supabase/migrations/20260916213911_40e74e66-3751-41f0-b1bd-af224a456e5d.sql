-- ============ Tipos ============
DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM ('TRANSITO_48H', 'OMISION_PROTOCOLO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_status AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Tabla ============
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.alert_type NOT NULL,
  status public.alert_status NOT NULL DEFAULT 'OPEN',
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_notes text
);

GRANT SELECT ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_select_admin ON public.alerts;
CREATE POLICY alerts_select_admin ON public.alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ Índices ============
CREATE INDEX IF NOT EXISTS alerts_status_idx ON public.alerts (status);
CREATE INDEX IF NOT EXISTS alerts_type_idx ON public.alerts (type);
CREATE INDEX IF NOT EXISTS alerts_asset_idx ON public.alerts (asset_id);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON public.alerts (created_at DESC);

-- Anti-duplicado: una sola alerta por (tipo, movimiento origen).
CREATE UNIQUE INDEX IF NOT EXISTS alerts_type_movement_uidx
  ON public.alerts (type, movement_id) WHERE movement_id IS NOT NULL;

-- ============ Regla 1: omisión de protocolo ============
CREATE OR REPLACE FUNCTION public.alerts_on_protocol_omission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action_label text;
BEGIN
  IF NOT NEW.protocol_omission THEN
    RETURN NEW;
  END IF;

  _action_label := CASE NEW.action
    WHEN 'ENTRADA' THEN 'entrada'
    WHEN 'SALIDA' THEN 'salida'
    ELSE 'inventario' END;

  INSERT INTO public.alerts (type, status, asset_id, movement_id, site_id, message, metadata)
  VALUES (
    'OMISION_PROTOCOLO',
    'OPEN',
    NEW.asset_id,
    NEW.id,
    NEW.site_id,
    format(
      'Omisión de protocolo detectada: el activo %s fue registrado con %s en %s sin la secuencia esperada de movimientos.',
      NEW.asset_number, _action_label, NEW.site_name
    ),
    jsonb_build_object(
      'action', NEW.action,
      'asset_number', NEW.asset_number,
      'previous_site_id', NEW.previous_site_id,
      'previous_site_name', NEW.previous_site_name,
      'previous_status', NEW.previous_status,
      'new_site_id', NEW.site_id,
      'new_site_name', NEW.site_name,
      'performed_by', NEW.performed_by,
      'performed_by_email', NEW.performed_by_email,
      'occurred_at', NEW.occurred_at
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movements_protocol_omission_alert ON public.movements;
CREATE TRIGGER movements_protocol_omission_alert
  AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.alerts_on_protocol_omission();

-- ============ Regla 2: tránsito +48 h (revisión idempotente) ============
CREATE OR REPLACE FUNCTION public.run_transit_48h_check()
RETURNS TABLE(assets_reviewed integer, alerts_created integer, alerts_existing integer, errors integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rec record;
  _salida public.movements%ROWTYPE;
  _has_entry boolean;
  _inserted uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede ejecutar la revisión de tránsito.' USING ERRCODE = '42501';
  END IF;

  assets_reviewed := 0;
  alerts_created := 0;
  alerts_existing := 0;
  errors := 0;

  FOR _rec IN SELECT a.id, a.asset_number FROM public.assets a WHERE a.status = 'EN_TRANSITO' LOOP
    assets_reviewed := assets_reviewed + 1;
    BEGIN
      SELECT * INTO _salida
      FROM public.movements m
      WHERE m.asset_id = _rec.id AND m.action = 'SALIDA'
      ORDER BY m.occurred_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.movements m2
        WHERE m2.asset_id = _rec.id
          AND m2.action = 'ENTRADA'
          AND m2.occurred_at > _salida.occurred_at
      ) INTO _has_entry;

      IF _has_entry THEN
        CONTINUE;
      END IF;

      IF _salida.occurred_at > now() - interval '48 hours' THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.alerts al
        WHERE al.type = 'TRANSITO_48H' AND al.movement_id = _salida.id
      ) THEN
        alerts_existing := alerts_existing + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.alerts (type, status, asset_id, movement_id, site_id, message, metadata)
      VALUES (
        'TRANSITO_48H',
        'OPEN',
        _rec.id,
        _salida.id,
        _salida.site_id,
        format(
          'Tránsito prolongado: el activo %s salió de %s y lleva más de 48 horas sin registrar entrada.',
          _salida.asset_number, _salida.site_name
        ),
        jsonb_build_object(
          'asset_number', _salida.asset_number,
          'origin_site_id', _salida.site_id,
          'origin_site_name', _salida.site_name,
          'departed_at', _salida.occurred_at,
          'performed_by', _salida.performed_by,
          'performed_by_email', _salida.performed_by_email
        )
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO _inserted;

      IF _inserted IS NULL THEN
        alerts_existing := alerts_existing + 1;
      ELSE
        alerts_created := alerts_created + 1;
      END IF;
      _inserted := NULL;
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
    END;
  END LOOP;

  RETURN NEXT;
END;
$$;

-- ============ Consulta enriquecida ============
CREATE OR REPLACE FUNCTION public.list_alerts(_status text DEFAULT 'ALL', _limit integer DEFAULT 100, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  type public.alert_type,
  status public.alert_status,
  asset_id uuid,
  asset_number text,
  movement_id uuid,
  site_id uuid,
  site_name text,
  message text,
  metadata jsonb,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by_email text,
  resolution_notes text,
  departed_at timestamptz,
  origin_site_name text,
  hours_in_transit numeric,
  subsequent_entry_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _st text := upper(coalesce(_status, 'ALL'));
  _lim integer := least(greatest(coalesce(_limit, 100), 1), 200);
  _off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar las alertas.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT al.* FROM public.alerts al
    WHERE _st = 'ALL' OR al.status = _st::public.alert_status
  ), counted AS (
    SELECT count(*) AS n FROM filtered
  )
  SELECT
    f.id, f.type, f.status, f.asset_id, a.asset_number, f.movement_id, f.site_id, s.name,
    f.message, f.metadata, f.created_at, f.resolved_at, u.email::text, f.resolution_notes,
    mv.occurred_at,
    mv.site_name,
    CASE WHEN mv.occurred_at IS NULL THEN NULL
         ELSE round(EXTRACT(EPOCH FROM (coalesce(entry.occurred_at, now()) - mv.occurred_at)) / 3600.0, 1)
    END,
    entry.occurred_at,
    (SELECT n FROM counted)
  FROM filtered f
  JOIN public.assets a ON a.id = f.asset_id
  LEFT JOIN public.sites s ON s.id = f.site_id
  LEFT JOIN auth.users u ON u.id = f.resolved_by
  LEFT JOIN public.movements mv ON mv.id = f.movement_id AND f.type = 'TRANSITO_48H'
  LEFT JOIN LATERAL (
    SELECT m2.occurred_at FROM public.movements m2
    WHERE mv.id IS NOT NULL AND m2.asset_id = f.asset_id AND m2.action = 'ENTRADA'
      AND m2.occurred_at > mv.occurred_at
    ORDER BY m2.occurred_at ASC LIMIT 1
  ) entry ON true
  ORDER BY f.status ASC, f.created_at DESC
  LIMIT _lim OFFSET _off;
END;
$$;

-- ============ Alertas de un activo (admin) ============
CREATE OR REPLACE FUNCTION public.list_asset_alerts(_asset_id uuid)
RETURNS TABLE(id uuid, type public.alert_type, status public.alert_status, message text, created_at timestamptz, resolved_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT al.id, al.type, al.status, al.message, al.created_at, al.resolved_at
  FROM public.alerts al
  WHERE al.asset_id = _asset_id
  ORDER BY al.created_at DESC
  LIMIT 100;
END;
$$;

-- ============ Resolver alerta ============
CREATE OR REPLACE FUNCTION public.resolve_alert(_alert_id uuid, _notes text)
RETURNS TABLE(id uuid, status public.alert_status, resolved_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _clean text := btrim(coalesce(_notes, ''));
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver alertas.' USING ERRCODE = '42501';
  END IF;
  IF _clean = '' OR length(_clean) > 2000 THEN
    RAISE EXCEPTION 'Las notas de resolución son obligatorias.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.alerts al
  SET status = 'RESOLVED',
      resolved_at = now(),
      resolved_by = _uid,
      resolution_notes = _clean
  WHERE al.id = _alert_id AND al.status = 'OPEN'
  RETURNING al.id, al.status, al.resolved_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La alerta no existe o ya fue resuelta.' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- ============ Conteos para el panel ============
CREATE OR REPLACE FUNCTION public.alerts_dashboard()
RETURNS TABLE(open_alerts bigint, transit_48h bigint, protocol_omissions bigint, assets_in_transit bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar los indicadores.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.alerts WHERE status = 'OPEN'),
    (SELECT count(*) FROM public.alerts WHERE status = 'OPEN' AND type = 'TRANSITO_48H'),
    (SELECT count(*) FROM public.alerts WHERE status = 'OPEN' AND type = 'OMISION_PROTOCOLO'),
    (SELECT count(*) FROM public.assets WHERE status = 'EN_TRANSITO');
END;
$$;

REVOKE ALL ON FUNCTION public.run_transit_48h_check() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_alerts(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_asset_alerts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_alert(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.alerts_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_transit_48h_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_alerts(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_asset_alerts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alerts_dashboard() TO authenticated;
