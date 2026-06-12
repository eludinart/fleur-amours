'use client'

import { useEffect, useState } from 'react'
import { timelineApi, type TimelineEventDTO, type TimelineNarrative } from '@/api/timeline'
import { getLocale, t } from '@/i18n'
import { useStore } from '@/store/useStore'

const SOURCE_META: Record<string, { icon: string; tint: string }> = {
  session: { icon: '🌿', tint: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30' },
  tirage: { icon: '🃏', tint: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' },
  fleur: { icon: '🌸', tint: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' },
  dreamscape: { icon: '🌙', tint: 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/30' },
  diagnostic: { icon: '📋', tint: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30' },
  checkin: { icon: '📝', tint: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30' },
  dyad: { icon: '💞', tint: 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950/30' },
  ritual: { icon: '✦', tint: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' },
  onboarding: { icon: '🌱', tint: 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30' },
}

function formatDate(s: string, locale: string) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EclosionTimelinePage() {
  const locale = useStore((s) => s.locale) || getLocale() || 'fr'
  const [events, setEvents] = useState<TimelineEventDTO[]>([])
  const [narrative, setNarrative] = useState<TimelineNarrative | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [narrativeLoading, setNarrativeLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    timelineApi
      .my(150)
      .then((r) => {
        if (!cancelled) setEvents(r.events || [])
      })
      .catch((e: { message?: string; detail?: string }) => {
        if (!cancelled) {
          setEvents([])
          setError(e?.detail || e?.message || t('eclosion.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function loadNarrative() {
    setNarrativeLoading(true)
    setError('')
    timelineApi
      .narrative(locale)
      .then((r) => setNarrative(r.narrative))
      .catch((e: { message?: string; detail?: string }) => {
        setNarrative(null)
        setError(e?.detail || e?.message || t('eclosion.narrativeError'))
      })
      .finally(() => setNarrativeLoading(false))
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('eclosion.title')}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t('eclosion.subtitle')}
          </p>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <section className="mb-8 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm dark:border-violet-900 dark:from-violet-950/30 dark:to-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('eclosion.narrativeTitle')}</h2>
            <button
              type="button"
              onClick={loadNarrative}
              disabled={narrativeLoading}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {narrativeLoading ? t('eclosion.narrativeLoading') : t('eclosion.narrativeCta')}
            </button>
          </div>
          {narrative ? (
            <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-serif text-lg font-semibold text-violet-900 dark:text-violet-200">{narrative.headline}</p>
              {narrative.movement && <p>{narrative.movement}</p>}
              {narrative.focus && <p className="text-slate-600 dark:text-slate-300">→ {narrative.focus}</p>}
              {narrative.encouragement && <p className="italic text-slate-500 dark:text-slate-400">{narrative.encouragement}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('eclosion.narrativeHint')}</p>
          )}
        </section>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden />
          </div>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('eclosion.empty')}
          </p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5 dark:border-slate-700">
            {events.map((e) => {
              const meta = SOURCE_META[e.source] ?? SOURCE_META.session
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.6rem] flex h-7 w-7 items-center justify-center rounded-full border bg-white text-sm dark:bg-slate-900">
                    {meta.icon}
                  </span>
                  <div className={`rounded-xl border p-4 shadow-sm ${meta.tint}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{e.title}</p>
                      <time className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(e.createdAt, locale)}
                      </time>
                    </div>
                    {e.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{e.summary}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
