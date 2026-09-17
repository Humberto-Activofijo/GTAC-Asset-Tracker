import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { requireAuth } from "../supabase";

export default defineTool({
  name: "get_asset",
  title: "Consultar activo",
  description:
    "Devuelve el detalle de un activo por su número de activo (código QR), junto con sus últimos movimientos.",
  inputSchema: {
    assetNumber: z.string().trim().min(1).describe("Número de activo o código QR."),
    movements: z
      .number()
      .int()
      .min(0)
      .max(50)
      .default(10)
      .describe("Cantidad de movimientos recientes a incluir."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ assetNumber, movements }, ctx) => {
    const supabase = requireAuth(ctx);
    const { data: asset, error } = await supabase
      .from("assets")
      .select(
        "id, asset_number, category, model, serial_number, condition, status, current_site_id, last_movement_at, created_at, sites:current_site_id(name, code)",
      )
      .eq("asset_number", assetNumber)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!asset) {
      return {
        content: [{ type: "text", text: `No se encontró el activo ${assetNumber}.` }],
        isError: true,
      };
    }

    let recent: Record<string, unknown>[] = [];
    if ((movements ?? 10) > 0) {
      const { data, error: movError } = await supabase
        .from("movements")
        .select(
          "id, action, condition, occurred_at, site_name, previous_site_name, performed_by_email, protocol_omission, notes",
        )
        .eq("asset_id", asset.id)
        .order("occurred_at", { ascending: false })
        .limit(movements ?? 10);
      if (movError) return { content: [{ type: "text", text: movError.message }], isError: true };
      recent = data ?? [];
    }

    const text = JSON.stringify({ asset, movements: recent });
    return {
      content: [{ type: "text", text }],
      structuredContent: JSON.parse(text) as Record<string, unknown>,
    };
  },
});
