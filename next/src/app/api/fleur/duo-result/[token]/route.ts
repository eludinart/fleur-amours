/**
 * GET /api/fleur/duo-result/[token]
 * Récupère le résultat DUO (person_a, person_b) par token depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getDuoResult } from '@/lib/db-fleur'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const data = await getDuoResult(token)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Token introuvable' },
      { status }
    )
  }
}
