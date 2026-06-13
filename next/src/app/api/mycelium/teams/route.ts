/**
 * POST /api/mycelium/teams — crée une équipe dans l'organisation gérée.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumRh } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { createTeam } from '@/lib/db-organisations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireMyceliumRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!ctx.org) {
      return NextResponse.json({ error: 'Créez d\'abord une organisation' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const team = await createTeam(ctx.org.id, name)
    return NextResponse.json({ team }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
