import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Site = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

/** Sitios visibles para la sesión actual (RLS decide: admin todos, ingeniero los asignados). */
export const visibleSitesQuery = queryOptions({
  queryKey: ["sites", "visible"],
  queryFn: async (): Promise<Site[]> => {
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, code, active, latitude, longitude, created_at, updated_at")
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as Site[];
  },
});

export type Assignment = {
  id: string;
  engineer_id: string;
  site_id: string;
  active: boolean;
};

export const assignmentsQuery = queryOptions({
  queryKey: ["engineer-sites"],
  queryFn: async (): Promise<Assignment[]> => {
    const { data, error } = await supabase
      .from("engineer_sites")
      .select("id, engineer_id, site_id, active")
      .limit(2000);
    if (error) throw error;
    return (data ?? []) as Assignment[];
  },
});

export type EngineerProfile = {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
};

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: async (): Promise<EngineerProfile[]> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, active, created_at")
      .order("email", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as EngineerProfile[];
  },
});

export const rolesQuery = queryOptions({
  queryKey: ["user-roles"],
  queryFn: async (): Promise<{ user_id: string; role: string }[]> => {
    const { data, error } = await supabase.from("user_roles").select("user_id, role").limit(1000);
    if (error) throw error;
    return data ?? [];
  },
});
