import { getPool, isDbConfigured, table, exec } from '@/lib/db'

export type TelemetryEventRow = {
  id?: number
  ts: string // ISO
  event_name: string
  user_id: number | null
  anon_id: string | null
  email_hash: string | null
  path: string | null
  referrer: string | null
  user_agent: string | null
  ip_hash: string | null
  trace_id: string | null
  session_id: string | null
  feature: string | null
  env: string | null
  app_host: string | null
  properties: Record<string, unknown>
}

let _tableEnsured = false

export async function ensureTelemetryTable(): Promise<void> {
  if (_tableEnsured) return
  if (!isDbConfigured()) return
  const pool = getPool()
  const t = table('app_events')
  await exec(
    pool,
    `
    CREATE TABLE IF NOT EXISTS ${t} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      ts DATETIME(3) NOT NULL,
      event_name VARCHAR(80) NOT NULL,
      user_id BIGINT NULL,
      anon_id VARCHAR(64) NULL,
      email_hash CHAR(64) NULL,
      path VARCHAR(255) NULL,
      referrer VARCHAR(255) NULL,
      user_agent VARCHAR(255) NULL,
      ip_hash CHAR(64) NULL,
      trace_id VARCHAR(64) NULL,
      session_id VARCHAR(64) NULL,
      feature VARCHAR(64) NULL,
      env VARCHAR(24) NULL,
      app_host VARCHAR(80) NULL,
      properties_json JSON NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_ts (ts),
      KEY idx_event_ts (event_name, ts),
      KEY idx_user_ts (user_id, ts),
      KEY idx_anon_ts (anon_id, ts),
      KEY idx_feature_ts (feature, ts),
      KEY idx_trace (trace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
  )
  _tableEnsured = true
}

export async function insertTelemetryEvents(events: TelemetryEventRow[]): Promise<number> {
  if (!isDbConfigured()) return 0
  if (!events.length) return 0
  await ensureTelemetryTable()
  const pool = getPool()
  const t = table('app_events')

  const values: unknown[] = []
  const rowsSql: string[] = []
  for (const ev of events) {
    rowsSql.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    values.push(
      new Date(ev.ts),
      ev.event_name,
      ev.user_id,
      ev.anon_id,
      ev.email_hash,
      ev.path,
      ev.referrer,
      ev.user_agent,
      ev.ip_hash,
      ev.trace_id,
      ev.session_id,
      ev.feature,
      ev.env,
      ev.app_host,
      JSON.stringify(ev.properties ?? {})
    )
  }

  const sql = `
    INSERT INTO ${t}
      (ts, event_name, user_id, anon_id, email_hash, path, referrer, user_agent, ip_hash, trace_id, session_id, feature, env, app_host, properties_json)
    VALUES ${rowsSql.join(',')}
  `
  const [result] = await exec(pool, sql, values)
  const inserted = (result as { affectedRows?: number }).affectedRows ?? 0
  return inserted
}

export async function listTelemetryEvents({
  fromIso,
  toIso,
  eventName,
  env,
  userId,
  anonId,
  limit = 200,
}: {
  fromIso?: string
  toIso?: string
  eventName?: string
  env?: string
  userId?: number
  anonId?: string
  limit?: number
}): Promise<Record<string, unknown>[]> {
  if (!isDbConfigured()) return []
  await ensureTelemetryTable()
  const pool = getPool()
  const t = table('app_events')

  const where: string[] = []
  const params: unknown[] = []
  if (fromIso) {
    where.push('ts >= ?')
    params.push(new Date(fromIso))
  }
  if (toIso) {
    where.push('ts <= ?')
    params.push(new Date(toIso))
  }
  if (eventName) {
    where.push('event_name = ?')
    params.push(eventName)
  }
  if (env) {
    where.push('env = ?')
    params.push(env)
  }
  if (Number.isFinite(userId as any)) {
    where.push('user_id = ?')
    params.push(userId)
  }
  if (anonId) {
    where.push('anon_id = ?')
    params.push(anonId)
  }

  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)))
  const sql = `
    SELECT id, ts, event_name, user_id, anon_id, path, referrer, trace_id, session_id, feature, env, app_host, properties_json
    FROM ${t}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ts DESC
    LIMIT ?
  `
  params.push(safeLimit)

  const [rows] = await exec(pool, sql, params)
  const r = rows as any[]
  return (r ?? []).map((x) => ({
    id: x.id,
    ts: x.ts,
    name: x.event_name,
    user_id: x.user_id,
    anon_id: x.anon_id,
    path: x.path,
    referrer: x.referrer,
    trace_id: x.trace_id,
    session_id: x.session_id,
    feature: x.feature,
    env: x.env,
    app_host: x.app_host,
    properties: (() => {
      try {
        return x.properties_json ? JSON.parse(x.properties_json) : {}
      } catch {
        return {}
      }
    })(),
  }))
}

export async function clearTelemetryEvents(): Promise<void> {
  if (!isDbConfigured()) return
  await ensureTelemetryTable()
  const pool = getPool()
  const t = table('app_events')
  // TRUNCATE is fast; resets auto-increment
  await exec(pool, `TRUNCATE TABLE ${t}`)
}

