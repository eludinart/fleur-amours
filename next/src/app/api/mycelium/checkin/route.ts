/**
 * GET  /api/mycelium/checkin — historique check-ins pro
 * POST /api/mycelium/checkin — pulse bien-être entreprise
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumMember } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { getMyWorkCheckins, saveWorkCheckin } from '@/lib/db-mycelium'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireMyceliumMember(req)
    if (!isDbConfigured()) return NextResponse.json({ checkins: [] })
    const checkins = await getMyWorkCheckins(uid, 30)
    return NextResponse.json({ checkins })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, checkins: [] }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireMyceliumMember(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { mood?: number; note?: string }
    const saved = await saveWorkCheckin({
      userId: uid,
      mood: body.mood,
      note: body.note ?? null,
    })
    return NextResponse.json({ checkin: saved, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Enregistrement impossible' }, { status: e.status || 400 })
  }
}
