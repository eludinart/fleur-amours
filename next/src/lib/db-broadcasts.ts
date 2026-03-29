/**
 * Centre de diffusion (emails / notifications / messages) — MariaDB.
 *
 * V1: canaux
 * - email (SMTP)
 * - inapp (centre de notifications + bannière via priority/flags)
 *
 * Stocke:
 * - broadcasts: brouillon/scheduled/sending/...
 * - broadcast_deliveries: 1 destinataire × 1 canal
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'

const T_BROADCAST = () => table('fleur_broadcasts')
const T_DELIV = () => table('fleur_broadcast_deliveries')

export type BroadcastStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'

export type BroadcastChannel = 'email' | 'inapp'

/** `single` = une personne (ID et/ou email) ; `users` = sans rôle coach/admin ; `coaches` = rôle coach uniquement ; `all` = tous les comptes avec email */
export type AudienceType = 'single' | 'users' | 'coaches' | 'all'

export type ActivitySegment =
  | 'any'
  | 'active_7d'
  | 'active_30d'
  | 'active_90d'
  | 'inactive_30d'
  | 'inactive_90d'
  | 'never'

export type CoachListedSegment = 'any' | 'listed' | 'not_listed'

export type BroadcastAudience = {
  audience_type: AudienceType
  activity: ActivitySegment
  coach_listed: CoachListedSegment
  exclude_admins: boolean
  exclude_emails: string[]
  respect_email_optout: boolean
  /** Si audience_type === 'single' */
  single_user_id?: number | null
  single_user_email?: string | null
}

export type BroadcastContent = {
  email?: {
    subject: string
    preheader?: string
    from_name?: string
    from_email?: string
    reply_to?: string
    design_json?: unknown
    html?: string
    text?: string
  }
  inapp?: {
    type?: string
    title: string
    body?: string
    action_url?: string
    action_label?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    expires_at?: string | null
    banner?: {
      enabled: boolean
      dismissible?: boolean
      level?: 'info' | 'important' | 'critical'
      starts_at?: string | null
      ends_at?: string | null
    }
  }
}

export async function ensureBroadcastTables(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const tB = T_BROADCAST()
  const tD = T_DELIV()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tB} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL DEFAULT '',
      created_by_user_id INT DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      audience_json MEDIUMTEXT,
      channels_json MEDIUMTEXT,
      snapshot_json MEDIUMTEXT,
      scheduled_at DATETIME DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tD} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      broadcast_id INT NOT NULL,
      user_id INT NOT NULL,
      user_email VARCHAR(255) DEFAULT NULL,
      channel VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'queued',
      provider_message_id VARCHAR(255) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      opened_at DATETIME DEFAULT NULL,
      clicked_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      INDEX idx_broadcast (broadcast_id, channel, status),
      INDEX idx_user (user_id),
      UNIQUE KEY uk_broadcast_user_channel (broadcast_id, user_id, channel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function normalizeEmail(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function parseUtc(value: string | null | undefined): number | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z').getTime()
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s + 'Z').getTime()
  }
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : null
}

