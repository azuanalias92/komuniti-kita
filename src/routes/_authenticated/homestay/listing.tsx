import { createFileRoute } from '@tanstack/react-router'
import { HomestayCheckins } from '@/features/homestay-booking/components/homestay-checkins'

export const Route = createFileRoute('/_authenticated/homestay/listing')({
  component: HomestayCheckins,
})
