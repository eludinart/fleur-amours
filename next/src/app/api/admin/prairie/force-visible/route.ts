/**
 * POST /api/admin/prairie/force-visible
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { forcePrairieVisibleByEmail } from '@/lib/db-prairie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim()
    if (!email) {
      return NextResponse.json({ error: 'email requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const result = await forcePrairieVisibleByEmail(email)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}
