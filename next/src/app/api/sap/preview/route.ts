/**
 * GET /api/sap/preview?action=...
 * Prévisualise le coût en Sève pour une action.
 * Stub: autorise toutes les actions (ok, available) en attendant la table billing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const action = req.nextUrl.searchParams.get('action') || ''
    return NextResponse.json({
      ok: true,
      available: true,
      cost: 0,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { ok: false, available: false, cost: 0 },
      { status: e.status || 401 }
    )
  }
}
