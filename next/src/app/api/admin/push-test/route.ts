/**
 * GET  /api/admin/push-test        — liste les tokens enregistrés
 * POST /api/admin/push-test        — envoie un push test à un userId
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured, getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrCoach(req)
    if (!isDbConfigured()) return NextResponse.json({ tokens: [] })
    const pool = getPool()
    const t = table('fleur_push_tokens')
    const [rows] = await pool.execute(
      `SELECT id, user_id, user_email, platform, LEFT(token,30) as token_preview, created_at FROM ${t} ORDER BY created_at DESC LIMIT 50`
    )
    return NextResponse.json({ tokens: rows })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminOrCoach(req)
    const body = (await req.json()) as { user_id?: number; title?: string; message?: string }
    const userId = Number(body.user_id ?? 0)
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })

    const { sendFcmPush } = await import('@/lib/fcm')
    const sent = await sendFcmPush(
      userId,
      null,
      body.title ?? 'Test notification',
      body.message ?? 'Ceci est un test push depuis le panneau admin',
      null
    )
    return NextResponse.json({ sent, ok: sent > 0 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
