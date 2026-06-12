import { useSearch } from '@tanstack/react-router'
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
import { AuthLayout } from '../auth-layout'

export function SignIn() {
  const { error } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Sign in to your account using Google
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
          <Button className='w-full' asChild>
            <a href='/api/auth/google/start'>Sign in with Google</a>
          </Button>
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            Don't have an account?{' '}
            <a
              href='/join'
              className='hover:text-primary underline underline-offset-4'
            >
              Join with invite code
            </a>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
