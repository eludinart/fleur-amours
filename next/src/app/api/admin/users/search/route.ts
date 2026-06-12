/**
 * GET /api/admin/users/search?q=&role=&limit=
 * Recherche utilisateurs pour le sélecteur de campagnes e-mail.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdmin } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) return NextResponse.json({ items: [] })

    const { searchParams } = new URL(req.url)
    const q = String(searchParams.get('q') ?? '').trim().toLowerCase()
    const role = String(searchParams.get('role') ?? '').trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

    const pool = getPool()
    const tUsers = table('users')
    const tRoles = table('fleur_app_roles')
    const where: string[] = [`u.user_email IS NOT NULL AND u.user_email != ''`]
    const params: (string | number)[] = []

    if (q) {
      where.push(`(LOWER(u.user_email) LIKE ? OR LOWER(u.display_name) LIKE ? OR LOWER(u.user_login) LIKE ?)`)
      const like = `%${q}%`
      params.push(like, like, like)
    }
    if (role === 'user' || role === 'users') {
      where.push(`COALESCE(ar.app_role, 'user') NOT IN ('coach', 'admin')`)
    } else if (role === 'coach' || role === 'coaches') {
      where.push(`COALESCE(ar.app_role, '') = 'coach'`)
    } else if (role === 'admin' || role === 'admins') {
      where.push(`COALESCE(ar.app_role, '') = 'admin'`)
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID as id, u.user_email as email, u.display_name as name, COALESCE(ar.app_role, 'user') as app_role
       FROM ${tUsers} u
       LEFT JOIN ${tRoles} ar ON ar.user_id = u.ID
       WHERE ${where.join(' AND ')}
       ORDER BY u.display_name ASC, u.user_email ASC
       LIMIT ?`,
      [...params, limit]
    )

    const items = rows.map((r) => ({
      id: Number(r.id),
      email: String(r.email ?? ''),
      name: r.name ? String(r.name) : '',
      app_role: String(r.app_role ?? 'user'),
    }))
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
