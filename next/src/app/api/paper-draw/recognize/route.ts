/**
 * POST /api/paper-draw/recognize — identification des cartes sur photo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isLlmConfigured } from '@/lib/llm'
import { llmVisionJson } from '@/lib/llm-vision'
import { ALL_CARD_NAMES, type PaperDrawLayoutId } from '@/lib/paper-draw-layouts'
import { buildRecognizeSystem, buildRecognizeUserPrompt } from '@/lib/paper-draw-prompts'
import { ALL_CARDS } from '@/data/tarotCards'

export const dynamic = 'force-dynamic'

const VALID_LAYOUTS = new Set([
  'one',
  'two',
  'three',
  'four_doors',
  'flower_8',
  'free',
])

function normalizeCardName(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const exact = ALL_CARDS.find((c) => c.name.toLowerCase() === t.toLowerCase())
  if (exact) return exact.name
  const partial = ALL_CARDS.find(
    (c) =>
      c.name.toLowerCase().includes(t.toLowerCase()) ||
      t.toLowerCase().includes(c.name.toLowerCase())
  )
  return partial?.name ?? null
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)

    const body = (await req.json().catch(() => ({}))) as {
      image?: string
      layout_template?: string
    }
    const image = String(body.image ?? '').trim()
    if (!image || !/^data:image\/(jpeg|png|webp|jpg);base64,/i.test(image)) {
      return NextResponse.json({ error: 'image requise (data URL)' }, { status: 422 })
    }
    if (image.length > 4_500_000) {
      return NextResponse.json({ error: 'Image trop volumineuse' }, { status: 413 })
    }

    const layoutRaw = String(body.layout_template ?? 'free')
    const layout = (VALID_LAYOUTS.has(layoutRaw) ? layoutRaw : 'free') as PaperDrawLayoutId

    if (!(await isLlmConfigured())) {
      return NextResponse.json({
        cards: [],
        needs_review: true,
        provider: 'none',
        message: 'IA non configurée — ajoutez les cartes manuellement.',
      })
    }

    const names = ALL_CARD_NAMES.length ? ALL_CARD_NAMES : ALL_CARDS.map((c) => c.name)
    const system = buildRecognizeSystem(names)
    const userPrompt = buildRecognizeUserPrompt(layout)

    const raw = await llmVisionJson(system, userPrompt, image, { tier: 'premium' })

    const cards: Array<{ name: string; confidence: number }> = []
    if (raw) {
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const o = item as Record<string, unknown>
        const nameRaw = String(o.name ?? '').trim()
        const name = normalizeCardName(nameRaw)
        if (!name) continue
        const conf = Math.min(1, Math.max(0, Number(o.confidence ?? 0.7)))
        cards.push({ name, confidence: conf })
      }
    }

    return NextResponse.json({
      cards,
      needs_review: true,
      provider: 'vision',
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 401 })
  }
}
