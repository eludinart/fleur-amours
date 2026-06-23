/**
 * GET /api/a-deux/pairing/[token]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getPairingByToken } from '@/lib/db-a-deux'

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
    const data = await getPairingByToken(token)
    if (!data) return NextResponse.json({ error: 'Token introuvable' }, { status: 404 })
    return NextResponse.json({
      pairing: data.pairing,
      anchor: data.anchor,
      partner_anchor: data.partner_anchor,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 })
  }
}
