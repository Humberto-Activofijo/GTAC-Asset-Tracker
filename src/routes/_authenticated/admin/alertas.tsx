import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  ALERT_EMAIL_STATUS_LABEL,
  ALERT_STATUS_LABEL,
  ALERT_TYPE_LABEL,
  type AlertRow,
  alertsListQuery,
  relativeAge,
  resolveAlert,
  retryAlertNotification,
} from "@/modules/alerts/queries";
import { TransitCheckButton } from "@/modules/alerts/TransitCheckButton";
import { currentUserQuery } from "@/modules/auth/queries";
import { PageHeader } from "@/modules/layout/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TabKey = "OPEN" | "RESOLVED" | "ALL";

const TABS: { key: TabKey; label: string }[] = [
  { key: "OPEN", label: "Abiertas" },
  { key: "RESOLVED", label: "Resueltas" },
  { key: "ALL", label: "Todas" },
];

export const Route = createFileRoute("/_authenticated/admin/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas administrativas — GTAC" },
      {
        name: "description",
        content: "Alertas de tránsito mayor a 48 horas y omisiones de protocolo de activos.",
      },
      { property: "og:title", content: "Alertas administrativas — GTAC" },
      {
        property: "og:description",
        content: "Alertas de tránsito mayor a 48 horas y omisiones de protocolo de activos.",
      },
    ],
  }),
  component: AlertasPage,
});

function AlertCard({ alert, onResolve }: { alert: AlertRow; onResolve: (a: AlertRow) => void }) {
  const meta = alert.metadata ?? {};
  const isTransit = alert.type === "TRANSITO_48H";
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await retryAlertNotification(alert.id);
      if (result.status === "SENT") toast.success("Notificación enviada.");
      else
        toast.error(
          result.error ?? "No fue posible enviar la notificación.",
        );
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible reintentar el envío.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                isTransit
                  ? "border-destructive/40 text-destructive"
                  : "border-border text-foreground",
              )}
            >
              {ALERT_TYPE_LABEL[alert.type]}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {ALERT_STATUS_LABEL[alert.status]}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                alert.email_status === "SENT"
                  ? "border-border text-muted-foreground"
                  : "border-destructive/40 text-destructive",
              )}
            >
              {ALERT_EMAIL_STATUS_LABEL[alert.email_status]}
            </span>
            <Link
              to="/activos/$assetId"
              params={{ assetId: alert.asset_id }}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {alert.asset_number}
            </Link>
          </div>
          <p className="mt-2 text-sm text-foreground">{alert.message}</p>
        </div>
        {alert.status === "OPEN" && (
          <Button size="sm" onClick={() => onResolve(alert)}>
            Resolver
          </Button>
        )}
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Sitio relacionado" value={alert.site_name ?? "—"} />
        <Detail label="Fecha" value={formatDateTime(alert.created_at)} />
        <Detail label="Antigüedad" value={relativeAge(alert.created_at)} />

        {isTransit ? (
          <>
            <Detail label="Sitio de origen" value={alert.origin_site_name ?? "—"} />
            <Detail label="Salida" value={formatDateTime(alert.departed_at)} />
            <Detail
              label="Horas en tránsito"
              value={alert.hours_in_transit != null ? `${alert.hours_in_transit} h` : "—"}
            />
            {alert.subsequent_entry_at && (
              <Detail
                label="Entrada posterior registrada"
                value={formatDateTime(alert.subsequent_entry_at)}
              />
            )}
          </>
        ) : (
          <>
            <Detail label="Acción" value={meta.action ?? "—"} />
            <Detail label="Sitio anterior" value={meta.previous_site_name ?? "—"} />
            <Detail label="Sitio nuevo" value={meta.new_site_name ?? alert.site_name ?? "—"} />
            <Detail label="Usuario" value={meta.performed_by_email ?? "—"} />
          </>
        )}

        {alert.status === "RESOLVED" && (
          <>
            <Detail label="Resuelta" value={formatDateTime(alert.resolved_at)} />
            <Detail label="Resuelta por" value={alert.resolved_by_email ?? "—"} />
            <Detail label="Notas" value={alert.resolution_notes ?? "—"} />
          </>
        )}
      </dl>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function AlertasPage() {
  const userQ = useQuery(currentUserQuery);
  const isAdmin = userQ.data?.role === "admin";
  const [tab, setTab] = useState<TabKey>("OPEN");
  const [target, setTarget] = useState<AlertRow | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const listQ = useQuery(alertsListQuery(tab, isAdmin));

  if (userQ.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Alertas" />
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Esta sección es exclusiva para administradores.
        </div>
      </>
    );
  }

  async function handleConfirm() {
    if (!target) return;
    if (!notes.trim()) {
      toast.error("Escribe las notas de resolución.");
      return;
    }
    setSaving(true);
    try {
      await resolveAlert(target.id, notes.trim());
      toast.success("Alerta resuelta.");
      setTarget(null);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible resolver la alerta.");
    } finally {
      setSaving(false);
    }
  }

  const rows = listQ.data ?? [];

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Tránsitos mayores a 48 horas y omisiones de protocolo."
        action={<TransitCheckButton variant="outline" />}
      />

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {listQ.isPending ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : listQ.isError ? (
        <p className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-destructive">
          No fue posible cargar las alertas.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          No hay alertas en esta vista.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <AlertCard key={a.id} alert={a} onResolve={setTarget} />
          ))}
        </div>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
            <DialogDescription>{target?.message}</DialogDescription>
          </DialogHeader>

          {target && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {ALERT_TYPE_LABEL[target.type]} · {target.asset_number} ·{" "}
              {formatDateTime(target.created_at)}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="resolution-notes">Notas de resolución *</Label>
            <Textarea
              id="resolution-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Describe la verificación realizada."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={saving || !notes.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
