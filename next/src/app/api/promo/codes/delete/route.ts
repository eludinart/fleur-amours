/**
 * POST /api/promo/codes/delete — supprime un code (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { deletePromoCode } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = parseInt(body.id, 10)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const out = await deletePromoCode(id)
    return NextResponse.json({ ok: true, deleted: out.deleted })
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