function nowSqlUtc(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function createDraft(params: {
  title: string
  createdByUserId?: number | null
  audience: BroadcastAudience
  channels: BroadcastContent
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const title = String(params.title ?? '').trim().slice(0, 255)
  if (!title) throw new Error('Titre requis')
  const [res] = await pool.execute(
    `INSERT INTO ${tB} (title, created_by_user_id, status, audience_json, channels_json) VALUES (?, ?, 'draft', ?, ?)`,
    [
      title,
      params.createdByUserId ?? null,
      JSON.stringify(params.audience ?? {}),
      JSON.stringify(params.channels ?? {}),
    ]
  )
  return { id: Number((res as ResultSetHeader).insertId) }
}

export async function updateDraft(params: {
  id: number
  title?: string
  audience?: BroadcastAudience
  channels?: BroadcastContent
  scheduled_at?: string | null
}): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const id = Number(params.id)
  if (!id) throw new Error('id requis')
  const updates: string[] = []
  const values: (string | number | boolean | null)[] = []
  if (params.title != null) {
    updates.push('title = ?')
    values.push(String(params.title).trim().slice(0, 255))
  }
  if (params.audience != null) {
    updates.push('audience_json = ?')
    values.push(JSON.stringify(params.audience))
  }
  if (params.channels != null) {
    updates.push('channels_json = ?')
    values.push(JSON.stringify(params.channels))
  }
  if (Object.prototype.hasOwnProperty.call(params, 'scheduled_at')) {
    updates.push('scheduled_at = ?')
    values.push(params.scheduled_at ? String(params.scheduled_at).replace('T', ' ').slice(0, 19) : null)
  }
  if (updates.length === 0) return
  values.push(id)
  await exec(pool, `UPDATE ${tB} SET ${updates.join(', ')} WHERE id = ? AND status = 'draft'`, values)
}

export async function getById(id: number): Promise<Record<string, unknown> | null> {
  if (!isDbConfigured()) return null
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${tB} WHERE id = ? LIMIT 1`, [id])
  const r = rows?.[0]
  if (!r) return null
  const parseJson = (x: unknown) => {
    try {
      return x ? JSON.parse(String(x)) : null
    } catch {
      return null
    }
  }
  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    status: String(r.status ?? 'draft'),
    created_by_user_id: r.created_by_user_id != null ? Number(r.created_by_user_id) : null,
    audience: parseJson(r.audience_json),
    channels: parseJson(r.channels_json),
    snapshot: parseJson(r.snapshot_json),
    scheduled_at: r.scheduled_at ?? null,
    started_at: r.started_at ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  }
}

export async function list(params: { page?: number; per_page?: number; status?: string }): Promise<{ items: Record<string, unknown>[]; total: number }> {
  if (!isDbConfigured()) return { items: [], total: 0 }
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const perPage = Math.min(50, Math.max(1, params.per_page ?? 20))
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * perPage
  const status = String(params.status ?? '').trim()
  let where = '1=1'
  const values: (string | number | boolean | null)[] = []
  if (status) {
    where += ' AND status = ?'
    values.push(status)
  }
  const countRes = await exec(pool, `SELECT COUNT(*) as total FROM ${tB} WHERE ${where}`, values)
  const countRows = (countRes[0] ?? []) as RowDataPacket[]
  const total = Number(countRows?.[0]?.total ?? 0)
  const rowsRes = await exec(
    pool,
    `SELECT id, title, status, scheduled_at, started_at, completed_at, created_at
     FROM ${tB} WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, perPage, offset]
  )
  const rows = (rowsRes[0] ?? []) as RowDataPacket[]
  const items = rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ''),
    status: String(r.status ?? ''),
    scheduled_at: r.scheduled_at ?? null,
    started_at: r.started_at ?? null,
    completed_at: r.completed_at ?? null,
    created_at: r.created_at ?? null,
  }))
  return { items, total }
}

