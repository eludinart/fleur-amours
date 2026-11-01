/**
 * GET /api/presence/streak — fil de sève (présence multi-activités).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getPresenceStreak } from '@/lib/presence-streak'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ current: 0, today: false, badge7: false })
    }
    const streak = await getPresenceStreak(parseInt(userId, 10))
    return NextResponse.json(streak)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 })
  }
}
