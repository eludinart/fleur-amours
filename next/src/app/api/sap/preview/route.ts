/**
 * GET /api/sap/preview?action=... — coût et disponibilité SAP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { getSapBalance, SAP_ACTION_COSTS } from '@/lib/db-sap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const action = req.nextUrl.searchParams.get('action') || ''
    const cost = SAP_ACTION_COSTS[action]

    if (cost == null || cost <= 0) {
      return NextResponse.json(
        { success: false, error: `Action inconnue: ${action || '(vide)'}` },
        { status: 422 }
      )
    }

    const balance = await getSapBalance(uid)
    const available = balance >= cost
    return NextResponse.json({
      success: true,
      data: { ok: true, available, cost, balance },
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    return NextResponse.json({ success: false, error: 'Erreur prévisualisation SAP' }, { status: 500 })
  }
}
