/**
 * GET /api/mycelium/access — droits Mycelium pour navigation client.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { getMyceliumAccess } from '@/lib/mycelium-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const access = await getMyceliumAccess(uid)
    let isAppAdmin = false
    try {
      await requireAdmin(req)
      isAppAdmin = true
    } catch {
      /* ignore */
    }
    return NextResponse.json({
      ...access,
      isAppAdmin,
      /** Admin app sans org peut quand même ouvrir l'admin pour créer une org. */
      showAdmin: access.canManage || isAppAdmin,
      showDashboard: access.canManage || isAppAdmin,
      showEspace: access.member || isAppAdmin,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
