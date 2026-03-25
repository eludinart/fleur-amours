/**
 * GET /api/sap/balance — solde SAP (wallet unifié).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { getSapBalance } from '@/lib/db-sap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Utilisateur invalide' }, { status: 400 })
    }
    const balance = await getSapBalance(uid)
    return NextResponse.json({ success: true, data: { balance } })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    return NextResponse.json({ success: false, error: 'Erreur solde SAP' }, { status: 500 })
  }
}
