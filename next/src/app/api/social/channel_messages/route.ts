/**
 * GET /api/social/channel_messages
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getChannelMessages } from '@/lib/db-social'
import { getStubMessages } from '@/lib/social-stub-store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const channelId = req.nextUrl.searchParams.get('channel_id')
    if (!channelId) {
      return NextResponse.json({ error: 'channel_id requis' }, { status: 400 })
    }
    const cid = parseInt(channelId, 10)
    if (!cid) {
      return NextResponse.json({ error: 'channel_id invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      const stub = getStubMessages(cid)
      const formatted = stub.map((m) => ({
        id: m.id,
        messageId: m.id,
        senderId: m.senderId,
        body: m.body,
        cardSlug: m.cardSlug,
        temperature: m.temperature,
        createdAt: m.createdAt,
      }))
      return NextResponse.json({ messages: formatted })
    }

    const messages = await getChannelMessages(cid, userId)
    // Format attendu par DialogueStream : id, senderId, body, cardSlug, temperature, createdAt
    const formatted = messages.map((m) => ({
      id: m.id,
      messageId: m.id,
      senderId: m.senderId,
      body: m.body,
      cardSlug: m.cardSlug,
      temperature: m.temperature,
      createdAt: m.createdAt,
    }))
    return NextResponse.json({ messages: formatted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
