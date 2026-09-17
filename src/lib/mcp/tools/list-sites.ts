import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_sites",
  title: "Listar sitios",
  description:
    "Lista los sitios visibles para el usuario firmado (todos si es administrador, o solo los asignados si es ingeniero).",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Filtra por nombre o código del sitio."),
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de sitios a devolver."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let query = supabase
      .from("sites")
      .select("id, name, code, active, latitude, longitude")
      .order("name")
      .limit(limit ?? 50);
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sites: data ?? [] },
    };
  },
});
