import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  inventoryRpcParams,
  movementRpcParams,
  type InventoryReportFilters,
  type InventoryReportRow,
  type MovementReportFilters,
  type MovementReportRow,
} from "./types";

type RpcFn = (
  fn: string,
  params?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const rpc: RpcFn = (fn, params) => (supabase.rpc as unknown as RpcFn).call(supabase, fn, params);

export const MOVEMENT_REPORT_ACTIONS = ["ALTA", "ENTRADA", "SALIDA", "INVENTARIO"] as const;

export type DashboardMetrics = {
  total_assets: number;
  assets_on_site: number;
  assets_in_transit: number;
  condition_active: number;
  condition_disconnected: number;
  condition_damaged: number;
  period_entradas: number;
  period_salidas: number;
  period_inventarios: number;
  period_altas: number;
  open_alerts: number;
  transit_48h: number;
  protocol_omissions: number;
  movements_by_type: { name: string; value: number }[];
  assets_by_condition: { name: string; value: number }[];
  top_sites: { name: string; value: number }[];
  daily_activity: { name: string; value: number }[];
};

/** Indicadores agregados en la base de datos; nunca se descargan los registros. */
export function dashboardMetricsQuery(from: string, to: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["dashboard", "metrics", from, to],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<DashboardMetrics> => {
      const { data, error } = await rpc("dashboard_metrics", { _from: from, _to: to });
      if (error) throw new Error(error.message);
      return data as DashboardMetrics;
    },
  });
}

export type Paged<T> = { rows: T[]; total: number };

export function movementReportQuery(
  filters: MovementReportFilters,
  page: number,
  pageSize: number,
) {
  return queryOptions({
    queryKey: ["reports", "movements", filters, page, pageSize],
    staleTime: 10_000,
    queryFn: async (): Promise<Paged<MovementReportRow>> => {
      const { data, error } = await rpc("report_movements", {
        ...movementRpcParams(filters),
        _limit: pageSize,
        _offset: (page - 1) * pageSize,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as MovementReportRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });
}

export function inventoryReportQuery(
  filters: InventoryReportFilters,
  page: number,
  pageSize: number,
) {
  return queryOptions({
    queryKey: ["reports", "inventory", filters, page, pageSize],
    staleTime: 10_000,
    queryFn: async (): Promise<Paged<InventoryReportRow>> => {
      const { data, error } = await rpc("report_inventory", {
        ...inventoryRpcParams(filters),
        _limit: pageSize,
        _offset: (page - 1) * pageSize,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as InventoryReportRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });
}

export type SiteAssetCounts = {
  total: number;
  activos: number;
  desconectados: number;
  danados: number;
  en_transito: number;
};

export function siteAssetCountsQuery(siteId: string | null) {
  return queryOptions({
    queryKey: ["sites", "asset-counts", siteId],
    enabled: Boolean(siteId),
    queryFn: async (): Promise<SiteAssetCounts> => {
      const { data, error } = await rpc("site_asset_counts", { _site_id: siteId });
      if (error) throw new Error(error.message);
      const row = (data as SiteAssetCounts[] | null)?.[0];
      return row ?? { total: 0, activos: 0, desconectados: 0, danados: 0, en_transito: 0 };
    },
  });
}

/**
 * Descarga el archivo generado en el servidor: el navegador nunca recibe los
 * registros completos, solo el archivo terminado.
 */
export async function downloadReport(
  kind: "movements" | "inventory",
  filters: MovementReportFilters | InventoryReportFilters,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");

  const response = await fetch(`/api/reports/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filters }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No fue posible generar el archivo.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? `GTAC_${kind}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
