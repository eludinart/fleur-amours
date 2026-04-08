/**
 * POST /api/social/reject_connection
 * Refuse une graine (demande) reçue.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { rejectSeedConnection } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const seedId = parseInt(String(body.seedId ?? body.seed_id ?? 0), 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    if (!seedId) return NextResponse.json({ error: 'seedId requis' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ ok: true }, { status: 200 })

    await rejectSeedConnection({ seedId, rejectorUserId: uid })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

