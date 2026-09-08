import { createFileRoute } from "@tanstack/react-router";

import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas — GTAC" },
      { name: "description", content: "Alertas operativas de GTAC (en desarrollo)." },
      { property: "og:title", content: "Alertas — GTAC" },
      { property: "og:description", content: "Alertas operativas de GTAC (en desarrollo)." },
    ],
  }),
  component: () => <ModuleInDevelopment title="Alertas" />,
});
