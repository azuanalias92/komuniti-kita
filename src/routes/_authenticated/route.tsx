import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/stores/auth-store'
import { useAclStore } from '@/stores/acl-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { user, accessToken } = useAuthStore.getState().auth
    if (!user || !accessToken) {
      throw redirect({ to: '/sign-in' })
    }

    // Load ACL permissions for the user's role
    const userRole = Array.isArray(user.role) ? user.role[0] : user.role
    if (userRole) {
      try {
        await useAclStore.getState().loadForRole(userRole)
      } catch {}
    }

    const href = location.href || ''
    const path = href.split('?')[0].split('#')[0]
    const seg = path.split('/').filter(Boolean)[0] || ''
    const resource = seg ? `/${seg}` : '/'
    
    // Always allow access to error pages
    if (path.startsWith('/errors')) {
      return
    }

    const canRead = useAclStore.getState().can(resource, 'read')
    if (!canRead) {
      throw redirect({ to: '/errors/$error', params: { error: 'forbidden' } })
    }
  },
  component: AuthenticatedLayout,
})
