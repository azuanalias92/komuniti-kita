import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'

/**
 * Tenant-aware fetch wrapper.
 * Automatically adds Authorization and X-Tenant-ID headers.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { auth } = useAuthStore.getState()
  const { currentTenantId } = useTenantStore.getState()

  const headers = new Headers(options.headers || {})

  if (auth.accessToken) {
    headers.set('Authorization', `Bearer ${auth.accessToken}`)
  }

  const tenantId = currentTenantId || auth.user?.tenantId
  if (tenantId && tenantId !== '*') {
    headers.set('X-Tenant-ID', tenantId)
  }

  if (!headers.has('content-type') && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json')
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * After successful auth (sign-in/sign-up), populate the tenant store
 * with the user's tenant info.
 */
export function syncTenantAfterAuth() {
  const { auth } = useAuthStore.getState()
  const { setTenants, setCurrentTenant } = useTenantStore.getState()

  if (auth.user?.role.includes('super_admin')) {
    // Default super admin to the aggregate "all communities" scope.
    setTenants(auth.user.tenants || [])
    setCurrentTenant('*')
  } else if (auth.user?.tenantId) {
    setTenants([
      {
        id: auth.user.tenantId,
        name: auth.user.tenantName || auth.user.tenantSlug || 'My Community',
        slug: auth.user.tenantSlug || auth.user.tenantId,
      },
    ])
    setCurrentTenant(auth.user.tenantId)
  }
}
