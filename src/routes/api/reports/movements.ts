import { createFileRoute } from "@tanstack/react-router";

import { movementRpcParams, type MovementReportFilters, type MovementReportRow } from "@/modules/reports/types";

export const Route = createFileRoute("/api/reports/movements")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          assertAdmin,
          bearerToken,
          cdmxDate,
          cdmxTime,
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
            filters?: MovementReportFilters;
          };
          const rows = await fetchAllRows<MovementReportRow>(
            client,
            "export_movements_page",
            movementRpcParams(body.filters ?? {}),
            (last) => ({
              _after_occurred_at: last.occurred_at,
              _after_row_id: last.row_id,
            }),
          );

          const sheet: (string | number)[][] = [
            [
              "Fecha",
              "Hora",
              "Número de activo",
              "Serie",
              "Modelo",
              "Acción",
              "Sitio",
              "Usuario",
              "Condición",
              "Notas",
              "Omisión de protocolo",
              "Latitud",
              "Longitud",
            ],
            ...rows.map((r) => [
              cdmxDate(r.occurred_at),
              cdmxTime(r.occurred_at),
              r.asset_number,
              r.serial_number ?? "",
              r.model ?? "",
              r.action,
              r.site_name ?? "",
              r.user_email ?? "",
              r.condition,
              r.notes ?? "",
              r.protocol_omission ? "Sí" : "No",
              r.latitude ?? "",
              r.longitude ?? "",
            ]),
          ];

          return workbookResponse(sheet, "Movimientos", `GTAC_Movimientos_${fileStamp()}.xlsx`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error al generar el archivo.";
          const status = message.includes("administrador") ? 403 : 400;
          return new Response(message, { status });
        }
      },
    },
  },
});
