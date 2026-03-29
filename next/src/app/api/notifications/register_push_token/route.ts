/**
 * POST /api/notifications/register_push_token
 * Enregistre le token FCM pour les push notifications Android.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = (await req.json()) as {
      token?: string
      platform?: string
      user_id?: number
      user_email?: string
    }
    const token = String(body.token ?? '').trim()
    const platform = String(body.platform ?? 'android').trim() || 'android'

    if (!token) {
      return NextResponse.json({ error: 'token requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true })
    }

    const pool = getPool()
    const t = table('fleur_push_tokens')
    const tUsers = table('users')

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_email VARCHAR(255) DEFAULT NULL,
        token VARCHAR(500) NOT NULL,
        platform VARCHAR(20) DEFAULT 'android',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_token (token(255)),
        INDEX idx_user (user_id),
        INDEX idx_email (user_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const uid = userId ? parseInt(userId, 10) : null
    let userEmail: string | null = null
    if (uid) {
      const [rows] = await pool.execute(
        `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [uid]
      )
      userEmail = (rows as { user_email?: string }[])?.[0]?.user_email ?? null
    }

    await pool.execute(
      `INSERT INTO ${t} (user_id, user_email, token, platform) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), user_email = VALUES(user_email), platform = VALUES(platform)`,
      [uid, userEmail, token, platform]
    )

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur' },
      { status: e.status ?? 500 }
    )
  }
}
