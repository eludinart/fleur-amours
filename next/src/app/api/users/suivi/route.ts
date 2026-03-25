/**
 * GET /api/users/suivi
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId, isAdmin } = await requireAdminOrCoach(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ users: [] })
    }

    const pool = getPool()
    const search = String(new URL(req.url).searchParams.get('search') ?? '').trim().toLowerCase()
    const shadowOnly = String(new URL(req.url).searchParams.get('shadow') ?? '') === '1'
    const sort = String(new URL(req.url).searchParams.get('sort') ?? 'last_session')

    const petalKeys = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

    const normalizeEmail = (s: string) => String(s ?? '').trim().toLowerCase()
    const emptyPetals: Record<string, number> = Object.fromEntries(petalKeys.map((k) => [k, 0]))

    function safeParseJson<T>(raw: unknown, fallback: T): T {
      try {
        if (!raw) return fallback
        if (typeof raw === 'string') return JSON.parse(raw) as T
        return raw as T
      } catch {
        return fallback
      }
    }

    async function getCoachPatientEmails(coachUserId: number): Promise<string[]> {
      const tSeeds = table('fleur_social_seeds')
      const tUsers = table('users')
      const [rows] = await pool.execute<RowDataPacket[]>(
        `
          SELECT DISTINCT u.user_email
          FROM ${tSeeds} s
          JOIN ${tUsers} u ON u.ID = s.to_user_id
          WHERE s.from_user_id = ? AND s.status = 'accepted'
        `,
        [coachUserId]
      )
      return Array.from(
        new Set(
          (rows ?? [])
            .map((r) => normalizeEmail(String((r as any)?.user_email ?? '')))
            .filter(Boolean)
        )
      )
    }

    async function getAllSessionEmails(): Promise<string[]> {
      const tSessions = table('fleur_sessions')
      const [rows] = await pool.execute<RowDataPacket[]>(
        `
          SELECT DISTINCT email
          FROM ${tSessions}
          WHERE email IS NOT NULL AND email != ''
        `
      )
      return Array.from(
        new Set(
          (rows ?? [])
            .map((r) => normalizeEmail(String((r as any)?.email ?? '')))
            .filter(Boolean)
        )
      )
    }

    const coachUserId = parseInt(userId, 10)
    const patientEmails = isAdmin
      ? await getAllSessionEmails()
      : await getCoachPatientEmails(coachUserId)

    const filteredEmails = search ? patientEmails.filter((e) => e.includes(search)) : patientEmails
    if (filteredEmails.length === 0) return NextResponse.json({ users: [] })

    // Calcul per-email (petals & shadow events) : plus fiable côté JSON
    const users = []
    for (const email of filteredEmails) {
      const tSessions = table('fleur_sessions')
      const [rows] = await pool.execute<RowDataPacket[]>(
        `
          SELECT
            id,
            email,
            created_at,
            turn_count,
            duration_seconds,
            status,
            first_words,
            door_suggested,
            petals_json,
            step_data_json
          FROM ${tSessions}
          WHERE email = ?
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [email]
      )

      const sessions = rows ?? []
      if (sessions.length === 0) continue

      const avgPetals: Record<string, number> = { ...emptyPetals }
      const avgDeficit: Record<string, number> = { ...emptyPetals }

      let max_shadow_level = 0
      let shadow_event_count = 0
      let shadow_urgent = false
      let totalTurns = 0
      let last_session: string | undefined

      for (const r of sessions) {
        const petals = safeParseJson<Record<string, number>>((r as any)?.petals_json ?? '{}', {})
        const stepData = safeParseJson<any>((r as any)?.step_data_json ?? null, null)
        const petalsDeficit = safeParseJson<Record<string, number>>(stepData?.petalsDeficit ?? {}, {})
        const sMax = Number(stepData?.maxShadowLevel ?? stepData?.max_shadow_level ?? 0) || 0
        const shadowEvents = Array.isArray(stepData?.shadowEvents) ? stepData.shadowEvents : []

        if (!last_session && (r as any)?.created_at) last_session = String((r as any).created_at)

        totalTurns += Number((r as any)?.turn_count ?? 0) || 0
        max_shadow_level = Math.max(max_shadow_level, sMax)

        // shadow urgent
        for (const ev of shadowEvents) {
          const level = Number(ev?.level ?? 0) || 0
          if (level >= 1) {
            shadow_event_count += 1
            if (ev?.urgent) shadow_urgent = true
          }
        }
        if (sMax >= 4) shadow_urgent = true

        for (const k of petalKeys) {
          avgPetals[k] += Number(petals?.[k] ?? 0) || 0
          avgDeficit[k] += Number(petalsDeficit?.[k] ?? 0) || 0
        }
      }

      const n = sessions.length || 1
      for (const k of petalKeys) {
        avgPetals[k] = avgPetals[k] / n
        avgDeficit[k] = avgDeficit[k] / n
      }

      if (shadowOnly && (max_shadow_level ?? 0) < 1 && shadow_event_count === 0) continue

      users.push({
        email,
        session_count: sessions.length,
        avg_turns: totalTurns / n || 0,
        last_session: last_session ?? undefined,
        max_shadow_level,
        shadow_urgent,
        shadow_event_count,
        avg_petals: avgPetals,
        // détail possible côté UI "ombres" (non utilisé par la liste)
        avg_deficit: avgDeficit,
      })
    }

    const sorted = users.sort((a: any, b: any) => {
      if (sort === 'shadow') return (b.max_shadow_level ?? 0) - (a.max_shadow_level ?? 0)
      if (sort === 'sessions') return (b.session_count ?? 0) - (a.session_count ?? 0)
      // last_session
      const ad = a.last_session ? new Date(a.last_session).getTime() : 0
      const bd = b.last_session ? new Date(b.last_session).getTime() : 0
      return bd - ad
    })

    return NextResponse.json({ users: sorted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, users: [] }, { status: e.status || 401 })
  }
}
