import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SendHorizonal } from 'lucide-react'

const formSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  email: z.string().email('Please enter a valid email'),
})

export function JoinTenantPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [tenantName, setTenantName] = useState('')

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const prefilledEmail = urlParams.get('email') || ''
  const prefilledName = urlParams.get('name') || ''

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inviteCode: '',
      email: prefilledEmail,
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const p = (async () => {
      const body: Record<string, string> = {
        inviteCode: data.inviteCode,
        email: data.email,
      }
      if (prefilledName) {
        body.name = prefilledName
      }

      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = json.error || 'Failed to join'
        if (msg === 'invalid_invite_code') throw new Error('Invalid invite code. Please check and try again.')
        if (msg === 'invite_code_disabled') throw new Error('This invite code has been disabled.')
        if (msg === 'invite_code_expired') throw new Error('This invite code has expired.')
        if (msg === 'invite_code_exhausted') throw new Error('This invite code has reached its usage limit.')
        if (msg === 'user_already_in_tenant') throw new Error('You already have an account in this community.')
        if (msg === 'approval_already_pending') throw new Error('You already have a pending request for this community. Please wait for admin approval.')
        throw new Error(msg)
      }

      setTenantName(json.tenantName || 'the community')
      setIsSubmitted(true)
      return 'Request submitted! An admin will review your request shortly.'
    })()

    toast.promise(p, {
      loading: 'Submitting request...',
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <SendHorizonal className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Request Submitted!</h2>
              <p className="text-muted-foreground">
                Your request to join <strong>{tenantName}</strong> has been sent to the admin for review.
              </p>
              <p className="text-sm text-muted-foreground">
                You'll be able to sign in once your request is approved. Check your email for updates.
              </p>
              <div className="pt-4">
                <Button asChild variant="outline">
                  <a href="/sign-in">Go to Sign In</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Join a Community</CardTitle>
          <CardDescription>
            Enter your invite code to request access to an existing community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {prefilledName && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  Signed in as <strong>{prefilledEmail}</strong>
                  {prefilledName && <> ({prefilledName})</>}
                </div>
              )}

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

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Submitting...' : 'Request to Join'}
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
