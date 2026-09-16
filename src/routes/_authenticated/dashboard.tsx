import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { alertsDashboardQuery } from "@/modules/alerts/queries";
import { TransitCheckButton } from "@/modules/alerts/TransitCheckButton";
import { currentUserQuery } from "@/modules/auth/queries";
import { PageHeader } from "@/modules/layout/PageHeader";
import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GTAC" },
      {
        name: "description",
        content: "Indicadores administrativos de alertas y activos en tránsito.",
      },
      { property: "og:title", content: "Dashboard — GTAC" },
      {
        property: "og:description",
        content: "Indicadores administrativos de alertas y activos en tránsito.",
      },
    ],
  }),
  component: DashboardPage,
});

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function DashboardPage() {
  const userQ = useQuery(currentUserQuery);
  const isAdmin = userQ.data?.role === "admin";
  const statsQ = useQuery(alertsDashboardQuery(isAdmin));

  if (userQ.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <ModuleInDevelopment title="Dashboard" />;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Indicadores administrativos de alertas y tránsitos."
        action={<TransitCheckButton variant="outline" />}
      />

      {statsQ.isError ? (
        <p className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-destructive">
          No fue posible cargar los indicadores.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Alertas abiertas" value={statsQ.data?.open_alerts} />
          <Metric label="Tránsito +48h" value={statsQ.data?.transit_48h} />
          <Metric label="Omisiones de protocolo" value={statsQ.data?.protocol_omissions} />
          <Metric label="Activos en tránsito" value={statsQ.data?.assets_in_transit} />
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Consulta el detalle en{" "}
        <Link to="/admin/alertas" className="underline underline-offset-4">
          Alertas
        </Link>
        .
      </p>
    </>
  );
}
