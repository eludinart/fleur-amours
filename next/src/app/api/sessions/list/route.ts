/**
 * GET /api/sessions/list
 * Liste des sessions (admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { list } from '@/lib/db-sessions'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0 })
    }
    await requireAdmin(req)
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(req.nextUrl.searchParams.get('per_page') ?? '20', 10)
    const search = req.nextUrl.searchParams.get('search') ?? undefined
    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const data = await list({ page, per_page: perPage, search, status })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', items: [], total: 0 },
      { status: e.status || 401 }
    )
  }
}
