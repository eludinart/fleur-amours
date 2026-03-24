/**
 * POST /api/ai/door-intro
 * Génère l'intro contextualisée lors du passage à une nouvelle porte.
 * Prend en compte l'historique des échanges pour relier le chemin parcouru à la nouvelle porte.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { DOOR_INTRO_SYSTEM_PROMPT } from '@/lib/prompts'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const DOOR_LABELS: Record<string, string> = {
  love: 'la Porte du Cœur',
  vegetal: 'la Porte du Temps',
  elements: 'la Porte du Climat',
  life: "la Porte de l'Histoire",
}

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }

  let body: {
    door?: string
    first_words?: string
    anchors?: Array<{ door?: string; synthesis?: string; habit?: string }>
    card_name?: string
    card_theme?: string
    history?: Array<{ role?: string; content?: string }>
    locked_doors?: string[]
    petals?: Record<string, number>
  }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }

  const door = String(body.door ?? 'love').trim() || 'love'
  const firstWords = String(body.first_words ?? '').trim()
  const anchors = Array.isArray(body.anchors) ? body.anchors : []
  const cardName = String(body.card_name ?? '').trim()
  const cardTheme = String(body.card_theme ?? '').trim()
  const history = Array.isArray(body.history) ? body.history : []
  const lockedDoors = Array.isArray(body.locked_doors) ? body.locked_doors : []
  const petals = body.petals && typeof body.petals === 'object' ? body.petals : {}
  const locale = getLocale(req)

  // Contexte pour l'IA
  const anchorsText =
    anchors.length > 0
      ? anchors
          .map((a) => {
            const d = a.door ? DOOR_LABELS[a.door] ?? a.door : ''
            return `- ${d}: ${a.synthesis ?? ''}${a.habit ? ` (habitude: ${a.habit})` : ''}`
          })
          .join('\n')
      : 'Aucune porte encore parcourue.'

  const userContent =
    `═══ CONTEXTE POUR L'INTRO DE LA NOUVELLE PORTE ═══\n` +
    `Nouvelle porte : ${DOOR_LABELS[door] ?? door}\n` +
    `Première parole (seuil) : "${firstWords}"\n` +
    `Portes verrouillées : ${lockedDoors.length > 0 ? lockedDoors.map((d) => DOOR_LABELS[d] ?? d).join(', ') : 'Aucune'}\n` +
    `Carte tirée : ${cardName || '—'}\n` +
    `Thème carte : ${cardTheme || '—'}\n` +
    `Ancres des portes parcourues :\n${anchorsText}\n` +
    `Pétales actuels : ${JSON.stringify(petals)}\n` +
    `\nEn te basant sur l'historique des échanges ci-dessus, formule une intro (door_intro) qui relie le chemin parcouru à cette nouvelle porte, puis une question d'ouverture (question).` +
    getLangInstruction(locale)

  const oaiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history) {
    const role = (m.role ?? 'user') as 'user' | 'assistant'
    const content = String(m.content ?? '').trim()
    if (role && content) oaiMessages.push({ role, content })
  }
  oaiMessages.push({ role: 'user', content: userContent })

  if (process.env.OPENROUTER_API_KEY) {
    const result = await openrouterCall(
      DOOR_INTRO_SYSTEM_PROMPT,
      oaiMessages,
      { maxTokens: 400 }
    )
    if (
      result &&
      typeof result === 'object' &&
      ((result as Record<string, unknown>).door_intro || (result as Record<string, unknown>).question)
    ) {
      const r = result as Record<string, unknown>
      return NextResponse.json({
        door_intro: String(r.door_intro ?? '').trim(),
        question: String(r.question ?? r.first_question ?? '').trim() || "Qu'est-ce qui est vivant pour vous en entrant dans cette porte ?",
        provider: 'openrouter',
      })
    }
  }

  // Fallback : intro simple sans historique
  const doorLabel = DOOR_LABELS[door] ?? door
  const defaultQuestion =
    cardTheme && cardTheme.length > 10
      ? `La carte ${cardName} invite à explorer : ${cardTheme.split('.')[0]}. Qu'est-ce qui résonne en vous ?`
      : "Qu'est-ce qui est vivant pour vous en entrant dans cette porte ?"

  return NextResponse.json({
    door_intro: `${doorLabel} vous accueille.`,
    question: defaultQuestion,
    provider: 'node-fallback',
  })
}
