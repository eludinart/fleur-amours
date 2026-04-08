'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { FlowerSVG } from '@/components/FlowerSVG'
import { FleurTimeScroll } from '@/components/fleur/FleurTimeScroll'
import { fetchDashboardData } from '@/api/dashboard'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { Breadcrumbs } from '@/components/Breadcrumbs'

const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

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
  const reduceMotion = useReducedMotion()
  useStore((s) => s.locale)
  const { user } = useAuth()
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeIndex, setTimeIndex] = useState(-1)

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
  const prairieLinks = data?.prairieLinks ?? []

  const displayPetals = useMemo(() => {
    if (timeIndex < 0 || !last5[timeIndex]) {
      return normalizePetals(aggregate as Record<string, unknown>)
    }
    const snap = last5[timeIndex] as { petals?: Record<string, unknown> }
    const p = snap.petals
    if (p && typeof p === 'object') return normalizePetals(p)
    return normalizePetals(aggregate as Record<string, unknown>)
  }, [timeIndex, last5, aggregate])

  const socialBreathSec = useMemo(() => {
    const n = Array.isArray(prairieLinks) ? prairieLinks.length : 0
    return 5.5 + 5 * Math.exp(-n / 4)
  }, [prairieLinks])

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
    <div className="flex-1 min-h-0 relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(30,27,75,0.35),transparent)]" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-6 space-y-6">
          <header className="text-center space-y-1">
            <Breadcrumbs />
            <h1 className="text-lg font-light tracking-[0.25em] uppercase text-white/85">{t('fleurZen.title')}</h1>
            <p className="text-[11px] text-white/45 font-light tracking-wide">{t('fleurZen.subtitle')}</p>
          </header>

          <motion.div
            className="flex justify-center will-change-transform"
            animate={reduceMotion ? {} : { scale: [1, 1.02, 1] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: socialBreathSec, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <FlowerSVG
              petals={displayPetals}
              size={280}
              animate
              showLabels
              showScores={false}
              labelsOnHoverOnly
            />
          </motion.div>

          <p className="text-center text-[10px] text-white/40 max-w-xs mx-auto leading-relaxed">
            {t('fleurZen.chromaticHint')}
          </p>

          <FleurTimeScroll snapshots={timeSnapshots} selectedIndex={timeIndex} onSelect={setTimeIndex} />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={statsHref}
              className="text-[11px] tracking-[0.18em] uppercase text-white/50 hover:text-white/80 border border-white/15 hover:border-white/30 px-5 py-2.5 rounded-full transition-colors"
            >
              {t('fleurZen.detailsStats')}
            </Link>
          </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {user?.email ? `${t('fleurZen.title')} — ${user.email}` : ''}
      </span>
    </div>
  )
}
