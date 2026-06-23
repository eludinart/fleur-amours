/**
 * POST /api/social/message_reaction — ajoute ou retire une réaction emoji sur un message Clairière.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { toggleChannelMessageReaction } from '@/lib/db-social'
import { toggleStubReaction } from '@/lib/social-stub-store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as {
      messageId?: number
      message_id?: number
      emoji?: string
      channelId?: number
      channel_id?: number
    }
    const messageId = Number(body.messageId ?? body.message_id ?? 0)
    const emoji = String(body.emoji ?? '').trim()
    const channelId = Number(body.channelId ?? body.channel_id ?? 0)

    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 })
    }
    if (!emoji) {
      return NextResponse.json({ error: 'emoji requis' }, { status: 400 })
    }

    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      const result = toggleStubReaction(channelId, messageId, uid, emoji)
      return NextResponse.json(result)
    }

    const result = await toggleChannelMessageReaction(messageId, uid, emoji)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