async function selectAudienceRecipients(audience: BroadcastAudience): Promise<Array<{ user_id: number; email: string; last_login: string | null; coach_is_listed: string | null; app_role: string | null }>> {
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tRoles = table('fleur_app_roles')

  const excludeEmails = new Set((audience.exclude_emails ?? []).map(normalizeEmail).filter(Boolean))

  if (audience.audience_type === 'single') {
    const sid = audience.single_user_id != null ? Number(audience.single_user_id) : 0
    const sem = normalizeEmail(audience.single_user_email)
    const whereSingle: string[] = [`u.user_email IS NOT NULL AND u.user_email != ''`]
    const pSingle: (string | number)[] = []
    if (sid > 0) {
      whereSingle.push(`u.ID = ?`)
      pSingle.push(sid)
    } else if (sem) {
      whereSingle.push(`LOWER(u.user_email) = ?`)
      pSingle.push(sem)
    } else {
      return []
    }
    const sqlOne = `
      SELECT
        u.ID as user_id,
        u.user_email as email,
        um_last.meta_value as last_login,
        um_listed.meta_value as coach_is_listed,
        ar.app_role as app_role
      FROM ${tUsers} u
      LEFT JOIN ${tMeta} um_last ON um_last.user_id = u.ID AND um_last.meta_key = 'fleur_last_login'
      LEFT JOIN ${tMeta} um_listed ON um_listed.user_id = u.ID AND um_listed.meta_key = 'fleur_coach_is_listed'
      LEFT JOIN ${tRoles} ar ON ar.user_id = u.ID
      WHERE ${whereSingle.join(' AND ')}
      LIMIT 1
    `
    const resOne = await exec(pool, sqlOne, pSingle)
    const rowsOne = (resOne[0] ?? []) as RowDataPacket[]
    return rowsOne
      .map((r) => ({
        user_id: Number(r.user_id),
        email: normalizeEmail(r.email),
        last_login: r.last_login != null ? String(r.last_login) : null,
        coach_is_listed: r.coach_is_listed != null ? String(r.coach_is_listed) : null,
        app_role: r.app_role != null ? String(r.app_role) : null,
      }))
      .filter((r) => r.user_id > 0 && r.email && !excludeEmails.has(r.email))
  }

  // Activity thresholds (days)
  const days =
    audience.activity === 'active_7d' ? 7 :
    audience.activity === 'active_30d' ? 30 :
    audience.activity === 'active_90d' ? 90 :
    audience.activity === 'inactive_30d' ? 30 :
    audience.activity === 'inactive_90d' ? 90 :
    null

  const isActiveMode = audience.activity.startsWith('active_')
  const isInactiveMode = audience.activity.startsWith('inactive_')

  const whereParts: string[] = [
    `u.user_email IS NOT NULL AND u.user_email != ''`,
  ]
  const params: (string | number | boolean | null)[] = []

  // Audience type via app_role table (V1).
  if (audience.audience_type === 'users') {
    whereParts.push(`COALESCE(ar.app_role, 'user') NOT IN ('coach', 'admin')`)
  } else if (audience.audience_type === 'coaches') {
    whereParts.push(`COALESCE(ar.app_role, '') = 'coach'`)
  }

  if (audience.exclude_admins) {
    whereParts.push(`COALESCE(ar.app_role, '') NOT IN ('admin')`)
  }

  // Coach listed segment: stored as meta 'fleur_coach_is_listed' (default '1').
  if (audience.coach_listed === 'listed') {
    whereParts.push(`COALESCE(um_listed.meta_value, '1') != '0'`)
  } else if (audience.coach_listed === 'not_listed') {
    whereParts.push(`COALESCE(um_listed.meta_value, '1') = '0'`)
  }

  // Email opt-out: meta 'fleur_email_optout' = '1'
  if (audience.respect_email_optout) {
    whereParts.push(`COALESCE(um_optout.meta_value, '0') != '1'`)
  }

  // Activity segment based on usermeta fleur_last_login (format 'YYYY-MM-DD HH:mm:ss')
  if (audience.activity === 'never') {
    whereParts.push(`(um_last.meta_value IS NULL OR TRIM(um_last.meta_value) = '')`)
  } else if (days != null && (isActiveMode || isInactiveMode)) {
    // Compare by parsing as UTC; store is UTC string.
    // Use STR_TO_DATE for MySQL; assume UTC. We compare to NOW() which is DB timezone; acceptable V1.
    const cmp = isActiveMode ? '>=' : '<'
    whereParts.push(`um_last.meta_value IS NOT NULL AND TRIM(um_last.meta_value) != ''`)
    whereParts.push(`STR_TO_DATE(um_last.meta_value, '%Y-%m-%d %H:%i:%s') ${cmp} (NOW() - INTERVAL ? DAY)`)
    params.push(days)
  }

  const sql = `
    SELECT
      u.ID as user_id,
      u.user_email as email,
      um_last.meta_value as last_login,
      um_listed.meta_value as coach_is_listed,
      ar.app_role as app_role
    FROM ${tUsers} u
    LEFT JOIN ${tMeta} um_last ON um_last.user_id = u.ID AND um_last.meta_key = 'fleur_last_login'
    LEFT JOIN ${tMeta} um_listed ON um_listed.user_id = u.ID AND um_listed.meta_key = 'fleur_coach_is_listed'
    LEFT JOIN ${tMeta} um_optout ON um_optout.user_id = u.ID AND um_optout.meta_key = 'fleur_email_optout'
    LEFT JOIN ${tRoles} ar ON ar.user_id = u.ID
    WHERE ${whereParts.join(' AND ')}
    ORDER BY u.ID ASC
  `
  const res = await exec(pool, sql, params)
  const rows = (res[0] ?? []) as RowDataPacket[]
  return rows
    .map((r) => ({
      user_id: Number(r.user_id),
      email: normalizeEmail(r.email),
      last_login: r.last_login != null ? String(r.last_login) : null,
      coach_is_listed: r.coach_is_listed != null ? String(r.coach_is_listed) : null,
      app_role: r.app_role != null ? String(r.app_role) : null,
    }))
    .filter((r) => r.user_id > 0 && r.email && !excludeEmails.has(r.email))
}

export async function previewAudience(audience: BroadcastAudience): Promise<{ count: number; sample: Array<{ user_id: number; email_masked: string }> }> {
  if (!isDbConfigured()) return { count: 0, sample: [] }
  await ensureBroadcastTables()
  const recipients = await selectAudienceRecipients(audience)
  const mask = (email: string) => {
    const [u, d] = email.split('@')
    const user = (u || '').slice(0, 2) + '***'
    const dom = d ? d.replace(/^(.{1}).+(\..+)$/, '$1***$2') : '***'
    return `${user}@${dom}`
  }
  return {
    count: recipients.length,
    sample: recipients.slice(0, 20).map((r) => ({ user_id: r.user_id, email_masked: mask(r.email) })),
  }
}

