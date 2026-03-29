/**
 * POST /api/admin/credit-sap
 * Crédite de la Sève (Sablier et/ou Cristal) pour un utilisateur.
 * En dev avec USE_NODE_API=true, persiste en MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdmin } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { syncSapWalletFromAccess } from '@/lib/db-sap'

interface TotalRow extends RowDataPacket {
  total_accumulated_eternal: number
}

export const dynamic = 'force-dynamic'

const TBL = table('fleur_users_access')

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

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const userId = parseInt(body.user_id, 10)
    const sablier = parseInt(body.sablier, 10) || 0
    const cristal = parseInt(body.cristal, 10) || 0

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'user_id requis et doit être un entier.' },
        { status: 400 }
      )
    }

    if (!sablier && !cristal) {
      return NextResponse.json(
        { ok: false, error: 'Aucun crédit à attribuer. Indiquez Sablier ou Cristal.' },
        { status: 400 }
      )
    }

    const pool = getPool()
    await ensureTable(pool)

    await pool.execute(
      `INSERT IGNORE INTO ${TBL} (user_id, token_balance, eternal_sap) VALUES (?, 0, 0)`,
      [userId]
    )

    let totalBefore = 0
    const [rows] = await pool.execute<TotalRow[]>(
      `SELECT total_accumulated_eternal FROM ${TBL} WHERE user_id = ?`,
      [userId]
    )
    if (Array.isArray(rows) && rows[0]) {
      totalBefore = Number(rows[0].total_accumulated_eternal) || 0
    }

    const updates: string[] = []
    const params: (number | string)[] = []

    if (sablier > 0) {
      updates.push('token_balance = token_balance + ?')
      params.push(sablier)
    }
    if (cristal > 0) {
      updates.push('eternal_sap = eternal_sap + ?')
      params.push(cristal)
      updates.push('total_accumulated_eternal = total_accumulated_eternal + ?')
      params.push(cristal)
      if (totalBefore < 200 && totalBefore + cristal >= 200) {
        updates.push('token_balance = token_balance + 20')
      }
    }

    params.push(userId)
    await pool.execute(
      `UPDATE ${TBL} SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
      params
    )

    let sapDelta = sablier + cristal
    if (cristal > 0 && totalBefore < 200 && totalBefore + cristal >= 200) {
      sapDelta += 20
    }

    if (sapDelta > 0 && isDbConfigured()) {
      try {
        await syncSapWalletFromAccess(userId)
      } catch (sapErr) {
        console.error('[credit-sap] synchronisation wallet SAP échouée', sapErr)
        return NextResponse.json({
          ok: true,
          credited: { sablier, cristal },
          sap_wallet_sync_error: (sapErr as Error)?.message ?? 'Wallet SAP non mis à jour',
        })
      }
    }

    return NextResponse.json({
      ok: true,
      credited: { sablier, cristal },
      sap_credited: sapDelta > 0 ? sapDelta : 0,
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json(
      { error: e?.message || 'Erreur lors du crédit de Sève.' },
      { status: 500 }
    )
  }
}
