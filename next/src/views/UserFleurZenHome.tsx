'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { FlowerSVG, PETAL_DEFS } from '@/components/FlowerSVG'
import { FleurTimeScroll, formatZenSnapshotDate } from '@/components/fleur/FleurTimeScroll'
import {
  ChronicleList,
  DashboardPowerPhrase,
  ZenHomeBrief,
  ZenHomeNextStep,
  ZenHomeMiniStats,
  ZenPetalLegend,
  ZenHomeShadowFocus,
} from '@/components/dashboard'
import { DashboardTuteurFab } from '@/components/dashboard/DashboardTuteurFab'
import { fetchDashboardData, dashboardApi } from '@/api/dashboard'
import { dominantPetalId, weakPetalsClickFilter, topPetalIds } from '@/lib/petal-tarot'
import type { ShadowZone } from '@/lib/petal-shadow'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { Breadcrumbs } from '@/components/Breadcrumbs'

const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

const ZEN_TIME_AUTO_MS = 8000

function petalZenLabel(petalId: string | null): string {
  if (!petalId) return ''
  const k = `fleurZen.petalLabels.${petalId}`
  const s = t(k)
  return s !== k ? s : PETAL_DEFS.find((p) => p.id === petalId)?.name ?? petalId
}

function normalizePetals(raw: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of PETAL_KEYS) {
    const v = Number(raw?.[k] ?? 0)
    out[k] = Math.min(1, Math.max(0, v))
  }
  return out
}

