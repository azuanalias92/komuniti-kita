import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/check-in-logs/')({
  beforeLoad: () => {
    throw redirect({ to: '/check-in/logs' })
  },
})
