'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlowerSVG } from '@/components/FlowerSVG'
import { myceliumApi, type ClimateDTO, type TeamDTO } from '@/api/mycelium'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const WINDOWS = [7, 30, 90]

export default function MyceliumClimatePage() {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [teamId, setTeamId] = useState<number | undefined>(undefined)
  const [windowDays, setWindowDays] = useState(30)
  const [climate, setClimate] = useState<ClimateDTO | null>(null)
  const [hasOrg, setHasOrg] = useState(true)

  useEffect(() => {
    myceliumApi
      .getOrg()
      .then((r) => {
        setHasOrg(!!r.org)
        setTeams(r.teams || [])
      })
      .catch(() => setHasOrg(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    myceliumApi
      .climate({ teamId, windowDays })
      .then((r) => setClimate(r.climate))
      .catch(() => setClimate(null))
      .finally(() => setLoading(false))
  }, [teamId, windowDays])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('mycelium.climateTitle')}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.climateSubtitle')}</p>
          </div>
          <Link
            href="/mycelium/admin"
            className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            {t('mycelium.adminLink')}
          </Link>
        </header>

        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
          {t('mycelium.privacyNote')}
        </p>

        {!hasOrg ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('mycelium.noOrg')}
          </p>
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

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
              </div>
            ) : !climate?.available ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-slate-600 dark:text-slate-300">{t('mycelium.climateUnavailable')}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('mycelium.climateThreshold')} {climate?.threshold ?? 5}
                  {climate?.reason === 'below_threshold' ? ` — ${climate.respondents}/${climate.threshold}` : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={t('mycelium.respondents')} value={String(climate.respondents)} />
                  <Stat label={t('mycelium.moodAvg')} value={climate.moodAverage != null ? `${climate.moodAverage}/5` : '—'} />
                </div>
                {climate.petalsAverage && (
                  <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <p className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.collectiveFlower')}</p>
                    <FlowerSVG petals={climate.petalsAverage} size={200} animate showLabels />
                  </div>
                )}
              </div>
            )}
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