export function UserFleurZenHome() {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const locale = useStore((s) => s.locale)
  const { user } = useAuth()
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeIndex, setTimeIndex] = useState(-1)
  const [autoTimePlay, setAutoTimePlay] = useState(true)
  const [whisper, setWhisper] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchDashboardData()
      .then(setData)
      .catch((e) => setError((e as Error)?.message ?? '…'))
      .finally(() => setLoading(false))
  }, [])

  const aggregate = data?.petals_aggregate ?? {}
  const last5 = data?.last5Snapshots ?? []
  const chronicle = data?.chronicle ?? []
  const stats = data?.stats ?? {}
  const shadowZones = (data?.shadowZones ?? []) as ShadowZone[]
  const hasChronicleShadow = Boolean(data?.hasChronicleShadow)
  const currentSession = data?.currentSession ?? null

  const displayPetals = useMemo(() => {
    if (timeIndex < 0 || !last5[timeIndex]) {
      return normalizePetals(aggregate as Record<string, unknown>)
    }
    const snap = last5[timeIndex] as { petals?: Record<string, unknown> }
    const p = snap.petals
    if (p && typeof p === 'object') return normalizePetals(p)
    return normalizePetals(aggregate as Record<string, unknown>)
  }, [timeIndex, last5, aggregate])

  const pulseId = useMemo(() => dominantPetalId(displayPetals), [displayPetals])
  const labelAnchorIds = useMemo(() => topPetalIds(displayPetals, 3, 0.04), [displayPetals])
  const accentPetalName = useMemo(() => (pulseId ? petalZenLabel(pulseId) : ''), [pulseId, locale])
  const accentPetalColor = useMemo(() => {
    if (!pulseId) return null
    return PETAL_DEFS.find((p) => p.id === pulseId)?.color ?? null
  }, [pulseId])

  const hasPetals = useMemo(
    () => Object.values(displayPetals).some((v) => (v ?? 0) > 0.05),
    [displayPetals]
  )

  const timeStateCaption = useMemo(() => {
    if (timeIndex < 0) {
      return { mode: 'present' as const, text: t('fleurZen.timeCaptionPresent') }
    }
    const snap = last5[timeIndex] as Record<string, unknown> | undefined
    if (!snap) {
      return { mode: 'present' as const, text: t('fleurZen.timeCaptionPresent') }
    }
    const petals = normalizePetals(snap.petals as Record<string, unknown> | undefined)
    const did = dominantPetalId(petals)
    const petalName = petalZenLabel(did)
    const dateStr = formatZenSnapshotDate(snap.date as string | undefined, locale)
    const detail = String(snap.summary ?? snap.label ?? '').trim()
    if (detail) {
      return { mode: 'snapshot' as const, date: dateStr, detail, petalName }
    }
    if (petalName) {
      return { mode: 'petalOnly' as const, date: dateStr, petalName }
    }
    return { mode: 'dateOnly' as const, date: dateStr }
  }, [timeIndex, last5, locale])

  const clickablePetalsFilter = useMemo(() => weakPetalsClickFilter(displayPetals), [displayPetals])

  const chronicleWhisperSubhint = useMemo(() => {
    if (last5.length >= 2) return t('fleurZen.readingLevel3HintTrend')
    return t('fleurZen.readingLevel3HintSingle')
  }, [last5.length, locale])

  useEffect(() => {
    if (!data) return
    const snaps = (data.last5Snapshots ?? []) as Array<Record<string, unknown>>
    if (snaps.length < 2) {
      setWhisper(t('fleurZen.readingLevel3SingleSnapshot'))
      return
    }
    let cancelled = false
    dashboardApi
      .getTrend(snaps)
      .then((r) => {
        if (!cancelled) setWhisper(String((r as { trend?: string })?.trend ?? '').trim())
      })
      .catch(() => {
        if (!cancelled) setWhisper('')
      })
    return () => {
      cancelled = true
    }
  }, [data, locale])

  useEffect(() => {
    if (reduceMotion || !autoTimePlay || last5.length === 0) return
    const id = window.setInterval(() => {
      setTimeIndex((prev) => {
        const maxI = last5.length - 1
        if (prev < 0) return 0
        if (prev < maxI) return prev + 1
        return -1
      })
    }, ZEN_TIME_AUTO_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion, autoTimePlay, last5.length])

  const handleManualTimeSelect = useCallback((index: number) => {
    setAutoTimePlay(false)
    setTimeIndex(index)
  }, [])

  const handlePetalClick = useCallback((petalId: string) => {
    router.push(`/tirage?petal=${encodeURIComponent(petalId)}`)
  }, [router])

  const timeSnapshots = useMemo(
    () =>
      (last5 as Array<Record<string, unknown>>).map((s, i) => ({
        id: String(s.id ?? i),
        date: s.date as string | undefined,
        label: (s.label as string) || (s.type as string) || '',
        type: s.type as string | undefined,
      })),
    [last5]
  )

  const statsHref = useMemo(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    p.set('view', 'stats')
    const q = p.toString()
    return `${pathname}${q ? `?${q}` : ''}`
  }, [pathname, searchParams])

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" aria-hidden />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 bg-slate-950 text-amber-300/90 text-sm text-center">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-xs uppercase tracking-widest text-teal-400/90 border border-teal-500/40 px-4 py-2 rounded-full"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_38%,rgba(30,27,75,0.38),transparent)]" />

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28 sm:pb-32">
          <header className="text-center xl:text-left space-y-2 mb-4 sm:mb-5">
            <Breadcrumbs />
            <h1 className="text-xl sm:text-2xl font-light tracking-[0.2em] uppercase text-white/90">{t('fleurZen.title')}</h1>
            <p className="text-xs sm:text-[13px] text-white/50 font-light tracking-wide max-w-2xl mx-auto xl:mx-0">
              {t('fleurZen.subtitle')}
            </p>
          </header>

          <ZenHomeBrief
            petals={normalizePetals(aggregate as Record<string, unknown>)}
            chronicle={chronicle as Array<Record<string, unknown>>}
          />

          <ZenHomeShadowFocus zones={shadowZones} hasChronicleShadow={hasChronicleShadow} />

          <ZenHomeNextStep
            currentSession={currentSession as { status?: string } | null}
            hasPetals={hasPetals}
            chronicleCount={chronicle.length}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:items-start">
            <section className="xl:col-span-5 flex flex-col items-center xl:items-stretch space-y-4 sm:space-y-5 min-w-0">
              <DashboardPowerPhrase
                petals={displayPetals}
                variant="zen"
                className="max-w-md xl:max-w-none w-full"
                labelKey="fleurZen.personalReadingLabel"
                hintKey="fleurZen.personalReadingHint"
              />

              <div className="relative flex justify-center w-full isolate [&_.flower-svg]:max-w-[min(100%,320px)]">
                <div
                  className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,300px)] aspect-square rounded-full bg-gradient-to-tr from-violet-600/30 via-teal-500/18 to-fuchsia-600/22 blur-3xl ${
                    reduceMotion ? 'opacity-70' : 'opacity-90 motion-safe:animate-[pulse_5s_ease-in-out_infinite]'
                  }`}
                  aria-hidden
                />
                <FlowerSVG
                  petals={displayPetals}
                  size={300}
                  animate
                  showLabels
                  showScores
                  labelsOnHoverOnly
                  pinnedLabelIds={labelAnchorIds}
                  labelTheme="dark"
                  labelPeekMs={2800}
                  visualPreset="zen"
                  historicalView={timeIndex >= 0}
                  pulsePetalId={pulseId}
                  disablePulse={!!reduceMotion}
                  onPetalClick={handlePetalClick}
                  clickablePetals={clickablePetalsFilter}
                  svgClassName="relative z-[1] mx-auto"
                />
              </div>

              <div className="w-full max-w-md xl:max-w-none mx-auto space-y-3">
                <ZenPetalLegend petals={displayPetals} />

                <div className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm px-4 py-4">
                  <div className="space-y-2 text-center xl:text-left">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/75">
                      {t('fleurZen.snapshotLabel')}
                    </p>
                    <div className="text-sm sm:text-base text-violet-50/95 leading-relaxed space-y-1.5" aria-live="polite">
                      {timeStateCaption.mode === 'present' ? (
                        <p>{timeStateCaption.text}</p>
                      ) : timeStateCaption.mode === 'snapshot' ? (
                        <>
                          <p className="text-xs text-white/45 tracking-wide">{timeStateCaption.date}</p>
                          <p>{timeStateCaption.detail}</p>
                        </>
                      ) : timeStateCaption.mode === 'petalOnly' ? (
                        <p>{t('fleurZen.timeCaptionSnapshotPetal', { date: timeStateCaption.date, petal: timeStateCaption.petalName })}</p>
                      ) : (
                        <p>{t('fleurZen.timeCaptionSnapshotDate', { date: timeStateCaption.date })}</p>
                      )}
                    </div>
                  </div>
                  {accentPetalName ? (
                    <div className="mt-3 pt-3 border-t border-white/10 text-center xl:text-left">
                      <p
                        className="text-sm font-semibold"
                        style={accentPetalColor ? { color: accentPetalColor } : undefined}
                      >
                        {t('fleurZen.accentOnView', { petal: accentPetalName })}
                      </p>
                    </div>
                  ) : null}
                </div>

                {timeSnapshots.length > 0 ? (
                  <FleurTimeScroll
                    snapshots={timeSnapshots}
                    selectedIndex={timeIndex}
                    onSelect={handleManualTimeSelect}
                    variant="sliderOnly"
                    showResumeAuto={!autoTimePlay && !reduceMotion}
                    onResumeAuto={() => setAutoTimePlay(true)}
                    className="!max-w-none w-full"
                  />
                ) : null}

                <div className="rounded-xl border border-white/[0.07] bg-slate-950/35 px-3.5 py-3 space-y-2 text-center xl:text-left text-[11px] sm:text-xs leading-relaxed text-white/50">
                  <p>{t('fleurZen.zenHelpPetal')}</p>
                  <p className="border-t border-white/[0.06] pt-2">
                    {timeSnapshots.length > 0 ? t('fleurZen.zenHelpTime') : t('fleurZen.zenHelpTimeEmpty')}
                  </p>
                </div>

                <ZenHomeMiniStats stats={stats as Record<string, unknown>} />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center xl:justify-start gap-3 pt-1 w-full">
                <Link
                  href={statsHref}
                  className="text-xs sm:text-[13px] font-medium text-teal-300/90 hover:text-teal-200 border border-teal-500/35 hover:border-teal-400/55 bg-teal-950/30 px-5 py-2.5 rounded-full transition-colors whitespace-nowrap"
                >
                  {t('fleurZen.detailsStatsLong')}
                </Link>
              </div>
            </section>

            <section className="xl:col-span-7 w-full min-w-0">
              {chronicle.length > 0 ? (
                <ChronicleList
                  chronicle={chronicle.slice(0, 12)}
                  layout="grid"
                  journalTitle
                  journalTitleKey="fleurZen.journalTitleZen"
                  journalDescKey="fleurZen.journalDescZen"
                  whisperLabelKey="fleurZen.trendLabel"
                  variant="zen"
                  compact
                  whisper={whisper || null}
                  whisperSubhint={chronicleWhisperSubhint}
                />
              ) : whisper ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-sm space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-violet-300/70">{t('fleurZen.trendLabel')}</p>
                  <p className="text-[9px] uppercase tracking-wider text-violet-300/55">{chronicleWhisperSubhint}</p>
                  <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed">{whisper}</p>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      <DashboardTuteurFab petals={normalizePetals(aggregate as Record<string, unknown>)} />

      <span className="sr-only" aria-live="polite">
        {user?.email ? `${t('fleurZen.title')} — ${user.email}` : ''}
      </span>
    </div>
  )
}
