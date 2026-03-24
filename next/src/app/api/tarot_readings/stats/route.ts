/**
 * GET /api/tarot_readings/stats (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { stats } from '@/lib/db-tarot'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const data = await stats()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, total: 0 }, { status: e.status || 401 })
  }
}
