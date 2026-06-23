/**
 * POST /api/social/snooze_seed
 * Met en sommeil une Graine reçue (« peut-être plus tard »).
 * Crée implicitement un cooldown 7 j côté envoyeur, sans le signaler comme un refus.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { snoozeSeedConnection } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const seedId = parseInt(String(body.seedId ?? body.seed_id ?? 0), 10)
    if (!seedId) {
      return NextResponse.json({ error: 'seedId requis' }, { status: 400 })
    }
    const snoozerUserId = parseInt(userId, 10)
    if (!snoozerUserId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    await snoozeSeedConnection({ seedId, snoozerUserId })
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors de la mise en sommeil' },
      { status: e.status || 400 }
    )
  }
}
