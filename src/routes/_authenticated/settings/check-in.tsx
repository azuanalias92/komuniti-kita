import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/check-in')({
  beforeLoad: () => {
    throw redirect({ to: '/check-in/configuration' })
  },
})
