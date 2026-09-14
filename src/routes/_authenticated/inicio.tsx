import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Wifi, WifiOff, ScanLine, Package, FileText, Plus, Loader2 } from "lucide-react";

import { currentUserQuery } from "@/modules/auth/queries";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { recentAssetActivityQuery } from "@/modules/assets/queries";
import { ACTION_LABEL, recentMovementsQuery } from "@/modules/movements/queries";
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

function RecentActivity() {
  const altasQ = useQuery(recentAssetActivityQuery);
  const movimientosQ = useQuery(recentMovementsQuery);

  if (altasQ.isPending || movimientosQ.isPending) {
    return (
      <div className="mt-4 flex justify-center rounded-lg border border-dashed border-border py-10">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (altasQ.isError || movimientosQ.isError) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-destructive">
        No fue posible cargar la actividad reciente.
      </p>
    );
  }

  type Entry = {
    key: string;
    label: string;
    assetId: string;
    assetNumber: string;
    site: string;
    user: string;
    at: string;
  };

  const entries: Entry[] = [
    ...(altasQ.data ?? []).map((asset) => ({
      key: `alta-${asset.id}`,
      label: "Alta",
      assetId: asset.id,
      assetNumber: asset.asset_number,
      site: asset.site?.name ?? "Sitio sin nombre",
      user: asset.created_by_email ?? "—",
      at: asset.created_at,
    })),
    ...(movimientosQ.data ?? []).map((m) => ({
      key: `mov-${m.id}`,
      label: ACTION_LABEL[m.action],
      assetId: m.asset_id,
      assetNumber: m.asset_number,
      site: m.site_name,
      user: m.performed_by_email ?? "—",
      at: m.occurred_at,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Sin actividad registrada todavía.
      </div>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              <span className="mr-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                {entry.label}
              </span>
              <Link
                to="/activos/$assetId"
                params={{ assetId: entry.assetId }}
                className="underline-offset-4 hover:underline"
              >
                {entry.assetNumber}
              </Link>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {entry.site} · {entry.user}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function InicioPage() {
  const { data: user } = useSuspenseQuery(currentUserQuery);
  const { sites, selectedSite, selectSite } = useSelectedSite();
  const online = useOnline();
  const [creating, setCreating] = useState(false);

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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-3 rounded-lg border border-foreground bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nuevo activo
          </button>
          <Link
            to="/escanear"
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ScanLine className="h-4 w-4" />
            Escanear activo
          </Link>
          <Link
            to="/movimientos"
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Package className="h-4 w-4" />
            Ver movimientos
          </Link>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Generar reporte
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Para registrar entrada, salida o inventario, escanea o busca el activo.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Actividad reciente</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/activos">Ver catálogo</Link>
          </Button>
        </div>
        <RecentActivity />
      </section>

      <NewAssetDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
