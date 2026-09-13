CREATE POLICY "asset_photos_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'asset-photos');

CREATE POLICY "asset_photos_insert_scoped" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'asset-photos'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_assigned_site(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    )
  );

CREATE POLICY "asset_photos_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-photos' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'asset-photos' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "asset_photos_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'asset-photos' AND public.has_role(auth.uid(), 'admin'::app_role));