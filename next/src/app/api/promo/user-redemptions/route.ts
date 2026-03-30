/**
 * GET /api/promo/user-redemptions?user_id=... — liste des accès d'un user (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { listRedemptions } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const userId = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!userId || isNaN(userId)) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    const items = await listRedemptions({ user_id: userId })
    return NextResponse.json(items)
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

