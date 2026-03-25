/**
 * POST /api/ai/coach-fiche
 * Génère une fiche (résumé, analyse, suggestions) à destination des coachs.
 * Persiste le résultat dans `fleur_sessions.step_data_json.coach_snapshot`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getById, update } from '@/lib/db-sessions'
import { openrouterCall } from '@/lib/openrouter'
import { getCoachPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'DB non configurée' }, { status: 500 })
    }

    let body: { sessionId?: string | number; force?: boolean }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
    }

    const sessionId = body?.sessionId != null ? parseInt(String(body.sessionId), 10) : NaN
    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: 'sessionId requis' }, { status: 400 })
    }

    const locale = getLocale(req)
    const session = await getById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const stepData = (session.step_data && typeof session.step_data === 'object' ? session.step_data : {}) as Record<string, any>

    const existing = stepData.coach_snapshot
    if (existing && !body?.force) {
      return NextResponse.json({ coach_snapshot: existing, cached: true })
    }

    const coachPrompt = await getCoachPrompt()
    const petals = (session.petals && typeof session.petals === 'object' ? session.petals : {}) as Record<string, number>
    const petalsDeficit =
      (stepData.petalsDeficit && typeof stepData.petalsDeficit === 'object' ? stepData.petalsDeficit : {}) as Record<
        string,
        number
      >
    const maxShadowLevel = Number(stepData.maxShadowLevel ?? stepData.max_shadow_level ?? 0) || 0
    const shadowEvents = Array.isArray(stepData.shadowEvents) ? stepData.shadowEvents : []
    const plan14j = (session as any).plan14j ?? null

    const userMsg = {
      session_id: sessionId,
      email: session.email ?? null,
      door_suggested: session.door_suggested ?? null,
      first_words: session.first_words ?? null,
      petals,
      petals_deficit: petalsDeficit,
      max_shadow_level: maxShadowLevel,
      shadow_events: shadowEvents,
      plan14j,
      history: (session.history && Array.isArray(session.history) ? session.history : []).slice(-20),
      language: locale,
    }

    const system = `${coachPrompt}\n\n${getLangInstruction(locale)}`

    // Fallback si aucun provider n'est dispo
    if (!process.env.OPENROUTER_API_KEY) {
      const topPetal = Object.entries(petalsDeficit).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? null
      const topVal = topPetal ? Number(petalsDeficit[topPetal] ?? 0) : 0
      const snapshot = {
        coach_summary: `La session met en évidence ${topPetal ? 'une tension sur ' + topPetal : 'des signaux de transformation'}.`,
        coach_analysis: `À partir des pétales et déficits enregistrés, le coach peut inviter la personne à relier ce qui se dit à ce qui se vit, puis à formuler une intention exploratoire.`,
        coach_suggestions: [
          `Poser une question d'échelle : « qu'est-ce qui a le plus bougé intérieurement ? »`,
          `Travailler un fil vivant : reprendre un mot clé de la personne et le faire descendre vers un ressenti.`,
        ],
        coach_conversation_prompts: [
          `Qu'est-ce qui demande d'être nommé avec plus de précision ?`,
          `Quel serait un petit pas faisable dès maintenant, si vous l'étiez ?`,
        ],
        coach_next_steps: [
          "Préparer 2-3 questions d'exploration",
          'Structurer un échange autour du fil vivant',
          'Valider une intention suffisamment petite',
        ],
        cached_at: new Date().toISOString(),
        provider: 'node-mock',
      }
      await update({ id: sessionId, step_data: { ...stepData, coach_snapshot: snapshot } })
      return NextResponse.json({ coach_snapshot: snapshot, cached: false })
    }

    const result = await openrouterCall(system, [{ role: 'user', content: JSON.stringify(userMsg) }], {
      maxTokens: 900,
      responseFormatJson: true,
    })

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return NextResponse.json({ error: 'IA coach : génération indisponible' }, { status: 502 })
    }

    const snapshot = {
      ...(result as Record<string, unknown>),
      cached_at: new Date().toISOString(),
      provider: 'openrouter',
    }

    await update({ id: sessionId, step_data: { ...stepData, coach_snapshot: snapshot } })
    return NextResponse.json({ coach_snapshot: snapshot, cached: false })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 500 })
  }
}

