import { createFileRoute } from '@tanstack/react-router'
import { HomestayGuardRecord } from '@/features/homestay-booking/components/homestay-guard-record'

export const Route = createFileRoute('/_authenticated/homestay/record')({
  component: HomestayGuardRecord,
})
