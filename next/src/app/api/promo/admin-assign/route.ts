/**
 * POST /api/promo/admin-assign — attribue un accès (admin)
 * Body:
 *   - { user_id, code }  OU
 *   - { user_id, free_until } OU { user_id, unlimited: true }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { assignAccessByCode, assignAccessDirect } from '@/lib/db-promo-access'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const userId = parseInt(body.user_id, 10)
    if (!userId || isNaN(userId)) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (code) {
      await assignAccessByCode(userId, code)
      return NextResponse.json({ ok: true })
    }

    const unlimited = Boolean(body.unlimited)
    const free_until = body.free_until ? String(body.free_until) : null
    await assignAccessDirect({ user_id: userId, unlimited, free_until, promo_note: body.promo_note ?? null })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

