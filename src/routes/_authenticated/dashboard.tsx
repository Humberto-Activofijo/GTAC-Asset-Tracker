import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TransitCheckButton } from "@/modules/alerts/TransitCheckButton";
import { currentUserQuery } from "@/modules/auth/queries";
import { dashboardMetricsQuery } from "@/modules/reports/queries";
import { PageHeader } from "@/modules/layout/PageHeader";
import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GTAC" },
      {
        name: "description",
        content: "Indicadores operativos de activos, movimientos y alertas por periodo.",
      },
      { property: "og:title", content: "Dashboard — GTAC" },
      {
        property: "og:description",
        content: "Indicadores operativos de activos, movimientos y alertas por periodo.",
      },
    ],
  }),
  component: DashboardPage,
});

type Preset = "today" | "7d" | "30d" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "custom", label: "Rango personalizado" },
];

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-medium text-foreground">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const PIE_COLORS = ["hsl(var(--foreground))", "hsl(var(--muted-foreground))", "hsl(var(--border))"];

/** El rango se calcula en horario de CDMX y se envía como marca de tiempo. */
function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  const todayCdmx = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  if (preset === "custom") {
    const from = customFrom || todayCdmx;
    const to = customTo || todayCdmx;
    return { from: `${from}T00:00:00-06:00`, to: `${to}T23:59:59-06:00` };
  }
  if (preset === "today") {
    return { from: `${todayCdmx}T00:00:00-06:00`, to: `${todayCdmx}T23:59:59-06:00` };
  }
  const days = preset === "7d" ? 7 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: now.toISOString() };
}

function DashboardPage() {
  const userQ = useQuery(currentUserQuery);
  const isAdmin = userQ.data?.role === "admin";

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () => rangeFor(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const statsQ = useQuery(dashboardMetricsQuery(range.from, range.to, isAdmin));
  const data = statsQ.data;

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
        description="Indicadores operativos de activos, movimientos y alertas."
        action={<TransitCheckButton variant="outline" />}
      />

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </section>

      {statsQ.isError ? (
        <p className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-destructive">
          No fue posible cargar los indicadores.
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Activos</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Total de activos" value={data?.total_assets} />
              <Metric label="En sitio" value={data?.assets_on_site} />
              <Metric label="En tránsito" value={data?.assets_in_transit} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Condición</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Activos" value={data?.condition_active} />
              <Metric label="Desconectados" value={data?.condition_disconnected} />
              <Metric label="Dañados" value={data?.condition_damaged} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Actividad del periodo</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Entradas" value={data?.period_entradas} />
              <Metric label="Salidas" value={data?.period_salidas} />
              <Metric label="Inventarios" value={data?.period_inventarios} />
              <Metric label="Altas" value={data?.period_altas} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Alertas</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Alertas abiertas" value={data?.open_alerts} />
              <Metric label="Tránsito +48h" value={data?.transit_48h} />
              <Metric label="Omisiones de protocolo" value={data?.protocol_omissions} />
              <Metric label="Activos en tránsito" value={data?.assets_in_transit} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Movimientos por tipo (periodo)">
              <BarChart data={data?.movements_by_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="currentColor" className="text-foreground" />
              </BarChart>
            </ChartCard>

            <ChartCard title="Activos por condición">
              <PieChart>
                <Tooltip />
                <Pie
                  data={data?.assets_by_condition ?? []}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {(data?.assets_by_condition ?? []).map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartCard>

            <ChartCard title="Activos por sitio (Top 10)">
              <BarChart data={data?.top_sites ?? []} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={10} />
                <Tooltip />
                <Bar dataKey="value" fill="currentColor" className="text-foreground" />
              </BarChart>
            </ChartCard>

            <ChartCard title="Actividad por día (periodo)">
              <LineChart data={data?.daily_activity ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="currentColor"
                  className="text-foreground"
                  dot={false}
                />
              </LineChart>
            </ChartCard>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Consulta el detalle en{" "}
        <Link to="/admin/alertas" className="underline underline-offset-4">
          Alertas
        </Link>{" "}
        o en{" "}
        <Link to="/admin/reportes" className="underline underline-offset-4">
          Reportes
        </Link>
        .
      </p>
    </>
  );
}
