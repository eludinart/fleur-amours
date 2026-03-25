/**
 * GET /api/auth/users
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

function wpRoleFromCaps(capsSerialized: string | null): string {
  if (!capsSerialized || typeof capsSerialized !== 'string') return 'subscriber'
  const re = /s:\d+:"([^"]+)";i:\d+;/g
  let m
  const roles: string[] = []
  while ((m = re.exec(capsSerialized)) !== null) roles.push(m[1])
  const priority = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
  for (const r of priority) {
    if (roles.includes(r)) return r
  }
  return roles[0] || 'subscriber'
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0 })
    }
    await requireAdmin(req)
    const pool = getPool()
    const prefix = process.env.DB_PREFIX || 'wp_'
    const usersTbl = table('users')
    const rolesTbl = table('fleur_app_roles')
    const metaTbl = table('usermeta')
    const capKey = `${prefix}capabilities`
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID as id, u.user_login as login, u.user_email as email, u.display_name as name,
              u.user_registered as registered, r.app_role,
              (SELECT meta_value FROM ${metaTbl} WHERE user_id = u.ID AND meta_key = ? LIMIT 1) as caps
       FROM ${usersTbl} u
       LEFT JOIN ${rolesTbl} r ON r.user_id = u.ID
       ORDER BY u.user_registered DESC LIMIT 200`,
      [capKey]
    )
    const items = rows.map((r) => {
      const wpRole = wpRoleFromCaps(r.caps)
      const appRole = r.app_role ? String(r.app_role) : (wpRole === 'administrator' ? 'admin' : 'user')
      return {
        id: Number(r.id),
        login: r.login,
        email: r.email,
        name: r.name,
        registered: r.registered,
        wp_role: wpRole,
        app_role: appRole,
      }
    })
    return NextResponse.json({ items, total: items.length })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', items: [], total: 0 },
      { status: e.status || 401 }
    )
  }
}
