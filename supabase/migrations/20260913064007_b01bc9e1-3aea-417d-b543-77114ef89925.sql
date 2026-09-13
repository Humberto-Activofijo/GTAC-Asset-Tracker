REVOKE ALL ON FUNCTION public.assets_stamp_creator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_assigned_site(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_site(uuid, uuid) TO authenticated;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;