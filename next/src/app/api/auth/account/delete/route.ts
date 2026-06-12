/**
 * POST /api/auth/account/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { clearAuthCookie } from '@/lib/auth-cookie'
import { isDbConfigured } from '@/lib/db'
import { deleteUserAccount } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    await deleteUserAccount(uid)
    const res = NextResponse.json({ ok: true })
    clearAuthCookie(res)
    return res
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 500 })
  }
}
