/**
 * Notifications in-app — MariaDB (tables WordPress prefixées).
 *
 * Tables:
 * - wp_fleur_notifications
 * - wp_fleur_notification_deliveries
 * - wp_fleur_notification_preferences (optionnel, V1 minimal)
 *
 * Objectif: alimenter NotificationCenter + NotificationsPage + AdminNotificationsPage
 * sans dépendre du catch-all stub.
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { filterOutboundRecipients } from './notification-outbound'
import { engagementExpiresAt, isEngagementNotificationType } from './engagement-templates'
import { excludeDemoAccountsSql } from './demo-accounts'
import { filterOutDemoUserIds } from './demo-accounts-filter'

const T_NOTIF = () => table('fleur_notifications')
const T_DELIV = () => table('fleur_notification_deliveries')
const T_PREF = () => table('fleur_notification_preferences')

// Singleton : évite les CREATE TABLE IF NOT EXISTS concurrents (metadata lock MariaDB)
let _ensureTablesPromise: Promise<void> | null = null

export function ensureNotificationsTables(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensureTablesPromise) {
    _ensureTablesPromise = _doEnsureNotificationsTables().catch((err) => {
      _ensureTablesPromise = null // reset pour permettre un retry
      throw err
    })
  }
  return _ensureTablesPromise
}

async function _doEnsureNotificationsTables(): Promise<void> {
  const pool = getPool()
  const tN = T_NOTIF()
  const tD = T_DELIV()
  const tP = T_PREF()

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tN} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(40) NOT NULL DEFAULT 'system',
      title VARCHAR(255) NOT NULL DEFAULT '',
      body TEXT DEFAULT NULL,
      action_url VARCHAR(255) DEFAULT NULL,
      action_label VARCHAR(80) DEFAULT NULL,
      recipient_type VARCHAR(20) NOT NULL DEFAULT 'all',
      recipient_id INT DEFAULT NULL,
      recipient_role VARCHAR(40) DEFAULT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      source_type VARCHAR(40) DEFAULT NULL,
      source_id INT DEFAULT NULL,
      channel_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_recipient (recipient_type, recipient_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tD} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notification_id INT NOT NULL,
      user_id INT NOT NULL,
      user_email VARCHAR(255) DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      channel_id INT DEFAULT NULL,
      INDEX idx_user (user_id, read_at),
      INDEX idx_notif (notification_id),
      INDEX idx_channel (channel_id),
      UNIQUE KEY uk_notif_user (notification_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tP} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      preferences_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // Migrations idempotentes : ajout des colonnes manquantes sur tables existantes
  // (MariaDB >= 10.0.2 supporte ADD COLUMN IF NOT EXISTS)
  const migrations = [
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS read_at DATETIME DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS user_email VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS channel_id INT DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS delivered_at DATETIME DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS email_error VARCHAR(500) DEFAULT NULL`,
    `ALTER TABLE ${tD} ADD COLUMN IF NOT EXISTS email_sent_at DATETIME DEFAULT NULL`,
    `ALTER TABLE ${tN} ADD COLUMN IF NOT EXISTS channel_id INT DEFAULT NULL`,
    `ALTER TABLE ${tN} ADD COLUMN IF NOT EXISTS expires_at DATETIME DEFAULT NULL`,
    `ALTER TABLE ${tN} ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) DEFAULT NULL`,
    `ALTER TABLE ${tN} ADD COLUMN IF NOT EXISTS source_id INT DEFAULT NULL`,
    `ALTER TABLE ${tN} ADD COLUMN IF NOT EXISTS channels_json VARCHAR(120) DEFAULT NULL`,
  ]
  for (const sql of migrations) {
    await pool.execute(sql).catch(() => {/* ignorer si colonne déjà présente */})
  }
}

function normalizeEmail(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

export type NotificationChannels = { inapp: boolean; email: boolean }

function channelsJson(channels: NotificationChannels): string {
  return JSON.stringify(channels)
}

function parseChannelsJson(raw: unknown): NotificationChannels {
  if (!raw) return { inapp: true, email: false }
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      inapp: (o as NotificationChannels).inapp !== false,
      email: !!(o as NotificationChannels).email,
    }
  } catch {
    return { inapp: true, email: false }
  }
}

