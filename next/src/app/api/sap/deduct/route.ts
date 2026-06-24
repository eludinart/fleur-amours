/**
 * POST /api/sap/deduct — débit SAP pour une action (transactionnel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { SAP_ACTION_COSTS, transactionalSapUpdate, SapError, getSapBalance } from '@/lib/db-sap'
import { invalidateUserAccessCache, readBillingBypass } from '@/lib/user-billing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '').trim()
    if (!action) {
      return NextResponse.json({ success: false, error: 'action requise' }, { status: 422 })
    }

    const cost = SAP_ACTION_COSTS[action]
    if (cost == null || cost <= 0) {
      return NextResponse.json({ success: false, error: `Action inconnue: ${action}` }, { status: 422 })
    }

    if (await readBillingBypass(uid)) {
      const balance = await getSapBalance(uid)
      return NextResponse.json({
        success: true,
        data: { action, debited: 0, balance, billing_bypass: true },
      })
    }

    const { balance } = await transactionalSapUpdate(uid, cost, action, 'usage')
    invalidateUserAccessCache(uid)
    return NextResponse.json({
      success: true,
      data: { action, debited: cost, balance },
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    if (err instanceof SapError && err.code === 'INSUFFICIENT') {
      return NextResponse.json({ success: false, error: err.message }, { status: 402 })
    }
    const e = err as Error
    return NextResponse.json({ success: false, error: e?.message || 'Erreur débit SAP' }, { status: 500 })
  }
}
