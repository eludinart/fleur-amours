/**
 * POST /api/promo/codes/create — crée un code (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { createPromoCode } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const code = String(body.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'code requis' }, { status: 400 })
    const duration_days = body.duration_days === null || body.duration_days === '' ? null : parseInt(body.duration_days, 10)
    const max_uses = body.max_uses === null || body.max_uses === '' ? null : parseInt(body.max_uses, 10)
    const expires_at = body.expires_at ? String(body.expires_at).trim() : null
    const note = body.note != null ? String(body.note) : ''
    const out = await createPromoCode({ code, duration_days: Number.isFinite(duration_days) ? duration_days : null, max_uses: Number.isFinite(max_uses) ? max_uses : null, expires_at, note })
    return NextResponse.json({ ok: true, id: out.id })
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

