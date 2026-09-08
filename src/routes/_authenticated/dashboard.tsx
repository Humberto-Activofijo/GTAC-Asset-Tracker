import { createFileRoute } from "@tanstack/react-router";

import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GTAC" },
      { name: "description", content: "Panel de indicadores de GTAC (en desarrollo)." },
      { property: "og:title", content: "Dashboard — GTAC" },
      { property: "og:description", content: "Panel de indicadores de GTAC (en desarrollo)." },
    ],
  }),
  component: () => <ModuleInDevelopment title="Dashboard" />,
});
