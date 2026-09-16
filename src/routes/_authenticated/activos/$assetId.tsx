import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import {
  CONDITION_LABEL,
  STATUS_LABEL,
  assetDetailQuery,
  getPhotoSignedUrl,
} from "@/modules/assets/queries";
import { MovementTimeline } from "@/modules/movements/MovementTimeline";
import { AssetAlerts } from "@/modules/alerts/AssetAlerts";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/activos/$assetId")({
  head: () => ({
    meta: [
      { title: "Detalle de activo — GTAC" },
      { name: "description", content: "Ficha del activo: datos, sitio, fotografía e historial." },
      { property: "og:title", content: "Detalle de activo — GTAC" },
      {
        property: "og:description",
        content: "Ficha del activo: datos, sitio, fotografía e historial.",
      },
    ],
  }),
  component: AssetDetailPage,
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function AssetDetailPage() {
  const { assetId } = Route.useParams();
  const assetQ = useQuery(assetDetailQuery(assetId));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const photoPath = assetQ.data?.photo_url ?? null;
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

  if (assetQ.isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (assetQ.isError || !assetQ.data) {
    return (
      <>
        <PageHeader title="Activo no disponible" />
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No encontramos este activo o no tienes permiso para verlo.
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/activos">Volver al catálogo</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const asset = assetQ.data;

  return (
    <>
      <PageHeader
        title={asset.asset_number}
        description="Ficha del activo"
        action={
          <Button asChild variant="outline">
            <Link to="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Datos del activo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Número de activo" value={asset.asset_number} />
            <Field label="Número de serie" value={asset.serial_number ?? "—"} />
            <Field label="Modelo" value={asset.model ?? "—"} />
            <Field label="Condición" value={CONDITION_LABEL[asset.condition]} />
            <Field label="Estatus" value={STATUS_LABEL[asset.status] ?? asset.status} />
            <Field label="Sitio actual" value={asset.site?.name ?? "—"} />
            <Field label="Dado de alta por" value={asset.created_by_email ?? "—"} />
            <Field label="Fecha de alta" value={formatDateTime(asset.created_at)} />
            <Field
              label="Último movimiento"
              value={asset.last_movement_at ? formatDateTime(asset.last_movement_at) : "Sin movimientos"}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Fotografía</h2>
          {asset.photo_url ? (
            photoUrl ? (
              <img
                src={photoUrl}
                alt={`Fotografía del activo ${asset.asset_number}`}
                className="mt-4 w-full rounded-lg border border-border object-cover"
                loading="lazy"
              />
            ) : (
              <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-border py-12">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Sin fotografía registrada.
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Historial del activo</h2>
        <MovementTimeline assetId={asset.id} />
      </section>

      <AssetAlerts assetId={asset.id} />
    </>
  );
}
