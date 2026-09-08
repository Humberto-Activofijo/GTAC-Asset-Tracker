import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "engineer";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  active: boolean;
  role: AppRole | null;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const userId = userData.user.id;

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, active").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError) throw profileError;
  if (rolesError) throw rolesError;
  if (!profile) return null;

  const roleValues = (roles ?? []).map((r) => r.role as AppRole);
  const role: AppRole | null = roleValues.includes("admin")
    ? "admin"
    : roleValues.includes("engineer")
      ? "engineer"
      : null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    active: profile.active,
    role,
  };
}

export const currentUserQuery = queryOptions({
  queryKey: ["current-user"],
  queryFn: fetchCurrentUser,
  staleTime: 60_000,
});
