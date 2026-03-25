/**
 * POST /api/admin/science/rebuild
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { generateScienceProfile } from '@/lib/science-generator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      user_id?: number
      userId?: number
      locale?: string
      petals?: Record<string, number>
    }

    const uid = Number(body.user_id ?? body.userId ?? 0)
    if (!Number.isFinite(uid) || uid <= 0) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }

    const user = await authMe(uid)
    const locale = (body.locale ?? 'fr').toLowerCase()
    const petals = body.petals ?? {}

    const result = await generateScienceProfile({
      userId: uid,
      userEmail: user.email,
      locale,
      petals,
      force: true,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

