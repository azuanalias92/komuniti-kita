import { createFileRoute } from "@tanstack/react-router";
import { BillingSettings } from "../settings/billing";

export const Route = createFileRoute("/_authenticated/billing/settings")({
  component: BillingSettings,
});
