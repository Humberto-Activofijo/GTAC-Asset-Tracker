-- Índices de apoyo para reportes
CREATE INDEX IF NOT EXISTS movements_occurred_at_idx ON public.movements (occurred_at DESC);
CREATE INDEX IF NOT EXISTS movements_action_idx ON public.movements (action);
CREATE INDEX IF NOT EXISTS movements_performed_by_idx ON public.movements (performed_by);
CREATE INDEX IF NOT EXISTS assets_status_idx ON public.assets (status);

-- =========================================================
-- Reporte de movimientos (incluye ALTA desde assets)
-- =========================================================
CREATE OR REPLACE FUNCTION public.report_movements(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _site_id uuid DEFAULT NULL,
  _asset_number text DEFAULT NULL,
  _condition text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _omission boolean DEFAULT NULL,
  _limit integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  row_id uuid,
  occurred_at timestamptz,
  asset_id uuid,
  asset_number text,
  serial_number text,
  model text,
  action text,
  site_id uuid,
  site_name text,
  user_email text,
  condition text,
  resulting_status text,
  notes text,
  protocol_omission boolean,
  has_gps boolean,
  has_photo boolean,
  latitude double precision,
  longitude double precision,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH is_admin AS (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS v
  ),
  unified AS (
    SELECT
      m.id AS row_id,
      m.occurred_at,
      m.asset_id,
      m.asset_number,
      a.serial_number,
      a.model,
      m.action::text AS action,
      m.site_id,
      m.site_name,
      COALESCE(m.performed_by_email, p.email) AS user_email,
      m.condition::text AS condition,
      CASE WHEN m.action = 'SALIDA' THEN 'EN_TRANSITO' ELSE 'EN_SITIO' END AS resulting_status,
      m.notes,
      m.protocol_omission,
      (m.latitude IS NOT NULL AND m.longitude IS NOT NULL) AS has_gps,
      (m.photo_url IS NOT NULL) AS has_photo,
      m.latitude,
      m.longitude,
      m.performed_by AS user_id
    FROM public.movements m
    JOIN public.assets a ON a.id = m.asset_id
    LEFT JOIN public.profiles p ON p.id = m.performed_by
    WHERE (SELECT v FROM is_admin)
       OR public.is_assigned_site(auth.uid(), m.site_id)
       OR (m.previous_site_id IS NOT NULL AND public.is_assigned_site(auth.uid(), m.previous_site_id))

    UNION ALL

    SELECT
      a.id AS row_id,
      a.created_at AS occurred_at,
      a.id AS asset_id,
      a.asset_number,
      a.serial_number,
      a.model,
      'ALTA'::text AS action,
      a.current_site_id AS site_id,
      s.name AS site_name,
      COALESCE(a.created_by_email, p.email) AS user_email,
      a.condition::text AS condition,
      'EN_SITIO'::text AS resulting_status,
      NULL::text AS notes,
      false AS protocol_omission,
      false AS has_gps,
      (a.photo_url IS NOT NULL) AS has_photo,
      NULL::double precision AS latitude,
      NULL::double precision AS longitude,
      a.created_by AS user_id
    FROM public.assets a
    JOIN public.sites s ON s.id = a.current_site_id
    LEFT JOIN public.profiles p ON p.id = a.created_by
    WHERE (SELECT v FROM is_admin)
       OR public.is_assigned_site(auth.uid(), a.current_site_id)
  ),
  filtered AS (
    SELECT * FROM unified u
    WHERE (_from IS NULL OR u.occurred_at >= _from)
      AND (_to IS NULL OR u.occurred_at <= _to)
      AND (_action IS NULL OR u.action = _action)
      AND (_site_id IS NULL OR u.site_id = _site_id)
      AND (_asset_number IS NULL OR u.asset_number ILIKE '%' || _asset_number || '%'
           OR COALESCE(u.serial_number, '') ILIKE '%' || _asset_number || '%')
      AND (_condition IS NULL OR u.condition = _condition)
      AND (_user_id IS NULL OR u.user_id = _user_id)
      AND (_omission IS NULL OR u.protocol_omission = _omission)
  )
  SELECT
    f.row_id, f.occurred_at, f.asset_id, f.asset_number, f.serial_number, f.model,
    f.action, f.site_id, f.site_name, f.user_email, f.condition, f.resulting_status,
    f.notes, f.protocol_omission, f.has_gps, f.has_photo, f.latitude, f.longitude,
    COUNT(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.occurred_at DESC, f.row_id
  LIMIT GREATEST(COALESCE(_limit, 25), 1)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

-- =========================================================
-- Reporte de inventario por sitio
-- =========================================================
CREATE OR REPLACE FUNCTION public.report_inventory(
  _site_id uuid DEFAULT NULL,
  _condition text DEFAULT NULL,
  _status text DEFAULT NULL,
  _asset_number text DEFAULT NULL,
  _serial_number text DEFAULT NULL,
  _model text DEFAULT NULL,
  _limit integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  site_id uuid,
  site_name text,
  asset_number text,
  serial_number text,
  model text,
  category text,
  condition text,
  status text,
  last_movement_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH is_admin AS (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS v
  ),
  filtered AS (
    SELECT a.id, a.current_site_id AS site_id, s.name AS site_name, a.asset_number,
           a.serial_number, a.model, a.category, a.condition::text AS condition,
           a.status::text AS status, a.last_movement_at, a.created_at
    FROM public.assets a
    JOIN public.sites s ON s.id = a.current_site_id
    WHERE ((SELECT v FROM is_admin) OR public.is_assigned_site(auth.uid(), a.current_site_id))
      AND (_site_id IS NULL OR a.current_site_id = _site_id)
      AND (_condition IS NULL OR a.condition::text = _condition)
      AND (_status IS NULL OR a.status::text = _status)
      AND (_asset_number IS NULL OR a.asset_number ILIKE '%' || _asset_number || '%')
      AND (_serial_number IS NULL OR COALESCE(a.serial_number, '') ILIKE '%' || _serial_number || '%')
      AND (_model IS NULL OR COALESCE(a.model, '') ILIKE '%' || _model || '%')
  )
  SELECT f.*, COUNT(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.site_name, f.asset_number, f.id
  LIMIT GREATEST(COALESCE(_limit, 25), 1)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

-- =========================================================
-- Contadores por sitio
-- =========================================================
CREATE OR REPLACE FUNCTION public.site_asset_counts(_site_id uuid)
RETURNS TABLE (
  total bigint,
  activos bigint,
  desconectados bigint,
  danados bigint,
  en_transito bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE a.condition = 'ACTIVO')::bigint,
    COUNT(*) FILTER (WHERE a.condition = 'DESCONECTADO')::bigint,
    COUNT(*) FILTER (WHERE a.condition = 'DANADO')::bigint,
    COUNT(*) FILTER (WHERE a.status = 'EN_TRANSITO')::bigint
  FROM public.assets a
  WHERE a.current_site_id = _site_id
    AND (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.is_assigned_site(auth.uid(), _site_id));
$$;

-- =========================================================
-- Indicadores y gráficos del dashboard (solo administradores)
-- =========================================================
CREATE OR REPLACE FUNCTION public.dashboard_metrics(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  p_from timestamptz := COALESCE(_from, now() - interval '30 days');
  p_to timestamptz := COALESCE(_to, now());
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar los indicadores.';
  END IF;

  SELECT jsonb_build_object(
    'total_assets', (SELECT COUNT(*) FROM public.assets),
    'assets_on_site', (SELECT COUNT(*) FROM public.assets WHERE status = 'EN_SITIO'),
    'assets_in_transit', (SELECT COUNT(*) FROM public.assets WHERE status = 'EN_TRANSITO'),
    'condition_active', (SELECT COUNT(*) FROM public.assets WHERE condition = 'ACTIVO'),
    'condition_disconnected', (SELECT COUNT(*) FROM public.assets WHERE condition = 'DESCONECTADO'),
    'condition_damaged', (SELECT COUNT(*) FROM public.assets WHERE condition = 'DANADO'),
    'period_entradas', (SELECT COUNT(*) FROM public.movements WHERE action = 'ENTRADA' AND occurred_at BETWEEN p_from AND p_to),
    'period_salidas', (SELECT COUNT(*) FROM public.movements WHERE action = 'SALIDA' AND occurred_at BETWEEN p_from AND p_to),
    'period_inventarios', (SELECT COUNT(*) FROM public.movements WHERE action = 'INVENTARIO' AND occurred_at BETWEEN p_from AND p_to),
    'period_altas', (SELECT COUNT(*) FROM public.assets WHERE created_at BETWEEN p_from AND p_to),
    'open_alerts', (SELECT COUNT(*) FROM public.alerts WHERE status = 'OPEN'),
    'transit_48h', (SELECT COUNT(*) FROM public.alerts WHERE status = 'OPEN' AND type = 'TRANSITO_48H'),
    'protocol_omissions', (SELECT COUNT(*) FROM public.alerts WHERE status = 'OPEN' AND type = 'OMISION_PROTOCOLO'),
    'movements_by_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.action, 'value', t.c) ORDER BY t.action)
      FROM (
        SELECT m.action::text AS action, COUNT(*) AS c
        FROM public.movements m
        WHERE m.occurred_at BETWEEN p_from AND p_to
        GROUP BY m.action
      ) t
    ), '[]'::jsonb),
    'assets_by_condition', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.condition, 'value', t.c) ORDER BY t.condition)
      FROM (
        SELECT a.condition::text AS condition, COUNT(*) AS c
        FROM public.assets a GROUP BY a.condition
      ) t
    ), '[]'::jsonb),
    'top_sites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.name, 'value', t.c) ORDER BY t.c DESC)
      FROM (
        SELECT s.name, COUNT(a.id) AS c
        FROM public.assets a JOIN public.sites s ON s.id = a.current_site_id
        GROUP BY s.name ORDER BY COUNT(a.id) DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'daily_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', t.day, 'value', t.c) ORDER BY t.day)
      FROM (
        SELECT to_char((m.occurred_at AT TIME ZONE 'America/Mexico_City')::date, 'YYYY-MM-DD') AS day,
               COUNT(*) AS c
        FROM public.movements m
        WHERE m.occurred_at BETWEEN p_from AND p_to
        GROUP BY 1
      ) t
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_movements(timestamptz, timestamptz, text, uuid, text, text, uuid, boolean, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.report_inventory(uuid, text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.site_asset_counts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_metrics(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_movements(timestamptz, timestamptz, text, uuid, text, text, uuid, boolean, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_inventory(uuid, text, text, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.site_asset_counts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(timestamptz, timestamptz) TO authenticated, service_role;