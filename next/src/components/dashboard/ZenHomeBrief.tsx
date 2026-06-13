'use client'

import { useEffect, useState, useMemo } from 'react'
import { dashboardApi, type ZenBrief } from '@/api/dashboard'
import { PETAL_DEFS } from '@/components/FlowerSVG'
import { topPetalIds, PETAL_ORDER } from '@/lib/petal-tarot'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const SESSION_CACHE_KEY = 'zen_brief_v2'

function petalLabel(id: string): string {
  const key = `fleurZen.petalLabels.${id}`
  const s = t(key)
  return s !== key ? s : PETAL_DEFS.find((p) => p.id === id)?.name ?? id
}

function hasProfile(petals: Record<string, number>): boolean {
  const maxV = Math.max(...PETAL_ORDER.map((id) => Number(petals[id] ?? 0)), 0)
  return maxV >= 0.04
}

function normalizeBrief(raw: Record<string, unknown>): ZenBrief | null {
  const headline = String(raw.headline ?? '').trim()
  const profile = String(raw.profile ?? raw.portrait ?? '').trim()
  const aspirations = String(raw.aspirations ?? '').trim()
  const movement = String(raw.movement ?? '').trim()
  if (!headline && !profile && !aspirations && !movement) return null
  return { headline, profile, aspirations, movement }
}

function readSessionCache(fetchKey: string): ZenBrief | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { key?: string; brief?: Record<string, unknown> }
    if (parsed.key !== fetchKey || !parsed.brief) return null
    return normalizeBrief(parsed.brief)
  } catch {
    return null
  }
}

function writeSessionCache(fetchKey: string, brief: ZenBrief) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ key: fetchKey, brief }))
  } catch {
    /* ignore */
  }
}

function buildLocalBrief(
  chronicle: Array<Record<string, unknown>>,
  petals: Record<string, number>
): ZenBrief {
  const top2 = topPetalIds(petals, 2, 0.04)
  const themes = chronicle
    .slice(0, 5)
    .map((c) => String(c.synthesis ?? '').trim())
    .filter((s) => s.length > 16)

  const headline =
    top2[0] && hasProfile(petals)
      ? t('fleurZen.briefFallbackHeadline', { petal: petalLabel(top2[0]) })
      : t('fleurZen.briefFallbackHeadlineGeneric')

  const profile =
    top2[0] && hasProfile(petals)
      ? t('fleurZen.briefLocalProfile', {
          petal1: petalLabel(top2[0]),
          petal2: top2[1] ? petalLabel(top2[1]) : petalLabel(top2[0]),
        })
      : t('fleurZen.briefLocalProfileEmpty')

  const aspirations =
    themes.length >= 2
      ? t('fleurZen.briefLocalAspirations', { theme1: themes[0], theme2: themes[1] })
      : themes[0]
        ? t('fleurZen.briefLocalAspirationsSingle', { theme: themes[0] })
        : t('fleurZen.briefLocalAspirationsEmpty')

  const movement =
    top2[1] && hasProfile(petals)
      ? t('fleurZen.briefLocalMovement', { petal: petalLabel(top2[1]) })
      : t('fleurZen.briefLocalMovementGeneric')

  return { headline, profile, aspirations, movement }
}

function BriefSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-sm sm:text-[15px] text-violet-100/88 leading-relaxed">{text}</p>
    </div>
  )
}

export function ZenHomeBrief({
  petals,
  chronicle = [],
}: {
  petals: Record<string, number>
  chronicle?: Array<Record<string, unknown>>
}) {
  const locale = useStore((s) => s.locale)

  const chronicleKey = useMemo(
    () =>
      chronicle
        .slice(0, 10)
        .map((c) => `${c.type}:${String(c.synthesis ?? '').slice(0, 48)}`)
        .join('|'),
    [chronicle]
  )

  const fetchKey = `${locale}|${chronicleKey}`

  const hasAnyActivity = useMemo(
    () => chronicle.length > 0 || hasProfile(petals),
    [chronicle.length, petals]
  )

  const [brief, setBrief] = useState<ZenBrief | null>(() =>
    hasAnyActivity ? readSessionCache(fetchKey) : null
  )
  const [initialLoading, setInitialLoading] = useState(() => hasAnyActivity && !readSessionCache(fetchKey))

  useEffect(() => {
    if (!hasAnyActivity) {
      setBrief(null)
      setInitialLoading(false)
      return
    }

    const cached = readSessionCache(fetchKey)
    if (cached) {
      setBrief(cached)
      setInitialLoading(false)
    }

    let cancelled = false

    dashboardApi
      .getZenBrief(locale)
      .then((res) => {
        if (cancelled) return
        const b = normalizeBrief(res.brief as Record<string, unknown>)
        if (b) {
          setBrief(b)
          writeSessionCache(fetchKey, b)
        } else if (!cached) {
          setBrief(buildLocalBrief(chronicle, petals))
        }
      })
      .catch(() => {
        if (cancelled) return
        setBrief((prev) => prev ?? buildLocalBrief(chronicle, petals))
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchKey encode locale + chronicle
  }, [fetchKey, hasAnyActivity, locale])

  if (!hasAnyActivity) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm px-4 py-4 mb-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/75 mb-2">{t('fleurZen.briefTitle')}</p>
        <p className="text-sm text-violet-100/90 leading-relaxed">{t('fleurZen.briefNoData')}</p>
      </div>
    )
  }

  if (initialLoading && !brief) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm px-4 py-4 mb-5 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/75">{t('fleurZen.briefTitle')}</p>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-2/3" />
          <div className="h-3 bg-white/8 rounded w-full" />
          <div className="h-3 bg-white/8 rounded w-11/12" />
        </div>
        <p className="text-[10px] text-white/30">{t('fleurZen.briefLoading')}</p>
      </div>
    )
  }

  const summary = brief ?? buildLocalBrief(chronicle, petals)

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm px-4 py-4 mb-5 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/75">{t('fleurZen.briefTitle')}</p>

      {summary.headline ? (
        <p className="text-base sm:text-lg font-semibold text-violet-50/95 leading-snug">{summary.headline}</p>
      ) : null}

      {summary.profile ? (
        <BriefSection label={t('fleurZen.briefProfileLabel')} text={summary.profile} />
      ) : null}

      {summary.aspirations ? (
        <div className="pt-2 border-t border-white/10">
          <BriefSection label={t('fleurZen.briefAspirationsLabel')} text={summary.aspirations} />
        </div>
      ) : null}

      {summary.movement ? (
        <div className="pt-2 border-t border-white/10">
          <BriefSection label={t('fleurZen.briefMovementLabel')} text={summary.movement} />
        </div>
      ) : null}
    </div>
  )
}
