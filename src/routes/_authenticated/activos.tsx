import { createFileRoute } from "@tanstack/react-router";

import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/activos")({
  head: () => ({
    meta: [
      { title: "Activos — GTAC" },
      { name: "description", content: "Inventario de activos fijos de GTAC (en desarrollo)." },
      { property: "og:title", content: "Activos — GTAC" },
      { property: "og:description", content: "Inventario de activos fijos de GTAC (en desarrollo)." },
    ],
  }),
  component: () => <ModuleInDevelopment title="Activos" />,
});
