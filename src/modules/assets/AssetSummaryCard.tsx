import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

import { CONDITION_LABEL, STATUS_LABEL, getPhotoSignedUrl } from "./queries";
import type { ScanAsset } from "./lookup";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

/**
 * Ficha compacta del activo identificado durante el escaneo.
 * No permite cambiar el sitio actual ni registrar movimientos.
 */
export function AssetSummaryCard({
  asset,
  siteName,
  canOpenDetail,
}: {
  asset: ScanAsset;
  siteName: string;
  /** Solo se enlaza la ficha completa cuando el activo está en un sitio del usuario. */
  canOpenDetail: boolean;
}) {
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

  const otherSite = !canOpenDetail;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Activo encontrado</p>
          <h2 className="text-lg font-semibold text-foreground">{asset.asset_number}</h2>
        </div>
        {canOpenDetail && (
          <Button asChild variant="outline" className="h-12">
            <Link to="/activos/$assetId" params={{ assetId: asset.id }}>
              Ver ficha completa
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
        <p>
          Ubicación actual: <span className="font-semibold">{asset.current_site_name}</span>
        </p>
        <p>
          Sitio seleccionado para esta operación: <span className="font-semibold">{siteName}</span>
        </p>
      </div>

      {otherSite && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Este activo está registrado en otro sitio. Por ahora solo se identifica: no se cambia su
          ubicación ni se registra ningún movimiento.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Número de activo" value={asset.asset_number} />
        <Field label="Número de serie" value={asset.serial_number ?? "—"} />
        <Field label="Modelo" value={asset.model ?? "—"} />
        <Field label="Condición" value={CONDITION_LABEL[asset.condition]} />
        <Field label="Estatus" value={STATUS_LABEL[asset.status] ?? asset.status} />
        <Field label="Sitio actual del activo" value={asset.current_site_name} />
        <Field
          label="Último movimiento"
          value={asset.last_movement_at ? formatDateTime(asset.last_movement_at) : "Sin movimientos"}
        />
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
