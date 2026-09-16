REVOKE EXECUTE ON FUNCTION public.run_transit_48h_check() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_alerts(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_transit_48h_check() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_alerts(text, integer, integer) TO authenticated, service_role;