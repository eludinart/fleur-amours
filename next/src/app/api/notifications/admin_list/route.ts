import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { adminList } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
    const per_page = parseInt(req.nextUrl.searchParams.get('per_page') ?? '20', 10)
    const type = req.nextUrl.searchParams.get('type') ?? ''
    const res = await adminList({ page, per_page, type })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

