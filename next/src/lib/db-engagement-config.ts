/**
 * Configuration admin des relances engagement (cron).
 * Une ligne id=1 — fréquence max par utilisateur, interrupteur global.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_engagement_config')

/** Surcharges optionnelles (dry-run admin, tests). */
export type EngagementRemindBodyOverride = {
  limit?: number
  activityDays?: number
  cooldownHours?: number
  tirageStaleDays?: number
  dreamscapeStaleDays?: number
  inactiveDays?: number
  dryRun?: boolean
}

/** Fréquence max : un seul message engagement par utilisateur sur cette fenêtre (tous types). */
export const ENGAGEMENT_COOLDOWN_PRESETS = [
  { id: 'daily', label: '1 fois par jour', hours: 24 },
  { id: 'weekly', label: '1 fois par semaine', hours: 168 },
  { id: 'monthly', label: '1 fois par mois', hours: 720 },
] as const

export type EngagementCooldownPresetId = (typeof ENGAGEMENT_COOLDOWN_PRESETS)[number]['id']

export type EngagementRuntimeConfig = {
  enabled: boolean
  cooldownHours: number
  inactiveDays: number
  limit: number
  updatedAt: string | null
}

const DEFAULT_CONFIG: EngagementRuntimeConfig = {
  enabled: true,
  cooldownHours: 168,
  inactiveDays: 15,
  limit: 250,
  updatedAt: null,
}

export function clampCooldownHours(h: number): number {
  return Math.min(Math.max(Math.round(h), 6), 720)
}

export function clampInactiveDays(d: number): number {
  return Math.min(Math.max(Math.round(d), 7), 90)
}

export function clampEngagementLimit(n: number): number {
  return Math.min(Math.max(Math.round(n), 1), 500)
}

export function cooldownPresetId(hours: number): EngagementCooldownPresetId {
  const match = ENGAGEMENT_COOLDOWN_PRESETS.find((p) => p.hours === hours)
  return match?.id ?? 'weekly'
}

export function cooldownHoursFromPreset(preset: string): number | null {
  const found = ENGAGEMENT_COOLDOWN_PRESETS.find((p) => p.id === preset)
  return found ? found.hours : null
}

async function ensureTable(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL()} (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      cooldown_hours INT NOT NULL DEFAULT 168,
      inactive_days INT NOT NULL DEFAULT 15,
      batch_limit INT NOT NULL DEFAULT 250,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  return true
}

function rowToConfig(row: RowDataPacket): EngagementRuntimeConfig {
  return {
    enabled: row.enabled === 1 || row.enabled === true,
    cooldownHours: clampCooldownHours(Number(row.cooldown_hours ?? DEFAULT_CONFIG.cooldownHours)),
    inactiveDays: clampInactiveDays(Number(row.inactive_days ?? DEFAULT_CONFIG.inactiveDays)),
    limit: clampEngagementLimit(Number(row.batch_limit ?? DEFAULT_CONFIG.limit)),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

/** Config persistée en base (défauts si table vide). */
export async function getEngagementRuntimeConfig(): Promise<EngagementRuntimeConfig> {
  if (!isDbConfigured()) return { ...DEFAULT_CONFIG }
  if (!(await ensureTable())) return { ...DEFAULT_CONFIG }

  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${TBL()} WHERE id = 1 LIMIT 1`)
  if (!rows[0]) return { ...DEFAULT_CONFIG }
  return rowToConfig(rows[0])
}

export type EngagementConfigUpdate = Partial<
  Pick<EngagementRuntimeConfig, 'enabled' | 'cooldownHours' | 'inactiveDays' | 'limit'>
> & { cooldownPreset?: EngagementCooldownPresetId | string }

export async function setEngagementRuntimeConfig(
  patch: EngagementConfigUpdate
): Promise<{ saved: boolean; config: EngagementRuntimeConfig }> {
  if (!isDbConfigured()) {
    return { saved: false, config: { ...DEFAULT_CONFIG } }
  }
  await ensureTable()
  const current = await getEngagementRuntimeConfig()

  let cooldownHours = current.cooldownHours
  if (patch.cooldownPreset) {
    const fromPreset = cooldownHoursFromPreset(String(patch.cooldownPreset))
    if (fromPreset != null) cooldownHours = fromPreset
  }
  if (patch.cooldownHours !== undefined) {
    cooldownHours = clampCooldownHours(patch.cooldownHours)
  }

  const next: EngagementRuntimeConfig = {
    enabled: patch.enabled !== undefined ? !!patch.enabled : current.enabled,
    cooldownHours,
    inactiveDays:
      patch.inactiveDays !== undefined
        ? clampInactiveDays(patch.inactiveDays)
        : current.inactiveDays,
    limit: patch.limit !== undefined ? clampEngagementLimit(patch.limit) : current.limit,
    updatedAt: null,
  }

  const pool = getPool()
  await pool.execute(
    `INSERT INTO ${TBL()} (id, enabled, cooldown_hours, inactive_days, batch_limit)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       cooldown_hours = VALUES(cooldown_hours),
       inactive_days = VALUES(inactive_days),
       batch_limit = VALUES(batch_limit)`,
    [next.enabled ? 1 : 0, next.cooldownHours, next.inactiveDays, next.limit]
  )

  const config = await getEngagementRuntimeConfig()
  return { saved: true, config }
}

/** Fusionne la config admin avec les surcharges éventuelles du body (dry-run admin). */
export async function resolveEngagementRemindInput(
  body: EngagementRemindBodyOverride = {}
): Promise<EngagementRuntimeConfig & EngagementRemindBodyOverride> {
  const stored = await getEngagementRuntimeConfig()
  return {
    ...stored,
    ...body,
    enabled: stored.enabled,
    cooldownHours:
      body.cooldownHours !== undefined
        ? clampCooldownHours(body.cooldownHours)
        : stored.cooldownHours,
    inactiveDays:
      body.inactiveDays !== undefined
        ? clampInactiveDays(body.inactiveDays)
        : stored.inactiveDays,
    limit: body.limit !== undefined ? clampEngagementLimit(body.limit) : stored.limit,
  }
}
