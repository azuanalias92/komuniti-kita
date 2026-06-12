import { createFileRoute } from '@tanstack/react-router'
import { JoinTenantPage } from '@/features/auth/join-tenant'

export const Route = createFileRoute('/(auth)/join')({
  component: JoinTenantPage,
})
