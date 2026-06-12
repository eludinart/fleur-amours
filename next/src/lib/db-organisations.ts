/**
 * Mycelium — modèle organisationnel (entreprise) — MariaDB.
 *
 * Tables :
 * - `fleur_organisations` : l'entité entreprise (propriétaire = owner_user_id).
 * - `fleur_teams`         : équipes au sein d'une organisation.
 * - `fleur_memberships`   : appartenance (user_id, org_id, team_id, role). SOURCE DE
 *                           VÉRITÉ de l'appartenance/rôle org (le JWT ne porte qu'un
 *                           rôle global).
 * - `fleur_org_seats`     : sièges achetés (capacité) par organisation.
 * - `fleur_org_invites`   : invitations en masse (token + email + équipe + rôle).
 *
 * Confidentialité : aucune donnée individuelle n'est exposée via ce module ;
 * le reporting passe par db-aggregates (k-anonymat).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomBytes } from 'crypto'
import { exec, getPool, isDbConfigured, table } from './db'

const T_ORG = () => table('fleur_organisations')
const T_TEAM = () => table('fleur_teams')
const T_MEMBER = () => table('fleur_memberships')
const T_SEATS = () => table('fleur_org_seats')
const T_INVITE = () => table('fleur_org_invites')

export type OrgRole = 'owner' | 'manager' | 'rh' | 'member'

export type Organisation = {
  id: number
  name: string
  ownerUserId: number
  createdAt: string
}

export type Team = { id: number; orgId: number; name: string; createdAt: string }
export type Membership = {
  id: number
  orgId: number
  teamId: number | null
  userId: number
  role: OrgRole
  createdAt: string
}

let _ensurePromise: Promise<void> | null = null

export function ensureOrgTables(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS ${T_ORG()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      owner_user_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_TEAM()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      name VARCHAR(160) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_MEMBER()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      team_id INT DEFAULT NULL,
      user_id INT NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_org_user (org_id, user_id),
      INDEX idx_user (user_id),
      INDEX idx_team (team_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_SEATS()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      seats INT NOT NULL DEFAULT 0,
      stripe_subscription_id VARCHAR(80) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_INVITE()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      team_id INT DEFAULT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'member',
      token VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_token (token),
      INDEX idx_org_status (org_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

// ── Organisations ───────────────────────────────────────────────

export async function createOrganisation(ownerUserId: number, name: string): Promise<Organisation> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()
  const conn = await pool.getConnection()
  let orgId = 0
  try {
    await conn.beginTransaction()
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO ${T_ORG()} (name, owner_user_id) VALUES (?, ?)`,
      [String(name).trim().slice(0, 160), ownerUserId]
    )
    orgId = Number(res.insertId)
    // L'owner est manager de droit.
    await conn.execute(
      `INSERT INTO ${T_MEMBER()} (org_id, user_id, role) VALUES (?, ?, 'owner')
       ON DUPLICATE KEY UPDATE role = 'owner'`,
      [orgId, ownerUserId]
    )
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  const org = await getOrganisation(orgId)
  if (!org) throw new Error('Création organisation impossible')
  return org
}

export async function getOrganisation(orgId: number): Promise<Organisation | null> {
  if (!isDbConfigured()) return null
  await ensureOrgTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${T_ORG()} WHERE id = ? LIMIT 1`, [orgId])
  if (!rows?.length) return null
  const r = rows[0]
  return { id: Number(r.id), name: String(r.name), ownerUserId: Number(r.owner_user_id), createdAt: String(r.created_at ?? '') }
}

/** Membership de l'utilisateur (la première trouvée — un user = une org dans ce MVP). */
export async function getMembershipForUser(userId: number): Promise<Membership | null> {
  if (!isDbConfigured()) return null
  await ensureOrgTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_MEMBER()} WHERE user_id = ? ORDER BY FIELD(role,'owner','manager','rh','member'), id ASC LIMIT 1`,
    [userId]
  )
  return rows?.length ? mapMembership(rows[0]) : null
}

export async function getManagedOrg(userId: number): Promise<{ org: Organisation; role: OrgRole } | null> {
  const m = await getMembershipForUser(userId)
  if (!m) return null
  if (m.role !== 'owner' && m.role !== 'manager' && m.role !== 'rh') return null
  const org = await getOrganisation(m.orgId)
  return org ? { org, role: m.role } : null
}

function mapMembership(r: RowDataPacket): Membership {
  return {
    id: Number(r.id),
    orgId: Number(r.org_id),
    teamId: r.team_id != null ? Number(r.team_id) : null,
    userId: Number(r.user_id),
    role: String(r.role ?? 'member') as OrgRole,
    createdAt: String(r.created_at ?? ''),
  }
}

// ── Équipes ─────────────────────────────────────────────────────

export async function createTeam(orgId: number, name: string): Promise<Team> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()
  const [res] = await exec(pool, `INSERT INTO ${T_TEAM()} (org_id, name) VALUES (?, ?)`, [orgId, String(name).trim().slice(0, 160)])
  return { id: Number((res as ResultSetHeader).insertId), orgId, name: String(name).trim().slice(0, 160), createdAt: new Date().toISOString() }
}

export async function listTeams(orgId: number): Promise<Team[]> {
  if (!isDbConfigured()) return []
  await ensureOrgTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${T_TEAM()} WHERE org_id = ? ORDER BY name`, [orgId])
  return rows.map((r) => ({ id: Number(r.id), orgId: Number(r.org_id), name: String(r.name), createdAt: String(r.created_at ?? '') }))
}

