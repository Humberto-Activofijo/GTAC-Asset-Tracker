import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import {
  ALERT_STATUS_LABEL,
  ALERT_TYPE_LABEL,
  assetAlertsQuery,
} from "@/modules/alerts/queries";
import { currentUserQuery } from "@/modules/auth/queries";
import { formatDateTime } from "@/lib/datetime";

/** Sección administrativa: los ingenieros no ven alertas del activo. */
export function AssetAlerts({ assetId }: { assetId: string }) {
  const userQ = useQuery(currentUserQuery);
  const isAdmin = userQ.data?.role === "admin";
  const alertsQ = useQuery(assetAlertsQuery(assetId, isAdmin));

  if (!isAdmin) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Alertas relacionadas</h2>
        <Link
          to="/admin/alertas"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          Ver panel
        </Link>
      </div>

      {alertsQ.isPending ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (alertsQ.data?.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Este activo no tiene alertas registradas.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {alertsQ.data?.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {ALERT_TYPE_LABEL[a.type]}
              </span>
              <span className="text-xs text-muted-foreground">{ALERT_STATUS_LABEL[a.status]}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
              <span className="w-full text-sm text-foreground">{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
