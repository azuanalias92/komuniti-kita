import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/homestay/')({
  beforeLoad: () => {
    throw redirect({ to: '/homestay/listing' })
  },
})
