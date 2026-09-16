import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { CONDITION_LABEL, STATUS_LABEL } from "@/modules/assets/queries";
import { inventoryReportQuery, siteAssetCountsQuery } from "@/modules/reports/queries";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 20;

/** Activos actuales de un sitio, paginados en el servidor. */
export function SiteAssetsDialog({
  site,
  onClose,
}: {
  site: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const countsQ = useQuery(siteAssetCountsQuery(site?.id ?? null));
  const listQ = useQuery({
    ...inventoryReportQuery({ siteId: site?.id ?? "" }, page, PAGE_SIZE),
    enabled: Boolean(site),
  });

  const total = listQ.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog
      open={site !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPage(1);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Activos de {site?.name}</DialogTitle>
          <DialogDescription>Inventario actual registrado en este sitio.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Total", countsQ.data?.total],
            ["Activos", countsQ.data?.activos],
            ["Desconectados", countsQ.data?.desconectados],
            ["Dañados", countsQ.data?.danados],
            ["En tránsito", countsQ.data?.en_transito],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
          {listQ.isPending ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (listQ.data?.rows.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Este sitio no tiene activos registrados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Activo</th>
                  <th className="px-3 py-2 font-medium">Serie</th>
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 font-medium">Condición</th>
                  <th className="px-3 py-2 font-medium">Estatus</th>
                  <th className="px-3 py-2 font-medium">Último movimiento</th>
                </tr>
              </thead>
              <tbody>
                {listQ.data?.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{r.asset_number}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.serial_number ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.model ?? "—"}</td>
                    <td className="px-3 py-2">
                      {CONDITION_LABEL[r.condition as keyof typeof CONDITION_LABEL] ?? r.condition}
                    </td>
                    <td className="px-3 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateTime(r.last_movement_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} activo{total === 1 ? "" : "s"} · página {page} de {lastPage}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
