import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

import { CONDITION_LABEL, STATUS_LABEL, getPhotoSignedUrl, type AssetRow } from "./queries";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

/** Ficha compacta del activo identificado. No permite cambiar el sitio actual. */
export function AssetSummaryCard({ asset, siteName }: { asset: AssetRow; siteName: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoPath = asset.photo_url;

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) {
      setPhotoUrl(null);
      return;
    }
    void getPhotoSignedUrl(photoPath).then((url) => {
      if (!cancelled) setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Activo identificado</p>
          <h2 className="text-lg font-semibold text-foreground">{asset.asset_number}</h2>
        </div>
        <Button asChild variant="outline" className="h-12">
          <Link to="/activos/$assetId" params={{ assetId: asset.id }}>
            Ver ficha completa
          </Link>
        </Button>
      </div>

      <div className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
        Sitio seleccionado para la operación: <span className="font-semibold">{siteName}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Número de activo" value={asset.asset_number} />
        <Field label="Número de serie" value={asset.serial_number ?? "—"} />
        <Field label="Modelo" value={asset.model ?? "—"} />
        <Field label="Condición" value={CONDITION_LABEL[asset.condition]} />
        <Field label="Estatus" value={STATUS_LABEL[asset.status] ?? asset.status} />
        <Field label="Sitio actual del activo" value={asset.site?.name ?? "—"} />
        <Field
          label="Último movimiento"
          value={asset.last_movement_at ? formatDateTime(asset.last_movement_at) : "Sin movimientos"}
        />
        <Field label="Fecha de alta" value={formatDateTime(asset.created_at)} />
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Fotografía</p>
        {asset.photo_url ? (
          photoUrl ? (
            <img
              src={photoUrl}
              alt={`Fotografía del activo ${asset.asset_number}`}
              className="mt-2 w-full max-w-sm rounded-lg border border-border object-cover"
              loading="lazy"
            />
          ) : (
            <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-border py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Sin fotografía registrada.
          </p>
        )}
      </div>
    </section>
  );
}
