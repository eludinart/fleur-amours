'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { ExportMyceliumReport } from '@/components/ExportMyceliumReport'
import { MyceliumReportPrintable } from '@/components/MyceliumReportPrintable'
import { myceliumApi, type StatsDTO, type TeamDTO, type MyceliumSynthesisDTO } from '@/api/mycelium'
import { PETAL_IDS_ORDER, petalLabel } from '@/lib/mycelium-lexicon'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const WINDOWS = [7, 30, 90]

export default function MyceliumDashboardPage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [teamId, setTeamId] = useState<number | undefined>(undefined)
  const [windowDays, setWindowDays] = useState(30)
  const [stats, setStats] = useState<StatsDTO | null>(null)
  const [synthesis, setSynthesis] = useState<MyceliumSynthesisDTO | null>(null)
  const [synthLoading, setSynthLoading] = useState(false)
  const [hasOrg, setHasOrg] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    myceliumApi
      .stats({ teamId, windowDays })
      .then((r) => {
        if (cancelled) return
        setStats(r)
        setTeams(r.teams || [])
        setHasOrg(!r.needsOrg && !!r.org)
      })
      .catch((e) => {
        if (cancelled) return
        setStats(null)
        setHasOrg(false)
        setError((e as { message?: string })?.message || t('mycelium.error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, windowDays])

  useEffect(() => {
    if (!hasOrg || !stats?.org) {
      if (stats?.needsOrg || (stats && !stats.org)) {
        setSynthesis({
          summary: t('mycelium.dashboardNoOrgHint'),
          actions: [t('mycelium.createOrgCta')],
          cached_at: new Date().toISOString(),
          provider: 'setup',
        })
      }
      return
    }
    let cancelled = false
    setSynthLoading(true)
    myceliumApi
      .synthesis({ teamId, windowDays, locale })
      .then((r) => {
        if (!cancelled) setSynthesis(r.synthesis)
      })
      .catch(() => {
        if (!cancelled) setSynthesis(null)
      })
      .finally(() => {
        if (!cancelled) setSynthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId, windowDays, locale, hasOrg, stats?.org, stats?.needsOrg])

  async function refreshSynthesis(force = false) {
    setSynthLoading(true)
    try {
      const r = await myceliumApi.synthesis({ teamId, windowDays, locale, force })
      setSynthesis(r.synthesis)
    } catch {
      /* ignore */
    } finally {
      setSynthLoading(false)
    }
  }

  const climate = stats?.dashboard.current
  const petals = climate?.petalsAverage ? scoresToPetals(climate.petalsAverage) : null
  const pdfFilename = stats?.org
    ? `Mycelium-QVT-${stats.org.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
    : 'Mycelium-QVT.pdf'

  return (
    <div className="flex-1 min-h-0 px-4 py-6 sm:px-6">
      {stats && (
        <MyceliumReportPrintable stats={stats} synthesis={synthesis} />
      )}
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('mycelium.dashboardTitle')}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.dashboardSubtitle')}</p>
            {stats?.org && (
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{stats.org.name}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {stats && (
              <ExportMyceliumReport
                getRoot={() => document.getElementById('mycelium-report-print')}
                filename={pdfFilename}
              />
            )}
            <Link
              href="/mycelium/espace"
              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              {t('mycelium.espaceLink')}
            </Link>
            <Link
              href="/mycelium/admin"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('mycelium.adminLink')}
            </Link>
          </div>
        </header>

        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
          {t('mycelium.privacyNote')}
        </p>

        {!hasOrg && !loading ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-300">{t('mycelium.dashboardNoOrgHint')}</p>
            <Link
              href="/mycelium/admin"
              className="mt-4 inline-block rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {t('mycelium.createOrgCta')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              <select
                value={teamId ?? ''}
                onChange={(e) => setTeamId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">{t('mycelium.allOrg')}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWindowDays(w)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      windowDays === w
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {w}j
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Adoption */}
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label={t('mycelium.statMembers')} value={String(stats.members)} />
                  <Stat
                    label={t('mycelium.participationRate')}
                    value={`${stats.adoption.participationRate}%`}
                  />
                  <Stat label={t('mycelium.profilesCount')} value={String(stats.adoption.withProfile)} />
                  <Stat label={t('mycelium.pulses30d')} value={String(stats.adoption.checkinCount30d)} />
                </section>

                {/* Synthèse IA */}
                <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900 dark:bg-violet-950/20">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.synthesisTitle')}</h2>
                    <button
                      type="button"
                      onClick={() => refreshSynthesis(true)}
                      disabled={synthLoading}
                      className="text-xs font-semibold text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-300"
                    >
                      {synthLoading ? '…' : t('mycelium.synthesisRefresh')}
                    </button>
                  </div>
                  {synthesis ? (
                    <>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{synthesis.summary}</p>
                      {synthesis.actions.length > 0 && (
                        <ul className="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {synthesis.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {synthesis.provider === 'openrouter' || synthesis.provider === 'mistral'
                          ? t('mycelium.synthesisAi')
                          : t('mycelium.synthesisFallback')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">{t('mycelium.synthesisLoading')}</p>
                  )}
                </section>

                {/* Climat */}
                {!climate?.available ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                    <p className="text-slate-600 dark:text-slate-300">{t('mycelium.climateUnavailable')}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {t('mycelium.climateThreshold')} {climate?.threshold ?? 5}
                      {climate?.reason === 'below_threshold'
                        ? ` — ${climate.respondents}/${climate.threshold} ${t('mycelium.respondents').toLowerCase()}`
                        : ''}
                    </p>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('mycelium.dashboardEmptyHint')}</p>
                  </div>
                ) : (
                  <>
                    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Stat label={t('mycelium.respondents')} value={String(climate.respondents)} />
                      <Stat
                        label={t('mycelium.moodAvg')}
                        value={climate.moodAverage != null ? `${climate.moodAverage}/5` : '—'}
                      />
                      <Stat
                        label={t('mycelium.moodTrend')}
                        value={
                          stats.dashboard.moodDelta != null
                            ? `${stats.dashboard.moodDelta > 0 ? '+' : ''}${stats.dashboard.moodDelta}`
                            : '—'
                        }
                      />
                    </section>

                    {/* Carte collective + dimensions (forme d'AmOurs + lexique pro) */}
                    {climate.petalsAverage && petals && (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                          {t('mycelium.dimensionsTitle')}
                        </h2>
                        <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
                          {t('mycelium.dimensionsFlowerHint')}
                        </p>
                        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
                          <div className="flex shrink-0 flex-col items-center lg:w-52">
                            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              {t('mycelium.collectiveMap')}
                            </p>
                            <FlowerSVG petals={petals} size={200} animate showLabels />
                          </div>
                          <ul className="w-full min-w-0 flex-1 space-y-3">
                            {PETAL_IDS_ORDER.map((id) => (
                              <li key={id} className="flex items-center gap-3 text-sm">
                                <span className="w-36 shrink-0 sm:w-44">
                                  <span className="block font-medium text-slate-800 dark:text-slate-100">
                                    {petalLabel(id, 'A')}
                                  </span>
                                  <span className="block text-sm leading-tight text-slate-500 dark:text-slate-400">
                                    {petalLabel(id, 'B')}
                                  </span>
                                </span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{ width: `${Math.min(100, (climate.petalsAverage![id] ?? 0) * 100)}%` }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right font-mono text-xs text-slate-500">
                                  {Math.round((climate.petalsAverage![id] ?? 0) * 100)}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>
                    )}

                    {/* Alertes */}
                    {stats.alerts.length > 0 && (
                      <section className="space-y-3">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.alertsTitle')}</h2>
                        {stats.alerts.map((a) => (
                          <div
                            key={a.petalId}
                            className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20"
                          >
                            <p className="font-medium text-amber-900 dark:text-amber-200">
                              {a.label} ({a.delta > 0 ? '+' : ''}
                              {Math.round(a.delta * 100)} pts)
                            </p>
                            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{a.hint}</p>
                          </div>
                        ))}
                      </section>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
