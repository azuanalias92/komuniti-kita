import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/homestay-record/")({
  beforeLoad: () => {
    throw redirect({ to: "/homestay/record" });
  },
});
