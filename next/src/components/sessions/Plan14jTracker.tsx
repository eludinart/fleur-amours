'use client'

import { useMemo, useState } from 'react'
import { sessionsApi } from '@/api/sessions'
import { t } from '@/i18n'

type PlanDay = { day?: number; action?: string; focus?: string; title?: string }

type Props = {
  sessionId: number | string
  days: PlanDay[]
  initialCompleted?: number[]
  initialBilan?: string | null
  initialLastAddDate?: string | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Suivi de complétion du plan 14 jours : cocher chaque étape, voir la progression,
 * et saisir un bilan une fois le plan terminé. Persiste via /api/sessions/plan-progress.
 * Cadence : un seul nouveau jour cochable par jour calendaire (rendez-vous quotidien).
 */
export default function Plan14jTracker({
  sessionId,
  days,
  initialCompleted = [],
  initialBilan,
  initialLastAddDate,
}: Props) {
  const [completed, setCompleted] = useState<number[]>(initialCompleted)
  const [bilan, setBilan] = useState(initialBilan ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [lastAddDate, setLastAddDate] = useState<string | null>(initialLastAddDate ?? null)
  const [cadenceMsg, setCadenceMsg] = useState(false)

  const total = days.length
  const allDone = total > 0 && completed.length >= total
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0
  const addLockedToday = lastAddDate === todayIso()

  const dayNumbers = useMemo(() => days.map((d, i) => d.day ?? i + 1), [days])

  async function persist(nextCompleted: number[], nextBilan?: string) {
    setSaving(true)
    try {
      const res = await sessionsApi.planProgress({
        id: sessionId,
        completed: nextCompleted,
        bilan: nextBilan,
      })
      // Le serveur est la source de vérité (cadence appliquée côté API).
      if (Array.isArray(res?.progress?.completed)) setCompleted(res.progress.completed)
      if (res?.progress?.lastAddDate !== undefined) setLastAddDate(res.progress.lastAddDate ?? null)
      if (res?.cadenceLimited) setCadenceMsg(true)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2000)
    } catch {
      /* réessayable */
    } finally {
      setSaving(false)
    }
  }

  function toggleDay(dayNum: number) {
    const isUncheck = completed.includes(dayNum)
    if (!isUncheck && addLockedToday) {
      setCadenceMsg(true)
      return
    }
    const next = isUncheck ? completed.filter((d) => d !== dayNum) : [...completed, dayNum]
    setCompleted(next)
    setCadenceMsg(false)
    void persist(next, bilan.trim() || undefined)
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">
          {t('plan14Tracker.title')}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {completed.length}/{total} · {pct}%
          {saving ? ' …' : savedAt ? ' ✓' : ''}
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-violet-100 dark:bg-violet-900/40">
        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {cadenceMsg ? (
        <p className="mb-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-200">
          {t('plan14Tracker.cadenceLimit')}
        </p>
      ) : null}
      <ul className="space-y-1">
        {days.map((d, i) => {
          const dayNum = dayNumbers[i]
          const isDone = completed.includes(dayNum)
          const locked = !isDone && addLockedToday
          return (
            <li key={dayNum}>
              <label
                className={`flex items-start gap-2 rounded-lg px-1 py-1 text-xs ${
                  locked
                    ? 'cursor-not-allowed opacity-55'
                    : 'cursor-pointer hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={locked}
                  onChange={() => toggleDay(dayNum)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
                />
                <span className={isDone ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}>
                  <span className="font-bold">J{dayNum}</span> {d.action ?? d.focus ?? d.title ?? ''}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {allDone && (
        <div className="mt-3 border-t border-violet-200 pt-3 dark:border-violet-900">
          <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {t('plan14Tracker.completedTitle')}
          </p>
          <textarea
            value={bilan}
            onChange={(e) => setBilan(e.target.value)}
            onBlur={() => persist(completed, bilan.trim() || undefined)}
            rows={3}
            maxLength={2000}
            placeholder={t('plan14Tracker.bilanPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}
    </div>
  )
}
