import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Checkpoint, type CheckpointFormData, checkpointFormSchema } from '../data/schema'

interface CheckpointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkpoint?: Checkpoint
  onSave: (data: CheckpointFormData) => void
  mode: 'create' | 'edit'
}

export function CheckpointDialog({
  open,
  onOpenChange,
  checkpoint,
  onSave,
  mode,
}: CheckpointDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CheckpointFormData>({
    resolver: zodResolver(checkpointFormSchema),
    defaultValues: checkpoint
      ? {
          name: checkpoint.name,
          latitude: checkpoint.latitude,
          longitude: checkpoint.longitude,
        }
      : {
          name: '',
          latitude: 0,
          longitude: 0,
        },
  })

  const handleSubmit = async (data: CheckpointFormData) => {
    setIsSubmitting(true)
    try {
      await onSave(data)
      onOpenChange(false)
      form.reset()
    } catch (error) {
      // Handle error appropriately in production
      // console.error('Error saving checkpoint:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create Checkpoint' : 'Edit Checkpoint'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Add a new checkpoint with name and coordinates.'
                : 'Update the checkpoint details.'}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                {...form.register('name')}
                placeholder='Enter checkpoint name'
              />
              {form.formState.errors.name && (
                <p className='text-sm text-destructive'>
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='latitude'>Latitude</Label>
              <Input
                id='latitude'
                type='number'
                step='0.000001'
                {...form.register('latitude', { valueAsNumber: true })}
                placeholder='Enter latitude (-90 to 90)'
              />
              {form.formState.errors.latitude && (
                <p className='text-sm text-destructive'>
                  {form.formState.errors.latitude.message}
                </p>
              )}
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='longitude'>Longitude</Label>
              <Input
                id='longitude'
                type='number'
                step='0.000001'
                {...form.register('longitude', { valueAsNumber: true })}
                placeholder='Enter longitude (-180 to 180)'
              />
              {form.formState.errors.longitude && (
                <p className='text-sm text-destructive'>
                  {form.formState.errors.longitude.message}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
