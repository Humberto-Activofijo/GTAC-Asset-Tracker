import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  retryAlertEmail as retryAlertEmailFn,
  runTransitCheckWithEmail,
} from "@/lib/alerts.functions";

export type AlertEmailStatus = "PENDING" | "SENT" | "FAILED";

export const ALERT_EMAIL_STATUS_LABEL: Record<AlertEmailStatus, string> = {
  PENDING: "Correo pendiente",
  SENT: "Correo enviado",
  FAILED: "Correo fallido",
};

export type AlertType = "TRANSITO_48H" | "OMISION_PROTOCOLO";
export type AlertStatus = "OPEN" | "RESOLVED";

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  TRANSITO_48H: "Tránsito +48 h",
  OMISION_PROTOCOLO: "Omisión de protocolo",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  OPEN: "Abierta",
  RESOLVED: "Resuelta",
};

export type AlertMetadata = {
  action?: string;
  asset_number?: string;
  previous_site_name?: string | null;
  new_site_name?: string | null;
  performed_by_email?: string | null;
  occurred_at?: string;
  origin_site_name?: string | null;
  departed_at?: string;
};

export type AlertRow = {
  id: string;
  type: AlertType;
  status: AlertStatus;
  asset_id: string;
  asset_number: string;
  movement_id: string | null;
  site_id: string | null;
  site_name: string | null;
  message: string;
  metadata: AlertMetadata | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_email: string | null;
  resolution_notes: string | null;
  departed_at: string | null;
  origin_site_name: string | null;
  hours_in_transit: number | null;
  subsequent_entry_at: string | null;
  total_count: number;
};

type RpcFn = (
  fn: string,
  params?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const rpc: RpcFn = (fn, params) =>
  (supabase.rpc as unknown as RpcFn).call(supabase, fn, params);

/** Listado administrativo; el backend verifica el rol y enriquece cada alerta. */
export function alertsListQuery(status: "OPEN" | "RESOLVED" | "ALL", enabled: boolean) {
  return queryOptions({
    queryKey: ["alerts", "list", status],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await rpc("list_alerts", {
        _status: status,
        _limit: 200,
        _offset: 0,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AlertRow[];
    },
  });
}

export type AssetAlert = {
  id: string;
  type: AlertType;
  status: AlertStatus;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

/** Alertas de un activo; para ingenieros la función devuelve vacío. */
export function assetAlertsQuery(assetId: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["alerts", "asset", assetId],
    enabled,
    queryFn: async (): Promise<AssetAlert[]> => {
      const { data, error } = await rpc("list_asset_alerts", { _asset_id: assetId });
      if (error) throw new Error(error.message);
      return (data ?? []) as AssetAlert[];
    },
  });
}

export type AlertsDashboard = {
  open_alerts: number;
  transit_48h: number;
  protocol_omissions: number;
  assets_in_transit: number;
};

export function alertsDashboardQuery(enabled: boolean) {
  return queryOptions({
    queryKey: ["alerts", "dashboard"],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AlertsDashboard> => {
      const { data, error } = await rpc("alerts_dashboard");
      if (error) throw new Error(error.message);
      const row = (data as AlertsDashboard[] | null)?.[0];
      return (
        row ?? { open_alerts: 0, transit_48h: 0, protocol_omissions: 0, assets_in_transit: 0 }
      );
    },
  });
}

export type TransitCheckResult = {
  assets_reviewed: number;
  alerts_created: number;
  alerts_existing: number;
  errors: number;
};

/** Revisión manual idempotente: solo crea las alertas faltantes. */
export async function runTransitCheck(): Promise<TransitCheckResult> {
  const { data, error } = await rpc("run_transit_48h_check");
  if (error) throw new Error(error.message);
  const row = (data as TransitCheckResult[] | null)?.[0];
  if (!row) throw new Error("No fue posible ejecutar la revisión.");
  return row;
}

export async function resolveAlert(alertId: string, notes: string): Promise<void> {
  const { error } = await rpc("resolve_alert", { _alert_id: alertId, _notes: notes });
  if (error) throw new Error(error.message);
}

/** Antigüedad aproximada en texto, a partir de una fecha UTC. */
export function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "hace menos de 1 hora";
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}
