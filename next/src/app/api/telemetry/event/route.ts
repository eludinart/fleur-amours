/**
 * POST /api/telemetry/event
 * Collecte d'événements (batch) pour analytics internes.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isDbConfigured } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/api-auth'
import { insertTelemetryEvents, type TelemetryEventRow } from '@/lib/db-events'
import { mergeIngestTelemetryEnv } from '@/lib/telemetry/env'

export const dynamic = 'force-dynamic'

type IncomingEvent = {
  name?: string
  ts?: string
  feature?: string
  session_id?: string
  trace_id?: string
  properties?: Record<string, unknown>
  path?: string
  referrer?: string
  anon_id?: string
  app_host?: string
  env?: string
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

function safeString(v: unknown, max = 255): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

function isValidEventName(name: string): boolean {
  return /^[a-z0-9_]{2,80}$/.test(name)
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true, stored: 0, skipped: 0 })
    }

    const userIdRaw = getUserIdFromRequest(req)
    const user_id = userIdRaw ? parseInt(userIdRaw, 10) : null

    const body = (await req.json().catch(() => null)) as
      | { events?: IncomingEvent[]; event?: IncomingEvent }
      | null

    const incoming = Array.isArray(body?.events)
      ? body!.events
      : body?.event
        ? [body.event]
        : []

    // Limites anti-abus (best-effort)
    const maxBatch = 50
    const sliced = incoming.slice(0, maxBatch)

    const ua = safeString(req.headers.get('user-agent'), 255)
    const ip =
      safeString(req.headers.get('x-forwarded-for'), 200) ??
      safeString(req.headers.get('x-real-ip'), 80)
    const ip_hash = ip ? sha256Hex(ip) : null

    const appHost = safeString(req.headers.get('host'), 80)

    const nowIso = new Date().toISOString()
    const rows: TelemetryEventRow[] = []
    let skipped = 0

    for (const ev of sliced) {
      const name = safeString(ev?.name, 80)
      if (!name || !isValidEventName(name)) {
        skipped += 1
        continue
      }
      const ts = safeString(ev?.ts, 40) ?? nowIso
      const anon_id = safeString(ev?.anon_id, 64)
      const path = safeString(ev?.path, 255)
      const referrer = safeString(ev?.referrer, 255)
      const trace_id = safeString(ev?.trace_id, 64)
      const session_id = safeString(ev?.session_id, 64)
      const feature = safeString(ev?.feature, 64)
      const app_host = safeString(ev?.app_host, 80) ?? appHost
      const envMerged = mergeIngestTelemetryEnv(
        typeof ev?.env === 'string' ? ev.env : null,
        app_host
      )
      const env = safeString(envMerged, 24)

      rows.push({
        ts,
        event_name: name,
        user_id: Number.isFinite(user_id as any) ? (user_id as number) : null,
        anon_id,
        email_hash: null,
        path,
        referrer,
        user_agent: ua,
        ip_hash,
        trace_id,
        session_id,
        feature,
        env,
        app_host,
        properties: ev?.properties && typeof ev.properties === 'object' ? ev.properties : {},
      })
    }

    const stored = await insertTelemetryEvents(rows)
    return NextResponse.json({ ok: true, stored, skipped })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ ok: false, error: e.message || 'Erreur' }, { status: 500 })
  }
}

