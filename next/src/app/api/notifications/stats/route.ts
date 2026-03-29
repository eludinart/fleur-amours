import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { ensureNotificationsTables, unreadCountForUser } from '@/lib/db-notifications'
import { getPool, table } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    const uid = parseInt(userId, 10)
    await ensureNotificationsTables()
    const pool = getPool()
    const tN = table('fleur_notifications')
    const tD = table('fleur_notification_deliveries')

    const [totRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM ${tN}`)
    const total = Number(totRows?.[0]?.total ?? 0)
    const [delRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as delivered FROM ${tD}`)
    const delivered = Number(delRows?.[0]?.delivered ?? 0)
    const [readRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as read FROM ${tD} WHERE read_at IS NOT NULL`)
    const read = Number(readRows?.[0]?.read ?? 0)
    const [unreadRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as unread FROM ${tD} WHERE read_at IS NULL`)
    /** Toutes les livraisons encore « non lues » (tous comptes) — utile pour la vue admin globale */
    const unread = Number(unreadRows?.[0]?.unread ?? 0)
    /** Cloche de l’admin connecté : baisse quand il ouvre / marque lu ses notifications */
    const unread_mine = Number.isFinite(uid) && uid > 0 ? await unreadCountForUser(uid) : 0

    return NextResponse.json({ total, delivered, read, unread, unread_mine })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

