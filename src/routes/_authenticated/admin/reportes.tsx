import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { currentUserQuery } from "@/modules/auth/queries";
import { visibleSitesQuery, profilesQuery } from "@/modules/sites/queries";
import { CONDITION_LABEL, STATUS_LABEL, ASSET_CONDITIONS } from "@/modules/assets/queries";
import {
  MOVEMENT_REPORT_ACTIONS,
  downloadReport,
  inventoryReportQuery,
  movementReportQuery,
} from "@/modules/reports/queries";
import type { InventoryReportFilters, MovementReportFilters } from "@/modules/reports/types";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;
const ALL = "__all__";

export const Route = createFileRoute("/_authenticated/admin/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — GTAC" },
      {
        name: "description",
        content: "Reportes de movimientos e inventario por sitio con exportación a Excel.",
      },
      { property: "og:title", content: "Reportes — GTAC" },
      {
        property: "og:description",
        content: "Reportes de movimientos e inventario por sitio con exportación a Excel.",
      },
    ],
  }),
  component: ReportesPage,
});

function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} registro{total === 1 ? "" : "s"} · página {page} de {lastPage}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

function ReportesPage() {
  const userQ = useQuery(currentUserQuery);
  const isAdmin = userQ.data?.role === "admin";
  const sitesQ = useQuery(visibleSitesQuery);
  const profilesQ = useQuery({ ...profilesQuery, enabled: isAdmin });

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Movimientos e inventario por sitio. La exportación es exclusiva de administradores."
      />

      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="inventario">Inventario por sitio</TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="mt-4">
          <MovementsReport
            isAdmin={isAdmin}
            sites={sitesQ.data ?? []}
            users={profilesQ.data ?? []}
          />
        </TabsContent>

        <TabsContent value="inventario" className="mt-4">
          <InventoryReport isAdmin={isAdmin} sites={sitesQ.data ?? []} />
        </TabsContent>
      </Tabs>
    </>
  );
}

type SiteOption = { id: string; name: string };

function ExportButton({
  kind,
  filters,
  label,
  disabled,
}: {
  kind: "movements" | "inventory";
  filters: MovementReportFilters | InventoryReportFilters;
  label: string;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (disabled) return null;
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await downloadReport(kind, filters);
          toast.success("Archivo generado.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No fue posible generar el archivo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando archivo…
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" /> {label}
        </>
      )}
    </Button>
  );
}

