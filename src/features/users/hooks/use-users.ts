import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'

type SearchParams = {
  page: number
  pageSize: number
  username?: string
  status?: string[]
  role?: string[]
}

async function fetchUsers(params: SearchParams) {
  const url = new URL('/api/users', window.location.origin)
  url.searchParams.set('page', String(params.page))
  url.searchParams.set('pageSize', String(params.pageSize))
  if (params.username) url.searchParams.set('username', params.username)
  for (const s of params.status || []) url.searchParams.append('status', s)
  for (const r of params.role || []) url.searchParams.append('role', r)

  const token = useAuthStore.getState().auth.accessToken
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (res.status === 204) return { data: [], page: params.page, pageSize: params.pageSize, total: 0 }
  if (!res.ok) throw new Error('Failed to load users')
  return res.json() as Promise<{
    data: unknown[]
    page: number
    pageSize: number
    total: number
  }>
}

export function useUsers(params: SearchParams) {
  const query = useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
    select: (resp) => ({ users: resp.data, page: resp.page, pageSize: resp.pageSize, total: resp.total }),
  })

  return {
    users: query.data?.users || [],
    page: query.data?.page || params.page,
    pageSize: query.data?.pageSize || params.pageSize,
    total: query.data?.total || 0,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
