import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tenant {
  id: string
  name: string
  slug: string
}

interface TenantState {
  tenants: Tenant[]
  currentTenantId: string | null
  setTenants: (tenants: Tenant[]) => void
  setCurrentTenant: (id: string) => void
  addTenant: (tenant: Tenant) => void
  removeTenant: (id: string) => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenants: [],
      currentTenantId: null,

      setTenants: (tenants) =>
        set((state) => ({
          tenants,
          currentTenantId: state.currentTenantId || tenants[0]?.id || null,
        })),

      setCurrentTenant: (id) =>
        set({ currentTenantId: id }),

      addTenant: (tenant) =>
        set((state) => ({
          tenants: [...state.tenants.filter((t) => t.id !== tenant.id), tenant],
        })),

      removeTenant: (id) =>
        set((state) => {
          const remaining = state.tenants.filter((t) => t.id !== id)
          return {
            tenants: remaining,
            currentTenantId: state.currentTenantId === id
              ? (remaining[0]?.id ?? null)
              : state.currentTenantId,
          }
        }),
    }),
    {
      name: 'tenant-store',
      partialize: (state) => ({
        tenants: state.tenants,
        currentTenantId: state.currentTenantId,
      }),
    }
  )
)
