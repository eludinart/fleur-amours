/**
 * GET /api/sessions/[id]
 * DELETE /api/sessions/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getById, deleteById } from '@/lib/db-sessions'
import { getAuthHeader } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'
import { authMe } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

async function getEmailFromToken(req: NextRequest): Promise<string | null> {
  const token = getAuthHeader(req)
  if (!token) return null
  const payload = jwtDecode(token)
  if (!payload?.sub) return null
  try {
    const user = await authMe(parseInt(payload.sub, 10))
    return user.email || null
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const payload = jwtDecode(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const email = await getEmailFromToken(req)
    const session = await getById(sessionId, email ?? undefined)

    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const payload = jwtDecode(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const session = await getById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const isAdmin = payload.role === 'admin' || payload.role === 'administrator'
    if (!isAdmin) {
      const email = await getEmailFromToken(req)
      if (session.email !== email) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }

    const { deleted } = await deleteById(sessionId)
    return NextResponse.json({ ok: deleted, deleted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 500 }
    )
  }
}
