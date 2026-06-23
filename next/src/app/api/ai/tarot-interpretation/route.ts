/**
 * POST /api/ai/tarot-interpretation
 * Interprétation IA d'un tirage (simple ou 4 cartes), avec cache serveur
 * (règle jardin-ai-token-cache) : même tirage + même intention => pas de
 * second appel modèle.
 */
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getLlmMeta, isLlmConfigured } from '@/lib/llm'
import { getLangInstruction } from '@/lib/prompts'
import { cacheGet, cacheSet } from '@/lib/server-cache'
import { AiAccessDeniedError, aiAccessErrorResponse, guardedLlmCall, logAiCacheHit } from '@/lib/ai-guard'
import { buildSystemPrompt } from '@/lib/ai-system-prompt'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 24 * 3600_000

type TarotCard = { name?: string; desc?: string; synth?: string }

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr')
    .toLowerCase()
    .slice(0, 5)
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    ;({ userId } = await requireAuth(req))
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const uid = parseInt(userId, 10)

  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string
      intention?: string
      cards?: TarotCard[]
      locale?: string
    }
    const cards = (Array.isArray(body.cards) ? body.cards : [])
      .filter((c) => c && String(c.name ?? '').trim())
      .slice(0, 6)
    if (!cards.length) {
      return NextResponse.json({ error: 'cards requis' }, { status: 422 })
    }
    const type = body.type === 'four' ? 'four' : 'simple'
    const intention = String(body.intention ?? '').trim().slice(0, 400)
    const locale = resolveLocale(req, body.locale)

    const cacheKey =
      'tarot_interp:' +
      createHash('sha256')
        .update(JSON.stringify({ type, intention, locale, cards: cards.map((c) => c.name) }))
        .digest('hex')
    const cached = cacheGet<string>(cacheKey)
    if (cached) {
      void logAiCacheHit('tarot-interpretation', uid, cached.length)
      return NextResponse.json({ interpretation: cached, cached: true })
    }

    if (!(await isLlmConfigured())) {
      return NextResponse.json({ interpretation: '' })
    }

    const cardsText = cards
      .map((c, i) => {
        const parts = [
          `Carte ${i + 1} : ${String(c.name).trim()}`,
          c.desc ? `Description : ${String(c.desc).trim().slice(0, 600)}` : '',
          c.synth ? `Synthèse : ${String(c.synth).trim().slice(0, 300)}` : '',
        ].filter(Boolean)
        return parts.join('\n')
      })
      .join('\n\n')

    const positions =
      type === 'four'
        ? "Le tirage comporte 4 cartes : 1) situation actuelle, 2) obstacle ou tension, 3) ressource disponible, 4) direction d'évolution."
        : 'Le tirage comporte une seule carte : un éclairage du moment présent.'

    const baseSystem =
      'Tu interprètes un tirage de cartes relationnelles (pas de divination, pas de prédiction). ' +
      positions +
      " Relie les cartes entre elles et à l'intention si elle est fournie. " +
      'Ton chaleureux et concret, jamais clinique ni ésotérique. ' +
      'Réponds en texte simple (pas de JSON, pas de markdown), 3 paragraphes maximum, 1200 caractères maximum.'

    const system = await buildSystemPrompt({
      taskId: 'tarot-interpretation',
      basePrompt: baseSystem,
      locale,
    })
    const systemWithLang = `${system}\n${getLangInstruction(locale)}`

    const userContent = intention ? `Intention : ${intention}\n\n${cardsText}` : cardsText

    const { result } = await guardedLlmCall({
      taskId: 'tarot-interpretation',
      userId: uid,
      system: systemWithLang,
      messages: [{ role: 'user', content: userContent }],
      options: { rawText: true, maxTokens: 700 },
    })

    const interpretation = typeof result === 'string' ? result.trim().slice(0, 2000) : ''
    if (interpretation) cacheSet(cacheKey, interpretation, CACHE_TTL_MS)
    return NextResponse.json({ interpretation, provider: (await getLlmMeta('light')).provider })
  } catch (err: unknown) {
    if (err instanceof AiAccessDeniedError) return aiAccessErrorResponse(err.result)
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 500 })
  }
}
