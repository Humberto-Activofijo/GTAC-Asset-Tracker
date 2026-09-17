import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_alerts",
  title: "Listar alertas",
  description:
    "Lista las alertas de tránsito mayor a 48 horas y de omisión de protocolo. Solo los administradores tienen acceso a este listado.",
  inputSchema: {
    status: z.enum(["ABIERTA", "RESUELTA"]).optional().describe("Estado de la alerta."),
    type: z
      .enum(["TRANSITO_48H", "OMISION_PROTOCOLO"])
      .optional()
      .describe("Tipo de alerta."),
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de alertas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, type, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let query = supabase
      .from("alerts")
      .select(
        "id, type, status, message, created_at, resolved_at, resolution_notes, email_status, asset_id, site_id",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No hay alertas visibles. El listado de alertas es exclusivo de administradores.",
          },
        ],
        structuredContent: { alerts: [] },
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { alerts: data },
    };
  },
});
