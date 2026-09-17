import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_assets",
  title: "Listar activos",
  description:
    "Lista los activos visibles para el usuario firmado, con filtros por sitio, estado, condición o número de activo.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Número de activo, modelo o número de serie."),
    siteId: z.string().uuid().optional().describe("Identificador del sitio actual del activo."),
    status: z.enum(["EN_SITIO", "EN_TRANSITO"]).optional().describe("Estado del activo."),
    condition: z
      .enum(["ACTIVO", "DESCONECTADO", "DANADO"])
      .optional()
      .describe("Condición física del activo."),
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de activos a devolver."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, siteId, status, condition, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let query = supabase
      .from("assets")
      .select(
        "id, asset_number, category, model, serial_number, condition, status, current_site_id, last_movement_at, sites:current_site_id(name)",
      )
      .order("asset_number")
      .limit(limit ?? 50);

    if (siteId) query = query.eq("current_site_id", siteId);
    if (status) query = query.eq("status", status);
    if (condition) query = query.eq("condition", condition);
    if (search) {
      query = query.or(
        `asset_number.ilike.%${search}%,model.ilike.%${search}%,serial_number.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { assets: data ?? [] },
    };
  },
});
