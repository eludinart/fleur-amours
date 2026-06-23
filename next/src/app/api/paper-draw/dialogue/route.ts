/**
 * POST /api/paper-draw/dialogue
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { llmCall, getLlmMeta, isLlmConfigured } from '@/lib/llm'
import type { PaperDrawLayoutId } from '@/lib/paper-draw-layouts'
import { buildDialogueSystem, buildDialogueUser } from '@/lib/paper-draw-prompts'

export const dynamic = 'force-dynamic'

const VALID_LAYOUTS = new Set([
  'one',
  'two',
  'three',
  'four_doors',
  'flower_8',
  'free',
])

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr')
    .toLowerCase()
    .slice(0, 5)
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const body = (await req.json().catch(() => ({}))) as {
      layout_template?: string
      intention?: string
      context?: string
      cards?: Array<{ name?: string; slot?: string; role?: string }>
      history?: Array<{ role?: string; content?: string }>
      transcript?: string
      locale?: string
    }

    const transcript = String(body.transcript ?? '').trim()
    if (!transcript) {
      return NextResponse.json({ error: 'transcript requis' }, { status: 422 })
    }

    const layoutRaw = String(body.layout_template ?? 'free')
    const layoutId = (VALID_LAYOUTS.has(layoutRaw) ? layoutRaw : 'free') as PaperDrawLayoutId
    const cards = (Array.isArray(body.cards) ? body.cards : [])
      .filter((c) => c && String(c.name ?? '').trim())
      .map((c) => ({
        name: String(c.name).trim(),
        slot: c.slot ? String(c.slot) : undefined,
        role: c.role ? String(c.role) : undefined,
      }))
    const intention = String(body.intention ?? '').trim().slice(0, 500)
    const context = String(body.context ?? '').trim().slice(0, 800)
    const history = Array.isArray(body.history) ? body.history : []
    const locale = resolveLocale(req, body.locale)

    let response_a = 'Je vous reçois.'
    let question = "Qu'est-ce qui résonne le plus pour vous dans ce tirage ?"

    if (await isLlmConfigured()) {
      const system = buildDialogueSystem(locale)
      const userContent = buildDialogueUser({
        layoutId,
        intention,
        context,
        cards,
        history,
        transcript,
      })

      const raw = await llmCall(
        system,
        [{ role: 'user', content: userContent }],
        { maxTokens: 600, responseFormatJson: true, tier: 'standard' }
      )

      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>
        const ra = String(r.response_a ?? '').trim()
        const q = String(r.question ?? '').trim()
        if (q.length > 5) {
          response_a = ra.length > 3 ? ra.slice(0, 500) : response_a
          question = q.slice(0, 800)
        }
      }
    }

    const meta = await getLlmMeta('standard')
    return NextResponse.json({ response_a, question, provider: meta.provider })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 401 })
  }
}
