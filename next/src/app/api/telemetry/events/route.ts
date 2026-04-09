/**
 * GET /api/telemetry/events
 * DELETE /api/telemetry/events
 * Lecture / purge (admin) des événements stockés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { clearTelemetryEvents, listTelemetryEvents } from '@/lib/db-events'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const event = searchParams.get('event') || undefined
    const env = searchParams.get('env') || undefined
    const userIdRaw = searchParams.get('user_id')
    const anonId = searchParams.get('anon_id') || undefined
    const limitRaw = searchParams.get('limit') || undefined

    const userId = userIdRaw ? parseInt(userIdRaw, 10) : undefined
    const limit = limitRaw ? parseInt(limitRaw, 10) : 200

    const items = await listTelemetryEvents({
      fromIso: from,
      toIso: to,
      eventName: event,
      env: env === 'production' || env === 'development' ? env : undefined,
      userId: Number.isFinite(userId as any) ? (userId as number) : undefined,
      anonId,
      limit,
    })
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req)
    await clearTelemetryEvents()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}

