/**
 * GET /api/tarot_readings/get?id=...
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { getById } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const idParam = req.nextUrl.searchParams.get('id')
    const id = idParam ? parseInt(idParam, 10) : 0

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    let email: string | undefined
    try {
      const user = await authMe(parseInt(userId, 10))
      email = user.email || undefined
    } catch {
      /* ignore */
    }

    const reading = await getById(id, userId, email)
    if (!reading) {
      return NextResponse.json({ error: 'Tirage introuvable' }, { status: 404 })
    }

    return NextResponse.json(reading)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