/** Met à jour le statut e-mail d'une livraison (appelé après dispatch SMTP). */
export async function markDeliveryEmailStatus(params: {
  notificationId: number
  userId: number
  sent: boolean
  error?: string | null
}): Promise<void> {
  if (!isDbConfigured()) return
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  const tN = T_NOTIF()
  const status = params.sent ? 'sent' : params.error ? 'failed' : 'skipped'
  await pool.execute(
    `UPDATE ${tD}
        SET email_status = ?, email_error = ?, email_sent_at = IF(?, NOW(), NULL)
      WHERE notification_id = ? AND user_id = ?`,
    [status, params.error ? String(params.error).slice(0, 500) : null, params.sent ? 1 : 0, params.notificationId, params.userId]
  )
  await pool.execute(
    `UPDATE ${tN} SET channels_json = ? WHERE id = ?`,
    [channelsJson({ inapp: true, email: true }), params.notificationId]
  )
}

export type NotificationCreateInput = {
  type?: string
  title: string
  body?: string | null
  action_url?: string | null
  action_label?: string | null
  recipient_type?: 'all' | 'role' | 'user'
  recipient_id?: number | null
  recipient_email?: string | null
  recipient_role?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  expires_at?: string | null
  created_by?: number | null
  source_type?: string | null
  source_id?: number | null
  channel_id?: number | null
  /** Ne pas envoyer l'e-mail transactionnel (ex. campagne SMTP déjà envoyée). */
  skip_email?: boolean
  /** Contourne le garde-fou dev (tests admin explicites). */
  skip_dev_guard?: boolean
}

async function resolveRecipients(input: NotificationCreateInput): Promise<Array<{ user_id: number; email: string }>> {
  const pool = getPool()
  const tUsers = table('users')
  const tRoles = table('fleur_app_roles')
  const tMeta = table('usermeta')
  const excludeDemo = excludeDemoAccountsSql('u', tMeta)

  const rt = input.recipient_type ?? 'all'
  if (rt === 'user') {
    const id = input.recipient_id != null ? Number(input.recipient_id) : 0
    const email = normalizeEmail(input.recipient_email)
    if (!id && !email) return []
    if (id) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT u.ID as user_id, u.user_email as email FROM ${tUsers} u WHERE u.ID = ? ${excludeDemo} LIMIT 1`,
        [id]
      )
      return rows.map((r) => ({ user_id: Number(r.user_id), email: normalizeEmail(r.email) })).filter((r) => r.email)
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID as user_id, u.user_email as email FROM ${tUsers} u
       WHERE LOWER(u.user_email) = ? ${excludeDemo} LIMIT 1`,
      [email]
    )
    return rows.map((r) => ({ user_id: Number(r.user_id), email: normalizeEmail(r.email) })).filter((r) => r.email)
  }

  if (rt === 'role') {
    const role = String(input.recipient_role ?? 'user').trim()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID as user_id, u.user_email as email
       FROM ${tUsers} u
       WHERE u.ID IN (SELECT user_id FROM ${tRoles} WHERE app_role = ?)
       AND u.user_email IS NOT NULL AND u.user_email != ''
       ${excludeDemo}`,
      [role]
    )
    return rows.map((r) => ({ user_id: Number(r.user_id), email: normalizeEmail(r.email) })).filter((r) => r.email)
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID as user_id, u.user_email as email FROM ${tUsers} u
     WHERE u.user_email IS NOT NULL AND u.user_email != ''
     ${excludeDemo}`
  )
  return rows.map((r) => ({ user_id: Number(r.user_id), email: normalizeEmail(r.email) })).filter((r) => r.email)
}

