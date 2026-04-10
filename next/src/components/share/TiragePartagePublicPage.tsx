'use client'

import { Suspense } from 'react'
import { LocaleSync } from '@/components/LocaleSync'
import TiragePartagePage from '@/views/TiragePartagePage'

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
  </div>
)

export function TiragePartagePublicPage() {
  return (
    <Suspense fallback={fallback}>
      <div className="flex min-h-[100dvh] min-h-screen flex-1 flex-col overflow-hidden">
        <LocaleSync />
        <TiragePartagePage />
      </div>
    </Suspense>
  )
}
