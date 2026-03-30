/**
 * GET /api/promo/codes — liste des codes (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { listPromoCodes } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const codes = await listPromoCodes()
    // Adapter au format attendu par AdminPromoPage
    const now = Date.now()
    const out = codes.map((c) => {
      const unlimited_duration = c.duration_days == null
      const unlimited_uses = c.max_uses == null
      const is_expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false
      const is_exhausted = c.max_uses != null ? c.uses_count >= c.max_uses : false
      return {
        id: c.id,
        code: c.code,
        duration_days: c.duration_days,
        unlimited_duration,
        max_uses: c.max_uses,
        unlimited_uses,
        uses_count: c.uses_count,
        expires_at: c.expires_at,
        note: c.note ?? '',
        is_expired,
        is_exhausted,
      }
    })
    return NextResponse.json(out)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

