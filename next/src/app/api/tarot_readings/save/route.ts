/**
 * POST /api/tarot_readings/save
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { save } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const type = ['simple', 'four'].includes(String(body.type ?? '')) ? body.type : 'simple'
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

    let email: string | null = null
    try {
      const user = await authMe(parseInt(userId, 10))
      email = user.email || null
    } catch {
      /* ignore */
    }

    const saved = await save({
      user_id: parseInt(userId, 10),
      email,
      type,
      payload,
    })

    return NextResponse.json(saved, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
