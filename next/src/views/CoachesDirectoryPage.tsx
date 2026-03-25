'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { chatApi } from '@/api/chat'
import {
  type Coach,
  coachPrimaryTitle,
  coachPseudoHandle,
  formatCoachLastSeenLabel,
} from '@/lib/coach-profile'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

function CoachDirectoryCard({ coach: c }: { coach: Coach }) {
  const title = coachPrimaryTitle(c)
  const handle = coachPseudoHandle(c)

  return (
    <details className="group rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
      <summary className="cursor-pointer list-none p-4 flex items-start gap-3 [&::-webkit-details-marker]:hidden">
        <div className="relative shrink-0">
          {c.avatar ? (
            <img
              src={c.avatar}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-600"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
              {c.avatar_emoji || '🌿'}
            </div>
          )}
          {c.is_online ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"
              title={t('chat.online')}
              aria-label={t('chat.online')}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <span
              className={`font-bold text-base text-slate-950 dark:text-white truncate ${handle ? 'font-mono' : ''}`}
            >
              {title}
            </span>
            {c.coach_verified ? (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm ring-1 ring-white/80 shrink-0">
                {t('coaches.verifiedBadge')}
              </span>
            ) : null}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                c.is_online
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
              }`}
            >
              {c.is_online ? t('chat.online') : t('chat.offline')}
            </span>
            <span className="ml-auto text-violet-600 dark:text-violet-300 text-xs font-semibold shrink-0">
              <span className="group-open:hidden">{t('coaches.openFiche')}</span>
              <span className="hidden group-open:inline">{t('coaches.closeFiche')}</span>
              <span className="inline-block transition-transform group-open:rotate-180 ml-0.5">▾</span>
            </span>
          </div>
          {handle && (c.name || '').trim() ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{c.name}</p>
          ) : null}
          {!c.is_online ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatCoachLastSeenLabel(c.last_seen_at ?? null, t)}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-200 font-medium">
              {t('chat.presenceActiveHint')}
            </p>
          )}
          {c.coach_headline ? (
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
              {c.coach_headline}
            </p>
          ) : null}
          {c.coach_short_bio ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
              {c.coach_short_bio}
            </p>
          ) : null}
        </div>
      </summary>

      <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-600 space-y-4">
        <div className="flex flex-wrap gap-1.5 pt-2">
          {c.coach_years_experience != null && c.coach_years_experience > 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 dark:bg-amber-500/15 text-amber-950 dark:text-amber-50 border-amber-300 dark:border-amber-400/60">
              {t('chat.yearsExp', { n: c.coach_years_experience })}
            </span>
          ) : null}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-900 dark:text-violet-100 border border-violet-200 dark:border-violet-700">
            {c.coach_response_time_label || '—'}
          </span>
          {(c.coach_languages?.length ?? 0) > 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600">
              {c.coach_languages!.join(' · ')}
            </span>
          ) : null}
          {(c.coach_specialties ?? []).slice(0, 6).map((s, i) => (
            <span
              key={`spec-${c.id}-${i}`}
              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600/10 dark:bg-violet-400/15 text-violet-950 dark:text-violet-100 border border-violet-300 dark:border-violet-500/40"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('chat.responseTime')}
              </p>
              <p className="font-semibold mt-0.5">{c.coach_response_time_label || '—'}</p>
              {c.coach_response_time_hours != null ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">~{c.coach_response_time_hours} h</p>
              ) : null}
            </div>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('chat.experience')}
              </p>
              <p className="font-semibold mt-0.5">
                {c.coach_years_experience != null && c.coach_years_experience > 0
                  ? t('chat.yearsExp', { n: c.coach_years_experience })
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600 sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('chat.languages')}
              </p>
              <p className="font-medium mt-0.5">
                {(c.coach_languages?.length ?? 0) > 0 ? c.coach_languages!.join(', ') : '—'}
              </p>
            </div>
          </div>
          {(c.coach_specialties?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                {t('chat.specialties')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {c.coach_specialties!.map((s, i) => (
                  <span
                    key={`spec-full-${c.id}-${i}`}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-600/10 dark:bg-violet-400/15 text-violet-950 dark:text-violet-100 border border-violet-300 dark:border-violet-500/40"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {c.coach_reviews_label ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {t('chat.reviews')}
              </p>
              <p className="text-sm">{c.coach_reviews_label}</p>
            </div>
          ) : null}
          {c.coach_long_bio ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                {t('chat.longBioLabel')}
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.coach_long_bio}</p>
            </div>
          ) : null}
        </div>

        <Link
          href={`/chat?coach=${c.id}`}
          className="flex w-full justify-center items-center py-3 rounded-2xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/25 text-sm"
        >
          {t('coaches.contactByMessage')}
        </Link>
      </div>
    </details>
  )
}

export function CoachesDirectoryPage() {
  useStore((s) => s.locale)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    chatApi
      .coaches()
      .then((r) => {
        if (cancelled) return
        const data = r as { coaches?: Coach[] }
        setCoaches(data?.coaches ?? [])
      })
      .catch(() => {
        if (!cancelled) setError(t('coaches.loadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8">
        <p className="text-rose-600 dark:text-rose-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('coaches.pageTitle')}</h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{t('coaches.pageSubtitle')}</p>
        </header>

        {coaches.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">{t('coaches.empty')}</p>
        ) : (
          <div className="space-y-4">
            {coaches.map((c) => (
              <CoachDirectoryCard key={c.id} coach={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
