'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sessionsApi } from '@/api/sessions'
import { t } from '@/i18n'
import type { ActivePlan14j } from '@/lib/plan14j-active'

export function ZenHomePlan14jToday({ plan }: { plan: ActivePlan14j }) {
  const [completed, setCompleted] = useState(plan.completed)
  const [saving, setSaving] = useState(false)
  const isDone = completed.includes(plan.currentDay)
  const pct = plan.progressPct

  async function toggleToday() {
    if (saving) return
    const next = isDone
      ? completed.filter((d) => d !== plan.currentDay)
      : [...completed, plan.currentDay]
    setSaving(true)
    try {
      await sessionsApi.planProgress({
        id: plan.sessionId,
        completed: next,
      })
      setCompleted(next)
    } catch {
      /* réessayable */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-5 rounded-2xl border-2 border-emerald-500/35 bg-emerald-950/25 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/85">
            {t('dashboard.plan14TodayLabel')}
          </p>
          <p className="text-base font-semibold text-emerald-50 mt-0.5">
            {t('dashboard.plan14TodayTitle', { day: plan.currentDay })}
          </p>
        </div>
        <span className="text-xs text-emerald-200/60">{pct}%</span>
      </div>
      {plan.currentAction ? (
        <p className="mt-2 text-sm text-emerald-100/90 leading-relaxed">{plan.currentAction}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-100">
          <input
            type="checkbox"
            checked={isDone}
            disabled={saving}
            onChange={() => void toggleToday()}
            className="h-4 w-4 accent-emerald-500"
          />
          <span className={isDone ? 'line-through opacity-60' : ''}>
            {t('dashboard.plan14TodayDone')}
          </span>
        </label>
        <Link
          href={`/session?open=${plan.sessionId}`}
          className="text-xs text-emerald-300/90 hover:text-emerald-200 underline"
        >
          {t('dashboard.plan14ViewFull')}
        </Link>
      </div>
    </div>
  )
}
