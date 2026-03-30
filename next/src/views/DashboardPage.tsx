// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  StatsOverview,
  SanctuaireLiens,
  FleurSynthese,
  EvolutionRadar,
  ChronicleList,
  InsightAI,
  InsightCard,
  GhostComparator,
  SèveTracker,
  DashboardCoachingChats,
  DashboardMyCoaches,
} from '@/components/dashboard'
import { BuyTarotCTA } from '@/components/BuyTarotCTA'

const EvolutionChart = dynamic(
  () => import('@/components/dashboard/EvolutionChart').then((m) => ({ default: m.EvolutionChart })),
  { ssr: false }
)
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ContextualHint } from '@/components/ContextualHint'
import { InfoBubble } from '@/components/InfoBubble'
import { fetchDashboardData } from '@/api/dashboard'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function DashboardPage() {
  const { user, isAdmin, isCoach } = useAuth()
  useStore((s) => s.locale)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const silverMode = (data?.access?.total_accumulated_eternal ?? 0) >= 200

  const refresh = () => {
    setLoading(true)
    setError(null)
    return fetchDashboardData()
      .then(setData)
      .catch((e) => setError((e as Error)?.message ?? 'Impossible de charger le dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // Si on revient sur l’onglet, on recharge (ex. crédit admin, achat, etc.)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DashboardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-20 px-4">
        <p className="text-amber-600 dark:text-amber-400 text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-5 py-2.5 bg-accent text-white rounded-xl font-medium hover:opacity-90"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const stats = data?.stats ?? {}
  const access = data?.access ?? {}
  const petalsAggregate = data?.petals_aggregate ?? {}
  const petalsAvg30d = data?.petals_avg_30d ?? {}
  const currentSession = data?.currentSession ?? null
  const chronicle = data?.chronicle ?? []
  const timeline = data?.timeline ?? []
  const last5Snapshots = data?.last5Snapshots ?? []
  const prairieFleurs = data?.prairieFleurs ?? []
  const prairieLinks = data?.prairieLinks ?? []
  const prairieMeFleur = data?.prairieMeFleur ?? null
  const meId = Number(prairieMeFleur?.user_id ?? user?.id) || 0

  return (
    <div
      className={`flex-1 min-h-0 overflow-y-auto ${
        silverMode ? 'bg-gradient-to-b from-slate-950 via-indigo-950/30 to-slate-950' : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 min-w-0">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <Breadcrumbs />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{t('dashboard.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboardSubtitle')}</p>
            <div className="mt-3 max-w-xl">
              <ContextualHint hintId="ctx_dashboard_nav" messageKey="onboarding.contextual.dashboard" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(isAdmin || isCoach) && (
              <Link
                href="/?view=coach"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/35 text-sm font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 transition-colors"
              >
                <span>💬</span> {t('nav.coachDashboard')}
              </Link>
            )}
            <Link
              href="/presentation"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>📖</span> {t('presentation.label')}
            </Link>
            <BuyTarotCTA />
          </div>
        </motion.header>

        <DashboardCoachingChats />

        <DashboardMyCoaches />

        {(() => {
          const hasSessionInProgress = currentSession?.status === 'in_progress'
          const hasPetals = Object.values(petalsAggregate).some((v) => (v ?? 0) > 0)
          if (hasSessionInProgress) {
            return (
              <Link
                href="/session"
                className="block p-4 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
              >
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300">👉 {t('dashboard.nextStep')}</p>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.resumeSession')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.sessionInProgress')}</p>
              </Link>
            )
          }
          if (!hasPetals && chronicle.length === 0) {
            return (
              <Link
                href="/fleur"
                className="block p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 hover:border-rose-400 dark:hover:border-rose-600 transition-colors"
              >
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">👉 {t('dashboard.startHere')}</p>
                <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.completeFleur')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.fleurDesc')}</p>
              </Link>
            )
          }
          return (
            <Link
              href="/tirage"
              className="block p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
            >
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">👉 {t('dashboard.suggestion')}</p>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.launchReading')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.readingDesc')}</p>
            </Link>
          )
        })()}

        <SanctuaireLiens prairieFleurs={prairieFleurs} prairieLinks={prairieLinks} prairieMeFleur={prairieMeFleur} meId={meId} />

        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{t('statsOverview.title')}</h2>
          <InfoBubble title={t('dashboard.statsLabel')} content={t('dashboard.statsDesc')} />
        </div>
        <StatsOverview stats={stats} />

        <SèveTracker
          tokenBalance={access?.token_balance ?? 0}
          eternalSap={access?.eternal_sap ?? 0}
          totalAccumulatedEternal={access?.total_accumulated_eternal ?? 0}
        />

        <div className="space-y-8">
          <FleurSynthese petals={petalsAggregate} size={240} />
          <EvolutionRadar currentPetals={currentSession?.petals} avgPetals30d={petalsAvg30d} currentSession={currentSession} />
          <GhostComparator timeline={timeline} />
        </div>

        <EvolutionChart timeline={timeline} />

        <div className="grid gap-4 sm:grid-cols-2">
          <InsightAI petals={petalsAggregate} />
          <InsightCard snapshots={last5Snapshots} />
        </div>

        <ChronicleList chronicle={chronicle} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-3"
        >
          <Link
            href="/session"
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <span className="text-2xl">🌿</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quickLinks.explorer')}</span>
          </Link>
          <Link
            href="/tirage"
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <span className="text-2xl">🎴</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quickLinks.tirages')}</span>
          </Link>
          <Link
            href="/fleur"
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <span className="text-2xl">🌸</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quickLinks.maFleur')}</span>
          </Link>
          <Link
            href={`${basePath}/mes-fleurs`}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <span className="text-2xl">📄</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quickLinks.mesFleurs')}</span>
          </Link>
          <Link
            href="/dreamscape"
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:border-accent/40 hover:bg-accent/5 transition-colors"
          >
            <span className="text-2xl">🌙</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('quickLinks.dreamscape')}</span>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
