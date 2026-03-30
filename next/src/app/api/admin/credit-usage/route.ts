/**
 * POST /api/admin/credit-usage
 * Crédit de tokens gratuits = bonus de quota sur le mois en cours.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { addQuotaBonus } from '@/lib/db-quota-bonus'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const userId = parseInt(body.user_id, 10)
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'user_id requis.' }, { status: 400 })
    }

    const credits = {
      chat_messages: parseInt(body.chat_messages, 10) || 0,
      sessions: parseInt(body.sessions, 10) || 0,
      tirages: parseInt(body.tirages, 10) || 0,
      fleur_submits: parseInt(body.fleur_submits, 10) || 0,
    }
    if (!credits.chat_messages && !credits.sessions && !credits.tirages && !credits.fleur_submits) {
      return NextResponse.json({ error: 'Aucun crédit fourni.' }, { status: 400 })
    }

    const bonus = await addQuotaBonus(userId, credits)
    return NextResponse.json({ ok: true, bonus })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

