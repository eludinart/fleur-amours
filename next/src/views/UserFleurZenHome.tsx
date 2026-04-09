'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { FlowerSVG, PETAL_DEFS } from '@/components/FlowerSVG'
import { FleurTimeScroll, formatZenSnapshotDate } from '@/components/fleur/FleurTimeScroll'
import { ChronicleList } from '@/components/dashboard/ChronicleList'
import { DashboardPowerPhrase } from '@/components/dashboard/DashboardPowerPhrase'
import { DashboardTuteurFab } from '@/components/dashboard/DashboardTuteurFab'
import { fetchDashboardData, dashboardApi } from '@/api/dashboard'
import { dominantPetalId, weakPetalsClickFilter, topPetalIds } from '@/lib/petal-tarot'
import { isSessionMantraEcho } from '@/lib/session-mantra-echo'
import { zenReadingLevel1Line } from '@/lib/flower-header-line'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { Breadcrumbs } from '@/components/Breadcrumbs'

const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

const ZEN_TIME_AUTO_MS = 8000
const ZEN_HAIKU_SS_PREFIX = 'jardin.zenHaiku.v1'
const ZEN_HAIKU_TTL_MS = 1000 * 60 * 60 * 48

function petalsFingerprint(p: Record<string, number>): string {
  return PETAL_KEYS.map((k) => `${k}=${Number(p[k] ?? 0).toFixed(3)}`).join('&')
}

