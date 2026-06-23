/**
 * POST /api/paper-draw/interpret
 */
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { llmCall, isLlmConfigured } from '@/lib/llm'
import type { PaperDrawLayoutId } from '@/lib/paper-draw-layouts'
import { buildInterpretSystem, buildInterpretUser } from '@/lib/paper-draw-prompts'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 24 * 3600_000
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
      cards?: Array<{ name?: string; slot?: string; role?: string; duplicate?: boolean }>
      locale?: string
    }

    const layoutRaw = String(body.layout_template ?? 'free')
    const layoutId = (VALID_LAYOUTS.has(layoutRaw) ? layoutRaw : 'free') as PaperDrawLayoutId
    const cards = (Array.isArray(body.cards) ? body.cards : [])
      .filter((c) => c && String(c.name ?? '').trim())
      .map((c) => ({
        name: String(c.name).trim(),
        slot: c.slot ? String(c.slot) : undefined,
        role: c.role ? String(c.role) : undefined,
        duplicate: Boolean(c.duplicate),
      }))
    if (!cards.length) {
      return NextResponse.json({ error: 'cards requis' }, { status: 422 })
    }

    const intention = String(body.intention ?? '').trim().slice(0, 500)
    const context = String(body.context ?? '').trim().slice(0, 800)
    const locale = resolveLocale(req, body.locale)

    const cacheKey =
      'paper_interp:' +
      createHash('sha256')
        .update(JSON.stringify({ layoutId, intention, context, locale, cards }))
        .digest('hex')
    const cached = cacheGet<string>(cacheKey)
    if (cached) return NextResponse.json({ interpretation: cached, cached: true })

    if (!(await isLlmConfigured())) {
      return NextResponse.json({ interpretation: '' })
    }

    const system = buildInterpretSystem(locale)
    const userContent = buildInterpretUser({ layoutId, intention, context, cards })

    const result = await llmCall(
      system,
      [{ role: 'user', content: userContent }],
      { rawText: true, maxTokens: 800, tier: 'standard' }
    )

    const interpretation = typeof result === 'string' ? result.trim().slice(0, 2200) : ''
    if (interpretation) cacheSet(cacheKey, interpretation, CACHE_TTL_MS)
    return NextResponse.json({ interpretation })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 401 })
  }
}