// ── Memberships ─────────────────────────────────────────────────

export async function addMembership(input: {
  orgId: number
  userId: number
  teamId?: number | null
  role?: OrgRole
}): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()
  await exec(
    pool,
    `INSERT INTO ${T_MEMBER()} (org_id, team_id, user_id, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), role = VALUES(role)`,
    [input.orgId, input.teamId ?? null, input.userId, input.role ?? 'member']
  )
}

export async function countMembers(orgId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureOrgTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${T_MEMBER()} WHERE org_id = ?`, [orgId])
  return Number(rows[0]?.n ?? 0)
}

// ── Sièges (capacité) ───────────────────────────────────────────

export async function getSeats(orgId: number): Promise<{ seats: number; stripeSubscriptionId: string | null }> {
  if (!isDbConfigured()) return { seats: 0, stripeSubscriptionId: null }
  await ensureOrgTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT seats, stripe_subscription_id FROM ${T_SEATS()} WHERE org_id = ? LIMIT 1`, [orgId])
  if (!rows?.length) return { seats: 0, stripeSubscriptionId: null }
  return { seats: Number(rows[0].seats ?? 0), stripeSubscriptionId: rows[0].stripe_subscription_id ?? null }
}

export async function setSeats(orgId: number, seats: number, stripeSubscriptionId?: string | null): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()
  const n = Math.max(0, parseInt(String(seats), 10) || 0)
  await exec(
    pool,
    `INSERT INTO ${T_SEATS()} (org_id, seats, stripe_subscription_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE seats = VALUES(seats), stripe_subscription_id = COALESCE(VALUES(stripe_subscription_id), stripe_subscription_id)`,
    [orgId, n, stripeSubscriptionId ?? null]
  )
}

// ── Invitations en masse ────────────────────────────────────────

export type OrgInvite = { id: number; email: string; role: OrgRole; teamId: number | null; token: string; status: string }

/**
 * Crée des invitations pour une liste d'emails. Respecte la capacité de sièges :
 * (membres actuels + invitations en attente + nouvelles) ne dépasse pas `seats`
 * (si des sièges sont définis ; 0 = illimité en MVP).
 */
export async function createBatchInvites(input: {
  orgId: number
  emails: string[]
  teamId?: number | null
  role?: OrgRole
}): Promise<{ created: OrgInvite[]; skipped: string[] }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()

  const emails = Array.from(
    new Set(
      input.emails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  )

  const { seats } = await getSeats(input.orgId)
  const created: OrgInvite[] = []
  const skipped: string[] = []

  let usedCapacity = 0
  if (seats > 0) {
    const members = await countMembers(input.orgId)
    const [pendRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM ${T_INVITE()} WHERE org_id = ? AND status = 'pending'`,
      [input.orgId]
    )
    usedCapacity = members + Number(pendRows[0]?.n ?? 0)
  }

  for (const email of emails) {
    if (seats > 0 && usedCapacity >= seats) {
      skipped.push(email)
      continue
    }
    const token = randomBytes(24).toString('hex')
    try {
      await exec(
        pool,
        `INSERT INTO ${T_INVITE()} (org_id, team_id, email, role, token, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [input.orgId, input.teamId ?? null, email, input.role ?? 'member', token]
      )
      created.push({ id: 0, email, role: input.role ?? 'member', teamId: input.teamId ?? null, token, status: 'pending' })
      usedCapacity++
    } catch {
      skipped.push(email)
    }
  }

  return { created, skipped }
}

export async function listInvites(orgId: number, status?: string): Promise<OrgInvite[]> {
  if (!isDbConfigured()) return []
  await ensureOrgTables()
  const pool = getPool()
  const args: (number | string)[] = [orgId]
  let sql = `SELECT id, email, role, team_id, token, status FROM ${T_INVITE()} WHERE org_id = ?`
  if (status) {
    sql += ' AND status = ?'
    args.push(status)
  }
  sql += ' ORDER BY created_at DESC LIMIT 500'
  const [rows] = await pool.execute<RowDataPacket[]>(sql, args)
  return rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    role: String(r.role ?? 'member') as OrgRole,
    teamId: r.team_id != null ? Number(r.team_id) : null,
    token: String(r.token),
    status: String(r.status),
  }))
}

/** Accepte une invitation org : crée la membership et marque l'invite acceptée. */
export async function acceptOrgInvite(token: string, userId: number): Promise<{ orgId: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureOrgTables()
  const pool = getPool()
  // Transaction + verrou FOR UPDATE : pas de double acceptation concurrente,
  // et le membership + le statut de l'invitation restent cohérents.
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT * FROM ${T_INVITE()} WHERE token = ? LIMIT 1 FOR UPDATE`,
      [token]
    )
    const inv = rows?.[0]
    if (!inv) throw new Error('Invitation introuvable')
    if (String(inv.status) !== 'pending') throw new Error('Invitation déjà traitée')
    const orgId = Number(inv.org_id)
    await conn.execute(
      `INSERT INTO ${T_MEMBER()} (org_id, team_id, user_id, role) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), role = VALUES(role)`,
      [orgId, inv.team_id != null ? Number(inv.team_id) : null, userId, String(inv.role ?? 'member')]
    )
    await conn.execute(`UPDATE ${T_INVITE()} SET status = 'accepted' WHERE id = ?`, [Number(inv.id)])
    await conn.commit()
    return { orgId }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
