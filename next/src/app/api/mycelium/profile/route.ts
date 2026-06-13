/**
 * GET  /api/mycelium/profile — profil fleur au travail
 * POST /api/mycelium/profile — enregistre le profil (scores 0–1 par pétale)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumMember } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { getWorkProfile, saveWorkProfile } from '@/lib/db-mycelium'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireMyceliumMember(req)
    if (!isDbConfigured()) return NextResponse.json({ profile: null })
    const profile = await getWorkProfile(uid)
    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, profile: null }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireMyceliumMember(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { petals?: Record<string, number> }
    if (!body.petals || typeof body.petals !== 'object') {
      return NextResponse.json({ error: 'Scores pétales requis' }, { status: 400 })
    }
    const profile = await saveWorkProfile(uid, body.petals)
    return NextResponse.json({ profile, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Enregistrement impossible' }, { status: e.status || 400 })
  }
}
