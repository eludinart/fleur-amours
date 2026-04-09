'use client'

import { useEffect, useState } from 'react'
import { dashboardApi } from '@/api/dashboard'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

function pickPowerPhrase(res: unknown): string {
  const r = res as Record<string, unknown>
  const meta = r?.meta && typeof r.meta === 'object' ? (r.meta as { power_phrase?: string }) : null
  const fromMeta = typeof meta?.power_phrase === 'string' ? meta.power_phrase.trim() : ''
  if (fromMeta) return fromMeta
  const facts = Array.isArray(r?.facts) ? r.facts : []
  const f0 = facts[0] && typeof facts[0] === 'object' ? String((facts[0] as { text?: string }).text ?? '').trim() : ''
  if (f0) return f0
  const hyp = Array.isArray(r?.hypotheses) ? r.hypotheses : []
  const h0 = hyp[0] && typeof hyp[0] === 'object' ? String((hyp[0] as { text?: string }).text ?? '').trim() : ''
  if (h0) return h0
  return String(r?.insight ?? '').trim()
}

/** Vue zen : n'utilise pas les "facts" (motif actuel…) — trop proche des autres blocs. */
function pickZenPowerPhrase(res: unknown): string {
  const r = res as Record<string, unknown>
  const meta = r?.meta && typeof r.meta === 'object' ? (r.meta as { power_phrase?: string }) : null
  const fromMeta = typeof meta?.power_phrase === 'string' ? meta.power_phrase.trim() : ''
  if (fromMeta) return fromMeta
  const hyp = Array.isArray(r?.hypotheses) ? r.hypotheses : []
  const h0 = hyp[0] && typeof hyp[0] === 'object' ? String((hyp[0] as { text?: string }).text ?? '').trim() : ''
  if (h0) return h0
  return ''
}

export function DashboardPowerPhrase({
  petals,
  variant = 'default',
  className = '',
}: {
  petals: Record<string, number>
  variant?: 'zen' | 'default'
  className?: string
}) {
  const locale = useStore((s) => s.locale)
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(false)
  const hasPetals = petals && Object.values(petals).some((v) => (v ?? 0) > 0.05)
  const petalsKey = JSON.stringify(petals ?? {})

  useEffect(() => {
    if (!hasPetals) {
      setPhrase('')
      return
    }
    let cancelled = false
    setLoading(true)
    dashboardApi
      .getInsight(petals, locale)
      .then((res) => {
        if (!cancelled) setPhrase(variant === 'zen' ? pickZenPowerPhrase(res) : pickPowerPhrase(res))
      })
      .catch(() => {
        if (!cancelled) setPhrase('')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasPetals, locale, petalsKey, variant])

  if (!hasPetals) return null

  const zen =
    variant === 'zen'
      ? 'w-full rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-sm px-4 py-3.5 shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]'
      : 'w-full rounded-2xl border border-violet-200/55 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/25 px-4 py-3.5'

  const labelCls =
    variant === 'zen'
      ? 'text-[10px] uppercase tracking-[0.22em] text-teal-300/75 mb-2'
      : 'text-[10px] uppercase tracking-[0.2em] text-violet-600/80 dark:text-violet-300/80 mb-2'

  const bodyCls =
    variant === 'zen'
      ? 'text-sm sm:text-[15px] leading-relaxed text-violet-100/95 italic whitespace-pre-line text-center xl:text-left'
      : 'text-sm sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 italic whitespace-pre-line'

  if (loading && !phrase) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`${zen} ${className}`}
      >
        <span className="sr-only">{t('dashboard.powerPhraseLoading')}</span>
        <div className="h-3 w-24 rounded bg-white/10 dark:bg-white/10 animate-pulse mb-3" />
        <div className="h-4 w-full rounded bg-white/8 dark:bg-slate-600/40 animate-pulse mb-2" />
        <div className="h-4 w-[85%] max-w-md rounded bg-white/8 dark:bg-slate-600/40 animate-pulse" />
      </div>
    )
  }

  if (!phrase) {
    if (variant === 'zen') {
      return (
        <aside className={`${zen} ${className}`} aria-labelledby="dashboard-power-phrase-label">
          <p id="dashboard-power-phrase-label" className={labelCls}>
            {t('dashboard.powerPhraseLabel')}
          </p>
          <p className="text-[10px] text-teal-200/55 uppercase tracking-wider mb-2 text-center xl:text-left">
            {t('fleurZen.readingLevel2Hint')}
          </p>
          <p className="text-xs text-violet-200/70 leading-relaxed text-center xl:text-left">
            {t('fleurZen.powerPhraseZenEmpty')}
          </p>
        </aside>
      )
    }
    return null
  }

  return (
    <aside className={`${zen} ${className}`} aria-labelledby="dashboard-power-phrase-label">
      <p id="dashboard-power-phrase-label" className={labelCls}>
        {t('dashboard.powerPhraseLabel')}
      </p>
      {variant === 'zen' ? (
        <p className="text-[10px] text-teal-200/55 uppercase tracking-wider mb-2 text-center xl:text-left">
          {t('fleurZen.readingLevel2Hint')}
        </p>
      ) : null}
      <p className={bodyCls}>{phrase}</p>
    </aside>
  )
}
