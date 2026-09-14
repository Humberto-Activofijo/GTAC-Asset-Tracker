import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import {
  ASSET_CONDITIONS,
  CONDITION_LABEL,
  STATUS_LABEL,
  assetsListQuery,
} from "@/modules/assets/queries";
import { NewAssetDialog } from "@/modules/assets/NewAssetDialog";
import { useSelectedSite } from "@/modules/sites/SelectedSiteContext";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;
const ALL = "__all__";

type AssetsSearch = { page: number; q: string; site: string; condition: string };

export const Route = createFileRoute("/_authenticated/activos/")({
  validateSearch: (search: Record<string, unknown>): AssetsSearch => ({
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
    q: typeof search["q"] === "string" ? search["q"] : "",
    site: typeof search["site"] === "string" ? search["site"] : "",
    condition: typeof search["condition"] === "string" ? search["condition"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Activos — GTAC" },
      { name: "description", content: "Catálogo de activos fijos registrados en los sitios GTAC." },
      { property: "og:title", content: "Activos — GTAC" },
      {
        property: "og:description",
        content: "Catálogo de activos fijos registrados en los sitios GTAC.",
      },
    ],
  }),
  component: ActivosPage,
});

function ActivosPage() {
  const navigate = useNavigate({ from: "/activos/" });
  const { page, q, site, condition } = Route.useSearch();
  const { sites } = useSelectedSite();
  const [term, setTerm] = useState(q);
  const [creating, setCreating] = useState(false);

  const listQ = useQuery(
    assetsListQuery({ page, pageSize: PAGE_SIZE, q, siteId: site, condition }),
  );

  const total = listQ.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setSearch(patch: Partial<AssetsSearch>) {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...patch }) });
  }

  return (
    <>
      <PageHeader
        title="Activos"
        description="Catálogo de activos fijos por sitio."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo activo
          </Button>
        }
      />

      <section className="rounded-xl border border-border bg-card p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch({ q: term });
          }}
        >
          <div className="min-w-[220px] flex-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="buscar">
              Buscar por número de activo o serie
            </label>
            <div className="mt-1 flex gap-2">
              <Input
                id="buscar"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Número de activo o número de serie"
              />
              <Button type="submit" variant="outline" aria-label="Buscar">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="w-56">
            <label className="text-xs font-medium text-muted-foreground">Sitio</label>
            <Select
              value={site === "" ? ALL : site}
              onValueChange={(v) => setSearch({ site: v === ALL ? "" : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos los sitios" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL}>Todos los sitios</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <label className="text-xs font-medium text-muted-foreground">Condición</label>
            <Select
              value={condition === "" ? ALL : condition}
              onValueChange={(v) => setSearch({ condition: v === ALL ? "" : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas" />
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
        </form>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {listQ.isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : listQ.isError ? (
          <div className="px-6 py-12 text-center text-sm text-destructive">
            No fue posible cargar los activos. {(listQ.error as Error).message}
          </div>
        ) : total === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No hay activos que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Serie</th>
                  <th className="px-4 py-3 font-medium">Modelo</th>
                  <th className="px-4 py-3 font-medium">Condición</th>
                  <th className="px-4 py-3 font-medium">Sitio actual</th>
                  <th className="px-4 py-3 font-medium">Estatus</th>
                  <th className="px-4 py-3 font-medium">Fecha de alta</th>
                </tr>
              </thead>
              <tbody>
                {listQ.data?.rows.map((asset) => (
                  <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/activos/$assetId"
                        params={{ assetId: asset.id }}
                        className="underline-offset-4 hover:underline"
                      >
                        {asset.asset_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.serial_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.model ?? "—"}</td>
                    <td className="px-4 py-3">{CONDITION_LABEL[asset.condition]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{asset.site?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {STATUS_LABEL[asset.status] ?? asset.status}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(asset.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {total.toLocaleString("es-MX")} activo{total === 1 ? "" : "s"} · página {page} de{" "}
            {lastPage}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => void navigate({ search: (p) => ({ ...p, page: page - 1 }) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => void navigate({ search: (p) => ({ ...p, page: page + 1 }) })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <NewAssetDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
