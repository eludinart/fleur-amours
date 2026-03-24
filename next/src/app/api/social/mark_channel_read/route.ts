/**
 * POST /api/social/mark_channel_read
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { markChannelAsRead } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as { channelId?: number; channel_id?: number }
    const channelId = body.channelId ?? body.channel_id ?? 0

    if (!channelId || !userId) {
      return NextResponse.json({ ok: true })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true })
    }
    await markChannelAsRead(channelId, userId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
