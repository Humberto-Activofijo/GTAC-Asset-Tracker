import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import {
  ACTION_LABEL,
  MOVEMENT_ACTIONS,
  movementsListQuery,
} from "@/modules/movements/queries";
import { CONDITION_LABEL } from "@/modules/assets/queries";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;
const ALL = "__all__";

type MovementsSearch = {
  page?: number;
  action?: string;
  site?: string;
  from?: string;
  to?: string;
  q?: string;
};

export const Route = createFileRoute("/_authenticated/movimientos")({
  validateSearch: (search: Record<string, unknown>): MovementsSearch => ({
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
    action: typeof search["action"] === "string" ? search["action"] : "",
    site: typeof search["site"] === "string" ? search["site"] : "",
    from: typeof search["from"] === "string" ? search["from"] : "",
    to: typeof search["to"] === "string" ? search["to"] : "",
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Movimientos — GTAC" },
      {
        name: "description",
        content: "Historial de entradas, salidas e inventarios de activos por sitio.",
      },
      { property: "og:title", content: "Movimientos — GTAC" },
      {
        property: "og:description",
        content: "Historial de entradas, salidas e inventarios de activos por sitio.",
      },
    ],
  }),
  component: MovimientosPage,
});

function MovimientosPage() {
  const navigate = useNavigate({ from: "/movimientos" });
  const { page = 1, action = "", site = "", from = "", to = "", q = "" } = Route.useSearch();
  const { sites } = useSelectedSite();
  const [term, setTerm] = useState(q);

  const listQ = useQuery(
    movementsListQuery({ page, pageSize: PAGE_SIZE, action, siteId: site, from, to, q }),
  );

  const total = listQ.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setSearch(patch: Partial<MovementsSearch>) {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }) });
  }

  return (
    <>
      <PageHeader
        title="Movimientos"
        description="Entradas, salidas e inventarios registrados en tus sitios."
      />

      <section className="rounded-xl border border-border bg-card p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch({ q: term });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="mov-q" className="text-xs">
              Activo
            </Label>
            <div className="flex gap-2">
              <Input
                id="mov-q"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Número de activo"
              />
              <Button type="submit" variant="outline" aria-label="Buscar">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Acción</Label>
            <Select
              value={action || ALL}
              onValueChange={(v) => setSearch({ action: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {MOVEMENT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sitio</Label>
            <Select
              value={site || ALL}
              onValueChange={(v) => setSearch({ site: v === ALL ? "" : v })}
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
            <Label htmlFor="mov-from" className="text-xs">
              Desde
            </Label>
            <Input
              id="mov-from"
              type="date"
              value={from}
              onChange={(e) => setSearch({ from: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="mov-to" className="text-xs">
              Hasta
            </Label>
            <Input
              id="mov-to"
              type="date"
              value={to}
              onChange={(e) => setSearch({ to: e.target.value })}
            />
          </div>
        </form>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {listQ.isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : listQ.isError ? (
          <p className="px-6 py-16 text-center text-sm text-destructive">
            No fue posible cargar los movimientos.
          </p>
        ) : (listQ.data?.rows.length ?? 0) === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay movimientos con estos filtros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Activo</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Sitio</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Condición</th>
                  <th className="px-4 py-3 font-medium">Omisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listQ.data?.rows.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(m.occurred_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/activos/$assetId"
                        params={{ assetId: m.asset_id }}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {m.asset_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{ACTION_LABEL[m.action]}</td>
                    <td className="px-4 py-3">{m.site_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.performed_by_email ?? "—"}
                    </td>
                    <td className="px-4 py-3">{CONDITION_LABEL[m.condition]}</td>
                    <td className="px-4 py-3">
                      {m.protocol_omission ? (
                        <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total} movimiento{total === 1 ? "" : "s"} · página {page} de {lastPage}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </>
  );
}
