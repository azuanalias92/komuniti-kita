import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageIntro } from '@/components/layout/page-intro'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Search } from '@/components/search'
import { ConfigDrawer } from '@/components/config-drawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

type Payment = { id: string; house_id: string; amount: number; receipt_key: string; payment_date: string; status: string }

export const Route = createFileRoute('/_authenticated/billing/review')({
  component: PaymentReview,
})

function PaymentReview() {
  const qc = useQueryClient()
  const token = useAuthStore(s => s.auth.accessToken)

  const { data: residents } = useQuery<{ id: string; houseNo: string }[]>({
    queryKey: ['residents:list-basic'],
    queryFn: async () => {
      const res = await fetch('/api/residents?page=1&pageSize=1000')
      if (res.status === 204) return []
      const json = await res.json()
      return (json.data || []).map((r: any) => ({ id: r.id, houseNo: r.houseNo }))
    },
  })

  const residentMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of residents || []) m.set(r.id, r.houseNo)
    return m
  }, [residents])

  const { data, refetch, isFetching } = useQuery<Payment[]>({
    queryKey: ['billing:payments:pending'],
    queryFn: async () => {
      const res = await fetch('/api/billing/payments?status=pending')
      if (!res.ok) throw new Error('Failed to load payments')
      return await res.json()
    },
  })

  const { mutateAsync: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'confirmed' | 'rejected' }) => {
      const res = await fetch('/api/billing/payments', { method: 'PUT', headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ id, status }) })
      if (!res.ok) throw new Error('Update failed')
      return await res.json()
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['billing:payments:pending'] }); toast.success('Updated') },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  })

  async function handleAction(id: string, status: 'confirmed' | 'rejected') {
    await updateStatus({ id, status })
    await refetch()
  }

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
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title="Payment Review"
          subtitle="Approve or reject submitted payments."
        />
        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>House</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{residentMap.get(p.house_id) || p.house_id}</TableCell>
                    <TableCell>{Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                    <TableCell>{p.receipt_key ? (<a className="text-primary underline" href={`/api/r2/${p.receipt_key}`} target="_blank" rel="noreferrer">View</a>) : '-'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="default" size="sm" disabled={isFetching} onClick={() => handleAction(p.id, 'confirmed')}>Accept</Button>
                      <Button variant="destructive" size="sm" disabled={isFetching} onClick={() => handleAction(p.id, 'rejected')}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
