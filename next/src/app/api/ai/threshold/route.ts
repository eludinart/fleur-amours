/**
 * POST /api/ai/threshold
 * Identifie la porte d'entrée et formule la première question.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getLlmMeta, isLlmConfigured } from '@/lib/llm'
import { getThresholdPrompt } from '@/lib/prompts-resolver'
import { getLangInstruction } from '@/lib/prompts'
import { buildSystemPrompt } from '@/lib/ai-system-prompt'
import { AiAccessDeniedError, aiAccessErrorResponse, guardedLlmCall } from '@/lib/ai-guard'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

const doorLabels: Record<string, string> = {
  love: 'la Porte du Cœur',
  vegetal: 'la Porte du Temps',
  elements: 'la Porte du Climat',
  life: "la Porte de l'Histoire",
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    ;({ userId } = await requireAuth(req))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Authentification requise' }, { status: e.status ?? 401 })
  }
  const uid = parseInt(userId, 10)

  let body: { first_words?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }
  const firstWords = String(body.first_words ?? '').trim()
  if (!firstWords) {
    return NextResponse.json({ error: 'Les premiers mots ne peuvent pas être vides.' }, { status: 422 })
  }

  const locale = getLocale(req)
  const msg =
    `Voici ce que la personne a exprimé comme première parole :\n"${firstWords}"\n\nIdentifie la porte d'entrée et formule la première question selon les instructions.` +
    getLangInstruction(locale)

  if (await isLlmConfigured()) {
    try {
      const systemPrompt = await buildSystemPrompt({
        taskId: 'threshold',
        basePrompt: await getThresholdPrompt(),
        locale,
      })
      const { result } = await guardedLlmCall({
        taskId: 'threshold',
        userId: uid,
        system: systemPrompt,
        messages: [{ role: 'user', content: msg }],
        options: { maxTokens: 400 },
      })
      if (
        result &&
        typeof result === 'object' &&
        (result as Record<string, unknown>).door_suggested &&
        (result as Record<string, unknown>).first_question
      ) {
        return NextResponse.json({
          ...result,
          provider: (await getLlmMeta('light')).provider,
        })
      }
    } catch (e: unknown) {
      if (e instanceof AiAccessDeniedError) return aiAccessErrorResponse(e.result)
    }
  }

  const norm = firstWords
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
  const doorKeywords: Record<string, string[]> = {
    love: ['amour', 'relation', 'couple', 'duo', 'coeur', 'aimer', 'sentiment', 'ami'],
    vegetal: ['temps', 'phase', 'etape', 'croissance', 'cycle', 'racine', 'fruit', 'fleur'],
    elements: ['environnement', 'contexte', 'atmosphere', 'climat', 'travail', 'famille'],
    life: ['vie', 'chemin', 'histoire', 'passe', 'memoire', 'avenir', 'sens', 'transformation'],
  }
  const scores: Record<string, number> = {}
  for (const [door, keywords] of Object.entries(doorKeywords)) {
    scores[door] = keywords.filter((kw) => norm.includes(kw)).length
  }
  const bestDoor =
    Object.values(scores).some((v) => v > 0)
      ? (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'love')
      : 'love'
  const words = norm
    .split(/\s+/)
    .filter((w) => w.length >= 5)
    .filter((w) => !['comme', 'quand', 'alors', 'parce', 'cette', 'depuis'].includes(w))
  const mirrorWord = words[0] ?? null
  const firstQuestion = mirrorWord
    ? `Vous avez dit «${mirrorWord}». Qu'est-ce que ce mot représente pour vous en ce moment ?`
    : "Qu'est-ce qui est le plus vivant dans ce que vous venez de dire ?"

  return NextResponse.json({
    door_suggested: bestDoor,
    door_reason: `Vos premiers mots pointent vers ${doorLabels[bestDoor] ?? 'la Porte du Cœur'}.`,
    first_question: firstQuestion,
    card_group_hint: bestDoor,
    provider: 'node-mock',
  })
}
