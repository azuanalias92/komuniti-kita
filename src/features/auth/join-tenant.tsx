import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { syncTenantAfterAuth } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(7, 'Password must be at least 7 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export function JoinTenantPage() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inviteCode: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const p = (async () => {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inviteCode: data.inviteCode,
          email: data.email,
          password: data.password,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const msg = json.error || 'Failed to join'
        if (msg === 'invalid_invite_code') throw new Error('Invalid invite code. Please check and try again.')
        if (msg === 'invite_code_disabled') throw new Error('This invite code has been disabled.')
        if (msg === 'invite_code_expired') throw new Error('This invite code has expired.')
        if (msg === 'invite_code_exhausted') throw new Error('This invite code has reached its usage limit.')
        if (msg === 'user_already_in_tenant') throw new Error('You already have an account in this community.')
        throw new Error(msg)
      }

      const json = await res.json()
      auth.setUser(json.user)
      auth.setAccessToken(json.accessToken)
      syncTenantAfterAuth()
      navigate({ to: '/', replace: true })
      return `Welcome to ${json.user?.tenantName || 'your community'}!`
    })()

    toast.promise(p, {
      loading: 'Joining community...',
      success: (msg) => {
        setIsLoading(false)
        return msg
      },
      error: (err) => {
        setIsLoading(false)
        return err.message
      },
    })
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Join a Community</CardTitle>
          <CardDescription>
            Enter your invite code to join an existing community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="inviteCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invite Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter invite code (e.g. ABC12345)"
                        className="uppercase tracking-widest font-mono text-center text-lg"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        value={field.value}
                      />
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
                      <Input type="email" placeholder="your@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Create a password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Confirm your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Joining...' : 'Join Community'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <a href="/sign-in" className="underline hover:text-primary">
                  Sign in
                </a>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
