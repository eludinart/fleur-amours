/**
 * GET /api/social/presence_heartbeat
 * Met à jour fleur_social_last_seen_at pour l’utilisateur connecté (en ligne ≈ actif récemment).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { recordSocialPresenceHeartbeat } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (isDbConfigured() && uid > 0) {
      try {
        await recordSocialPresenceHeartbeat(uid)
      } catch {
        /* ignore DB errors — ok renvoyé pour ne pas casser le client */
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
