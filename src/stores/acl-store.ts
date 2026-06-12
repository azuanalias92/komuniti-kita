import { create } from 'zustand'

type Crud = { create: boolean; read: boolean; update: boolean; delete: boolean }

interface AclState {
  role: string
  permissions: Record<string, Crud>
  loaded: boolean
  setRole: (role: string) => void
  setPermissions: (perms: Record<string, Crud>) => void
  loadForRole: (role: string) => Promise<void>
  can: (resource: string, action: keyof Crud) => boolean
}

export const useAclStore = create<AclState>()((set, get) => ({
  role: '',
  permissions: {},
  loaded: false,
  setRole: (role) => set((s) => ({ ...s, role, loaded: false })),
  setPermissions: (perms) => set((s) => ({ ...s, permissions: perms, loaded: true })),
  loadForRole: async (role) => {
    const current = get()
    if (current.role === role && current.loaded) {
      return
    }
    try {
      const res = await fetch(`/api/acl?role=${encodeURIComponent(role)}`)
      if (!res.ok) {
        set((s) => ({ ...s, role, permissions: {}, loaded: true }))
        return
      }
      const list = await res.json()
      const perms: Record<string, Crud> = {}
      for (const p of list) {
        const r = String(p.resource || '')
        perms[r] = {
          create: Number(p.can_create || 0) === 1,
          read: Number(p.can_read || 0) === 1,
          update: Number(p.can_update || 0) === 1,
          delete: Number(p.can_delete || 0) === 1,
        }
      }
      set((s) => ({ ...s, role, permissions: perms, loaded: true }))
    } catch {
      set((s) => ({ ...s, role, permissions: {}, loaded: true }))
    }
  },
  can: (resource, action) => {
    const state = get()
    if (state.role === 'superadmin' || state.role === 'super_admin') return true
    const p = state.permissions[resource]
    if (!p) return false
    return p[action]
  },
}))
