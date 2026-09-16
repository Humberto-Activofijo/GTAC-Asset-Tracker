DO $$ BEGIN
  CREATE TYPE public.alert_email_status AS ENUM ('PENDING','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS email_status public.alert_email_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text;

CREATE INDEX IF NOT EXISTS alerts_email_status_idx ON public.alerts (email_status);

DROP FUNCTION IF EXISTS public.run_transit_48h_check();

CREATE OR REPLACE FUNCTION public.run_transit_48h_check()
 RETURNS TABLE(assets_reviewed integer, alerts_created integer, alerts_existing integer, errors integer, created_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  created_ids := ARRAY[]::uuid[];

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
        created_ids := created_ids || _inserted;
      END IF;
      _inserted := NULL;
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
    END;
  END LOOP;

  RETURN NEXT;
END;
$function$;

DROP FUNCTION IF EXISTS public.list_alerts(text, integer, integer);

CREATE OR REPLACE FUNCTION public.list_alerts(_status text DEFAULT 'ALL'::text, _limit integer DEFAULT 100, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, type alert_type, status alert_status, asset_id uuid, asset_number text, movement_id uuid, site_id uuid, site_name text, message text, metadata jsonb, created_at timestamp with time zone, resolved_at timestamp with time zone, resolved_by_email text, resolution_notes text, departed_at timestamp with time zone, origin_site_name text, hours_in_transit numeric, subsequent_entry_at timestamp with time zone, email_status alert_email_status, email_sent_at timestamp with time zone, email_error text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    f.email_status, f.email_sent_at, f.email_error,
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
$function$;