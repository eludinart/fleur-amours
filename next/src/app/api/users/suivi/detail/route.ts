/**
 * GET /api/users/suivi/detail
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'
import { getCoachPatientSnapshot } from '@/lib/db-coach-patient-fiches'
import { fetchPatientStaffOverview } from '@/lib/db-patient-staff-detail'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId, isAdmin } = await requireAdminOrCoach(req)

    const emailQuery = String(new URL(req.url).searchParams.get('email') ?? '').trim()
    const emailNorm = String(emailQuery ?? '').trim().toLowerCase()
    if (!emailNorm) return NextResponse.json({ error: 'email requis' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'DB non configurée' }, { status: 500 })
    }

    const pool = getPool()
    const tSessions = table('fleur_sessions')
    // Même clé qu’à l’upsert (POST coach-patient-fiche) : viewer admin ou coach.
    const viewerId = parseInt(userId, 10)
    const coachPatientSnapshotPromise =
      Number.isFinite(viewerId) && viewerId > 0 && emailNorm
        ? getCoachPatientSnapshot({ coachUserId: viewerId, patientEmail: emailNorm })
        : Promise.resolve(null)

    const petalKeys = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
    const DEFICIT_OMBRE_MIN = 0.02
    const normalizeEmail = (s: string) => String(s ?? '').trim().toLowerCase()
    const emptyPetals: Record<string, number> = Object.fromEntries(petalKeys.map((k) => [k, 0]))

    function sessionHasPetalDeficitShadow(deficit: Record<string, number>): boolean {
      return petalKeys.some((k) => Number(deficit?.[k] ?? 0) >= DEFICIT_OMBRE_MIN)
    }

    function readStepShadowEvents(stepData: Record<string, unknown> | null): unknown[] {
      if (!stepData || typeof stepData !== 'object') return []
      const camel = (stepData as { shadowEvents?: unknown }).shadowEvents
      const snake = (stepData as { shadow_events?: unknown }).shadow_events
      if (Array.isArray(camel) && camel.length > 0) return camel
      if (Array.isArray(snake) && snake.length > 0) return snake
      return []
    }

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

    // Si coach (pas admin), vérifier que l'email appartient à sa patientèle
    if (!isAdmin) {
      const coachUserId = parseInt(userId, 10)
      const patientEmails = await getCoachPatientEmails(coachUserId)
      if (!patientEmails.includes(emailNorm)) {
        return NextResponse.json({ error: 'Accès interdit (patient non lié à ce coach)' }, { status: 403 })
      }
    }

    const patient_overview = await fetchPatientStaffOverview(pool, emailNorm)

    const [rows] = await pool.execute<RowDataPacket[]>(
      `
        SELECT
          id,
          email,
          created_at,
          first_words,
          door_suggested,
          turn_count,
          duration_seconds,
          status,
          petals_json,
          step_data_json
        FROM ${tSessions}
        WHERE LOWER(email) = ?
        ORDER BY created_at DESC
      `,
      [emailNorm]
    )

    const sessionsRows = rows ?? []
    const session_count = sessionsRows.length
    if (session_count === 0) {
      return NextResponse.json({
        session_count: 0,
        max_shadow_level: 0,
        shadow_event_count: 0,
        avg_petals: emptyPetals,
        avg_deficit: emptyPetals,
        petal_evolution: [],
        shadow_events: [],
        sessions: [],
        coach_patient_snapshot: await coachPatientSnapshotPromise,
        patient_overview,
      })
    }

    let max_shadow_level = 0
    let shadow_event_count = 0
    let shadow_urgent = false

    const avg_petals: Record<string, number> = { ...emptyPetals }
    const avg_deficit: Record<string, number> = { ...emptyPetals }

    const petalEvolution: Array<{ date: string; petals: Record<string, number>; deficit: Record<string, number> }> = []
    const shadow_events: Array<{
      level?: number
      turn?: number
      urgent?: boolean
      door?: string
      resource_card?: string | null
      session_date?: string
      kind?: string
      top_deficit_petal?: string
      deficit_value?: number
    }> = []

    const sessions: Array<{
      id: number
      created_at?: string
      door_suggested?: string
      status?: string
      first_words?: string
      turn_count?: number
      duration_seconds?: number
      max_shadow_level?: number
      shadow_event_count?: number
      petals?: Record<string, number>
      petals_deficit?: Record<string, number>
      threshold_snapshot?: Record<string, unknown> | null
      coach_summary?: string
      coach_analysis?: string
      coach_suggestions?: string[]
      coach_next_steps?: string[]
    }> = []

    for (const r of sessionsRows) {
      const createdAt = (r as any)?.created_at ? String((r as any).created_at) : undefined
      const petals = safeParseJson<Record<string, number>>((r as any)?.petals_json ?? '{}', {})
      const stepData = safeParseJson<any>((r as any)?.step_data_json ?? null, null)
      const petalsDeficit = safeParseJson<Record<string, number>>(
        stepData?.petalsDeficit ?? stepData?.petals_deficit ?? {},
        {}
      )
      const sMax = Number(stepData?.maxShadowLevel ?? stepData?.max_shadow_level ?? 0) || 0
      max_shadow_level = Math.max(max_shadow_level, sMax)

      const shadowEvents = readStepShadowEvents(stepData)
      let tuteurEventsThisSession = 0
      for (const ev of shadowEvents) {
        const level = Number((ev as any)?.level ?? (ev as any)?.shadow_level ?? 0) || 0
        if (level >= 1 && (ev as any)?.urgent) shadow_urgent = true
        if (sMax >= 4) shadow_urgent = true

        if (level >= 1) {
          tuteurEventsThisSession += 1
          shadow_event_count += 1
          shadow_events.push({
            level: level,
            turn: (ev as any)?.turn ?? undefined,
            urgent: !!(ev as any)?.urgent,
            door: (ev as any)?.door ?? undefined,
            resource_card: (ev as any)?.resource_card ?? null,
            session_date: createdAt,
            kind: 'tuteur',
          })
        }
      }

      // Même logique que la liste suivi : déficit pétales = signal d'ombre même sans événement Tuteur persisté
      let deficitOnlySignal = 0
      if (sessionHasPetalDeficitShadow(petalsDeficit) && tuteurEventsThisSession === 0) {
        deficitOnlySignal = 1
        shadow_event_count += 1
        const topPetal = petalKeys.reduce(
          (best, k) =>
            Number(petalsDeficit?.[k] ?? 0) > Number(petalsDeficit?.[best] ?? 0) ? k : best,
          petalKeys[0]
        )
        const topVal = Number(petalsDeficit?.[topPetal] ?? 0) || 0
        shadow_events.push({
          level: 1,
          session_date: createdAt,
          kind: 'petal_deficit',
          top_deficit_petal: topPetal,
          deficit_value: topVal,
        })
      }

      for (const k of petalKeys) {
        avg_petals[k] += Number(petals?.[k] ?? 0) || 0
        avg_deficit[k] += Number(petalsDeficit?.[k] ?? 0) || 0
      }

      const deficitRecord = petalsDeficit && typeof petalsDeficit === 'object' ? petalsDeficit : {}
      petalEvolution.push({
        date: createdAt ?? '',
        petals: petals && typeof petals === 'object' ? petals : {},
        deficit: deficitRecord,
      })

      const thSnap =
        stepData && typeof stepData === 'object' && (stepData as { threshold_snapshot?: unknown }).threshold_snapshot
          ? ((stepData as { threshold_snapshot: Record<string, unknown> }).threshold_snapshot as Record<string, unknown>)
          : null

      const coachSnap =
        stepData && typeof stepData === 'object' && (stepData as { coach_snapshot?: unknown }).coach_snapshot
          ? ((stepData as { coach_snapshot: Record<string, unknown> }).coach_snapshot as Record<string, unknown>)
          : null

      sessions.push({
        id: Number((r as any)?.id ?? 0),
        created_at: createdAt,
        door_suggested: (r as any)?.door_suggested ?? undefined,
        status: (r as any)?.status ?? undefined,
        first_words: (r as any)?.first_words ?? undefined,
        turn_count: Number((r as any)?.turn_count ?? 0),
        duration_seconds: Number((r as any)?.duration_seconds ?? 0),
        max_shadow_level: Math.max(sMax, deficitOnlySignal ? 1 : 0),
        shadow_event_count: tuteurEventsThisSession + deficitOnlySignal,
        petals: petals && typeof petals === 'object' ? petals : {},
        petals_deficit: deficitRecord,
        threshold_snapshot: thSnap,
        coach_summary: coachSnap && typeof coachSnap === 'object' ? String(coachSnap.coach_summary ?? '') : undefined,
        coach_analysis: coachSnap && typeof coachSnap === 'object' ? String(coachSnap.coach_analysis ?? '') : undefined,
        coach_suggestions:
          coachSnap && typeof coachSnap === 'object' && Array.isArray((coachSnap as any).coach_suggestions)
            ? ((coachSnap as any).coach_suggestions as string[]).slice(0, 20)
            : undefined,
        coach_next_steps:
          coachSnap && typeof coachSnap === 'object' && Array.isArray((coachSnap as any).coach_next_steps)
            ? ((coachSnap as any).coach_next_steps as string[]).slice(0, 10)
            : undefined,
      })
    }

    const n = session_count || 1
    for (const k of petalKeys) {
      avg_petals[k] = avg_petals[k] / n
      avg_deficit[k] = avg_deficit[k] / n
    }

    const hasPetalDeficitShadowAvg = petalKeys.some((k) => (avg_deficit[k] ?? 0) >= DEFICIT_OMBRE_MIN)
    if (hasPetalDeficitShadowAvg && max_shadow_level < 1) {
      max_shadow_level = 1
    }

    // Chronologie : UI s'attend à une évolution dans l'ordre des sessions (du plus ancien au plus récent)
    petalEvolution.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    shadow_events.sort((a, b) => (a.session_date ? new Date(a.session_date).getTime() : 0) - (b.session_date ? new Date(b.session_date).getTime() : 0))

    // Les sessions listées en UI suivent généralement l'ordre créé_at DESC (comme notre SQL).
    // On garde l'ordre de sessionsRows, c'est-à-dire DESC.

    return NextResponse.json({
      session_count,
      max_shadow_level,
      shadow_event_count,
      avg_petals,
      avg_deficit,
      petal_evolution: petalEvolution,
      shadow_events,
      sessions,
      // Champs supplémentaires possibles côté UI (non requis mais pratiques)
      shadow_urgent,
      coach_patient_snapshot: await coachPatientSnapshotPromise,
      patient_overview,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
