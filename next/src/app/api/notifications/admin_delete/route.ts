import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { adminDelete } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      ids?: number[]
      filters?: { type?: string }
    }
    const deleted = await adminDelete(body)
    return NextResponse.json({ deleted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

