import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/alertas")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/alertas" });
  },
  component: () => null,
});
