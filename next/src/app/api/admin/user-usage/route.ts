/**
 * GET /api/admin/user-usage?user_id=...
 * Récupère le statut Sève et usage d'un utilisateur (admin).
 * En dev avec USE_NODE_API=true, lit depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdmin } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { getPool, table } from '@/lib/db'

interface AccessRow extends RowDataPacket {
  token_balance: number
  eternal_sap: number
}

export const dynamic = 'force-dynamic'

async function ensureTable(pool: Awaited<ReturnType<typeof getPool>>) {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_users_access (
      user_id INT NOT NULL PRIMARY KEY,
      token_balance INT NOT NULL DEFAULT 0,
      eternal_sap INT NOT NULL DEFAULT 0,
      total_accumulated_eternal INT NOT NULL DEFAULT 0,
      sub_type VARCHAR(20) NULL DEFAULT NULL,
      last_reset_date DATE NULL DEFAULT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const userId = parseInt(req.nextUrl.searchParams.get('user_id') ?? '', 10)
    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { error: 'user_id requis.' },
        { status: 400 }
      )
    }

    const pool = getPool()
    await ensureTable(pool)

    const TBL = table('fleur_users_access')
    const [rows] = await pool.execute<AccessRow[]>(
      `SELECT token_balance, eternal_sap FROM ${TBL} WHERE user_id = ?`,
      [userId]
    )

    const row = Array.isArray(rows) ? rows[0] : null
    const tokenBalance = row ? Number(row.token_balance) || 0 : 0
    const eternalSap = row ? Number(row.eternal_sap) || 0 : 0

    return NextResponse.json({
      token_balance: tokenBalance,
      eternal_sap: eternalSap,
      usage: {
        period: new Date().toISOString().slice(0, 7),
        chat_messages_count: 0,
        sessions_count: 0,
        tirages_count: 0,
        fleur_submits_count: 0,
      },
      limits: {
        chat_messages_per_month: 10,
        sessions_per_month: 5,
        tirages_per_month: 3,
        fleur_submits_per_month: 5,
      },
      has_promo: false,
      free_access: false,
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json(
      { error: e?.message || 'Erreur.' },
      { status: 500 }
    )
  }
}