export async function enqueueDeliveries(params: { broadcastId: number }): Promise<{ queued: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const tD = T_DELIV()

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT audience_json, channels_json, status FROM ${tB} WHERE id = ? LIMIT 1`,
    [params.broadcastId]
  )
  const r = rows?.[0]
  if (!r) throw new Error('Diffusion introuvable')
  if (String(r.status ?? '') !== 'draft' && String(r.status ?? '') !== 'scheduled') {
    throw new Error('Diffusion non envoyable dans cet état')
  }
  let audience: BroadcastAudience
  let channels: BroadcastContent
  try {
    audience = JSON.parse(String(r.audience_json ?? '{}')) as BroadcastAudience
  } catch {
    audience = {
      audience_type: 'all',
      activity: 'any',
      coach_listed: 'any',
      exclude_admins: true,
      exclude_emails: [],
      respect_email_optout: true,
    }
  }
  try {
    channels = JSON.parse(String(r.channels_json ?? '{}')) as BroadcastContent
  } catch {
    channels = {}
  }

  const recipients = await selectAudienceRecipients(audience)
  if (recipients.length === 0) {
    throw new Error('Aucun destinataire ne correspond à cette cible (vérifiez l’ID, l’e-mail ou les filtres).')
  }
  const wantsEmail = !!channels.email?.subject
  const wantsInapp = !!channels.inapp?.title
  if (!wantsEmail && !wantsInapp) throw new Error('Aucun canal activé')

  let queued = 0
  for (const u of recipients) {
    if (wantsEmail) {
      await pool.execute(
        `INSERT IGNORE INTO ${tD} (broadcast_id, user_id, user_email, channel, status) VALUES (?, ?, ?, 'email', 'queued')`,
        [params.broadcastId, u.user_id, u.email]
      )
      queued++
    }
    if (wantsInapp) {
      await pool.execute(
        `INSERT IGNORE INTO ${tD} (broadcast_id, user_id, user_email, channel, status) VALUES (?, ?, ?, 'inapp', 'queued')`,
        [params.broadcastId, u.user_id, u.email]
      )
      queued++
    }
  }

  const snapshot = {
    audience,
    channels,
    recipient_count: recipients.length,
    queued_at: nowSqlUtc(),
  }
  await pool.execute(
    `UPDATE ${tB} SET status = 'sending', started_at = NOW(), snapshot_json = ? WHERE id = ?`,
    [JSON.stringify(snapshot), params.broadcastId]
  )
  return { queued }
}

export async function claimQueuedDeliveries(params: { broadcastId: number; channel: BroadcastChannel; limit: number }): Promise<Array<{ id: number; user_id: number; user_email: string }>> {
  if (!isDbConfigured()) return []
  await ensureBroadcastTables()
  const pool = getPool()
  const tD = T_DELIV()
  const lim = Math.min(200, Math.max(1, params.limit ?? 50))
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, user_email
     FROM ${tD}
     WHERE broadcast_id = ? AND channel = ? AND status = 'queued'
     ORDER BY id ASC
     LIMIT ?`,
    [params.broadcastId, params.channel, lim]
  )
  // V1 simplifie: on ne lock pas (pas de multi-worker). En prod, on ferait un "status=processing" atomique.
  return rows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    user_email: normalizeEmail(r.user_email),
  }))
}

export async function markDeliverySent(params: { deliveryId: number; providerMessageId?: string | null }): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const tD = T_DELIV()
  await pool.execute(
    `UPDATE ${tD} SET status = 'sent', provider_message_id = ?, sent_at = NOW() WHERE id = ?`,
    [params.providerMessageId ?? null, params.deliveryId]
  )
}

export async function markDeliveryFailed(params: { deliveryId: number; error: string }): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const tD = T_DELIV()
  await pool.execute(
    `UPDATE ${tD} SET status = 'failed', error_message = ? WHERE id = ?`,
    [String(params.error ?? '').slice(0, 2000), params.deliveryId]
  )
}

export async function finalizeBroadcastIfDone(broadcastId: number): Promise<void> {
  if (!isDbConfigured()) return
  await ensureBroadcastTables()
  const pool = getPool()
  const tB = T_BROADCAST()
  const tD = T_DELIV()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
      SUM(status='queued') as queued,
      SUM(status='failed') as failed,
      SUM(status='sent') as sent
     FROM ${tD}
     WHERE broadcast_id = ?`,
    [broadcastId]
  )
  const queued = Number(rows?.[0]?.queued ?? 0)
  const failed = Number(rows?.[0]?.failed ?? 0)
  const sent = Number(rows?.[0]?.sent ?? 0)
  if (queued > 0) return
  const status: BroadcastStatus =
    failed > 0 && sent > 0 ? 'partial' :
    failed > 0 && sent === 0 ? 'failed' :
    'completed'
  await pool.execute(
    `UPDATE ${tB} SET status = ?, completed_at = NOW() WHERE id = ? AND status = 'sending'`,
    [status, broadcastId]
  )
}

