import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/checkpoints/")({
  beforeLoad: () => {
    throw redirect({ to: "/check-in/checkpoints" });
  },
});
