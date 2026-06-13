import { createFileRoute } from '@tanstack/react-router'
import { SettingsChangePassword } from '@/features/settings/change-password'

export const Route = createFileRoute('/_authenticated/settings/change-password')({
  component: SettingsChangePassword,
})
