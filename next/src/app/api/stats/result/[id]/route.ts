/**
 * GET/DELETE /api/stats/result/[id] — détail ou suppression d’une passation (cluster duo inclus, admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { getAdminPassationDetail, deletePassationClusterById } from '@/lib/db-fleur-passation-stats'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    const rid = parseInt(id, 10)
    if (!Number.isFinite(rid) || rid < 1) {
      return NextResponse.json({ detail: 'ID invalide' }, { status: 400 })
    }
    const data = await getAdminPassationDetail(rid)
    if (!data) {
      return NextResponse.json({ detail: 'Passation introuvable' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e?.message || 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    const rid = parseInt(id, 10)
    if (!Number.isFinite(rid) || rid < 1) {
      return NextResponse.json({ detail: 'ID invalide' }, { status: 400 })
    }
    const ok = await deletePassationClusterById(rid)
    if (!ok) {
      return NextResponse.json({ detail: 'Passation introuvable' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e?.message || 'Erreur serveur.' }, { status: 500 })
  }
}
