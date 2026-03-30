/**
 * GET /api/promo/redemptions — liste les utilisations (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { listRedemptions } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const codeId = req.nextUrl.searchParams.get('code_id')
    // on supporte code_id plus tard; pour l'instant, liste tout
    void codeId
    const items = await listRedemptions()
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

