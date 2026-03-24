/**
 * GET /api/social/clairiere_unread_count
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getClairiereUnreadCount } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!userId) {
      return NextResponse.json({ count: 0 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ count: 0 })
    }
    const count = await getClairiereUnreadCount(userId)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
