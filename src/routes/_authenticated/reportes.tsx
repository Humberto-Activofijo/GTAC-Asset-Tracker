import { createFileRoute } from "@tanstack/react-router";

import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — GTAC" },
      { name: "description", content: "Reportes de trazabilidad de GTAC (en desarrollo)." },
      { property: "og:title", content: "Reportes — GTAC" },
      { property: "og:description", content: "Reportes de trazabilidad de GTAC (en desarrollo)." },
    ],
  }),
  component: () => <ModuleInDevelopment title="Reportes" />,
});
