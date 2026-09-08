import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { currentUserQuery } from "@/modules/auth/queries";
import { visibleSitesQuery } from "@/modules/sites/queries";
import { SelectedSiteProvider } from "@/modules/sites/SelectedSiteContext";
import { AppLayout } from "@/modules/layout/AppLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">No fue posible cargar la sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    </div>
  ),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: user } = useSuspenseQuery(currentUserQuery);
  const { data: sites } = useSuspenseQuery(visibleSitesQuery);

  if (!user || !user.active) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">Cuenta no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta está desactivada o no tiene un perfil válido. Contacta al administrador.
          </p>
          <Button
            className="mt-4"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SelectedSiteProvider sites={sites}>
      <AppLayout user={user}>
        <Outlet />
      </AppLayout>
    </SelectedSiteProvider>
  );
}
