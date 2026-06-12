import { getRouteApi } from "@tanstack/react-router";
import { ConfigDrawer } from "@/components/config-drawer";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { UsersDialogs } from "./components/users-dialogs";
import { UsersProvider } from "./components/users-provider";
import { UsersTable } from "./components/users-table";
import { InviteManagement } from "./components/invite-management";
import { ApprovalManagement } from "./components/approval-management";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useUsersContext } from "./components/users-provider";
import { useAclStore } from "@/stores/acl-store";

const route = getRouteApi("/_authenticated/users/");

export function Users() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { can } = useAclStore();
  const canCreate = can("/users", "create");

  return (
    <UsersProvider>
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
          title="Users"
          subtitle="Manage users, roles, approvals, and invite codes."
          actions={canCreate ? <AddUserButton /> : undefined}
        />
        <UsersTable search={search} navigate={navigate} />
        <ApprovalManagement />
        <InviteManagement />
      </Main>

      <UsersDialogs />
    </UsersProvider>
  );
}

function AddUserButton() {
  const { setOpen } = useUsersContext();
  return (
    <Button className="space-x-1" onClick={() => setOpen("add")}>
      <span>Add User</span> <UserPlus size={18} />
    </Button>
  );
}
