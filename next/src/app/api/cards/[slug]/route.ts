/**
 * GET /api/cards/:slug — PUT /api/cards/:slug
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireAuth } from '@/lib/api-auth'
import { getCardBySlug, updateCard } from '@/lib/cards-data'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { slug } = await ctx.params
    const card = await getCardBySlug(slug)
    if (!card) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
    return NextResponse.json(card)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { slug } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const card = await updateCard(slug, body as Parameters<typeof updateCard>[1])
    return NextResponse.json({ ok: true, card, path: slug })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
