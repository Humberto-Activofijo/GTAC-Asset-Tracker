import { supabase } from "@/integrations/supabase/client";

import type { AssetCondition } from "./queries";

/** Solo se normalizan espacios: el contenido real del código no se altera. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\u00a0\u200b]/g, " ").trim().replace(/\s+/g, " ");
}

export type ScanAsset = {
  id: string;
  asset_number: string;
  serial_number: string | null;
  model: string | null;
  condition: AssetCondition;
  status: string;
  current_site_id: string;
  current_site_name: string;
  last_movement_at: string | null;
  photo_url: string | null;
};

export type LookupResult = {
  code: string;
  asset: ScanAsset | null;
  matchedBy: "asset_number" | "serial_number" | null;
};

/**
 * Identificación de un activo por código EXACTO durante el escaneo.
 *
 * Usa la función `lookup_asset_for_scan` del backend: requiere sesión activa,
 * acepta únicamente coincidencias exactas (número de activo/QR y, en su defecto,
 * número de serie), devuelve como máximo un activo y solo los campos necesarios.
 * No permite listar ni buscar parcialmente activos de otros sitios.
 */
export async function lookupAssetByCode(rawCode: string): Promise<LookupResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { code, asset: null, matchedBy: null };

  const { data, error } = await supabase.rpc("lookup_asset_for_scan", { _code: code });
  if (error) throw error;

  const row = data?.[0];
  if (!row) return { code, asset: null, matchedBy: null };

  const { matched_by, ...asset } = row;
  return {
    code,
    asset: asset as ScanAsset,
    matchedBy: matched_by === "serial_number" ? "serial_number" : "asset_number",
  };
}
