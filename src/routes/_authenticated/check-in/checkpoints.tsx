import { createFileRoute } from "@tanstack/react-router";
import { CheckpointsPage } from "@/features/checkpoints";

export const Route = createFileRoute("/_authenticated/check-in/checkpoints")({
  component: CheckpointsPage,
});
