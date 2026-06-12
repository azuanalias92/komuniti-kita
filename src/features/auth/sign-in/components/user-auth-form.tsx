import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useAclStore } from '@/stores/acl-store'
import { syncTenantAfterAuth } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(7, 'Password must be at least 7 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const p = (async () => {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'approval_pending') throw new Error('Your request to join is still pending approval. Please wait for an admin to approve your account.')
        throw new Error('invalid')
      }
      const json = await res.json()
      auth.setUser(json.user)
      auth.setAccessToken(json.accessToken)
      syncTenantAfterAuth()
      const firstRole = Array.isArray(json.user?.role) && json.user.role.length > 0 ? json.user.role[0] : ''
      if (firstRole) {
        try {
          await useAclStore.getState().loadForRole(firstRole)
        } catch {}
      }
      const roles = Array.isArray(json.user?.role) ? json.user.role : []
      let configuredStart = ''
      try {
        const resRoles = await fetch('/api/roles')
        if (resRoles.ok) {
          const list = await resRoles.json()
          const match = (list || []).find((r: any) => String(r.name || '') === String(firstRole))
          configuredStart = String(match?.start_page || '')
        }
      } catch {}
      const isGuard = roles.includes('guard')
      const allowedForGuard = ['/check-in', '/check-in-logs']
      let redirect = redirectTo || ''
      const isAllowedRedirect = allowedForGuard.some((p) => redirect.startsWith(p))
      let targetPath = '/'
      if (configuredStart && configuredStart.startsWith('/')) {
        targetPath = configuredStart
      } else if (isGuard) {
        targetPath = isAllowedRedirect ? redirect : '/check-in'
      } else {
        targetPath = redirect || '/'
      }
      navigate({ to: targetPath, replace: true })
      return `Welcome back, ${data.email}!`
    })()
    toast.promise(p, {
      loading: 'Signing in...',
      success: (msg) => {
        setIsLoading(false)
        return msg
      },
      error: () => {
        setIsLoading(false)
        return 'Invalid email or password'
      },
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='text-muted-foreground absolute end-0 -top-0.5 text-sm font-medium hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background text-muted-foreground px-2'>
              Or continue with
            </span>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-2'>
          <Button variant='outline' asChild disabled={isLoading}>
            <a href='/api/auth/google/start'>Google</a>
          </Button>
        </div>
      </form>
    </Form>
  )
}
