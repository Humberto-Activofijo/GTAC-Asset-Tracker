CREATE OR REPLACE FUNCTION public.export_movements_page(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _action text DEFAULT NULL,
  _site_id uuid DEFAULT NULL,
  _asset_number text DEFAULT NULL,
  _condition text DEFAULT NULL,
  _user_id uuid DEFAULT NULL,
  _omission boolean DEFAULT NULL,
  _limit integer DEFAULT 1000,
  _after_occurred_at timestamptz DEFAULT NULL,
  _after_row_id uuid DEFAULT NULL
)
RETURNS TABLE (
  row_id uuid,
  occurred_at timestamptz,
  asset_number text,
  serial_number text,
  model text,
  action text,
  site_name text,
  user_email text,
  condition text,
  notes text,
  protocol_omission boolean,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH is_admin AS (SELECT public.has_role(auth.uid(), 'admin'::app_role) AS v),
  unified AS (
    SELECT m.id AS row_id, m.occurred_at, m.asset_number, a.serial_number, a.model,
           m.action::text AS action, m.site_id, m.site_name,
           COALESCE(m.performed_by_email, p.email) AS user_email,
           m.condition::text AS condition, m.notes, m.protocol_omission,
           m.latitude, m.longitude, m.performed_by AS user_id
    FROM public.movements m
    JOIN public.assets a ON a.id = m.asset_id
    LEFT JOIN public.profiles p ON p.id = m.performed_by
    WHERE (SELECT v FROM is_admin)
       OR public.is_assigned_site(auth.uid(), m.site_id)
       OR (m.previous_site_id IS NOT NULL AND public.is_assigned_site(auth.uid(), m.previous_site_id))
    UNION ALL
    SELECT a.id, a.created_at, a.asset_number, a.serial_number, a.model, 'ALTA'::text,
           a.current_site_id, s.name, COALESCE(a.created_by_email, p.email),
           a.condition::text, NULL::text, false, NULL::double precision, NULL::double precision,
           a.created_by
    FROM public.assets a
    JOIN public.sites s ON s.id = a.current_site_id
    LEFT JOIN public.profiles p ON p.id = a.created_by
    WHERE (SELECT v FROM is_admin) OR public.is_assigned_site(auth.uid(), a.current_site_id)
  )
  SELECT u.row_id, u.occurred_at, u.asset_number, u.serial_number, u.model, u.action,
         u.site_name, u.user_email, u.condition, u.notes, u.protocol_omission,
         u.latitude, u.longitude
  FROM unified u
  WHERE (_from IS NULL OR u.occurred_at >= _from)
    AND (_to IS NULL OR u.occurred_at <= _to)
    AND (_action IS NULL OR u.action = _action)
    AND (_site_id IS NULL OR u.site_id = _site_id)
    AND (_asset_number IS NULL OR u.asset_number ILIKE '%' || _asset_number || '%'
         OR COALESCE(u.serial_number, '') ILIKE '%' || _asset_number || '%')
    AND (_condition IS NULL OR u.condition = _condition)
    AND (_user_id IS NULL OR u.user_id = _user_id)
    AND (_omission IS NULL OR u.protocol_omission = _omission)
    AND (
      _after_occurred_at IS NULL
      OR (u.occurred_at, u.row_id) < (_after_occurred_at, _after_row_id)
    )
  ORDER BY u.occurred_at DESC, u.row_id DESC
  LIMIT GREATEST(COALESCE(_limit, 1000), 1);
$$;

CREATE OR REPLACE FUNCTION public.export_inventory_page(
  _site_id uuid DEFAULT NULL,
  _condition text DEFAULT NULL,
  _status text DEFAULT NULL,
  _asset_number text DEFAULT NULL,
  _serial_number text DEFAULT NULL,
  _model text DEFAULT NULL,
  _limit integer DEFAULT 1000,
  _after_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  site_name text,
  asset_number text,
  serial_number text,
  model text,
  category text,
  condition text,
  status text,
  last_movement_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, s.name, a.asset_number, a.serial_number, a.model, a.category,
         a.condition::text, a.status::text, a.last_movement_at, a.created_at
  FROM public.assets a
  JOIN public.sites s ON s.id = a.current_site_id
  WHERE (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.is_assigned_site(auth.uid(), a.current_site_id))
    AND (_site_id IS NULL OR a.current_site_id = _site_id)
    AND (_condition IS NULL OR a.condition::text = _condition)
    AND (_status IS NULL OR a.status::text = _status)
    AND (_asset_number IS NULL OR a.asset_number ILIKE '%' || _asset_number || '%')
    AND (_serial_number IS NULL OR COALESCE(a.serial_number, '') ILIKE '%' || _serial_number || '%')
    AND (_model IS NULL OR COALESCE(a.model, '') ILIKE '%' || _model || '%')
    AND (_after_id IS NULL OR a.id > _after_id)
  ORDER BY a.id
  LIMIT GREATEST(COALESCE(_limit, 1000), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.export_movements_page(timestamptz, timestamptz, text, uuid, text, text, uuid, boolean, integer, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.export_inventory_page(uuid, text, text, text, text, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_movements_page(timestamptz, timestamptz, text, uuid, text, text, uuid, boolean, integer, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.export_inventory_page(uuid, text, text, text, text, text, integer, uuid) TO authenticated, service_role;