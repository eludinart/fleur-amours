/**
 * POST /api/ai/card-question
 * Accroche + question après tirage aléatoire (Explorer ma Fleur).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCardInfo } from '@/lib/card-info'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

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
    card_name?: string
    card_desc?: string
    door?: string
    history?: Array<{ role?: string; content?: string }>
  }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }

  const cardName = String(body.card_name ?? '').trim()
  const cardDesc = String(body.card_desc ?? '').trim()
  const locale = getLocale(req)

  if (!cardName) {
    return NextResponse.json({
      response_a: '',
      question: "Qu'est-ce que cette carte vous inspire ?",
      provider: 'noop',
      })
  }

  const info = await getCardInfo(cardName)
  let response_a = `Vous avez tiré « ${cardName} ».`
  let question =
    info?.questionRacine?.trim() ||
    (info?.theme ? info.theme.split(/[.!?]/)[0]?.trim() + ' — qu’est-ce qui résonne pour vous ?' : '') ||
    (cardDesc ? `« ${cardDesc.split('\n')[0].trim().slice(0, 200)} » — qu’est-ce que cela réveille en vous ?` : '') ||
    "Qu'est-ce que cette carte vous inspire en ce moment ?"

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    const history = Array.isArray(body.history) ? body.history : []
    const tail = history
      .slice(-4)
      .map((m) => {
        const c = String(m.content ?? '').trim()
        if (!c) return null
        return `${m.role ?? 'user'}: ${c.slice(0, 300)}`
      })
      .filter(Boolean)
      .join('\n')

    const userContent =
      `Carte tirée : « ${cardName} »\n` +
      `Thème / description (extrait) : ${(info?.theme || cardDesc).slice(0, 600)}\n` +
      `Question racine deck (si utile) : ${info?.questionRacine || '—'}\n` +
      (tail ? `\nDerniers échanges :\n${tail}\n` : '') +
      `\nRéponds UNIQUEMENT en JSON {"response_a":"string courte (1–2 phrases, accueil du tirage)","question":"string une seule question ouverte du Tuteur maïeutique"}.` +
      getLangInstruction(locale)

    const raw = await openrouterCall(
      'Tu es le Tuteur maïeutique Fleur d’AmOurs. JSON strict, deux clés uniquement.',
      [{ role: 'user', content: userContent }],
      { maxTokens: 500, responseFormatJson: true }
    )

    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>
      const ra = String(r.response_a ?? '').trim()
      const q = String(r.question ?? '').trim()
      if (q.length > 5) {
        response_a = ra.length > 3 ? ra.slice(0, 500) : response_a
        question = q.slice(0, 800)
        return NextResponse.json({ response_a, question, provider: 'openrouter' })
      }
    }
  }

  return NextResponse.json({ response_a, question, provider: info ? 'card-json' : 'fallback' })
}
