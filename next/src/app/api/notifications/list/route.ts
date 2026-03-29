import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { listForUser } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const per_page = parseInt(req.nextUrl.searchParams.get('per_page') ?? '20', 10)
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
    const data = await listForUser({ userId: uid, per_page, page })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

