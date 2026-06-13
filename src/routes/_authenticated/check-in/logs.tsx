import { createFileRoute } from '@tanstack/react-router'
import { CheckInLogs } from '@/features/check-in-logs'

export const Route = createFileRoute('/_authenticated/check-in/logs')({
  component: CheckInLogs,
})
