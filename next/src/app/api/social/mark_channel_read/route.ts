/**
 * POST /api/social/mark_channel_read
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { markChannelAsRead, recordChannelViewing, clearChannelViewing } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as {
      channelId?: number
      channel_id?: number
      viewing?: boolean
    }
    const channelId = body.channelId ?? body.channel_id ?? 0

    if (!channelId || !userId) {
      return NextResponse.json({ ok: true })
    }
    if (!isDbConfigured()) {
      const { recordStubChannelViewing, clearStubChannelViewing } = await import('@/lib/social-stub-store')
      if (body.viewing === true) recordStubChannelViewing(channelId, parseInt(userId, 10))
      else if (body.viewing === false) clearStubChannelViewing(channelId, parseInt(userId, 10))
      return NextResponse.json({ ok: true })
    }
    if (body.viewing === true) {
      await markChannelAsRead(channelId, userId)
      await recordChannelViewing(channelId, userId)
    } else if (body.viewing === false) {
      await clearChannelViewing(channelId, userId)
    } else {
      await markChannelAsRead(channelId, userId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
