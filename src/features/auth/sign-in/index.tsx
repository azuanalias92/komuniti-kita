import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter>
          <div className='space-y-4'>
            <p className='text-muted-foreground px-8 text-center text-sm'>
              By clicking sign in, you agree to our{' '}
              <a
                href='/terms'
                className='hover:text-primary underline underline-offset-4'
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href='/privacy'
                className='hover:text-primary underline underline-offset-4'
              >
                Privacy Policy
              </a>
              .
            </p>
            <p className='text-muted-foreground px-8 text-center text-sm'>
              Don't have an account?{' '}
              <a
                href='/sign-up'
                className='hover:text-primary underline underline-offset-4'
              >
                Sign up
              </a>
              {' or '}
              <a
                href='/join'
                className='hover:text-primary underline underline-offset-4'
              >
                Join with code
              </a>
            </p>
          </div>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
