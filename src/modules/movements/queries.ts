import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AssetCondition } from "@/modules/assets/queries";

export const MOVEMENT_ACTIONS = ["ENTRADA", "SALIDA", "INVENTARIO"] as const;
export type MovementAction = (typeof MOVEMENT_ACTIONS)[number];

export const ACTION_LABEL: Record<MovementAction, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  INVENTARIO: "Inventario",
};

export type MovementRow = {
  id: string;
  asset_id: string;
  asset_number: string;
  action: MovementAction;
  site_id: string;
  site_name: string;
  performed_by: string;
  performed_by_email: string | null;
  condition: AssetCondition;
  notes: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  previous_site_id: string | null;
  previous_site_name: string | null;
  previous_status: string | null;
  previous_condition: AssetCondition | null;
  protocol_omission: boolean;
  occurred_at: string;
  created_at: string;
};

const COLUMNS =
  "id, asset_id, asset_number, action, site_id, site_name, performed_by, performed_by_email, condition, notes, photo_url, latitude, longitude, previous_site_id, previous_site_name, previous_status, previous_condition, protocol_omission, occurred_at, created_at";

export type MovementFilters = {
  page: number;
  pageSize: number;
  action: string;
  siteId: string;
  from: string;
  to: string;
  q: string;
};

export type MovementListResult = { rows: MovementRow[]; total: number };

/** Paginación del lado del servidor; RLS limita el alcance por sitio asignado. */
export function movementsListQuery(filters: MovementFilters) {
  return queryOptions({
    queryKey: ["movements", "list", filters],
    queryFn: async (): Promise<MovementListResult> => {
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let query = supabase
        .from("movements")
        .select(COLUMNS, { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(from, to);

      if (filters.action) query = query.eq("action", filters.action as MovementAction);
      if (filters.siteId) query = query.eq("site_id", filters.siteId);
      if (filters.from) query = query.gte("occurred_at", `${filters.from}T00:00:00-06:00`);
      if (filters.to) query = query.lte("occurred_at", `${filters.to}T23:59:59-06:00`);
      const term = filters.q.trim().replace(/[%,()]/g, " ").trim();
      if (term) query = query.ilike("asset_number", `%${term}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as MovementRow[], total: count ?? 0 };
    },
    staleTime: 10_000,
  });
}

/** Historial completo de un activo, del más reciente al más antiguo. */
export function assetMovementsQuery(assetId: string) {
  return queryOptions({
    queryKey: ["movements", "asset", assetId],
    queryFn: async (): Promise<MovementRow[]> => {
      const { data, error } = await supabase
        .from("movements")
        .select(COLUMNS)
        .eq("asset_id", assetId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as MovementRow[];
    },
  });
}

export const recentMovementsQuery = queryOptions({
  queryKey: ["movements", "recent"],
  queryFn: async (): Promise<MovementRow[]> => {
    const { data, error } = await supabase
      .from("movements")
      .select(COLUMNS)
      .order("occurred_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as unknown as MovementRow[];
  },
  staleTime: 10_000,
});

export type RegisterMovementInput = {
  assetId: string;
  action: MovementAction;
  siteId: string;
  clientOperationId: string;
  condition: AssetCondition;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type RegisterMovementResult = {
  movement_id: string;
  duplicate: boolean;
  protocol_omission: boolean;
  new_status: string;
  new_site_id: string;
};

/**
 * Registro seguro del movimiento: el backend valida el permiso sobre el sitio,
 * evita duplicados por identificador de operación y actualiza el activo en la
 * misma transacción.
 */
export async function registerMovement(
  input: RegisterMovementInput,
): Promise<RegisterMovementResult> {
  const { data, error } = await supabase.rpc("register_movement", {
    _asset_id: input.assetId,
    _action: input.action,
    _site_id: input.siteId,
    _client_operation_id: input.clientOperationId,
    _condition: input.condition,
    _notes: input.notes ?? undefined,
    _photo_url: input.photoUrl ?? undefined,
    _latitude: input.latitude ?? undefined,
    _longitude: input.longitude ?? undefined,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("No fue posible registrar el movimiento.");
  return row as RegisterMovementResult;
}

export type Coords = { latitude: number; longitude: number } | null;

/** GPS opcional: si no hay permiso o soporte, el movimiento se registra sin ubicación. */
export function getCurrentCoords(timeoutMs = 8000): Promise<Coords> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
