/**
 * POST /api/ai/card-context
 * Court texte d’ancrage pour la modale carte (Explorer ma Fleur).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCardInfo } from '@/lib/card-info'
import { getLlmMeta, isLlmConfigured } from '@/lib/llm'
import { getLangInstruction } from '@/lib/prompts'
import { buildSystemPrompt } from '@/lib/ai-system-prompt'
import { AiAccessDeniedError, aiAccessErrorResponse, guardedLlmCall } from '@/lib/ai-guard'

export const dynamic = 'force-dynamic'

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

function baseFromCard(cardName: string, cardDesc: string, info: Awaited<ReturnType<typeof getCardInfo>>): string {
  if (info?.theme?.trim()) return info.theme.trim().slice(0, 700)
  const line = cardDesc.split('\n').map((s) => s.trim()).find(Boolean) ?? ''
  if (line) return line.slice(0, 700)
  return `La carte « ${cardName} » accompagne votre passage à cette porte.`
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    ;({ userId } = await requireAuth(req))
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }

  const uid = parseInt(userId, 10)

  let body: { card_name?: string; card_desc?: string; door?: string; history?: unknown[] }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }

  const cardName = String(body.card_name ?? '').trim()
  const cardDesc = String(body.card_desc ?? '').trim()
  const locale = getLocale(req)

  if (!cardName) {
    return NextResponse.json({ context: '', provider: 'noop' })
  }

  const info = await getCardInfo(cardName)
  let context = baseFromCard(cardName, cardDesc, info)

  if ((await isLlmConfigured())) {
    const history = Array.isArray(body.history) ? body.history : []
    const lines = history
      .slice(-6)
      .map((m) => {
        const o = m as { role?: string; content?: string }
        const c = String(o.content ?? '').trim()
        if (!c) return null
        return `${o.role ?? 'user'}: ${c.slice(0, 400)}`
      })
      .filter(Boolean)
      .join('\n')

    const userContent =
      `Carte : « ${cardName} »\n` +
      `Description / thème carte (extrait) :\n${context}\n\n` +
      (lines ? `Derniers échanges :\n${lines}\n\n` : '') +
      `En 2–3 phrases maximum, propose un texte bref, poétique et invitant — pas de conseil prescriptif — qui relie cette carte au vécu évoqué (ou ouvre doucement la réflexion si l’historique est vide).` +
      getLangInstruction(locale)

    const sys = await buildSystemPrompt({
      taskId: 'card-context',
      basePrompt: `Tu réponds UNIQUEMENT par un JSON {"context":"string"} — une seule clé, texte court (2–3 phrases). Pas de markdown.`,
      locale,
    })
    try {
      const { result: raw } = await guardedLlmCall({
        taskId: 'card-context',
        userId: uid,
        system: sys,
        messages: [{ role: 'user', content: userContent }],
        options: { maxTokens: 400, responseFormatJson: true },
      })

      if (raw && typeof raw === 'object') {
        const c = String((raw as Record<string, unknown>).context ?? '').trim()
        if (c.length > 10) {
          context = c.slice(0, 1200)
          return NextResponse.json({ context, provider: (await getLlmMeta('light')).provider })
        }
      }
    } catch (e: unknown) {
      if (e instanceof AiAccessDeniedError) return aiAccessErrorResponse(e.result)
    }
  }

  return NextResponse.json({ context, provider: info ? 'card-json' : 'fallback' })
}
