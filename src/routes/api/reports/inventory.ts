import { createFileRoute } from "@tanstack/react-router";

import {
  inventoryRpcParams,
  type InventoryReportFilters,
  type InventoryReportRow,
} from "@/modules/reports/types";

export const Route = createFileRoute("/api/reports/inventory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          assertAdmin,
          bearerToken,
          cdmxDateTime,
          clientForToken,
          fetchAllRows,
          fileStamp,
          workbookResponse,
        } = await import("@/lib/reports/export.server");

        const token = bearerToken(request);
        if (!token) return new Response("No autorizado.", { status: 401 });

        try {
          const client = clientForToken(token);
          await assertAdmin(client);

          const body = (await request.json().catch(() => ({}))) as {
            filters?: InventoryReportFilters;
          };
          const rows = await fetchAllRows<InventoryReportRow>(
            client,
            "report_inventory",
            inventoryRpcParams(body.filters ?? {}),
          );

          const sheet: (string | number)[][] = [
            [
              "Sitio",
              "Número de activo",
              "Serie",
              "Modelo",
              "Categoría",
              "Condición",
              "Estatus",
              "Último movimiento",
              "Fecha de alta",
            ],
            ...rows.map((r) => [
              r.site_name,
              r.asset_number,
              r.serial_number ?? "",
              r.model ?? "",
              r.category ?? "",
              r.condition,
              r.status,
              cdmxDateTime(r.last_movement_at),
              cdmxDateTime(r.created_at),
            ]),
          ];

          return workbookResponse(sheet, "Inventario", `GTAC_Inventario_${fileStamp()}.xlsx`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al generar el archivo.";
          const status = message.includes("administrador") ? 403 : 400;
          return new Response(message, { status });
        }
      },
    },
  },
});
