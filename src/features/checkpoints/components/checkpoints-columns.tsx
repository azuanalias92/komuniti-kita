import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { type Checkpoint } from '../data/schema'
import { DataTableRowActions } from './checkpoints-row-actions'

export const checkpointsColumns: ColumnDef<Checkpoint>[] = [
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
    meta: {
      className: cn('max-md:sticky start-0 z-10 rounded-tl-[inherit]'),
    },
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
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-36 ps-3'>{row.getValue('name')}</LongText>
    ),
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
        'ps-0.5 max-md:sticky start-6 @4xl/content:table-cell @4xl/content:drop-shadow-none'
      ),
    },
    enableHiding: false,
  },
  {
    accessorKey: 'latitude',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Latitude' />
    ),
    cell: ({ row }) => (
      <div className='w-fit ps-2 text-nowrap'>{row.getValue('latitude')}</div>
    ),
  },
  {
    accessorKey: 'longitude',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Longitude' />
    ),
    cell: ({ row }) => (
      <div className='w-fit ps-2 text-nowrap'>{row.getValue('longitude')}</div>
    ),
  },
  {
    id: 'coordinates',
    header: 'Coordinates',
    cell: ({ row }) => {
      const latitude = Number(row.original.latitude)
      const longitude = Number(row.original.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return <Badge variant='outline' className='text-xs'>-</Badge>
      }
      return (
        <Badge variant='outline' className='text-xs'>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
