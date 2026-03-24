/**
 * GET /api/social/my_channels
 * Charge les canaux de dialogue (La Clairière) depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getMyChannels } from '@/lib/db-social'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ channels: [] }, { status: 200 })
    }

    const data = await getMyChannels(userId)
    return NextResponse.json({ channels: data.channels })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
