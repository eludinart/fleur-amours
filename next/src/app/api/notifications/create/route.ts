import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createNotification, type NotificationCreateInput } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = body as unknown as NotificationCreateInput
    const res = await createNotification(input)
    return NextResponse.json({ ok: true, ...res })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

