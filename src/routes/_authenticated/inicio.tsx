import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Wifi, WifiOff, ScanLine, Package, FileText, Plus, Loader2 } from "lucide-react";

import { currentUserQuery } from "@/modules/auth/queries";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { recentAssetActivityQuery } from "@/modules/assets/queries";
import { NewAssetDialog } from "@/modules/assets/NewAssetDialog";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — GTAC Trazabilidad de Activos" },
      { name: "description", content: "Resumen de tus sitios asignados en GTAC." },
      { property: "og:title", content: "Inicio — GTAC Trazabilidad de Activos" },
      { property: "og:description", content: "Resumen de tus sitios asignados en GTAC." },
    ],
  }),
  component: InicioPage,
});

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

const QUICK_ACTIONS = [
  { label: "Escanear activo", icon: ScanLine },
  { label: "Registrar movimiento", icon: Package },
  { label: "Generar reporte", icon: FileText },
];

function RecentActivity() {
  const activityQ = useQuery(recentAssetActivityQuery);

  if (activityQ.isPending) {
    return (
      <div className="mt-4 flex justify-center rounded-lg border border-dashed border-border py-10">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activityQ.isError) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-destructive">
        No fue posible cargar la actividad reciente.
      </p>
    );
  }

  const rows = activityQ.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Sin actividad registrada todavía.
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-border">
      {rows.map((asset) => (
        <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              <span className="mr-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                Alta
              </span>
              <Link
                to="/activos/$assetId"
                params={{ assetId: asset.id }}
                className="underline-offset-4 hover:underline"
              >
                {asset.asset_number}
              </Link>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {asset.site?.name ?? "Sitio sin nombre"} · {asset.created_by_email ?? "—"}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{formatDateTime(asset.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function InicioPage() {
  const { data: user } = useSuspenseQuery(currentUserQuery);
  const { sites, selectedSite, selectSite } = useSelectedSite();
  const online = useOnline();

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.fullName ?? user?.email ?? ""}`}
        description="Bienvenido a GTAC — Trazabilidad de Activos."
        action={
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium",
              online ? "text-foreground" : "text-destructive",
            )}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "En línea" : "Sin conexión"}
          </span>
        }
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Mis sitios</h2>
        {sites.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no tienes sitios asignados. Contacta al administrador.
          </p>
        ) : (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {sites.map((site) => {
              const active = selectedSite?.id === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => selectSite(site.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {site.name}
                </button>
              );
            })}
          </div>
        )}

        {selectedSite && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted px-4 py-3">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Sitio seleccionado: {selectedSite.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedSite.code ? `Código ${selectedSite.code}` : "Sin código"} ·{" "}
                {selectedSite.active ? "Activo" : "Inactivo"}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Acciones rápidas</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Estas acciones se habilitarán en las siguientes fases.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <div
              key={action.label}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Actividad reciente</h2>
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Sin actividad registrada todavía.
        </div>
      </section>
    </>
  );
}
