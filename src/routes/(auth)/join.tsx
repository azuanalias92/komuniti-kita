import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { JoinTenantPage } from '@/features/auth/join-tenant'

const searchSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/join')({
  component: JoinTenantPage,
  validateSearch: searchSchema,
})
