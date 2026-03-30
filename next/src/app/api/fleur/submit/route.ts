/**
 * POST /api/fleur/submit
 * Enregistre les réponses Fleur en MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { notifyDuoPartnerSubmitted, submitFleur } from '@/lib/db-fleur'
import { requireAuth } from '@/lib/api-auth'
import { incrementMonthlyUsage } from '@/lib/db-usage'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const payload = { ...body, user_id: uid }

    const data = await submitFleur(payload)

    const partnerToken = typeof body.partner_token === 'string' ? body.partner_token.trim() : ''
    if (partnerToken) {
      void notifyDuoPartnerSubmitted(partnerToken, uid)
    }

    void incrementMonthlyUsage(uid, { fleur_submits: 1 })

    const result = {
      id: data.result_id,
      result_id: data.result_id,
      token: data.token,
      scores: data.scores ?? {},
      analysis: null,
      composite: null,
      interpretation: null,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors de l\'enregistrement' },
      { status }
    )
  }
}
