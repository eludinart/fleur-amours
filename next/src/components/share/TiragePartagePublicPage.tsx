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
      <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-900">
        <LocaleSync />
        <TiragePartagePage />
      </div>
    </Suspense>
  )
}
