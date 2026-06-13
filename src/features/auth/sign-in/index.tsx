import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { syncTenantAfterAuth } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { useAuthStore } from '@/stores/auth-store'
import { AuthLayout } from '../auth-layout'

const inviteSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
})

const emailSignInSchema = z.object({
  email: z.email('Email is required'),
  password: z.string().min(1, 'Password is required'),
})

export function SignIn() {
  const { error, new_user, email, name } = useSearch({ from: '/(auth)/sign-in' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailSigningIn, setIsEmailSigningIn] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      inviteCode: '',
    },
  })

  const emailSignInForm = useForm<z.infer<typeof emailSignInSchema>>({
    resolver: zodResolver(emailSignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof inviteSchema>) {
    if (!email) return
    setIsSubmitting(true)
    const p = (async () => {
      const body: Record<string, string> = {
        inviteCode: data.inviteCode,
        email,
      }
      if (name) body.name = name

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
        setIsSubmitting(false)
        return msg
      },
      error: (err) => {
        setIsSubmitting(false)
        return err.message
      },
    })
  }

  async function onEmailSignIn(values: z.infer<typeof emailSignInSchema>) {
    setIsEmailSigningIn(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error === 'invalid_credentials' ? 'Invalid email or password.' : 'Failed to sign in.')
      }

      auth.setAccessToken(typeof json.accessToken === 'string' ? json.accessToken : '')
      auth.setUser(json.user ?? null)
      syncTenantAfterAuth()
      window.location.assign('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign in.')
    } finally {
      setIsEmailSigningIn(false)
    }
  }

  if (isSubmitted) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardContent className='py-12'>
            <div className='text-center space-y-4'>
              <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto'>
                <SendIcon />
              </div>
              <h2 className='text-xl font-semibold'>Request Submitted!</h2>
              <p className='text-muted-foreground'>
                Your request to join <strong>{tenantName}</strong> has been sent to the admin for review.
              </p>
              <p className='text-sm text-muted-foreground'>
                You&apos;ll be able to sign in once your request is approved. Check your email for updates.
              </p>
              <div className='pt-4'>
                <Button asChild variant='outline'>
                  <a href='/sign-in'>Go to Sign In</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            {new_user
              ? 'Signed in with Google! Enter an invite code to join a community.'
              : 'Sign in with email and password, or continue with Google.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error === 'approval_pending' && (
            <Alert className='mb-4'>
              <AlertDescription>
                Your request to join is still pending approval. Please wait for
                an admin to approve your account.
              </AlertDescription>
            </Alert>
          )}

          {!new_user ? (
            <div className='space-y-4'>
              <Form {...emailSignInForm}>
                <form onSubmit={emailSignInForm.handleSubmit(onEmailSignIn)} className='space-y-4'>
                  <FormField
                    control={emailSignInForm.control}
                    name='email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type='email' placeholder='you@example.com' autoComplete='email' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailSignInForm.control}
                    name='password'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder='Enter your password' autoComplete='current-password' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type='submit' className='w-full' disabled={isEmailSigningIn}>
                    {isEmailSigningIn ? 'Signing in...' : 'Sign in with Email'}
                  </Button>
                </form>
              </Form>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-card px-2 text-muted-foreground'>Or continue with Google</span>
                </div>
              </div>

              <Button className='w-full' variant='outline' asChild>
                <a href='/api/auth/google/start'>Sign in with Google</a>
              </Button>
            </div>
          ) : (
            <Button className='w-full' asChild>
              <a href='/api/auth/google/start'>Sign in with Google</a>
            </Button>
          )}

          {new_user && (
            <div className='mt-6 space-y-4'>
              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-card px-2 text-muted-foreground'>Join a community</span>
                </div>
              </div>

              {email && (
                <div className='rounded-md bg-muted p-3 text-sm'>
                  Signed in as <strong>{email}</strong>
                  {name && <> ({name})</>}
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                  <FormField
                    control={form.control}
                    name='inviteCode'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invite Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Enter invite code (e.g. ABC12345)'
                            className='uppercase tracking-widest font-mono text-center text-lg'
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type='submit' disabled={isSubmitting} className='w-full'>
                    {isSubmitting ? 'Submitting...' : 'Request to Join'}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
        {!new_user && (
          <CardFooter>
            <p className='text-muted-foreground px-8 text-center text-sm'>
              New here?{' '}
              <a
                href='/api/auth/google/start'
                className='hover:text-primary underline underline-offset-4'
              >
                Sign in with Google
              </a>{' '}
              to get started
            </p>
          </CardFooter>
        )}
      </Card>
    </AuthLayout>
  )
}

function SendIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='text-green-600'
    >
      <path d='M22 2 11 13' />
      <path d='m22 2-7 20-4-9-9-4Z' />
    </svg>
  )
}
