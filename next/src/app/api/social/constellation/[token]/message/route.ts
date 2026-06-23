/**
 * POST /api/social/constellation/[token]/message
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { postConstellationMessage } from '@/lib/db-constellations'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const { token } = await params
    const body = await req.json().catch(() => ({}))
    const text = String(body.body ?? body.message ?? '').trim()

    if (!isDbConfigured()) {
      return NextResponse.json({ id: 0, createdAt: new Date().toISOString() })
    }

    const msg = await postConstellationMessage(uid, token, text)
    return NextResponse.json(msg, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
