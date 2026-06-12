import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserCheck, UserX, RefreshCw, Users } from 'lucide-react'

type Approval = {
  id: string
  invite_code: string
  email: string
  username: string
  status: string
  created_at: string
}

export function ApprovalManagement() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('pending')

  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['tenant-approvals', tab],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/approvals?status=${tab}`)
      if (!res.ok) throw new Error('Failed to load approvals')
      return await res.json()
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenants/approvals?id=${id}&action=approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-approvals'] })
      toast.success(`Approved: ${data.email}`)
    },
    onError: () => toast.error('Failed to approve request'),
  })

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenants/approvals?id=${id}&action=reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to reject')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-approvals'] })
      toast.success('Request rejected')
    },
    onError: () => toast.error('Failed to reject request'),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Requests
          </CardTitle>
          <CardDescription>
            Approve or reject users requesting to join your community
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['tenant-approvals'] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {isLoading ? (
              <div className="text-muted-foreground py-8 text-center">Loading requests...</div>
            ) : approvals.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <p>No {tab} requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Invite Code</TableHead>
                      <TableHead>Requested</TableHead>
                      {tab !== 'pending' && <TableHead>Status</TableHead>}
                      {tab === 'pending' && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.email}</TableCell>
                        <TableCell>{a.username}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono tracking-wider">
                            {a.invite_code}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                        </TableCell>
                        {tab !== 'pending' && (
                          <TableCell>
                            <Badge variant={tab === 'approved' ? 'default' : 'secondary'}>
                              {tab}
                            </Badge>
                          </TableCell>
                        )}
                        {tab === 'pending' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(a.id)}
                                disabled={approveMutation.isPending}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectMutation.mutate(a.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
