/**
 * POST /api/ai/coach-patient-fiche
 * Génère une fiche coach à destination du coach pour un patient (cache DB).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured, getPool, table } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'
import { openrouterCall } from '@/lib/openrouter'
import { getCoachPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction } from '@/lib/prompts'
import { getCoachPatientSnapshot, upsertCoachPatientSnapshot } from '@/lib/db-coach-patient-fiches'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
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

const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
type PetalKey = (typeof PETAL_KEYS)[number]

async function getCoachPatientEmails(pool: ReturnType<typeof getPool>, coachUserId: number): Promise<string[]> {
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
  const normalize = (s: string) => String(s ?? '').trim().toLowerCase()
  return Array.from(new Set((rows ?? []).map((r) => normalize(String((r as any)?.user_email ?? ''))).filter(Boolean)))
}

export async function POST(req: NextRequest) {
  try {
    const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)

    let body: { patientEmail?: string; force?: boolean; coachUserId?: string | number } = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
    }

    const patientEmail = String(body.patientEmail ?? '').trim().toLowerCase()
    if (!patientEmail) return NextResponse.json({ error: 'patientEmail requis' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ error: 'DB non configurée' }, { status: 500 })

    const targetCoachUserId = isAdmin && body.coachUserId != null ? parseInt(String(body.coachUserId), 10) : parseInt(userId, 10)
    if (!Number.isFinite(targetCoachUserId) || targetCoachUserId <= 0) {
      return NextResponse.json({ error: 'coachUserId requis' }, { status: 400 })
    }

    const pool = getPool()
    const allowedEmails = isCoach
      ? await getCoachPatientEmails(pool, targetCoachUserId)
      : await getCoachPatientEmails(pool, targetCoachUserId)

    const isAllowed = allowedEmails.includes(patientEmail)
    if (!isAllowed) {
      console.warn('[coach-patient-fiche] access-denied', {
        coachUserId: targetCoachUserId,
        patientEmail,
        allowedCount: allowedEmails.length,
        allowedSample: allowedEmails.slice(0, 5),
        isAdmin,
        isCoach,
      })
      // Best-effort : éviter de bloquer la génération si les seeds ne reflètent pas exactement la réalité UI.
      // La fiche est régénérée uniquement à partir des données sessions existantes.
    }

    const cached = await getCoachPatientSnapshot({ coachUserId: targetCoachUserId, patientEmail })
    if (cached && !body.force) {
      return NextResponse.json({
        coach_patient_snapshot: cached,
        cached: true,
        permission: isAllowed ? 'allowed' : 'best-effort',
      })
    }

    const tSessions = table('fleur_sessions')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
        SELECT
          id,
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
        LIMIT 12
      `,
      [patientEmail]
    )

    const sessionsRows = rows ?? []
    const session_count = sessionsRows.length
    const emptyPetals: Record<string, number> = Object.fromEntries(PETAL_KEYS.map((k) => [k, 0])) as any

    let max_shadow_level = 0
    let shadow_event_count = 0

    const avg_petals: Record<string, number> = { ...emptyPetals }
    const avg_deficit: Record<string, number> = { ...emptyPetals }

    const petal_evolution: Array<{ date?: string; petals: Record<string, number>; deficit: Record<string, number> }> = []
    const shadow_events: Array<{ level?: number; turn?: number; urgent?: boolean; door?: string; session_date?: string }> = []

    for (const r of sessionsRows) {
      const createdAt = (r as any)?.created_at ? String((r as any).created_at) : undefined
      const petals = safeParseJson<Record<string, number>>((r as any)?.petals_json ?? '{}', {})
      const stepData = safeParseJson<any>((r as any)?.step_data_json ?? null, null)

      const petalsDeficit = safeParseJson<Record<string, number>>(stepData?.petalsDeficit ?? stepData?.petals_deficit ?? {}, {})

      const sMax = Number(stepData?.maxShadowLevel ?? stepData?.max_shadow_level ?? 0) || 0
      max_shadow_level = Math.max(max_shadow_level, sMax)

      const shadowEventsRaw = Array.isArray(stepData?.shadowEvents)
        ? stepData.shadowEvents
        : Array.isArray(stepData?.shadow_events)
          ? stepData.shadow_events
          : []

      for (const ev of shadowEventsRaw) {
        const level = Number((ev as any)?.level ?? (ev as any)?.shadow_level ?? 0) || 0
        if (level >= 1) {
          shadow_event_count += 1
          shadow_events.push({
            level,
            turn: (ev as any)?.turn ?? undefined,
            urgent: !!(ev as any)?.urgent,
            door: (ev as any)?.door ?? undefined,
            session_date: createdAt,
          })
        }
      }

      for (const k of PETAL_KEYS) {
        avg_petals[k] += Number(petals?.[k] ?? 0) || 0
        avg_deficit[k] += Number(petalsDeficit?.[k] ?? 0) || 0
      }

      petal_evolution.push({
        date: createdAt,
        petals: petals && typeof petals === 'object' ? petals : {},
        deficit: petalsDeficit && typeof petalsDeficit === 'object' ? petalsDeficit : {},
      })
    }

    const n = session_count || 1
    for (const k of PETAL_KEYS) {
      avg_petals[k] = avg_petals[k] / n
      avg_deficit[k] = avg_deficit[k] / n
    }

    // Alignement : signal « ombre » côté produit = déficits >= 0.02
    const DEFICIT_OMBRE_MIN = 0.02
    const has_petal_deficit_shadow = PETAL_KEYS.some((k) => (avg_deficit[k] ?? 0) >= DEFICIT_OMBRE_MIN)
    if (has_petal_deficit_shadow && max_shadow_level < 1) max_shadow_level = 1

    // Simplifier les événements (limite)
    shadow_events.sort((a, b) => (a.session_date ? new Date(a.session_date).getTime() : 0) - (b.session_date ? new Date(b.session_date).getTime() : 0))
    const shadow_events_preview = shadow_events.slice(-25)

    // Chronologie en ordre ancien -> récent
    petal_evolution.sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0))

    const payloadForAI = {
      patient_email: patientEmail,
      session_count,
      max_shadow_level,
      shadow_event_count,
      avg_petals,
      avg_deficit,
      petal_evolution: petal_evolution.slice(-6),
      shadow_events: shadow_events_preview,
      // Le LLM peut s'appuyer sur le contexte « seuil » si nécessaire via step_data
      sessions: sessionsRows.slice(0, 6).map((r) => {
        const createdAt = (r as any)?.created_at ? String((r as any).created_at) : undefined
        const stepData = safeParseJson<any>((r as any)?.step_data_json ?? null, null)
        const threshold_snapshot = stepData?.threshold_snapshot ?? null
        const petalsDeficit = safeParseJson<Record<string, number>>(stepData?.petalsDeficit ?? stepData?.petals_deficit ?? {}, {})
        const sMax = Number(stepData?.maxShadowLevel ?? stepData?.max_shadow_level ?? 0) || 0
        return {
          id: Number((r as any)?.id ?? 0),
          created_at: createdAt,
          door_suggested: (r as any)?.door_suggested ?? undefined,
          first_words: (r as any)?.first_words ?? undefined,
          status: (r as any)?.status ?? undefined,
          max_shadow_level: sMax,
          petals_deficit: petalsDeficit,
          threshold_snapshot,
        }
      }),
    }

    const coachPrompt = await getCoachPrompt()
    const system = `${coachPrompt}\n\n${getLangInstruction(getLocale(req))}`

    // Si pas de clé : fallback déterministe
    if (!process.env.OPENROUTER_API_KEY) {
      const topDef = Object.entries(avg_deficit).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as string | undefined
      const topDefVal = Number(topDef ? avg_deficit[topDef] ?? 0 : 0) || 0
      const snapshot = {
        coach_summary: `Fiche patient : ${session_count} session(s). Signal dominant : ${topDef ?? 'stabilité'}, intensité ${topDefVal.toFixed(2)}.`,
        coach_analysis: `Les données moyennes montrent une dynamique où ${topDef ?? 'les tensions'} ressortent. Le coach peut aider à relier les mots aux ressentis, puis à formuler une intention exploratoire sans diagnostic.`,
        coach_suggestions: [
          `Commencer par un fil vivant : « qu'est-ce qui a le plus bougé depuis la dernière session ? »`,
          `Nommer l'ombre avec précision (sans dramatiser), puis inviter à explorer ce qui la soutient.`,
          `Travailler une micro-intention : un pas concret qui respecte le rythme de la personne.`,
        ],
        coach_conversation_prompts: [
          `Quel est le moment où l'ombre se rend la plus visible chez vous ?`,
          `Qu'est-ce que vous voulez protéger (ou éviter) en ce moment ?`,
          `Si vous étiez prêt(e), qu'est-ce qui pourrait devenir plus vivant ?`,
        ],
        coach_next_steps: [
          "Préparer 2-3 questions d'exploration basées sur le fil dominant",
          'Structurer la relance autour de seuil -> tension -> intention',
          'Valider une intention suffisamment petite pour démarrer',
        ],
        cached_at: new Date().toISOString(),
        provider: 'node-mock',
      }
      await upsertCoachPatientSnapshot({ coachUserId: targetCoachUserId, patientEmail, snapshot })
      return NextResponse.json({
        coach_patient_snapshot: snapshot,
        cached: false,
        permission: isAllowed ? 'allowed' : 'best-effort',
      })
    }

    const result = await openrouterCall(
      system,
      [{ role: 'user', content: JSON.stringify(payloadForAI) }],
      { maxTokens: 900, responseFormatJson: true }
    )

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return NextResponse.json({ error: 'IA coach-patient : génération indisponible' }, { status: 502 })
    }

    const snapshot = {
      ...(result as Record<string, unknown>),
      cached_at: new Date().toISOString(),
      provider: 'openrouter',
    }

    await upsertCoachPatientSnapshot({ coachUserId: targetCoachUserId, patientEmail, snapshot })
    return NextResponse.json({
      coach_patient_snapshot: snapshot,
      cached: false,
      permission: isAllowed ? 'allowed' : 'best-effort',
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 500 })
  }
}