function MovementsReport({
  isAdmin,
  sites,
  users,
}: {
  isAdmin: boolean;
  sites: SiteOption[];
  users: { id: string; email: string }[];
}) {
  const [filters, setFilters] = useState<MovementReportFilters>({});
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const listQ = useQuery(movementReportQuery(filters, page, PAGE_SIZE));

  function patch(next: Partial<MovementReportFilters>) {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...next }));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ assetNumber: term });
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => patch({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => patch({ to: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acción</Label>
            <Select
              value={filters.action || ALL}
              onValueChange={(v) => patch({ action: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {MOVEMENT_REPORT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sitio</Label>
            <Select
              value={filters.siteId || ALL}
              onValueChange={(v) => patch({ siteId: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL}>Todos</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Activo o serie</Label>
            <div className="flex gap-2">
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Número o serie"
              />
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Condición</Label>
            <Select
              value={filters.condition || ALL}
              onValueChange={(v) => patch({ condition: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONDITION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">Usuario</Label>
              <Select
                value={filters.userId || ALL}
                onValueChange={(v) => patch({ userId: v === ALL ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Omisión de protocolo</Label>
            <Select
              value={filters.omission || ALL}
              onValueChange={(v) =>
                patch({ omission: v === ALL ? "" : (v as "yes" | "no") })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                <SelectItem value="yes">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
        <div className="mt-3 flex justify-end">
          <ExportButton
            kind="movements"
            filters={filters}
            label="Descargar movimientos (.xlsx)"
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {listQ.isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : listQ.isError ? (
          <p className="px-6 py-16 text-center text-sm text-destructive">
            No fue posible cargar el reporte.
          </p>
        ) : (listQ.data?.rows.length ?? 0) === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay movimientos con estos filtros.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Fecha/hora</th>
                    <th className="px-3 py-3 font-medium">Activo</th>
                    <th className="px-3 py-3 font-medium">Serie</th>
                    <th className="px-3 py-3 font-medium">Modelo</th>
                    <th className="px-3 py-3 font-medium">Acción</th>
                    <th className="px-3 py-3 font-medium">Sitio</th>
                    <th className="px-3 py-3 font-medium">Usuario</th>
                    <th className="px-3 py-3 font-medium">Condición</th>
                    <th className="px-3 py-3 font-medium">Estatus</th>
                    <th className="px-3 py-3 font-medium">Notas</th>
                    <th className="px-3 py-3 font-medium">Omisión</th>
                    <th className="px-3 py-3 font-medium">GPS</th>
                    <th className="px-3 py-3 font-medium">Evidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {listQ.data?.rows.map((r) => (
                    <tr key={`${r.action}-${r.row_id}`} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-2">{formatDateTime(r.occurred_at)}</td>
                      <td className="px-3 py-2 font-medium">{r.asset_number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.serial_number ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.model ?? "—"}</td>
                      <td className="px-3 py-2">{r.action}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.site_name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.user_email ?? "—"}</td>
                      <td className="px-3 py-2">
                        {CONDITION_LABEL[r.condition as keyof typeof CONDITION_LABEL] ?? r.condition}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {STATUS_LABEL[r.resulting_status] ?? r.resulting_status}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">
                        {r.notes ?? "—"}
                      </td>
                      <td className="px-3 py-2">{r.protocol_omission ? "Sí" : "No"}</td>
                      <td className="px-3 py-2">{r.has_gps ? "Sí" : "No"}</td>
                      <td className="px-3 py-2">{r.has_photo ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={listQ.data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}

function InventoryReport({ isAdmin, sites }: { isAdmin: boolean; sites: SiteOption[] }) {
  const [filters, setFilters] = useState<InventoryReportFilters>({});
  const [page, setPage] = useState(1);
  const listQ = useQuery(inventoryReportQuery(filters, page, PAGE_SIZE));

  function patch(next: Partial<InventoryReportFilters>) {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...next }));
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Sitio</Label>
            <Select
              value={filters.siteId || ALL}
              onValueChange={(v) => patch({ siteId: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL}>{isAdmin ? "Todos los sitios" : "Mis sitios"}</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Condición</Label>
            <Select
              value={filters.condition || ALL}
              onValueChange={(v) => patch({ condition: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {ASSET_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONDITION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estatus</Label>
            <Select
              value={filters.status || ALL}
              onValueChange={(v) => patch({ status: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="EN_SITIO">En sitio</SelectItem>
                <SelectItem value="EN_TRANSITO">En tránsito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Número de activo</Label>
            <Input
              value={filters.assetNumber ?? ""}
              onChange={(e) => patch({ assetNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Serie</Label>
            <Input
              value={filters.serialNumber ?? ""}
              onChange={(e) => patch({ serialNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modelo</Label>
            <Input
              value={filters.model ?? ""}
              onChange={(e) => patch({ model: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <ExportButton
            kind="inventory"
            filters={filters}
            label="Descargar inventario (.xlsx)"
            disabled={!isAdmin}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {listQ.isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : listQ.isError ? (
          <p className="px-6 py-16 text-center text-sm text-destructive">
            No fue posible cargar el inventario.
          </p>
        ) : (listQ.data?.rows.length ?? 0) === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay activos con estos filtros.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Sitio</th>
                    <th className="px-3 py-3 font-medium">Activo</th>
                    <th className="px-3 py-3 font-medium">Serie</th>
                    <th className="px-3 py-3 font-medium">Modelo</th>
                    <th className="px-3 py-3 font-medium">Categoría</th>
                    <th className="px-3 py-3 font-medium">Condición</th>
                    <th className="px-3 py-3 font-medium">Estatus</th>
                    <th className="px-3 py-3 font-medium">Último movimiento</th>
                    <th className="px-3 py-3 font-medium">Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {listQ.data?.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{r.site_name}</td>
                      <td className="px-3 py-2 font-medium">{r.asset_number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.serial_number ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.model ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                      <td className="px-3 py-2">
                        {CONDITION_LABEL[r.condition as keyof typeof CONDITION_LABEL] ?? r.condition}
                      </td>
                      <td className="px-3 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDateTime(r.last_movement_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={listQ.data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}
