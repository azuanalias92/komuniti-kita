import { createFileRoute } from '@tanstack/react-router'
import { CheckInSettings } from '@/features/settings/check-in'

export const Route = createFileRoute('/_authenticated/check-in/configuration')({
  component: CheckInSettings,
})
