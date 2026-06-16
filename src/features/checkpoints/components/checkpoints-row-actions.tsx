import { useState } from 'react'
import type { Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CheckpointDialog } from './checkpoint-dialog'
import { type Checkpoint, type CheckpointFormData } from '../data/schema'
import { MoreHorizontal, Edit, Trash } from 'lucide-react'
import { useAclStore } from '@/stores/acl-store'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'

interface DataTableRowActionsProps {
  row: Row<Checkpoint>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { can } = useAclStore()
  const canUpdate = can('/checkpoints', 'update')
  const canDelete = can('/checkpoints', 'delete')

  const checkpoint = row.original

  const { auth } = useAuthStore()
  const queryClient = useQueryClient()

  const handleEdit = async (data: CheckpointFormData) => {
    const res = await fetch('/api/checkpoints', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      body: JSON.stringify({
        id: checkpoint.id,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to update checkpoint')
    }

    queryClient.invalidateQueries({ queryKey: ['checkpoints'] })
    setShowEditDialog(false)
  }

  const handleDelete = async () => {
    const res = await fetch(`/api/checkpoints?id=${checkpoint.id}`, {
      method: 'DELETE',
      headers: {
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
    })

    if (!res.ok) {
      throw new Error('Failed to delete checkpoint')
    }

    queryClient.invalidateQueries({ queryKey: ['checkpoints'] })
    setShowDeleteDialog(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
          >
            <MoreHorizontal className='h-4 w-4' />
            <span className='sr-only'>Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          {canUpdate && (
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <Edit className='mr-2 h-4 w-4' />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className='text-destructive'
            >
              <Trash className='mr-2 h-4 w-4' />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CheckpointDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        checkpoint={checkpoint}
        onSave={handleEdit}
        mode='edit'
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title='Delete Checkpoint'
        desc={`Are you sure you want to delete "${checkpoint.name}"? This action cannot be undone.`}
        handleConfirm={handleDelete}
        destructive
      />
    </>
  )
}
