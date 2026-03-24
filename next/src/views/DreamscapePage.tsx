// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { DreamscapeCanvas } from '@/components/DreamscapeCanvas'
import { dreamscapeApi } from '@/api/dreamscape'

export default function DreamscapePage() {
  const searchParams = useSearchParams()
  const resumeIdParam = searchParams?.get?.('resume') ?? null
  const [resumeData, setResumeData] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(!!resumeIdParam)

  useEffect(() => {
    if (!resumeIdParam) {
      setResumeData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    ;(dreamscapeApi.my() as Promise<{ items?: Array<Record<string, unknown>> }>)
      .then((res) => {
        const item = (res?.items ?? []).find((i) => String(i.id) === resumeIdParam)
        setResumeData((item ?? { id: resumeIdParam }) as { id: string })
      })
      .catch(() => setResumeData({ id: resumeIdParam } as { id: string }))
      .finally(() => setLoading(false))
  }, [resumeIdParam])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-white/70">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4">Chargement…</p>
      </div>
    )
  }

  const initialData = resumeData ? (resumeData as Record<string, unknown>) : null
  const resumeId = resumeData?.id ?? null

  return (
    <div
      className="flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden min-h-0 w-full"
      style={{ height: 'calc(100dvh - var(--layout-header-h, 64px) - 2rem)', minHeight: 0 }}
    >
      <DreamscapeCanvas initialData={initialData} resumeId={resumeId || undefined} />
    </div>
  )
}
