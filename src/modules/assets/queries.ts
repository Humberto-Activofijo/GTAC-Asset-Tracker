import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const ASSET_CONDITIONS = ["ACTIVO", "DESCONECTADO", "DANADO"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  ACTIVO: "Activo",
  DESCONECTADO: "Desconectado",
  DANADO: "Dañado",
};

export const STATUS_LABEL: Record<string, string> = {
  EN_SITIO: "En sitio",
};

export type AssetRow = {
  id: string;
  asset_number: string;
  serial_number: string | null;
  model: string | null;
  category: string | null;
  condition: AssetCondition;
  status: string;
  current_site_id: string;
  photo_url: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  last_movement_at: string | null;
  site: { id: string; name: string } | null;
};

const LIST_COLUMNS =
  "id, asset_number, serial_number, model, category, condition, status, current_site_id, photo_url, created_by, created_by_email, created_at, updated_at, last_movement_at, site:sites!assets_current_site_id_fkey(id, name)";

export type AssetListFilters = {
  page: number;
  pageSize: number;
  q: string;
  siteId: string;
  condition: string;
};

export type AssetListResult = { rows: AssetRow[]; total: number };

/** Paginación del lado del servidor: nunca se descarga el catálogo completo. */
export function assetsListQuery(filters: AssetListFilters) {
  return queryOptions({
    queryKey: ["assets", "list", filters],
    queryFn: async (): Promise<AssetListResult> => {
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let query = supabase
        .from("assets")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      const term = filters.q.trim();
      if (term) {
        const escaped = term.replace(/[%,()]/g, " ").trim();
        if (escaped) {
          query = query.or(`asset_number.ilike.%${escaped}%,serial_number.ilike.%${escaped}%`);
        }
      }
      if (filters.siteId) query = query.eq("current_site_id", filters.siteId);
      if (filters.condition) query = query.eq("condition", filters.condition as AssetCondition);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as AssetRow[], total: count ?? 0 };
    },
    staleTime: 10_000,
  });
}

export function assetDetailQuery(assetId: string) {
  return queryOptions({
    queryKey: ["assets", "detail", assetId],
    queryFn: async (): Promise<AssetRow | null> => {
      const { data, error } = await supabase
        .from("assets")
        .select(LIST_COLUMNS)
        .eq("id", assetId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AssetRow) ?? null;
    },
  });
}

/** Altas recientes visibles para la sesión (RLS decide el alcance). */
export const recentAssetActivityQuery = queryOptions({
  queryKey: ["assets", "recent-activity"],
  queryFn: async (): Promise<AssetRow[]> => {
    const { data, error } = await supabase
      .from("assets")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as unknown as AssetRow[];
  },
  staleTime: 10_000,
});

/** Las fotos viven en un bucket privado: se muestran con URL firmada temporal. */
export async function getPhotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("asset-photos").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
