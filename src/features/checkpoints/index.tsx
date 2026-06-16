import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { CheckpointsTable } from "@/features/checkpoints/components/checkpoints-table";
import { CheckpointDialog } from "@/features/checkpoints/components/checkpoint-dialog";
import { type CheckpointFormData } from "@/features/checkpoints/data/schema";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { Header } from "@/components/layout/header";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useAclStore } from "@/stores/acl-store";

const route = getRouteApi("/_authenticated/check-in/checkpoints");

export function CheckpointsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const { auth } = useAuthStore();
  const { can } = useAclStore();
  const canCreate = can("/checkpoints", "create");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateCheckpoint = async (data: CheckpointFormData) => {
    const res = await fetch("/api/checkpoints", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      body: JSON.stringify({
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    });
    if (!res.ok && res.status !== 204) {
      throw new Error("Failed to create checkpoint");
    }
    queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
    setShowCreateDialog(false);
  };

  return (
    <>
      <Header />
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title="Checkpoints"
          subtitle="Manage checkpoint names and locations."
        />
        <CheckpointsTable search={search} navigate={navigate} onCreateClick={canCreate ? () => setShowCreateDialog(true) : undefined} />
        <CheckpointDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSave={handleCreateCheckpoint} mode="create" />
      </Main>
    </>
  );
}
