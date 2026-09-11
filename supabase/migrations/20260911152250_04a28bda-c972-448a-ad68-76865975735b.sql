ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS sites_name_unique ON public.sites (name);

CREATE TABLE IF NOT EXISTS public.pending_engineers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  active boolean NOT NULL DEFAULT true,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_engineers_email_unique ON public.pending_engineers (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_engineers TO authenticated;
GRANT ALL ON public.pending_engineers TO service_role;
ALTER TABLE public.pending_engineers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_engineers_select_admin" ON public.pending_engineers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineers_insert_admin" ON public.pending_engineers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineers_update_admin" ON public.pending_engineers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineers_delete_admin" ON public.pending_engineers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.pending_engineer_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_engineer_id uuid NOT NULL REFERENCES public.pending_engineers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pending_engineer_id, site_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_engineer_sites TO authenticated;
GRANT ALL ON public.pending_engineer_sites TO service_role;
ALTER TABLE public.pending_engineer_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_engineer_sites_select_admin" ON public.pending_engineer_sites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineer_sites_insert_admin" ON public.pending_engineer_sites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineer_sites_update_admin" ON public.pending_engineer_sites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pending_engineer_sites_delete_admin" ON public.pending_engineer_sites FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pending_engineers_set_updated_at BEFORE UPDATE ON public.pending_engineers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();