function readZenHaikuStorage(cacheKey: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${ZEN_HAIKU_SS_PREFIX}:${cacheKey}`)
    if (!raw) return null
    const j = JSON.parse(raw) as { h?: string; t?: number }
    if (!j?.h || typeof j.t !== 'number') return null
    if (Date.now() - j.t > ZEN_HAIKU_TTL_MS) return null
    return j.h
  } catch {
    return null
  }
}

function writeZenHaikuStorage(cacheKey: string, h: string) {
  try {
    sessionStorage.setItem(`${ZEN_HAIKU_SS_PREFIX}:${cacheKey}`, JSON.stringify({ h, t: Date.now() }))
  } catch {
    /* quota */
  }
}

function petalZenLabel(petalId: string | null, tr: typeof t): string {
  if (!petalId) return ''
  const k = `fleurZen.petalLabels.${petalId}`
  const s = tr(k)
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
  const [whisper, setWhisper] = useState<string>('')
  const [flowerHaiku, setFlowerHaiku] = useState<string | null>(null)
  const [haikuLoading, setHaikuLoading] = useState(false)
  const zenHaikuMemRef = useRef<Map<string, string>>(new Map())

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
  const sessionMantra = (data as { sessionMantra?: string | null } | null)?.sessionMantra ?? null

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

  const accentPetalName = useMemo(() => (pulseId ? petalZenLabel(pulseId, t) : ''), [pulseId, locale])

  const accentPetalColor = useMemo(() => {
    if (!pulseId) return null
    return PETAL_DEFS.find((p) => p.id === pulseId)?.color ?? null
  }, [pulseId])

  const timeStateCaption = useMemo(() => {
    if (timeIndex < 0) {
      return t('fleurZen.timeCaptionPresent')
    }
    const snap = last5[timeIndex] as Record<string, unknown> | undefined
    if (!snap) return t('fleurZen.timeCaptionPresent')
    const petals = normalizePetals(snap.petals as Record<string, unknown> | undefined)
    const did = dominantPetalId(petals)
    const petalName = petalZenLabel(did, t)
    const dateStr = formatZenSnapshotDate(snap.date as string | undefined, locale)
    const rawLabel = String(snap.label || snap.type || '').trim()
    const short = rawLabel.length > 88 ? `${rawLabel.slice(0, 85)}…` : rawLabel
    if (short) {
      return t('fleurZen.timeCaptionSnapshot', { date: dateStr, detail: short })
    }
    if (petalName) {
      return t('fleurZen.timeCaptionSnapshotPetal', { date: dateStr, petal: petalName })
    }
    return t('fleurZen.timeCaptionSnapshotDate', { date: dateStr })
  }, [timeIndex, last5, locale, t])

  const haikuCacheKey = useMemo(() => {
    if (timeIndex < 0) {
      return `${locale}|blend|${petalsFingerprint(displayPetals)}`
    }
    const s = last5[timeIndex] as Record<string, unknown> | undefined
    const sid = s ? String(s.id ?? timeIndex) : String(timeIndex)
    return `${locale}|snap|${sid}|${petalsFingerprint(displayPetals)}`
  }, [timeIndex, last5, displayPetals, locale])

  const haikuKeyRef = useRef(haikuCacheKey)
  haikuKeyRef.current = haikuCacheKey

  useEffect(() => {
    if (!data) return
    const key = haikuCacheKey
    const mem = zenHaikuMemRef.current.get(key)
    if (mem) {
      setFlowerHaiku(mem)
      setHaikuLoading(false)
      return
    }
    const fromSs = readZenHaikuStorage(key)
    if (fromSs) {
      zenHaikuMemRef.current.set(key, fromSs)
      setFlowerHaiku(fromSs)
      setHaikuLoading(false)
      return
    }
    let cancelled = false
    setHaikuLoading(true)
    const mode = timeIndex < 0 ? 'blend' : 'snapshot'
    const snap = timeIndex >= 0 ? (last5[timeIndex] as Record<string, unknown> | undefined) : undefined
    const labelParts = [snap?.label, snap?.type].filter(Boolean).map(String)
    let snapshotLabel = labelParts.join(' — ')
    if (snap && chronicle.length > 0) {
      const chMatch = chronicle.find((c) => String(c.id) === String(snap.id))
      const syn = chMatch?.synthesis ? String(chMatch.synthesis).trim() : ''
      if (syn.length > snapshotLabel.length) snapshotLabel = syn
    }
    dashboardApi
      .getFlowerStateHaiku({
        mode,
        petals: displayPetals,
        locale,
        cacheKey: key,
        snapshotMeta:
          mode === 'snapshot' && snap
            ? {
                dateIso: snap.date ? String(snap.date) : undefined,
                type: snap.type ? String(snap.type) : undefined,
                label: snapshotLabel.slice(0, 800) || undefined,
              }
            : undefined,
      })
      .then((r) => {
        if (cancelled || haikuKeyRef.current !== key) return
        const h = String((r as { haiku?: string })?.haiku ?? '').trim()
        if (h) {
          zenHaikuMemRef.current.set(key, h)
          writeZenHaikuStorage(key, h)
          setFlowerHaiku(h)
        } else {
          setFlowerHaiku(null)
        }
      })
      .catch(() => {
        if (!cancelled && haikuKeyRef.current === key) setFlowerHaiku(null)
      })
      .finally(() => {
        if (!cancelled && haikuKeyRef.current === key) setHaikuLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [data, haikuCacheKey, timeIndex, last5, displayPetals, locale, chronicle])

  const clickablePetalsFilter = useMemo(() => weakPetalsClickFilter(displayPetals), [displayPetals])

  const headerEpigraph = useMemo(() => {
    if (sessionMantra && !isSessionMantraEcho(sessionMantra)) return sessionMantra.trim()
    return zenReadingLevel1Line(displayPetals, t)
  }, [sessionMantra, displayPetals, locale])

  const epigraphIsLevel1Shape = useMemo(
    () => !(sessionMantra && !isSessionMantraEcho(sessionMantra)),
    [sessionMantra],
  )

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
          <header className="text-center xl:text-left space-y-2 mb-6 sm:mb-8">
            <Breadcrumbs />
            <h1 className="text-xl sm:text-2xl font-light tracking-[0.2em] uppercase text-white/90">{t('fleurZen.title')}</h1>
            <p className="text-xs sm:text-[13px] text-white/50 font-light tracking-wide max-w-2xl mx-auto xl:mx-0">
              {t('fleurZen.subtitle')}
            </p>
            {headerEpigraph ? (
              <div className="pt-3 max-w-3xl mx-auto xl:mx-0 text-center xl:text-left space-y-1.5">
                {epigraphIsLevel1Shape ? (
                  <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300/65">{t('fleurZen.readingLevel1Label')}</p>
                ) : null}
                <p className="text-base sm:text-lg md:text-xl font-medium leading-snug text-violet-100/95 italic">
                  « {headerEpigraph} »
                </p>
              </div>
            ) : null}
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:items-start">
            <section className="xl:col-span-5 flex flex-col items-center xl:items-center space-y-4 sm:space-y-5 min-w-0">
              <DashboardPowerPhrase petals={displayPetals} variant="zen" className="max-w-md xl:max-w-none" />
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
                  showScores={false}
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
                  svgClassName="relative z-[1]"
                />
              </div>

              <div className="w-full max-w-md mx-auto mt-1 space-y-3">
                <div className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-sm px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="space-y-2.5 text-center w-full max-w-lg mx-auto">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/75">
                      {t('fleurZen.flowerStateLabel')}
                    </p>
                    <p
                      className="whitespace-pre-line text-sm sm:text-base text-violet-50/95 leading-[1.7] text-balance px-0.5"
                      aria-live="polite"
                    >
                      {flowerHaiku ?? timeStateCaption}
                    </p>
                    {haikuLoading && !flowerHaiku ? (
                      <p className="text-[10px] text-violet-300/55 motion-safe:animate-pulse">{t('fleurZen.haikuLoading')}</p>
                    ) : null}
                  </div>
                  {accentPetalName ? (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-1.5 text-center">
                      <p
                        className="text-[10px] uppercase tracking-[0.2em] opacity-80"
                        style={accentPetalColor ? { color: accentPetalColor } : undefined}
                      >
                        {t('fleurZen.flowerAccentLabel')}
                      </p>
                      <p
                        className="text-base sm:text-[17px] font-semibold tracking-wide"
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

                <div className="rounded-xl border border-white/[0.07] bg-slate-950/35 px-3.5 py-3 space-y-2.5 text-center">
                  <p className="text-[11px] sm:text-xs leading-relaxed text-teal-200/80">
                    {t('fleurZen.zenHelpPetal')}
                  </p>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-white/42 border-t border-white/[0.06] pt-2.5">
                    {timeSnapshots.length > 0 ? t('fleurZen.zenHelpTime') : t('fleurZen.zenHelpTimeEmpty')}
                  </p>
                </div>
              </div>

              {chronicle.length === 0 && whisper ? (
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 xl:hidden space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-violet-300/70">
                    {t('chronicle.tutorWhisperLabel')}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-violet-300/55">{chronicleWhisperSubhint}</p>
                  <p className="text-sm text-violet-100/90 italic leading-relaxed line-clamp-5">{whisper}</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full">
                <Link
                  href={statsHref}
                  className="text-[11px] tracking-[0.18em] uppercase text-white/55 hover:text-white/85 border border-white/18 hover:border-white/35 px-6 py-2.5 rounded-full transition-colors whitespace-nowrap"
                >
                  {t('fleurZen.detailsStats')}
                </Link>
              </div>
            </section>

            <section className="xl:col-span-7 w-full min-w-0">
              {chronicle.length > 0 ? (
                <ChronicleList
                  chronicle={chronicle.slice(0, 12)}
                  layout="grid"
                  journalTitle
                  variant="zen"
                  compact
                  whisper={whisper || null}
                  whisperSubhint={chronicleWhisperSubhint}
                />
              ) : whisper ? (
                <div className="hidden xl:block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-sm space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-violet-300/70">
                    {t('chronicle.tutorWhisperLabel')}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-violet-300/55">{chronicleWhisperSubhint}</p>
                  <p className="text-sm sm:text-base text-violet-100/90 italic leading-relaxed">{whisper}</p>
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
