/**
 * GET /api/auth/users
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0 })
    }
    await requireAdmin(req)
    const pool = getPool()
    const tbl = table('users')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ID as id, user_login as login, user_email as email, display_name as name, user_registered as registered
       FROM ${tbl} ORDER BY user_registered DESC LIMIT 200`
    )
    const items = rows.map((r) => ({
      id: Number(r.id),
      login: r.login,
      email: r.email,
      name: r.name,
      registered: r.registered,
    }))
    return NextResponse.json({ items, total: items.length })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', items: [], total: 0 },
      { status: e.status || 401 }
    )
  }
}
