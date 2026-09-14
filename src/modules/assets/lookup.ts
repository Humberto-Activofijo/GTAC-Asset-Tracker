import { supabase } from "@/integrations/supabase/client";

import type { AssetRow } from "./queries";

const LOOKUP_COLUMNS =
  "id, asset_number, serial_number, model, category, condition, status, current_site_id, photo_url, created_by, created_by_email, created_at, updated_at, last_movement_at, site:sites!assets_current_site_id_fkey(id, name)";

/** Solo se normalizan espacios: el contenido real del código no se altera. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\u00a0\u200b]/g, " ").trim().replace(/\s+/g, " ");
}

export type LookupResult = {
  code: string;
  asset: AssetRow | null;
  matchedBy: "asset_number" | "serial_number" | null;
};

/**
 * Búsqueda en el backend por código exacto (sin distinguir mayúsculas), primero por
 * número de activo / QR y después por número de serie. Usa los índices existentes
 * y nunca descarga el catálogo al dispositivo.
 */
export async function lookupAssetByCode(rawCode: string): Promise<LookupResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { code, asset: null, matchedBy: null };

  const escaped = code.replace(/[%_,()]/g, " ").trim();

  const byNumber = await supabase
    .from("assets")
    .select(LOOKUP_COLUMNS)
    .ilike("asset_number", escaped)
    .limit(1)
    .maybeSingle();
  if (byNumber.error) throw byNumber.error;
  if (byNumber.data) {
    return { code, asset: byNumber.data as unknown as AssetRow, matchedBy: "asset_number" };
  }

  const bySerial = await supabase
    .from("assets")
    .select(LOOKUP_COLUMNS)
    .ilike("serial_number", escaped)
    .limit(1)
    .maybeSingle();
  if (bySerial.error) throw bySerial.error;
  if (bySerial.data) {
    return { code, asset: bySerial.data as unknown as AssetRow, matchedBy: "serial_number" };
  }

  return { code, asset: null, matchedBy: null };
}
