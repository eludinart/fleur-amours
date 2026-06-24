/**
 * Plan 14 jours actif : dernière session terminée avec plan non complété.
 */
export type Plan14jDay = { day?: number; action?: string; focus?: string; title?: string; theme?: string }

export type ActivePlan14j = {
  sessionId: number | string
  days: Plan14jDay[]
  completed: number[]
  currentDay: number
  currentAction: string
  startedAt?: string
  progressPct: number
}

export function findActivePlan14j(sessions: Array<Record<string, unknown>>): ActivePlan14j | null {
  const completedStatuses = new Set(['completed', 'done', 'finished', 'closed', 'terminated'])

  for (const s of sessions) {
    const status = String(s.status ?? '').toLowerCase()
    if (!completedStatuses.has(status)) continue

    const sd = (s.step_data ?? {}) as Record<string, unknown>
    const planRaw = sd.plan14j ?? s.plan14j
    if (!planRaw || typeof planRaw !== 'object') continue

    const plan = planRaw as { plan_14j?: Plan14jDay[] }
    const days = Array.isArray(plan.plan_14j) ? plan.plan_14j : []
    if (days.length === 0) continue

    const progress = (sd.plan14j_progress ?? {}) as { completed?: number[] }
    const completed = Array.isArray(progress.completed) ? progress.completed : []
    if (completed.length >= days.length) continue

    const dayNumbers = days.map((d, i) => {
      const n = Number(d.day ?? i + 1)
      return Number.isFinite(n) && n > 0 ? n : i + 1
    })
    const currentDayRaw = dayNumbers.find((n) => !completed.includes(n)) ?? dayNumbers[0]
    const currentDay = Number.isFinite(currentDayRaw) && currentDayRaw > 0 ? currentDayRaw : 1
    const idx = dayNumbers.indexOf(currentDay)
    const currentAction = String(days[idx]?.action ?? days[idx]?.focus ?? days[idx]?.title ?? '').trim()

    return {
      sessionId: s.id as number | string,
      days,
      completed,
      currentDay,
      currentAction,
      startedAt: s.created_at as string | undefined,
      progressPct: Math.round((completed.length / days.length) * 100),
    }
  }
  return null
}
