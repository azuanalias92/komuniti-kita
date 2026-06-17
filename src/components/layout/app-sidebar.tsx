import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { useLayout } from "@/context/layout-provider";
import { useAuthStore } from "@/stores/auth-store";
import { useTenantStore } from "@/stores/tenant-store";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { AppTitle } from "./app-title";
import { sidebarData } from "./data/sidebar-data";
import { NavGroup } from "./nav-group";
import { TeamSwitcher } from "./team-switcher";

export function AppSidebar() {
  const { collapsible, variant } = useLayout();
  const { auth } = useAuthStore();
  const { tenants, currentTenantId, setCurrentTenant } = useTenantStore();

  // Build teams list from auth tenant + any stored tenants
  const teams = useMemo(() => {
    const teamList = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      logo: Building2,
      plan: t.slug,
    }));

    // Add current user's tenant if not already in list
    if (auth.user?.tenantId && !teamList.find((t) => t.id === auth.user!.tenantId)) {
      teamList.unshift({
        id: auth.user.tenantId,
        name: auth.user.tenantName || auth.user.tenantSlug || "My Community",
        logo: Building2,
        plan: "Active",
      });
    }

    return teamList;
  }, [tenants, auth.user]);

  const activeTeamId = currentTenantId || auth.user?.tenantId || null;

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>{teams.length > 0 ? <TeamSwitcher teams={teams} activeTeamId={activeTeamId} onTeamChange={(id) => setCurrentTenant(id)} /> : <AppTitle />}</SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">v{__APP_VERSION__}</div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
