import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_movements",
  title: "Listar movimientos",
  description:
    "Lista los movimientos de activos (entradas, salidas e inventarios) visibles para el usuario firmado, con filtros por sitio, acción y rango de fechas (UTC).",
  inputSchema: {
    siteId: z.string().uuid().optional().describe("Sitio donde ocurrió el movimiento."),
    action: z.enum(["ENTRADA", "SALIDA", "INVENTARIO"]).optional().describe("Tipo de movimiento."),
    from: z.string().datetime().optional().describe("Fecha inicial en formato ISO (UTC)."),
    to: z.string().datetime().optional().describe("Fecha final en formato ISO (UTC)."),
    protocolOmissionOnly: z
      .boolean()
      .default(false)
      .describe("Solo movimientos con omisión de protocolo."),
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de movimientos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ siteId, action, from, to, protocolOmissionOnly, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let query = supabase
      .from("movements")
      .select(
        "id, asset_number, action, condition, occurred_at, site_id, site_name, previous_site_name, performed_by_email, protocol_omission, notes",
      )
      .order("occurred_at", { ascending: false })
      .limit(limit ?? 50);

    if (siteId) query = query.eq("site_id", siteId);
    if (action) query = query.eq("action", action);
    if (from) query = query.gte("occurred_at", from);
    if (to) query = query.lte("occurred_at", to);
    if (protocolOmissionOnly) query = query.eq("protocol_omission", true);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { movements: data ?? [] },
    };
  },
});
