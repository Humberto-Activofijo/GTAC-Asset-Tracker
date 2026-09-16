DROP POLICY IF EXISTS asset_photos_select_auth ON storage.objects;

CREATE POLICY asset_photos_select_scoped
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'asset-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_assigned_site(
         auth.uid(),
         (NULLIF((storage.foldername(name))[1], ''))::uuid
       )
  )
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assets_stamp_creator() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.alerts_on_protocol_omission() FROM PUBLIC, anon, authenticated;