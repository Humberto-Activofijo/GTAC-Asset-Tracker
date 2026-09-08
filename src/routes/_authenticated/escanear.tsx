import { createFileRoute } from "@tanstack/react-router";

import { ModuleInDevelopment } from "@/modules/layout/ModuleInDevelopment";

export const Route = createFileRoute("/_authenticated/escanear")({
  head: () => ({
    meta: [
      { title: "Escanear — GTAC" },
      { name: "description", content: "Escaneo de etiquetas de activos GTAC (en desarrollo)." },
      { property: "og:title", content: "Escanear — GTAC" },
      { property: "og:description", content: "Escaneo de etiquetas de activos GTAC (en desarrollo)." },
    ],
  }),
  component: () => <ModuleInDevelopment title="Escanear" />,
});
