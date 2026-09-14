CREATE INDEX IF NOT EXISTS assets_serial_exact_idx ON public.assets (upper(btrim(serial_number)));

CREATE OR REPLACE FUNCTION public.lookup_asset_for_scan(_code text)
RETURNS TABLE (
  id uuid,
  asset_number text,
  serial_number text,
  model text,
  condition public.asset_condition,
  status public.asset_status,
  current_site_id uuid,
  current_site_name text,
  last_movement_at timestamptz,
  photo_url text,
  matched_by text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.active) THEN
    RAISE EXCEPTION 'Perfil inactivo' USING ERRCODE = '42501';
  END IF;

  v_code := upper(btrim(regexp_replace(coalesce(_code, ''), '\s+', ' ', 'g')));
  IF v_code = '' OR length(v_code) > 128 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, a.asset_number, a.serial_number, a.model, a.condition, a.status,
         a.current_site_id, s.name, a.last_movement_at, a.photo_url, 'asset_number'::text
  FROM public.assets a
  JOIN public.sites s ON s.id = a.current_site_id
  WHERE upper(btrim(a.asset_number)) = v_code
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, a.asset_number, a.serial_number, a.model, a.condition, a.status,
         a.current_site_id, s.name, a.last_movement_at, a.photo_url, 'serial_number'::text
  FROM public.assets a
  JOIN public.sites s ON s.id = a.current_site_id
  WHERE a.serial_number IS NOT NULL AND upper(btrim(a.serial_number)) = v_code
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_asset_for_scan(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_asset_for_scan(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_asset_for_scan(text) TO authenticated;