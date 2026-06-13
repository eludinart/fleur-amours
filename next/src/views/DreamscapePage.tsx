// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DreamscapeCanvas } from '@/components/DreamscapeCanvas'
import { dreamscapeApi } from '@/api/dreamscape'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const INTRO_SEEN_KEY = 'jardin_dreamscape_intro_seen'

export default function DreamscapePage() {
  useStore((s) => s.locale)
  const searchParams = useSearchParams()
  const resumeIdParam = searchParams?.get?.('resume') ?? null
  const [resumeData, setResumeData] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(!!resumeIdParam)
  const isResume = !!resumeIdParam

  const [bannerExpanded, setBannerExpanded] = useState(() => {
    if (typeof window === 'undefined') return !isResume
    if (isResume) return false
    return !localStorage.getItem(INTRO_SEEN_KEY)
  })

  const collapseBanner = useCallback(() => {
    setBannerExpanded(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    }
  }, [])

  const expandBanner = useCallback(() => {
    setBannerExpanded(true)
  }, [])

  const onFirstUserMessage = useCallback(() => {
    collapseBanner()
  }, [collapseBanner])

  useEffect(() => {
    if (!resumeIdParam) {
      setResumeData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setBannerExpanded(false)
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
      {!isResume && (
        <div
          className={`shrink-0 border-b border-white/10 bg-slate-900/95 backdrop-blur-sm px-4 sm:px-6 transition-all ${
            bannerExpanded ? 'py-3 sm:py-4' : 'py-2'
          }`}
        >
          {bannerExpanded ? (
            <div className="max-w-2xl mx-auto space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {t('dreamscape')}
                  </h1>
                  <p className="text-xs sm:text-sm text-violet-200/90 italic">
                    {t('dreamscapeSubtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={collapseBanner}
                  className="shrink-0 text-[11px] text-white/50 hover:text-white/80 underline underline-offset-2"
                >
                  {t('dreamscapePage.bannerCollapse')}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed pr-2">
                {t('dreamscapeIntro')}
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white/90 truncate">{t('dreamscape')}</span>
              <button
                type="button"
                onClick={expandBanner}
                className="shrink-0 text-[11px] text-violet-300/90 hover:text-violet-200 underline underline-offset-2"
              >
                {t('dreamscapePage.bannerAbout')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <DreamscapeCanvas
          initialData={initialData}
          resumeId={resumeId || undefined}
          onFirstUserMessage={onFirstUserMessage}
        />
      </div>
    </div>
  )
}
