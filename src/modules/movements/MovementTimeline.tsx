import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { CONDITION_LABEL, getPhotoSignedUrl } from "@/modules/assets/queries";
import { formatDateTime } from "@/lib/datetime";

import { ACTION_LABEL, assetMovementsQuery, type MovementRow } from "./queries";

function Evidence({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getPhotoSignedUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="Evidencia del movimiento"
      className="mt-2 h-32 w-full max-w-xs rounded-lg border border-border object-cover"
      loading="lazy"
    />
  );
}

function Item({ movement }: { movement: MovementRow }) {
  return (
    <li className="relative border-l border-border pl-5 pb-6 last:pb-0">
      <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-foreground" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
          {ACTION_LABEL[movement.action]}
        </span>
        <span className="text-xs text-muted-foreground">{formatDateTime(movement.occurred_at)}</span>
        {movement.protocol_omission && (
          <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] font-medium text-destructive">
            Omisión de protocolo
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-foreground">
        {movement.site_name}
        {movement.previous_site_id && movement.previous_site_id !== movement.site_id && (
          <span className="text-muted-foreground"> · desde {movement.previous_site_name}</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {movement.performed_by_email ?? "—"} · Condición: {CONDITION_LABEL[movement.condition]}
        {movement.latitude != null && movement.longitude != null
          ? ` · GPS ${movement.latitude.toFixed(5)}, ${movement.longitude.toFixed(5)}`
          : " · Sin GPS"}
      </p>
      {movement.notes && <p className="mt-1 text-sm text-foreground">{movement.notes}</p>}
      {movement.photo_url && <Evidence path={movement.photo_url} />}
    </li>
  );
}

/** Línea de tiempo del activo, del movimiento más reciente al más antiguo. */
export function MovementTimeline({ assetId }: { assetId: string }) {
  const movementsQ = useQuery(assetMovementsQuery(assetId));

  if (movementsQ.isPending) {
    return (
      <div className="mt-4 flex justify-center rounded-lg border border-dashed border-border py-10">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (movementsQ.isError) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-destructive">
        No fue posible cargar el historial.
      </p>
    );
  }

  const rows = movementsQ.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Aún no hay movimientos registrados.
      </p>
    );
  }

  return (
    <ol className="mt-5 space-y-0">
      {rows.map((m) => (
        <Item key={m.id} movement={m} />
      ))}
    </ol>
  );
}