export async function createNotification(input: NotificationCreateInput): Promise<{ notification_id: number; deliveries: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureNotificationsTables()
  const pool = getPool()
  const tN = T_NOTIF()
  const tD = T_DELIV()

  const type = String(input.type ?? 'system').slice(0, 40)
  const title = String(input.title ?? '').trim().slice(0, 255)
  if (!title) throw new Error('Titre requis')
  const body = input.body != null ? String(input.body) : null
  const actionUrl = input.action_url != null ? String(input.action_url).slice(0, 255) : null
  const actionLabel = input.action_label != null ? String(input.action_label).slice(0, 80) : null
  const recipientType = (input.recipient_type ?? 'all') as string
  const recipientId = input.recipient_id != null ? Number(input.recipient_id) : null
  const recipientRole = input.recipient_role != null ? String(input.recipient_role).slice(0, 40) : null
  const priority = String(input.priority ?? 'normal').slice(0, 20)
  const createdBy = input.created_by != null ? Number(input.created_by) : null
  let expiresAt = input.expires_at ? String(input.expires_at).replace('T', ' ').slice(0, 19) : null
  if (!expiresAt && isEngagementNotificationType(type)) {
    expiresAt = engagementExpiresAt()
  }

  const channels: NotificationChannels = {
    inapp: true,
    email: !input.skip_email,
  }

  const [insRes] = await pool.execute(
    `INSERT INTO ${tN}
      (type, title, body, action_url, action_label, recipient_type, recipient_id, recipient_role, priority, source_type, source_id, channel_id, created_by, expires_at, channels_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      type,
      title,
      body,
      actionUrl,
      actionLabel,
      recipientType,
      recipientId,
      recipientRole,
      priority,
      input.source_type ?? null,
      input.source_id ?? null,
      input.channel_id ?? null,
      createdBy,
      expiresAt,
      channelsJson(channels),
    ]
  )
  const notificationId = Number((insRes as ResultSetHeader).insertId)

  const recipients = filterOutboundRecipients(await resolveRecipients(input), {
    skipDevGuard: input.skip_dev_guard,
  })
  const realUserIds = new Set(
    await filterOutDemoUserIds(recipients.map((r) => r.user_id))
  )
  const deliverable = recipients.filter((r) => realUserIds.has(r.user_id))
  if (deliverable.length === 0) {
    return { notification_id: notificationId, deliveries: 0 }
  }
  let deliveries = 0
  for (const r of deliverable) {
    const email = normalizeEmail(r.email)
    if (!email) continue
    await pool.execute(
      `INSERT IGNORE INTO ${tD} (notification_id, user_id, user_email) VALUES (?, ?, ?)`,
      [notificationId, r.user_id, email]
    )
    deliveries++
  }

  void import('./email')
    .then(({ dispatchNotificationEmails }) => {
      if (input.skip_email) return
      return dispatchNotificationEmails({
        notificationId,
        type,
        title,
        body,
        actionUrl,
        actionLabel,
        recipients: deliverable,
        skipDevGuard: input.skip_dev_guard,
      })
    })
    .catch(() => {})

  return { notification_id: notificationId, deliveries }
}

export async function unreadCountForUser(userId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  const tN = T_NOTIF()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as c
     FROM ${tD} d
     JOIN ${tN} n ON n.id = d.notification_id
     WHERE d.user_id = ? AND d.read_at IS NULL
       AND (n.expires_at IS NULL OR n.expires_at > NOW())`,
    [userId]
  )
  return Number(rows?.[0]?.c ?? 0)
}

export async function listForUser(params: { userId: number; per_page?: number; page?: number }): Promise<{ items: Record<string, unknown>[]; unread: number }> {
  if (!isDbConfigured()) return { items: [], unread: 0 }
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  const tN = T_NOTIF()
  const perPage = Math.min(50, Math.max(1, params.per_page ?? 20))
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * perPage
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
        n.id as id,
        n.type,
        n.title,
        n.body,
        n.action_url,
        n.action_label,
        n.priority,
        n.created_at,
        d.id as delivery_id,
        d.read_at
     FROM ${tD} d
     JOIN ${tN} n ON n.id = d.notification_id
     WHERE d.user_id = ?
       AND (n.expires_at IS NULL OR n.expires_at > NOW())
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [params.userId, perPage, offset]
  )
  const items = rows.map((r) => ({
    id: String(r.id),
    type: String(r.type ?? ''),
    title: String(r.title ?? ''),
    body: r.body ?? null,
    action_url: r.action_url ?? null,
    action_label: r.action_label ?? null,
    priority: String(r.priority ?? 'normal'),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    delivery_id: String(r.delivery_id ?? ''),
    read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
  }))
  const unread = await unreadCountForUser(params.userId)
  return { items, unread }
}

export async function markRead(userId: number, ids: number[]): Promise<void> {
  if (!isDbConfigured()) return
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  const clean = ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0).slice(0, 200)
  if (clean.length === 0) return
  const placeholders = clean.map(() => '?').join(', ')
  await exec(
    pool,
    `UPDATE ${tD} d SET d.read_at = COALESCE(d.read_at, NOW())
     WHERE d.user_id = ? AND d.notification_id IN (${placeholders})`,
    [userId, ...clean]
  )
}

export async function markAllRead(userId: number): Promise<void> {
  if (!isDbConfigured()) return
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  await pool.execute(`UPDATE ${tD} SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ?`, [userId])
}

export async function deleteRead(userId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureNotificationsTables()
  const pool = getPool()
  const tD = T_DELIV()
  const [res] = await pool.execute(`DELETE FROM ${tD} WHERE user_id = ? AND read_at IS NOT NULL`, [userId])
  return Number((res as ResultSetHeader).affectedRows ?? 0)
}

