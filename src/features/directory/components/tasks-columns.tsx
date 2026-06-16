import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { houseTypes } from '../data/data'
import { type Task } from '../data/schema'
import { Edit, MoreHorizontal, Trash } from 'lucide-react'

export const tasksColumns: ColumnDef<Task>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-0.5'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'houseNo',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='House No' />
    ),
    cell: ({ row }) => <div className='w-20'>{row.getValue('houseNo')}</div>,
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'owners',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Owners' />
    ),
    meta: { className: 'ps-1', tdClassName: 'ps-4' },
    cell: ({ row }) => {
      const owners = row.original.owners
      return (
        <div className='flex flex-wrap gap-2'>
          {owners.map((o) => (
            <Badge key={`${row.id}-${o.name}`} variant='outline'>
              {o.name} ({o.phone})
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: 'houseType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='House Type' />
    ),
    meta: { className: 'ps-1', tdClassName: 'ps-4' },
    cell: ({ row }) => {
      const ht = houseTypes.find((h) => h.value === row.getValue('houseType'))
      if (!ht) return null
      return <span>{ht.label}</span>
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'vehicles',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Vehicles' />
    ),
    meta: { className: 'ps-1', tdClassName: 'ps-3' },
    cell: ({ row }) => {
      const vehicles = row.original.vehicles
      if (!vehicles?.length) return <span className='text-muted-foreground'>None</span>
      return (
        <div className='flex flex-col gap-1'>
          {vehicles.map((v, idx) => (
            <span key={`${row.id}-veh-${idx}`}>{v.brand} {v.model} ({v.plate})</span>
          ))}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Actions' />
    ),
    cell: ({ row }) => {
      const resident = row.original
      
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                // This will be handled by parent component
                const event = new CustomEvent('editResident', { detail: resident })
                window.dispatchEvent(event)
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // This will be handled by parent component
                const event = new CustomEvent('deleteResident', { detail: resident })
                window.dispatchEvent(event)
              }}
              className="text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]
