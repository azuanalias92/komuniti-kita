import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Trash2, UserPen, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type User } from '../data/schema'
import { useUsersContext } from './users-provider'
import { toast } from 'sonner'
import { useAclStore } from '@/stores/acl-store'

interface DataTableRowActionsProps {
  row: Row<User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { setOpen, setCurrentRow, roleList } = useUsersContext()
  const { can } = useAclStore()
  const canUpdate = can('/users', 'update')
  const canDelete = can('/users', 'delete')

  const handleRoleChange = async (newRole: string) => {
    try {
      const res = await fetch(`/api/users/${row.original.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update user role')
      }
      toast.success(`User role updated to ${newRole}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user role')
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
          >
            <DotsHorizontalIcon className='h-4 w-4' />
            <span className='sr-only'>Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-52'>
          {canUpdate && (
            <DropdownMenuItem
              onClick={() => {
                setCurrentRow(row.original)
                setOpen('edit')
              }}
            >
              Edit User
              <DropdownMenuShortcut>
                <UserPen size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          
          {canUpdate && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Shield className='mr-2 h-4 w-4' />
                Change Role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {roleList.map((r) => (
                  <DropdownMenuItem key={r.id} onClick={() => handleRoleChange(r.name)}>
                    <Shield className='mr-2 h-4 w-4' />
                    {r.name}
                    {row.original.role === r.name && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {(canUpdate || canDelete) && <DropdownMenuSeparator />}
          
          {canDelete && (
            <DropdownMenuItem
              onClick={() => {
                setCurrentRow(row.original)
                setOpen('delete')
              }}
              className='text-red-600!'
            >
              Delete User
              <DropdownMenuShortcut>
                <Trash2 size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
