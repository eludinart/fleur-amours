/**
 * Candidats à une relance plan 14 jours (notification matinale).
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, sqlEmailEq, table } from './db'
import { excludeDemoAccountsSql } from './demo-accounts'
import { findActivePlan14j, type Plan14jDay } from './plan14j-active'

const TBL_SESSIONS = () => table('fleur_sessions')

function safeJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return fallback
  }
}

export type Plan14jReminderCandidate = {
  userId: number
  email: string | null
  sessionId: number
  currentDay: number
  action: string
}

/**
 * Utilisateurs avec un plan 14j en cours (session terminée, jours restants).
 */
export async function findPlan14jReminderCandidates(limit = 80): Promise<Plan14jReminderCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const excludeDemo = excludeDemoAccountsSql('u', table('usermeta'))
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.email, s.status, s.plan14j_json, s.step_data_json, s.created_at, u.ID as user_id
     FROM ${TBL_SESSIONS()} s
     INNER JOIN ${table('users')} u ON ${sqlEmailEq('u.user_email', 's.email')}
     WHERE s.plan14j_json IS NOT NULL AND s.plan14j_json != 'null' AND s.plan14j_json != ''
       AND s.status IN ('completed', 'done', 'finished', 'closed', 'terminated')
       ${excludeDemo}
     ORDER BY s.created_at DESC
     LIMIT 500`
  )

  const seenUsers = new Set<number>()
  const out: Plan14jReminderCandidate[] = []

  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || seenUsers.has(userId)) continue

    const session = {
      id: r.id,
      status: r.status,
      plan14j: safeJson(r.plan14j_json, null),
      step_data: safeJson(r.step_data_json, {}),
      created_at: r.created_at,
    }

    const active = findActivePlan14j([session as Record<string, unknown>])
    if (!active) continue

    seenUsers.add(userId)
    out.push({
      userId,
      email: r.email ? String(r.email) : null,
      sessionId: Number(r.id),
      currentDay: active.currentDay,
      action: active.currentAction,
    })
    if (out.length >= limit) break
  }

  return out
}
