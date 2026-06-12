import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { auth } = useAuthStore()
  const { tenants, currentTenantId, setCurrentTenant } = useTenantStore()
  const isSuperAdmin = auth.user?.role.includes('super_admin') ?? false

  const email = auth.user?.email || sidebarData.user.email
  const name = (() => {
    if (auth.user?.email) {
      return auth.user.email.split('@')[0]
    }
    return sidebarData.user.name
  })()
  const user = { name, email, avatar: sidebarData.user.avatar }

  // Build teams list from auth tenant + any stored tenants
  const teams = useMemo(() => {
    const teamList = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      logo: Building2,
      plan: t.slug,
    }))

    if (isSuperAdmin) {
      teamList.unshift({
        id: '*',
        name: 'All Communities',
        logo: Building2,
        plan: 'All tenants',
      })
    }

    // Add current user's tenant if not already in list
    if (
      auth.user?.tenantId &&
      auth.user.tenantId !== '*' &&
      !teamList.find((t) => t.id === auth.user!.tenantId)
    ) {
      teamList.unshift({
        id: auth.user.tenantId,
        name: auth.user.tenantName || auth.user.tenantSlug || 'My Community',
        logo: Building2,
        plan: 'Active',
      })
    }

    return teamList
  }, [tenants, auth.user, isSuperAdmin])

  const activeTeamId = currentTenantId || auth.user?.tenantId || null

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {teams.length > 0 ? (
          <TeamSwitcher
            teams={teams}
            activeTeamId={activeTeamId}
            onTeamChange={(id) => setCurrentTenant(id)}
          />
        ) : (
          <AppTitle />
        )}
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
