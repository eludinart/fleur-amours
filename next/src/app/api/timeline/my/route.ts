/**
 * GET /api/timeline/my
 * Timeline relationnelle de l'utilisateur connecté (Éclosion).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { getUserTimeline } from '@/lib/db-timeline'
import { syncUserTimeline } from '@/lib/db-timeline-sync'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ events: [] })
    }
    const uid = parseInt(userId, 10)
    const limitRaw = req.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? parseInt(limitRaw, 10) : 120
    const user = await authMe(uid).catch(() => null)
    await syncUserTimeline(uid, user?.email ?? null)
    const events = await getUserTimeline(uid, limit)
    return NextResponse.json({ events })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur', events: [] }, { status: e.status || 401 })
  }
}
