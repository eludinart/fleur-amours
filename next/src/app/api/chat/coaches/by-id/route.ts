/**
 * GET /api/chat/coaches/by-id?user_id=
 * Fiche coach pour le chat : patient avec conversation assignée, admin, ou l'utilisateur lui-même.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCoachPublicCard } from '@/lib/db-chat'
import { getPool, table } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import type { RowDataPacket } from 'mysql2'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isElevated(user: { app_role?: string; wp_role?: string }): boolean {
  const a = user.app_role || ''
  const w = user.wp_role || ''
  return a === 'admin' || w === 'administrator'
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ coach: null }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const coachWpId = parseInt(req.nextUrl.searchParams.get('user_id') ?? '0', 10)
    if (!uid || !coachWpId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }

    const user = await authMe(uid)
    if (isElevated(user) || uid === coachWpId) {
      const coach = await getCoachPublicCard(coachWpId)
      if (!coach) {
        return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
      }
      return NextResponse.json({ coach })
    }

    const pool = getPool()
    const tConv = table('fleur_chat_conversations')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tConv} WHERE user_id = ? AND assigned_coach_id = ? AND status != 'deleted' LIMIT 1`,
      [uid, coachWpId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const coach = await getCoachPublicCard(coachWpId)
    if (!coach) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }
    return NextResponse.json({ coach })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message, coach: null },
      { status: e.status ?? 401 }
    )
  }
}
