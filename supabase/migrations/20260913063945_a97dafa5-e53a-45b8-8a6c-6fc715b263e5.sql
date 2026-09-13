CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.asset_condition AS ENUM ('ACTIVO', 'DESCONECTADO', 'DANADO');
CREATE TYPE public.asset_status AS ENUM ('EN_SITIO');

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number text NOT NULL,
  serial_number text,
  model text,
  category text,
  condition public.asset_condition NOT NULL DEFAULT 'ACTIVO',
  status public.asset_status NOT NULL DEFAULT 'EN_SITIO',
  current_site_id uuid NOT NULL REFERENCES public.sites(id),
  photo_url text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_movement_at timestamptz,
  CONSTRAINT assets_asset_number_not_blank CHECK (btrim(asset_number) <> '')
);

CREATE UNIQUE INDEX assets_asset_number_unique ON public.assets (upper(btrim(asset_number)));
CREATE INDEX assets_serial_number_idx ON public.assets (upper(btrim(serial_number)));
CREATE INDEX assets_current_site_id_idx ON public.assets (current_site_id);
CREATE INDEX assets_condition_idx ON public.assets (condition);
CREATE INDEX assets_created_at_idx ON public.assets (created_at DESC);
CREATE INDEX assets_created_by_idx ON public.assets (created_by);
CREATE INDEX assets_asset_number_trgm_idx ON public.assets USING gin (asset_number gin_trgm_ops);
CREATE INDEX assets_serial_number_trgm_idx ON public.assets USING gin (serial_number gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_assigned_site(_user_id uuid, _site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.engineer_sites es
    WHERE es.engineer_id = _user_id AND es.site_id = _site_id AND es.active
  )
$$;

CREATE POLICY assets_select_admin ON public.assets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY assets_select_assigned ON public.assets
  FOR SELECT TO authenticated
  USING (public.is_assigned_site(auth.uid(), current_site_id));

CREATE POLICY assets_insert_admin ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY assets_insert_assigned ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'EN_SITIO'::asset_status
    AND public.is_assigned_site(auth.uid(), current_site_id)
  );

CREATE POLICY assets_update_admin ON public.assets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY assets_delete_admin ON public.assets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER assets_set_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assets_stamp_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_at = now();
  NEW.updated_at = now();
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  SELECT u.email INTO NEW.created_by_email FROM auth.users u WHERE u.id = NEW.created_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assets_stamp_creator_trigger
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.assets_stamp_creator();