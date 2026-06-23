'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DuoPage from '@/views/DuoPage'
import { RouteRedirect } from '@/components/RouteRedirect'

function DuoLegacyGateInner() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')
  if (token) return <DuoPage />
  return <RouteRedirect to="/a-deux" />
}

/** Anciens liens `/duo?token=…` → DuoPage legacy ; `/duo` seul → hub À deux. */
export function DuoLegacyGate() {
  return (
    <Suspense fallback={null}>
      <DuoLegacyGateInner />
    </Suspense>
  )
}