export async function adminList(params: { page?: number; per_page?: number; type?: string }): Promise<{ items: Record<string, unknown>[]; total: number; pages: number }> {
  if (!isDbConfigured()) return { items: [], total: 0, pages: 1 }
  await ensureNotificationsTables()
  const pool = getPool()
  const tN = T_NOTIF()
  const tD = T_DELIV()
  const perPage = Math.min(100, Math.max(1, params.per_page ?? 20))
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * perPage
  const type = String(params.type ?? '').trim()
  const where = type ? 'WHERE n.type = ?' : ''
  const values: (string | number | boolean | null)[] = type ? [type] : []
  const countRes = await exec(pool, `SELECT COUNT(*) as total FROM ${tN} n ${where}`, values)
  const countRows = (countRes[0] ?? []) as RowDataPacket[]
  const total = Number(countRows?.[0]?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / perPage))
  const rowsRes = await exec(
    pool,
    `SELECT
        n.id,
        n.created_at,
        n.type,
        n.title,
        n.recipient_type,
        n.recipient_role,
        n.recipient_id,
        n.priority,
        n.channels_json,
        (SELECT COUNT(*) FROM ${tD} d WHERE d.notification_id = n.id) as delivery_count,
        (SELECT COUNT(*) FROM ${tD} d WHERE d.notification_id = n.id AND d.read_at IS NOT NULL) as read_count,
        (SELECT COUNT(*) FROM ${tD} d WHERE d.notification_id = n.id AND d.email_status = 'sent') as email_sent_count,
        (SELECT COUNT(*) FROM ${tD} d WHERE d.notification_id = n.id AND d.email_status IN ('failed', 'skipped')) as email_failed_count,
        (SELECT COUNT(*) FROM ${tD} d WHERE d.notification_id = n.id AND d.email_status IS NOT NULL) as email_attempted_count,
        (SELECT d.email_error FROM ${tD} d WHERE d.notification_id = n.id AND d.email_error IS NOT NULL LIMIT 1) as email_error_sample
     FROM ${tN} n
     ${where}
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, perPage, offset]
  )
  const rows = (rowsRes[0] ?? []) as RowDataPacket[]
  const items = rows.map((r) => {
    const channels = parseChannelsJson(r.channels_json)
    const type = String(r.type ?? '')
    const isEngagement = isEngagementNotificationType(type)
    const deliveryCount = Number(r.delivery_count ?? 0)
    const emailSent = Number(r.email_sent_count ?? 0)
    const emailFailed = Number(r.email_failed_count ?? 0)
    const emailAttempted = Number(r.email_attempted_count ?? 0)
    const inappOk = deliveryCount > 0
    const emailPlanned = isEngagement || channels.email || emailAttempted > 0
    let send_status: 'ok' | 'partial' | 'error' | 'pending' | 'inapp_only' | 'untracked' = 'inapp_only'
    if (emailPlanned) {
      if (emailAttempted === 0) send_status = isEngagement ? 'untracked' : 'pending'
      else if (emailFailed > 0 && emailSent === 0) send_status = 'error'
      else if (emailFailed > 0) send_status = 'partial'
      else send_status = 'ok'
    } else if (inappOk) {
      send_status = 'ok'
    }
    return {
      id: Number(r.id),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      type,
      title: String(r.title ?? ''),
      recipient_type: String(r.recipient_type ?? ''),
      recipient_role: r.recipient_role ?? null,
      recipient_id: r.recipient_id != null ? Number(r.recipient_id) : null,
      priority: String(r.priority ?? 'normal'),
      delivery_count: deliveryCount,
      read_count: Number(r.read_count ?? 0),
      channels: {
        inapp: inappOk,
        email: emailPlanned,
      },
      send_status,
      email_sent_count: emailSent,
      email_failed_count: emailFailed,
      email_error: r.email_error_sample ? String(r.email_error_sample) : null,
    }
  })
  return { items, total, pages }
}

export async function adminDelete(params: { ids?: number[]; filters?: { type?: string } }): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureNotificationsTables()
  const pool = getPool()
  const tN = T_NOTIF()
  const tD = T_DELIV()
  const ids = (params.ids ?? []).map(Number).filter((x) => x > 0)
  const type = String(params.filters?.type ?? '').trim()
  if (ids.length === 0 && !type) return 0

  // Supprimer deliveries puis notifications (pas de FK pour rester compatible).
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ')
    await exec(pool, `DELETE FROM ${tD} WHERE notification_id IN (${placeholders})`, ids)
    const [res] = await exec(pool, `DELETE FROM ${tN} WHERE id IN (${placeholders})`, ids)
    return Number((res as ResultSetHeader).affectedRows ?? 0)
  }

  await pool.execute(`DELETE d FROM ${tD} d JOIN ${tN} n ON n.id = d.notification_id WHERE n.type = ?`, [type])
  const [res] = await pool.execute(`DELETE FROM ${tN} WHERE type = ?`, [type])
  return Number((res as ResultSetHeader).affectedRows ?? 0)
}

