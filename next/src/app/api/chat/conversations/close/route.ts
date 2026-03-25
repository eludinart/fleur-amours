/**
 * POST /api/chat/conversations/close
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { closeConversation } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdminOrCoach(req)
    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? '0'), 10)
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true })
    }
    await closeConversation(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 })
  }
}
