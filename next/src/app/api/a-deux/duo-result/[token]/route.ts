/**
 * GET /api/a-deux/duo-result/[token]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getDuoPairingResult } from '@/lib/db-a-deux'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await requireAuth(req)
    const { token } = await params
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const data = await getDuoPairingResult(token)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message ?? 'Token introuvable' }, { status: 404 })
  }
}
