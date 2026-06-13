/**
 * Mycelium — données individuelles contexte entreprise (check-ins pro, profil travail).
 * Les agrégats RH passent par db-aggregates (k-anonymat).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { recordTimelineEvent } from './db-timeline'
import { getMembershipForUser } from './db-organisations'

const T_CHECKIN = () => table('fleur_mycelium_checkins')
const T_PROFILE = () => table('fleur_mycelium_profiles')

export type WorkCheckin = {
  id: number
  userId: number
  orgId: number
  teamId: number | null
  mood: number
  note: string | null
  createdAt: string
}

export type WorkProfile = {
  userId: number
  orgId: number
  petals: Record<string, number>
  updatedAt: string
}

let _ensurePromise: Promise<void> | null = null

export function ensureMyceliumTables(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = _doEnsure().catch((err) => {
      _ensurePromise = null
      throw err
    })
  }
  return _ensurePromise
}

async function _doEnsure(): Promise<void> {
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_CHECKIN()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      org_id INT NOT NULL,
      team_id INT DEFAULT NULL,
      mood TINYINT NOT NULL DEFAULT 3,
      note VARCHAR(500) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org_created (org_id, created_at),
      INDEX idx_user_org (user_id, org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_PROFILE()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      org_id INT NOT NULL,
      petals_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_org (user_id, org_id),
      INDEX idx_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function clamp1to5(v: unknown): number {
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return 3
  return Math.min(Math.max(n, 1), 5)
}

export async function saveWorkCheckin(input: {
  userId: number
  mood: unknown
  note?: string | null
}): Promise<WorkCheckin> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureMyceliumTables()
  const membership = await getMembershipForUser(input.userId)
  if (!membership) throw new Error('Aucune organisation')

  const mood = clamp1to5(input.mood)
  const note = input.note != null ? String(input.note).slice(0, 500) : null
  const pool = getPool()
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_CHECKIN()} (user_id, org_id, team_id, mood, note) VALUES (?, ?, ?, ?, ?)`,
    [input.userId, membership.orgId, membership.teamId, mood, note]
  )
  const id = Number((res as ResultSetHeader).insertId)

  const profile = await getWorkProfile(input.userId, membership.orgId)
  const petalsArr = profile ? PETALS_RECORD_TO_ARRAY(profile.petals) : null

  void recordTimelineEvent({
    userId: input.userId,
    source: 'checkin',
    refId: id,
    title: 'Pulse bien-être pro',
    summary: note,
    mood,
    petals: petalsArr,
    orgId: membership.orgId,
    teamId: membership.teamId,
  }).catch(() => {})

  return {
    id,
    userId: input.userId,
    orgId: membership.orgId,
    teamId: membership.teamId,
    mood,
    note,
    createdAt: new Date().toISOString(),
  }
}

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

function PETALS_RECORD_TO_ARRAY(petals: Record<string, number>): number[] {
  return PETAL_IDS.map((id) => Number(petals[id]) || 0)
}

export async function getMyWorkCheckins(userId: number, limit = 20): Promise<WorkCheckin[]> {
  if (!isDbConfigured()) return []
  await ensureMyceliumTables()
  const membership = await getMembershipForUser(userId)
  if (!membership) return []
  const pool = getPool()
  const safe = Math.min(Math.max(limit, 1), 60)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_CHECKIN()} WHERE user_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT ${safe}`,
    [userId, membership.orgId]
  )
  return rows.map(mapCheckin)
}

function mapCheckin(r: RowDataPacket): WorkCheckin {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    orgId: Number(r.org_id),
    teamId: r.team_id != null ? Number(r.team_id) : null,
    mood: Number(r.mood),
    note: r.note != null ? String(r.note) : null,
    createdAt: String(r.created_at ?? ''),
  }
}

export async function saveWorkProfile(userId: number, petals: Record<string, number>): Promise<WorkProfile> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureMyceliumTables()
  const membership = await getMembershipForUser(userId)
  if (!membership) throw new Error('Aucune organisation')

  const normalized: Record<string, number> = {}
  for (const id of PETAL_IDS) {
    normalized[id] = Math.min(1, Math.max(0, Number(petals[id]) || 0))
  }
  const pool = getPool()
  await exec(
    pool,
    `INSERT INTO ${T_PROFILE()} (user_id, org_id, petals_json) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE petals_json = VALUES(petals_json), updated_at = CURRENT_TIMESTAMP`,
    [userId, membership.orgId, JSON.stringify(normalized)]
  )

  void recordTimelineEvent({
    userId,
    source: 'onboarding',
    refId: membership.orgId,
    title: 'Profil au travail',
    summary: 'Cartographie relationnelle professionnelle enregistrée.',
    petals: PETALS_RECORD_TO_ARRAY(normalized),
    mood: null,
    orgId: membership.orgId,
    teamId: membership.teamId,
  }).catch(() => {})

  return { userId, orgId: membership.orgId, petals: normalized, updatedAt: new Date().toISOString() }
}

export async function getWorkProfile(userId: number, orgId?: number): Promise<WorkProfile | null> {
  if (!isDbConfigured()) return null
  await ensureMyceliumTables()
  let oid = orgId
  if (!oid) {
    const m = await getMembershipForUser(userId)
    if (!m) return null
    oid = m.orgId
  }
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_PROFILE()} WHERE user_id = ? AND org_id = ? LIMIT 1`,
    [userId, oid]
  )
  if (!rows?.length) return null
  try {
    const petals = JSON.parse(String(rows[0].petals_json)) as Record<string, number>
    return {
      userId,
      orgId: oid,
      petals,
      updatedAt: String(rows[0].updated_at ?? ''),
    }
  } catch {
    return null
  }
}

export type OrgAdoptionStats = {
  totalMembers: number
  withProfile: number
  withCheckin30d: number
  checkinCount30d: number
  participationRate: number
}

export async function getOrgAdoptionStats(orgId: number): Promise<OrgAdoptionStats> {
  if (!isDbConfigured()) {
    return { totalMembers: 0, withProfile: 0, withCheckin30d: 0, checkinCount30d: 0, participationRate: 0 }
  }
  await ensureMyceliumTables()
  const pool = getPool()
  const T_MEMBER = table('fleur_memberships')

  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${T_MEMBER} WHERE org_id = ?`,
    [orgId]
  )
  const totalMembers = Number(memberRows[0]?.n ?? 0)

  const [profileRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT user_id) AS n FROM ${T_PROFILE()} WHERE org_id = ?`,
    [orgId]
  )
  const withProfile = Number(profileRows[0]?.n ?? 0)

  const [checkinRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS events
       FROM ${T_CHECKIN()} WHERE org_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)`,
    [orgId]
  )
  const withCheckin30d = Number(checkinRows[0]?.users ?? 0)
  const checkinCount30d = Number(checkinRows[0]?.events ?? 0)
  const participationRate = totalMembers > 0 ? Math.round((withCheckin30d / totalMembers) * 100) : 0

  return { totalMembers, withProfile, withCheckin30d, checkinCount30d, participationRate }
}

export async function getUserStreak(userId: number, orgId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureMyceliumTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE(created_at) AS d FROM ${T_CHECKIN()}
     WHERE user_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 60`,
    [userId, orgId]
  )
  if (!rows.length) return 0
  const days = new Set(rows.map((r) => String(r.d)))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) streak++
    else if (i > 0) break
  }
  return streak
}

// ── Synthèse IA dashboard (cache MariaDB) ───────────────────────

const T_SYNTH = () => table('fleur_mycelium_synthesis')

export type MyceliumSynthesis = {
  summary: string
  actions: string[]
  cached_at: string
  provider: string
}

let _ensureSynthPromise: Promise<void> | null = null

async function ensureSynthTable(): Promise<void> {
  if (!isDbConfigured()) return
  if (!_ensureSynthPromise) {
    _ensureSynthPromise = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS ${T_SYNTH()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          org_id INT NOT NULL,
          team_id INT DEFAULT NULL,
          window_days INT NOT NULL DEFAULT 30,
          signature VARCHAR(64) NOT NULL,
          synthesis_json TEXT NOT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_cache (org_id, team_id, window_days, signature),
          INDEX idx_org (org_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => undefined)
      .catch((err) => {
        _ensureSynthPromise = null
        throw err
      })
  }
  return _ensureSynthPromise
}

export async function getCachedSynthesis(params: {
  orgId: number
  teamId?: number | null
  windowDays: number
  signature: string
}): Promise<MyceliumSynthesis | null> {
  if (!isDbConfigured()) return null
  await ensureSynthTable()
  const pool = getPool()
  const teamKey = params.teamId ?? 0
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT synthesis_json, cached_at FROM ${T_SYNTH()}
     WHERE org_id = ? AND COALESCE(team_id, 0) = ? AND window_days = ? AND signature = ? LIMIT 1`,
    [params.orgId, teamKey, params.windowDays, params.signature]
  )
  if (!rows?.length) return null
  try {
    const parsed = JSON.parse(String(rows[0].synthesis_json)) as MyceliumSynthesis
    return { ...parsed, cached_at: String(rows[0].cached_at ?? parsed.cached_at) }
  } catch {
    return null
  }
}

export async function saveSynthesisCache(params: {
  orgId: number
  teamId?: number | null
  windowDays: number
  signature: string
  synthesis: MyceliumSynthesis
}): Promise<void> {
  if (!isDbConfigured()) return
  await ensureSynthTable()
  const pool = getPool()
  await exec(
    pool,
    `INSERT INTO ${T_SYNTH()} (org_id, team_id, window_days, signature, synthesis_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE synthesis_json = VALUES(synthesis_json), cached_at = CURRENT_TIMESTAMP`,
    [
      params.orgId,
      params.teamId ?? null,
      params.windowDays,
      params.signature,
      JSON.stringify(params.synthesis),
    ]
  )
}

/** Questions rotatives pour campagne pulse (semaine de l'année). */
export const PULSE_WEEKLY_QUESTIONS = [
  'Qu\'est-ce qui vous a nourri au travail cette semaine ?',
  'Où avez-vous senti de la reconnaissance ou de la tension ?',
  'Qu\'un geste concret améliorerait votre bien-être demain ?',
  'Comment vous sentez-vous dans votre équipe en ce moment ?',
] as const

export function pulseQuestionForWeek(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 1)
  const week = Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000))
  return PULSE_WEEKLY_QUESTIONS[week % PULSE_WEEKLY_QUESTIONS.length]
}
