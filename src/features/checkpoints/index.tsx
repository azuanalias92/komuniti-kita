import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { CheckpointsTable } from "@/features/checkpoints/components/checkpoints-table";
import { CheckpointDialog } from "@/features/checkpoints/components/checkpoint-dialog";
import { Plus } from "lucide-react";
import { type CheckpointFormData } from "@/features/checkpoints/data/schema";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { Header } from "@/components/layout/header";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useAclStore } from "@/stores/acl-store";
import { ConfigDrawer } from "@/components/config-drawer";
import { Search } from "@/components/search";

const route = getRouteApi("/_authenticated/checkpoints/");

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
      <Header fixed>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-6">
        <PageIntro
          title="Checkpoints"
          subtitle="Manage checkpoint names and locations."
          actions={
            canCreate ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Checkpoint
              </Button>
            ) : undefined
          }
        />
        <CheckpointsTable search={search} navigate={navigate} />
        <CheckpointDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onSave={handleCreateCheckpoint} mode="create" />
      </Main>
    </>
  );
}
