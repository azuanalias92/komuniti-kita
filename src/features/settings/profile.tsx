import { z } from 'zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
//
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  username: z.string().min(2, 'Username must be at least 2 characters'),
  phoneNumber: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Email is required'),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

const defaultValues: ProfileFormValues = {
  email: '',
  username: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
}

function getFallbackValues(email: string): ProfileFormValues {
  return {
    email,
    username: email.split('@')[0] || '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
  }
}

export function SettingsProfile() {
  const { auth } = useAuthStore()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    const load = async () => {
      const email = auth.user?.email
      if (!email) {
        form.reset(defaultValues)
        return
      }

      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`)
        if (res.status === 204 || !res.ok) {
          form.reset(getFallbackValues(email))
          return
        }

        const row = await res.json().catch(() => null)
        form.reset({
          email: row?.email || email,
          username: row?.username || email.split('@')[0] || '',
          firstName: row?.first_name || '',
          lastName: row?.last_name || '',
          phoneNumber: row?.phone_number || '',
        })
      } catch {
        form.reset(getFallbackValues(email))
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.email])

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              try {
                const res = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(data),
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'update_failed' }))
                  toast.error(String(err.error || 'Failed to update profile'))
                  return
                }
                toast.success('Profile updated')
              } catch {
                toast.error('Failed to update profile')
              }
            })}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="john" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+601****6789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input readOnly {...field} />
                  </FormControl>
                  <FormDescription>
                    Email is set from your login and cannot be changed here.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Update profile</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
