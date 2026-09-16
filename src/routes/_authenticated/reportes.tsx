import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reportes")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/reportes" });
  },
  component: () => null,
});
