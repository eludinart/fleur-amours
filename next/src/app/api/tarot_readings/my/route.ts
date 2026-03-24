/**
 * GET /api/tarot_readings/my
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { my } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [] })
    }

    let email: string | null = null
    try {
      const user = await authMe(parseInt(userId, 10))
      email = user.email || null
    } catch {
      /* ignore */
    }

    const data = await my(userId, email ?? undefined)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [] }, { status: e.status || 401 })
  }
}
