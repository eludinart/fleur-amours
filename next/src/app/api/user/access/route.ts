/**
 * GET /api/user/access
 * Bilan Sève / accès utilisateur.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAuth } from '@/lib/api-auth'
import { getPool, table, isDbConfigured } from '@/lib/db'
import { ensureUsageTable, readMonthlyUsage } from '@/lib/db-usage'
import { ensureQuotaBonusTable, readQuotaBonus } from '@/lib/db-quota-bonus'
import { cacheGet, cacheSet } from '@/lib/server-cache'
import {
  FREE_DEFAULT_SAP,
  limitsForUser,
  resolveUserBilling,
  skipsSapCharges,
} from '@/lib/user-billing'

const ACCESS_TTL_MS = 45_000

interface AccessRow extends RowDataPacket {
  token_balance: number
  eternal_sap: number
  total_accumulated_eternal: number
}

export const dynamic = 'force-dynamic'

let _ensureTablePromise: Promise<void> | null = null
function ensureTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureTablePromise) {
    const prefix = process.env.DB_PREFIX || 'wp_'
    _ensureTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}fleur_users_access (
        user_id INT NOT NULL PRIMARY KEY,
        token_balance INT NOT NULL DEFAULT 0,
        eternal_sap INT NOT NULL DEFAULT 0,
        total_accumulated_eternal INT NOT NULL DEFAULT 0,
        sub_type VARCHAR(20) NULL DEFAULT NULL,
        last_reset_date DATE NULL DEFAULT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined).catch((err) => { _ensureTablePromise = null; throw err })
  }
  return _ensureTablePromise
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    const cacheKey = `user_access:${uid}`
    const cached = cacheGet<object>(cacheKey)
    if (cached) return NextResponse.json(cached)

    if (isDbConfigured()) {
      try {
        const pool = getPool()
        const period = new Date().toISOString().slice(0, 7)

        await Promise.all([
          ensureTable(pool),
          ensureUsageTable(pool),
          ensureQuotaBonusTable(pool),
        ])

        const TBL = table('fleur_users_access')

        await pool.execute(
          `INSERT IGNORE INTO ${TBL} (user_id, token_balance, eternal_sap) VALUES (?, ?, 0)`,
          [uid, FREE_DEFAULT_SAP]
        )

        const [billing, rowsPacket] = await Promise.all([
          resolveUserBilling(uid),
          pool.execute<AccessRow[]>(
            `SELECT token_balance, eternal_sap, total_accumulated_eternal FROM ${TBL} WHERE user_id = ?`,
            [uid]
          ),
        ])
        const rows = rowsPacket[0] as AccessRow[]
        const row = Array.isArray(rows) ? rows[0] : null
        if (row) {
          const [usage, bonus] = await Promise.all([
            readMonthlyUsage(uid, period),
            readQuotaBonus(uid, period),
          ])
          const limits = limitsForUser(billing, {
            chat_messages_per_month: bonus.chat_messages_bonus ?? 0,
            sessions_per_month: bonus.sessions_bonus ?? 0,
            tirages_per_month: bonus.tirages_bonus ?? 0,
            fleur_submits_per_month: bonus.fleur_submits_bonus ?? 0,
          })
          const result = {
            token_balance: Number(row.token_balance) || 0,
            eternal_sap: Number(row.eternal_sap) || 0,
            total_accumulated_eternal: Number(row.total_accumulated_eternal) || 0,
            billing_bypass: billing.billingBypass,
            free_access: skipsSapCharges(billing),
            has_subscription: billing.hasSubscription,
            has_promo: billing.hasPromoAccess,
            promo_unlimited: billing.unlimited,
            promo_free_until: billing.freeUntil,
            usage,
            limits,
            quota_bonus: bonus,
          }
          cacheSet(cacheKey, result, ACCESS_TTL_MS)
          return NextResponse.json(result)
        }
      } catch {
        /* DB indisponible → fallback stub */
      }
    }

    return NextResponse.json({
      token_balance: 0,
      eternal_sap: 0,
      total_accumulated_eternal: 0,
      billing_bypass: false,
      free_access: false,
      has_subscription: false,
      has_promo: false,
      promo_unlimited: false,
      promo_free_until: null,
      usage: { period: new Date().toISOString().slice(0, 7), chat_messages_count: 0, sessions_count: 0, tirages_count: 0, fleur_submits_count: 0 },
      limits: { ...limitsForUser({ billingBypass: false, hasFullAccess: false, hasPromoAccess: false, unlimited: false, freeUntil: null, hasSubscription: false, subType: null }) },
      quota_bonus: { period: new Date().toISOString().slice(0, 7), chat_messages_bonus: 0, sessions_bonus: 0, tirages_bonus: 0, fleur_submits_bonus: 0 },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { token_balance: 0, eternal_sap: 0, total_accumulated_eternal: 0, free_access: false, billing_bypass: false },
      { status: e.status || 401 }
    )
  }
}
