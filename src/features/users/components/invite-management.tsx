import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Copy, Plus, Trash2, Users } from 'lucide-react'

type Invite = {
  id: string
  code: string
  description: string
  max_uses: number
  use_count: number
  expires_at: string | null
  is_active: number
  created_at: string
}

export function InviteManagement() {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newMaxUses, setNewMaxUses] = useState('10')

  const { data: invites = [], isLoading } = useQuery<Invite[]>({
    queryKey: ['tenant-invites'],
    queryFn: async () => {
      const res = await fetch('/api/tenants/invite')
      if (!res.ok) throw new Error('Failed to load invites')
      return await res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tenants/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: newDesc,
          maxUses: parseInt(newMaxUses) || 0,
          expiresInHours: 0, // no expiry
        }),
      })
      if (!res.ok) throw new Error('Failed to create invite')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invites'] })
      toast.success(`Invite code generated: ${data.code}`)
      setShowCreateDialog(false)
      setNewDesc('')
      setNewMaxUses('10')
    },
    onError: () => toast.error('Failed to generate invite code'),
  })

  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenants/invite?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disable invite')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invites'] })
      toast.success('Invite code disabled')
    },
    onError: () => toast.error('Failed to disable invite'),
  })

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const activeInvites = invites.filter((i) => i.is_active)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite Codes
          </CardTitle>
          <CardDescription>
            Generate invite codes so new users can join your community
          </CardDescription>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate Code
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground py-4 text-center">Loading invites...</div>
        ) : activeInvites.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <p className="mb-2">No active invite codes.</p>
            <p className="text-sm">Click "Generate Code" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeInvites.map((invite) => {
                  const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date()
                  return (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono tracking-widest">
                          {invite.code}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invite.description || '-'}
                      </TableCell>
                      <TableCell>
                        {invite.use_count}
                        {invite.max_uses > 0 && ` / ${invite.max_uses}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invite.expires_at
                          ? new Date(invite.expires_at).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="secondary">Expired</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyCode(invite.code)}
                            title="Copy code"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => disableMutation.mutate(invite.id)}
                            title="Disable code"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Invite Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g., For residents of Block A"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Uses (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
