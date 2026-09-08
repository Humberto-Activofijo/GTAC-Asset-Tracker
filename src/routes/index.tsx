import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "GTAC — Trazabilidad de Activos" },
      {
        name: "description",
        content:
          "Plataforma interna GTAC para administrar y dar seguimiento a activos fijos en sitios de telecomunicaciones.",
      },
      { property: "og:title", content: "GTAC — Trazabilidad de Activos" },
      {
        property: "og:description",
        content:
          "Plataforma interna GTAC para administrar y dar seguimiento a activos fijos en sitios de telecomunicaciones.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/inicio" : "/auth" });
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});
