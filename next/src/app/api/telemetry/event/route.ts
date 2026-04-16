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

type ConnectionContext = {
  ip?: string | null
  ip_chain?: string[] | null
  ip_hash?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  asn?: string | null
  colo?: string | null
  protocol?: string | null
  host?: string | null
  user_agent?: string | null
  connection_type?: string | null
  network?: {
    effective_type?: string | null
    rtt_ms?: number | null
    downlink_mbps?: number | null
    save_data?: boolean | null
  } | null
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

function parseForwardedFor(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function getCountryFromHeaders(req: NextRequest): string | null {
  return (
    safeString(req.headers.get('cf-ipcountry'), 16) ??
    safeString(req.headers.get('x-vercel-ip-country'), 16) ??
    safeString(req.headers.get('x-country-code'), 16)
  )
}

function buildConnectionContext(args: {
  req: NextRequest
  ip: string | null
  ipHash: string | null
  appHost: string | null
  ua: string | null
  evProps: Record<string, unknown> | null
}): ConnectionContext {
  const { req, ip, ipHash, appHost, ua, evProps } = args
  const ipChain = parseForwardedFor(req.headers.get('x-forwarded-for'))

  const p = evProps ?? {}
  const netObj =
    p && typeof p.network === 'object' && p.network !== null
      ? (p.network as Record<string, unknown>)
      : null
  const connectionType = safeString(p.connection_type, 40)
  const effectiveType = safeString(netObj?.effective_type, 40)
  const rttRaw = netObj?.rtt_ms
  const downlinkRaw = netObj?.downlink_mbps
  const saveDataRaw = netObj?.save_data

  return {
    ip,
    ip_chain: ipChain.length ? ipChain : null,
    ip_hash: ipHash,
    country: getCountryFromHeaders(req),
    region: safeString(req.headers.get('x-vercel-ip-country-region'), 64),
    city: safeString(req.headers.get('x-vercel-ip-city'), 80),
    asn: safeString(req.headers.get('x-vercel-ip-as-number'), 32),
    colo: safeString(req.headers.get('x-vercel-id'), 80),
    protocol: safeString(req.headers.get('x-forwarded-proto'), 16),
    host: appHost,
    user_agent: ua,
    connection_type: connectionType,
    network: {
      effective_type: effectiveType,
      rtt_ms: typeof rttRaw === 'number' && Number.isFinite(rttRaw) ? Math.round(rttRaw) : null,
      downlink_mbps: typeof downlinkRaw === 'number' && Number.isFinite(downlinkRaw) ? downlinkRaw : null,
      save_data: typeof saveDataRaw === 'boolean' ? saveDataRaw : null,
    },
  }
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

      const props =
        ev?.properties && typeof ev.properties === 'object'
          ? (ev.properties as Record<string, unknown>)
          : {}
      const connection = buildConnectionContext({
        req,
        ip,
        ipHash: ip_hash,
        appHost: app_host,
        ua,
        evProps: props,
      })

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
        properties: {
          ...props,
          ingest_context: connection,
        },
      })
    }

    const stored = await insertTelemetryEvents(rows)
    return NextResponse.json({ ok: true, stored, skipped })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ ok: false, error: e.message || 'Erreur' }, { status: 500 })
  }
}

