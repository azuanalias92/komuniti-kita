import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { PageIntro } from '@/components/layout/page-intro'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAuthStore } from '@/stores/auth-store'

type Tenant = {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  usersCount: number
  invitesCount: number
  pendingApprovalsCount: number
}

const createTenantSchema = z.object({
  name: z.string().min(2, 'Enter tenant name'),
  slug: z.string(),
})

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function Tenants() {
  const { auth } = useAuthStore()
  const isSuperAdmin = auth.user?.role.includes('super_admin') ?? false
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)

  const form = useForm<z.infer<typeof createTenantSchema>>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: '', slug: '' },
  })

  async function loadTenants() {
    setLoading(true)
    try {
      const res = await fetch('/api/tenants')
      const json = await res.json().catch(() => [])
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load tenants')
      }
      setTenants(Array.isArray(json) ? json : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tenants')
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTenants()
  }, [])

  function handleDialogOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setEditingTenant(null)
      form.reset({ name: '', slug: '' })
    }
  }

  function handleCreateOpen() {
    setEditingTenant(null)
    form.reset({ name: '', slug: '' })
    setOpen(true)
  }

  function handleEditOpen(tenant: Tenant) {
    setEditingTenant(tenant)
    form.reset({ name: tenant.name, slug: tenant.slug })
    setOpen(true)
  }

  async function onSubmit(values: z.infer<typeof createTenantSchema>) {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/tenants', {
        method: editingTenant ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingTenant ? { id: editingTenant.id, ...values } : values),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.error === 'slug_exists') {
          throw new Error('Slug already exists. Please use a different slug.')
        }
        if (json.error === 'tenant_not_found') {
          throw new Error('Tenant not found.')
        }
        throw new Error(json.error || 'Failed to create tenant')
      }
      if (editingTenant) {
        setTenants((current) =>
          current.map((tenant) => (tenant.id === editingTenant.id ? (json as Tenant) : tenant))
        )
        toast.success('Tenant updated')
      } else {
        setTenants((current) => [json as Tenant, ...current])
        toast.success('Tenant created')
      }
      setEditingTenant(null)
      form.reset({ name: '', slug: '' })
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : editingTenant
            ? 'Failed to update tenant'
            : 'Failed to create tenant'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <PageIntro
          title='Tenants'
          subtitle='View, create, and update communities.'
          actions={
            isSuperAdmin ? (
              <Button className='space-x-1' onClick={handleCreateOpen}>
                <span>Add Tenant</span>
                <Plus size={18} />
              </Button>
            ) : undefined
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Building2 className='size-5' />
              <span>Tenants</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Active Invites</TableHead>
                  <TableHead>Pending Approvals</TableHead>
                  <TableHead>Created</TableHead>
                  {isSuperAdmin ? <TableHead className='text-right'>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 7 : 6}>Loading tenants...</TableCell>
                  </TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 7 : 6}>No tenants found yet.</TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className='font-medium'>{tenant.name}</TableCell>
                      <TableCell>{tenant.slug}</TableCell>
                      <TableCell>{tenant.usersCount}</TableCell>
                      <TableCell>{tenant.invitesCount}</TableCell>
                      <TableCell>{tenant.pendingApprovalsCount}</TableCell>
                      <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                      {isSuperAdmin ? (
                        <TableCell className='text-right'>
                          <Button variant='outline' size='sm' onClick={() => handleEditOpen(tenant)}>
                            <Pencil className='mr-2 size-4' />
                            Edit
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle>
            <DialogDescription>
              {editingTenant
                ? 'Update the tenant name and slug.'
                : 'Add a new community tenant. Leave slug empty to auto-generate it from the name.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g. Taman Seri Mewah' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='slug'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder='optional, e.g. taman-seri-mewah' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting
                    ? editingTenant
                      ? 'Saving...'
                      : 'Creating...'
                    : editingTenant
                      ? 'Save Changes'
                      : 'Create Tenant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
