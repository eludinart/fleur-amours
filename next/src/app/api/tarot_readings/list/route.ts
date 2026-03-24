/**
 * GET /api/tarot_readings/list (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { list } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0, page: 1, pages: 0 })
    }

    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(req.nextUrl.searchParams.get('per_page') ?? '20', 10)
    const search = req.nextUrl.searchParams.get('search') ?? undefined

    const data = await list({ page, per_page: perPage, search })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [], total: 0, page: 1, pages: 0 }, { status: e.status || 401 })
  }
}
