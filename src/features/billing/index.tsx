import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageIntro } from '@/components/layout/page-intro'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Search } from '@/components/search'
import { ConfigDrawer } from '@/components/config-drawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type SummaryRow = {
  houseId: string
  houseNo: string
  amountDue: number
  amountPaid: number
  debit: number
  credit: number
  status: string
}

export function Billing() {
  const [frequency, setFrequency] = useState<string>('monthly')
  const [year, setYear] = useState<string>(String(new Date().getFullYear()))
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1))

  const { data } = useQuery<{ frequency: string; rate: number; period: { start: string; end: string } | null; data: SummaryRow[] }>({
    queryKey: ['billing:summary', frequency, year, month],
    queryFn: async () => {
      const params = new URLSearchParams({ frequency, year })
      if (frequency === 'monthly') params.set('month', month)
      const res = await fetch(`/api/billing/summary?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load summary')
      return await res.json()
    },
  })

  const rows = data?.data || []
  const periodLabel = data?.period
    ? `${data.period.start} → ${data.period.end}`
    : 'No billing settings yet'

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

  const { data: payments } = useQuery<{ id: string; house_id: string; amount: number; receipt_key: string; payment_date: string; status: string }[]>({
    queryKey: ['billing:payments', data?.period?.start, data?.period?.end],
    enabled: !!data?.period?.start && !!data?.period?.end,
    queryFn: async () => {
      if (!data?.period) return []
      const { start, end } = data.period
      const params = new URLSearchParams({ start, end, status: 'confirmed' })
      const res = await fetch(`/api/billing/payments?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load payments')
      return await res.json()
    },
  })

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
      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        <PageIntro
          title="Billing"
          subtitle="Review balances and payments by house."
        />

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="semi-annual">Every 6 Months</SelectItem>
                    <SelectItem value="annual">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" min={1970} max={9999} value={year} onChange={e => setYear(e.target.value)} />
              </div>
              {frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select month" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => (
                        <SelectItem key={m} value={m}>{new Date(2000, Number(m)-1, 1).toLocaleString(undefined, { month: 'long' })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end text-sm text-muted-foreground">
                <div>Rate: RM {data?.rate ?? 0} • Period: {periodLabel}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>House Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>House</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.houseId}>
                    <TableCell>{r.houseNo}</TableCell>
                    <TableCell>{r.amountDue.toFixed(2)}</TableCell>
                    <TableCell>{r.amountPaid.toFixed(2)}</TableCell>
                    <TableCell className={r.debit ? 'text-red-600' : ''}>{r.debit.toFixed(2)}</TableCell>
                    <TableCell className={r.credit ? 'text-green-600' : ''}>{r.credit.toFixed(2)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments Details</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments || []).map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{residentMap.get(p.house_id) || p.house_id}</TableCell>
                    <TableCell>{Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'confirmed' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.receipt_key ? (
                        <a className="text-primary underline" href={`/api/r2/${p.receipt_key}`} target="_blank" rel="noreferrer">View</a>
                      ) : (
                        '-'
                      )}
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
