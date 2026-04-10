'use client'

import { Suspense } from 'react'
import { LocaleSync } from '@/components/LocaleSync'
import DreamscapePartagePage from '@/views/DreamscapePartagePage'

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
  </div>
)

export function DreamscapePartagePublicPage() {
  return (
    <Suspense fallback={fallback}>
      <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        <LocaleSync />
        <DreamscapePartagePage />
      </div>
    </Suspense>
  )
}
