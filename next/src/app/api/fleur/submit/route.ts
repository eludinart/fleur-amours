/**
 * POST /api/fleur/submit
 * Enregistre les réponses Fleur en MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { notifyDuoPartnerSubmitted, submitFleur } from '@/lib/db-fleur'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const payload = { ...body, user_id: parseInt(userId, 10) }

    const data = await submitFleur(payload)

    const partnerToken = typeof body.partner_token === 'string' ? body.partner_token.trim() : ''
    if (partnerToken) {
      void notifyDuoPartnerSubmitted(partnerToken, parseInt(userId, 10))
    }

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
