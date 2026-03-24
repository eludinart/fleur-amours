/**
 * POST /api/auth/users/update
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { getPool, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = body.id ?? body.user_id
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    const pool = getPool()
    const tbl = table('users')
    if (body.name !== undefined) {
      await pool.execute(`UPDATE ${tbl} SET display_name = ? WHERE ID = ?`, [
        String(body.name ?? ''),
        id,
      ])
    }
    if (body.app_role !== undefined) {
      try {
        const appRoleTbl = table('fleur_app_roles')
        await pool.execute(
          `INSERT INTO ${appRoleTbl} (user_id, app_role) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE app_role = ?`,
          [id, body.app_role, body.app_role]
        )
      } catch {
        // Table fleur_app_roles peut ne pas exister
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 401 })
  }
}
