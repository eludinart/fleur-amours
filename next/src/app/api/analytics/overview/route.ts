/**
 * GET /api/analytics/overview
 * Vue d'ensemble analytics (admin/coach).
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
      return NextResponse.json({
        total_users: 0,
        total_sessions: 0,
        completed_sessions: 0,
        avg_turns: 0,
        avg_duration: 0,
        completion_rate: 0,
        shadow_rate: 0,
        shadow_events_7d: 0,
        urgent_count: 0,
        avg_petals: {},
        avg_deficit: {},
        radar_data: [],
        light_vs_shadow: [],
        shadow_distribution: [],
        petal_dominance: [],
        door_distribution: [],
        user_clusters: {},
        sessions_by_week: [],
      })
    }

    const pool = getPool()
    const tSessions = table('fleur_sessions')

    const petalKeys = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
    const petalLabels: Record<string, string> = {
      agape: 'Agapè',
      philautia: 'Philautia',
      mania: 'Mania',
      storge: 'Storgè',
      pragma: 'Pragma',
      philia: 'Philia',
      ludus: 'Ludus',
      eros: 'Éros',
    }
    const doorLabels: Record<string, string> = {
      love: 'Cœur',
      vegetal: 'Végétal',
      elements: 'Éléments',
      life: 'Histoire',
    }

    const normalizeEmail = (s: string) => String(s ?? '').trim().toLowerCase()

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

    const coachUserId = parseInt(userId, 10)
    const patientEmails = isAdmin ? null : await getCoachPatientEmails(coachUserId)

    // Récupérer les sessions dans le scope (admin: toutes; coach: patientèle).
    // NOTE: pour l'instant on lit en mémoire, mais on limite pour éviter d'exploser si DB énorme.
    const scopeLimit = 4000
    let sessionRows: RowDataPacket[] = []

    if (patientEmails && patientEmails.length > 0) {
      // IN clause en chunks
      const chunkSize = 50
      const chunks: string[][] = []
      for (let i = 0; i < patientEmails.length; i += chunkSize) {
        chunks.push(patientEmails.slice(i, i + chunkSize))
      }

      const all: RowDataPacket[] = []
      for (const c of chunks) {
        const placeholders = c.map(() => '?').join(',')
        const [rows] = await pool.execute<RowDataPacket[]>(
          `
            SELECT id, email, status, created_at, turn_count, duration_seconds, door_suggested, petals_json, step_data_json
            FROM ${tSessions}
            WHERE LOWER(email) IN (${placeholders})
            ORDER BY created_at DESC
            LIMIT ?
          `,
          [...c, scopeLimit] as unknown as (string | number)[]
        )
        all.push(...(rows ?? []))
      }
      sessionRows = all
        .sort((a, b) => new Date(String((b as any).created_at)).getTime() - new Date(String((a as any).created_at)).getTime())
        .slice(0, scopeLimit)
    } else {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `
          SELECT id, email, status, created_at, turn_count, duration_seconds, door_suggested, petals_json, step_data_json
          FROM ${tSessions}
          WHERE email IS NOT NULL AND email != ''
          ORDER BY created_at DESC
          LIMIT ?
        `,
        [scopeLimit]
      )
      sessionRows = rows ?? []
    }

    const total_sessions = sessionRows.length
    const emailsSet = new Set<string>()
    let completed_sessions = 0
    let totalTurns = 0
    let totalDuration = 0

    // Global petals/deficits over sessions
    const sumPetals: Record<string, number> = Object.fromEntries(petalKeys.map((k) => [k, 0]))
    const sumDeficit: Record<string, number> = Object.fromEntries(petalKeys.map((k) => [k, 0]))

    // Shadow
    let sessions_with_shadow = 0
    let urgent_count = 0
    let shadow_events_7d = 0
    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    // Distribution shadow (per-session max)
    const shadowDist = [0, 0, 0, 0, 0] // idx=level 0..4 (clamp)

    // Door distribution (sessions)
    const doorCounts: Record<string, number> = {}

    // Per-user aggregates for dominance & clusters
    const perUser = new Map<
      string,
      {
        sessions: number
        sumPetals: Record<string, number>
        sumDeficit: Record<string, number>
        maxShadow: number
      }
    >()

    for (const r of sessionRows) {
      const email = normalizeEmail(String((r as any)?.email ?? ''))
      if (email) emailsSet.add(email)

      const status = String((r as any)?.status ?? '')
      if (status === 'completed') completed_sessions += 1

      totalTurns += Number((r as any)?.turn_count ?? 0) || 0
      totalDuration += Number((r as any)?.duration_seconds ?? 0) || 0

      const door = String((r as any)?.door_suggested ?? '').trim()
      if (door) doorCounts[door] = (doorCounts[door] ?? 0) + 1

      const petals = safeParseJson<Record<string, number>>((r as any)?.petals_json ?? '{}', {})
      const stepData = safeParseJson<any>((r as any)?.step_data_json ?? null, null)
      const deficit = safeParseJson<Record<string, number>>(stepData?.petalsDeficit ?? {}, {})
      const maxShadow = Number(stepData?.maxShadowLevel ?? stepData?.max_shadow_level ?? 0) || 0
      const shadowEvents = Array.isArray(stepData?.shadowEvents) ? stepData.shadowEvents : []
      const createdAtStr = (r as any)?.created_at ? String((r as any).created_at) : ''
      const createdAt = createdAtStr ? new Date(createdAtStr).getTime() : 0

      const clampedShadow = Math.max(0, Math.min(4, Math.floor(maxShadow)))
      shadowDist[clampedShadow] += 1

      if (maxShadow >= 1 || shadowEvents.some((ev: any) => Number(ev?.level ?? 0) >= 1)) {
        sessions_with_shadow += 1
      }
      if (maxShadow >= 4 || shadowEvents.some((ev: any) => !!ev?.urgent || Number(ev?.level ?? 0) >= 4)) {
        urgent_count += 1
      }

      if (createdAt && now - createdAt <= sevenDaysMs) {
        shadow_events_7d += shadowEvents.filter((ev: any) => Number(ev?.level ?? 0) >= 1).length
      }

      for (const k of petalKeys) {
        sumPetals[k] += Number(petals?.[k] ?? 0) || 0
        sumDeficit[k] += Number(deficit?.[k] ?? 0) || 0
      }

      if (email) {
        if (!perUser.has(email)) {
          perUser.set(email, {
            sessions: 0,
            sumPetals: Object.fromEntries(petalKeys.map((k) => [k, 0])),
            sumDeficit: Object.fromEntries(petalKeys.map((k) => [k, 0])),
            maxShadow: 0,
          })
        }
        const u = perUser.get(email)!
        u.sessions += 1
        u.maxShadow = Math.max(u.maxShadow, maxShadow)
        for (const k of petalKeys) {
          u.sumPetals[k] += Number(petals?.[k] ?? 0) || 0
          u.sumDeficit[k] += Number(deficit?.[k] ?? 0) || 0
        }
      }
    }

    const total_users = emailsSet.size
    const avg_turns = total_sessions ? Number((totalTurns / total_sessions).toFixed(1)) : 0
    const avg_duration = total_sessions ? Math.round(totalDuration / total_sessions) : 0
    const completion_rate = total_sessions ? completed_sessions / total_sessions : 0
    const shadow_rate = total_sessions ? sessions_with_shadow / total_sessions : 0

    const avg_petals: Record<string, number> = {}
    const avg_deficit: Record<string, number> = {}
    for (const k of petalKeys) {
      avg_petals[k] = total_sessions ? sumPetals[k] / total_sessions : 0
      avg_deficit[k] = total_sessions ? sumDeficit[k] / total_sessions : 0
    }

    const radar_data = petalKeys.map((k) => ({
      petal: petalLabels[k],
      lumiere: Math.round((avg_petals[k] ?? 0) * 100),
      ombre: Math.round((avg_deficit[k] ?? 0) * 100),
    }))

    const light_vs_shadow = petalKeys.map((k) => ({
      petal: petalLabels[k],
      key: k,
      lumiere: avg_petals[k] ?? 0,
      ombre: avg_deficit[k] ?? 0,
    }))

    const shadow_distribution = [
      { label: 'Aucune', count: shadowDist[0] ?? 0, color: '#64748b' },
      { label: 'Niv. 1', count: shadowDist[1] ?? 0, color: '#f59e0b' },
      { label: 'Niv. 2', count: shadowDist[2] ?? 0, color: '#f97316' },
      { label: 'Niv. 3', count: shadowDist[3] ?? 0, color: '#e11d48' },
      { label: 'Niv. 4', count: shadowDist[4] ?? 0, color: '#dc2626' },
    ]

    // Dominance (par utilisateur : pétale dominante sur moyenne)
    const dominanceCounts: Record<string, number> = Object.fromEntries(petalKeys.map((k) => [k, 0]))
    for (const [email, u] of perUser.entries()) {
      const n = u.sessions || 1
      let best: (typeof petalKeys)[number] = 'agape'
      for (const k of petalKeys) {
        const v = (u.sumPetals[k] ?? 0) / n
        const b = (u.sumPetals[best] ?? 0) / n
        if (v > b) best = k
      }
      dominanceCounts[best] += 1
    }
    const petal_dominance = petalKeys
      .map((k) => ({
        petal: k,
        label: petalLabels[k],
        count: dominanceCounts[k] ?? 0,
        pct: total_users ? (dominanceCounts[k] ?? 0) / total_users : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const door_distribution = Object.entries(doorCounts)
      .map(([door, count]) => ({
        door,
        label: doorLabels[door] || door,
        count,
      }))
      .sort((a, b) => b.count - a.count)

    // Clusters (top 3 par dominance) : emails + quelques stats synthétiques
    const user_clusters: Record<
      string,
      Array<{ email: string; sessions: number; max_shadow_level: number; top_petal?: string }>
    > = {}
    for (const k of petalKeys) user_clusters[k] = []
    for (const [email, u] of perUser.entries()) {
      const n = u.sessions || 1
      let best: (typeof petalKeys)[number] = 'agape'
      for (const k of petalKeys) {
        const v = (u.sumPetals[k] ?? 0) / n
        const b = (u.sumPetals[best] ?? 0) / n
        if (v > b) best = k
      }
      user_clusters[best].push({
        email,
        sessions: u.sessions,
        max_shadow_level: u.maxShadow,
        top_petal: petalLabels[best],
      })
    }
    for (const k of petalKeys) {
      user_clusters[k] = (user_clusters[k] || [])
        .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
        .slice(0, 12)
    }

    // Sessions by week (12 dernières semaines) — YYYY-Www
    function weekKey(d: Date): string {
      const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      const dayNum = dt.getUTCDay() || 7
      dt.setUTCDate(dt.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
      const weekNo = Math.ceil((((dt as any) - (yearStart as any)) / 86400000 + 1) / 7)
      const yyyy = dt.getUTCFullYear()
      return `${yyyy}-W${String(weekNo).padStart(2, '0')}`
    }

    const weekCounts: Record<string, number> = {}
    const weeksOrder: string[] = []
    const nowDate = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowDate)
      d.setDate(d.getDate() - i * 7)
      const k = weekKey(d)
      if (!weeksOrder.includes(k)) weeksOrder.push(k)
      weekCounts[k] = 0
    }
    for (const r of sessionRows) {
      const createdAtStr = (r as any)?.created_at ? String((r as any).created_at) : ''
      if (!createdAtStr) continue
      const k = weekKey(new Date(createdAtStr))
      if (weekCounts[k] != null) weekCounts[k] += 1
    }
    const sessions_by_week = weeksOrder.map((k) => ({ week: k, count: weekCounts[k] ?? 0 }))

    return NextResponse.json({
      scope: isAdmin ? 'all' : 'patients',
      scope_label: isAdmin ? 'Toutes les sessions' : 'Patientèle du coach',
      scope_coach_user_id: isAdmin ? null : coachUserId,
      scope_patient_count: patientEmails ? patientEmails.length : null,
      total_users,
      total_sessions,
      completed_sessions,
      avg_turns,
      avg_duration,
      completion_rate,
      shadow_rate,
      shadow_events_7d,
      urgent_count,
      avg_petals,
      avg_deficit,
      radar_data,
      light_vs_shadow,
      shadow_distribution,
      petal_dominance,
      door_distribution,
      user_clusters,
      sessions_by_week,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
