/**
 * POST /api/social/send_message
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  sendChannelMessage,
  createClairiereMessageNotification,
  getOtherUserIdInChannel,
} from '@/lib/db-social'
import { addStubMessage } from '@/lib/social-stub-store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as {
      channelId?: number
      channel_id?: number
      body?: string
      cardSlug?: string
      card_slug?: string
    }
    const channelId = body.channelId ?? body.channel_id ?? 0
    const text = body.body ?? ''
    const cardSlug = body.cardSlug ?? body.card_slug ?? null

    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    }
    if (!text?.trim() && !cardSlug?.trim()) {
      return NextResponse.json({ error: 'body ou cardSlug requis' }, { status: 400 })
    }

    const senderId = parseInt(userId, 10)
    if (!senderId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      const now = new Date().toISOString()
      const msgId = Date.now()
      const msg = {
        id: msgId,
        messageId: msgId,
        senderId,
        body: text?.trim() || null,
        cardSlug: cardSlug?.trim() || null,
        temperature: 'calm' as const,
        createdAt: now,
      }
      addStubMessage(channelId, { ...msg })
      return NextResponse.json(msg, { status: 201 })
    }

    const msg = await sendChannelMessage(channelId, senderId, {
      body: text?.trim() || null,
      cardSlug: cardSlug?.trim() || null,
    })
    const recipientId = await getOtherUserIdInChannel(channelId, senderId)
    if (recipientId) {
      createClairiereMessageNotification(
        channelId,
        senderId,
        recipientId,
        msg.body,
        msg.cardSlug
      ).catch(() => {})
    }
    return NextResponse.json(
      {
        id: msg.id,
        messageId: msg.id,
        senderId: msg.senderId,
        body: msg.body,
        cardSlug: msg.cardSlug,
        temperature: msg.temperature,
        createdAt: msg.createdAt,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
