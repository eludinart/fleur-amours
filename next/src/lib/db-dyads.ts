/**
 * Jardin du couple (dyades persistantes) — MariaDB.
 *
 * Tables :
 * - `fleur_dyads`        : lien persistant entre 2 utilisateurs (invitation par token,
 *                          puis acceptation). Porte la "fleur de couple" évolutive.
 * - `fleur_dyad_events`  : fil partagé (messages, jalons, exercices).
 * - `fleur_dyad_rituals` : rituels relationnels récurrents (rendez-vous, gratitude…).
 *
 * L'invitation réutilise l'esprit du mécanisme de liens de db-social (lien entre
 * deux comptes), ici dédié au couple/relation.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomBytes } from 'crypto'
import { exec, getPool, isDbConfigured, table } from './db'
import { resolveUserPetalsProfile } from './resolve-user-petals'

const T_DYADS = () => table('fleur_dyads')
const T_EVENTS = () => table('fleur_dyad_events')
const T_RITUALS = () => table('fleur_dyad_rituals')

export type DyadStatus = 'pending' | 'active' | 'ended'

export type Dyad = {
  id: number
  userA: number
  userB: number | null
  inviteeEmail: string | null
  status: DyadStatus
  label: string | null
  fleur: Record<string, number> | null
  fleurUpdatedAt: string | null
  createdAt: string
  /** Présent tant que l'invitation est en attente (partage du lien). */
  inviteToken?: string | null
}

export type IncomingDyadInvite = {
  dyadId: number
  token: string
  fromUserId: number
  inviteeEmail: string | null
}

let _ensurePromise: Promise<void> | null = null

export function ensureDyadTables(): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS ${T_DYADS()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_a INT NOT NULL,
      user_b INT DEFAULT NULL,
      invitee_email VARCHAR(255) DEFAULT NULL,
      invite_token VARCHAR(64) DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      label VARCHAR(120) DEFAULT NULL,
      fleur_json TEXT DEFAULT NULL,
      fleur_updated_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_a (user_a),
      INDEX idx_user_b (user_b),
      UNIQUE KEY uk_invite_token (invite_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_EVENTS()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dyad_id INT NOT NULL,
      author_id INT DEFAULT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'message',
      content TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dyad_created (dyad_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_RITUALS()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dyad_id INT NOT NULL,
      kind VARCHAR(32) NOT NULL DEFAULT 'weekly',
      title VARCHAR(160) NOT NULL DEFAULT '',
      cadence_days INT NOT NULL DEFAULT 7,
      active TINYINT NOT NULL DEFAULT 1,
      last_done_at DATETIME DEFAULT NULL,
      next_due_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dyad (dyad_id),
      INDEX idx_next_due (next_due_at, active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function mapDyad(r: RowDataPacket): Dyad {
  let fleur: Record<string, number> | null = null
  if (r.fleur_json) {
    try {
      const parsed = JSON.parse(r.fleur_json)
      if (parsed && typeof parsed === 'object') fleur = parsed
    } catch {
      fleur = null
    }
  }
  return {
    id: Number(r.id),
    userA: Number(r.user_a),
    userB: r.user_b != null ? Number(r.user_b) : null,
    inviteeEmail: r.invitee_email ?? null,
    status: String(r.status ?? 'pending') as DyadStatus,
    label: r.label ?? null,
    fleur,
    fleurUpdatedAt: r.fleur_updated_at ? String(r.fleur_updated_at) : null,
    createdAt: String(r.created_at ?? ''),
    inviteToken:
      String(r.status ?? '') === 'pending' && r.invite_token
        ? String(r.invite_token)
        : null,
  }
}

/** Invitation en attente adressée à cet email (invité pas encore rattaché). */
export async function getIncomingDyadInvite(
  userId: number,
  email: string
): Promise<IncomingDyadInvite | null> {
  if (!isDbConfigured()) return null
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized.includes('@')) return null
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_a, invite_token, invitee_email FROM ${T_DYADS()}
     WHERE status = 'pending' AND LOWER(invitee_email) = ? AND user_a != ?
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, userId]
  )
  if (!rows?.length || !rows[0].invite_token) return null
  return {
    dyadId: Number(rows[0].id),
    token: String(rows[0].invite_token),
    fromUserId: Number(rows[0].user_a),
    inviteeEmail: rows[0].invitee_email ?? null,
  }
}

/** Dyade active entre deux utilisateurs précis. */
export async function findActiveDyadBetween(userA: number, userB: number): Promise<Dyad | null> {
  if (!isDbConfigured()) return null
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_DYADS()}
     WHERE status = 'active' AND user_b IS NOT NULL
       AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))
     ORDER BY created_at DESC LIMIT 1`,
    [userA, userB, userB, userA]
  )
  return rows?.length ? mapDyad(rows[0]) : null
}

/** Ouvre une dyade active entre deux comptes (parcours À deux déjà complété). */
export async function createActiveDyadBetween(userA: number, userB: number): Promise<Dyad> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_DYADS()} (user_a, user_b, status) VALUES (?, ?, 'active')`,
    [userA, userB]
  )
  const dyad = await getDyadById(Number((res as ResultSetHeader).insertId))
  if (!dyad) throw new Error('Création de la dyade impossible')
  return dyad
}

export async function getDyadIfMember(dyadId: number, userId: number): Promise<Dyad | null> {
  const dyad = await getDyadById(dyadId)
  if (!dyad || !userInDyad(dyad, userId)) return null
  return dyad
}

/** Dyade active (ou en attente) impliquant l'utilisateur. */
export async function getMyDyad(userId: number): Promise<Dyad | null> {
  if (!isDbConfigured()) return null
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_DYADS()}
       WHERE (user_a = ? OR user_b = ?) AND status IN ('pending','active')
       ORDER BY FIELD(status,'active','pending'), created_at DESC LIMIT 1`,
    [userId, userId]
  )
  return rows?.length ? mapDyad(rows[0]) : null
}

export async function getDyadById(id: number): Promise<Dyad | null> {
  if (!isDbConfigured()) return null
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${T_DYADS()} WHERE id = ? LIMIT 1`, [id])
  return rows?.length ? mapDyad(rows[0]) : null
}

function userInDyad(dyad: Dyad, userId: number): boolean {
  return dyad.userA === userId || dyad.userB === userId
}

/** Crée une invitation de couple (token) vers un email. Une seule dyade active/pending par initiateur. */
export async function createDyadInvite(input: {
  fromUserId: number
  inviteeEmail: string
  label?: string | null
}): Promise<{ dyad: Dyad; token: string }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()

  const email = String(input.inviteeEmail).trim().toLowerCase().slice(0, 255)
  const [pending] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${T_DYADS()} WHERE user_a = ? AND invitee_email = ? AND status = 'pending' LIMIT 1`,
    [input.fromUserId, email]
  )
  if (pending?.length) throw new Error('Une invitation est déjà en attente pour cet email')

  const token = randomBytes(24).toString('hex')
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_DYADS()} (user_a, invitee_email, invite_token, status, label)
     VALUES (?, ?, ?, 'pending', ?)`,
    [input.fromUserId, String(input.inviteeEmail).trim().toLowerCase().slice(0, 255), token, input.label ?? null]
  )
  const dyad = await getDyadById(Number((res as ResultSetHeader).insertId))
  if (!dyad) throw new Error('Création de la dyade impossible')
  return { dyad, token }
}

/** Accepte une invitation par token : rattache user_b et active la dyade. */
export async function acceptDyadInvite(token: string, acceptorUserId: number): Promise<Dyad> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_DYADS()} WHERE invite_token = ? LIMIT 1`,
    [token]
  )
  const dyad = rows?.length ? mapDyad(rows[0]) : null
  if (!dyad) throw new Error('Invitation introuvable')
  if (dyad.status !== 'pending') throw new Error('Invitation déjà traitée')
  if (dyad.userA === acceptorUserId) throw new Error('Vous ne pouvez pas accepter votre propre invitation')

  await exec(
    pool,
    `UPDATE ${T_DYADS()} SET user_b = ?, status = 'active', invite_token = NULL WHERE id = ?`,
    [acceptorUserId, dyad.id]
  )
  await addDyadEvent({ dyadId: dyad.id, authorId: acceptorUserId, type: 'milestone', content: 'Dyade activée' })
  const updated = await getDyadById(dyad.id)
  return updated as Dyad
}

export async function endDyad(dyadId: number, userId: number): Promise<{ ended: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const dyad = await getDyadById(dyadId)
  if (!dyad) throw new Error('Dyade introuvable')
  if (!userInDyad(dyad, userId)) throw new Error('Accès refusé')
  const pool = getPool()
  await exec(pool, `UPDATE ${T_DYADS()} SET status = 'ended' WHERE id = ?`, [dyadId])
  return { ended: true }
}

// ── Événements (fil partagé) ────────────────────────────────────

export type DyadEvent = {
  id: number
  dyadId: number
  authorId: number | null
  type: string
  content: string | null
  createdAt: string
}

export async function addDyadEvent(input: {
  dyadId: number
  authorId?: number | null
  type?: string
  content?: string | null
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_EVENTS()} (dyad_id, author_id, type, content) VALUES (?, ?, ?, ?)`,
    [
      input.dyadId,
      input.authorId ?? null,
      String(input.type ?? 'message').slice(0, 32),
      input.content != null ? String(input.content).slice(0, 4000) : null,
    ]
  )
  return { id: Number((res as ResultSetHeader).insertId) }
}

export async function listDyadEvents(dyadId: number, limit = 80): Promise<DyadEvent[]> {
  if (!isDbConfigured()) return []
  await ensureDyadTables()
  const pool = getPool()
  const safe = Math.min(Math.max(parseInt(String(limit), 10) || 80, 1), 300)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_EVENTS()} WHERE dyad_id = ? ORDER BY created_at DESC LIMIT ${safe}`,
    [dyadId]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    dyadId: Number(r.dyad_id),
    authorId: r.author_id != null ? Number(r.author_id) : null,
    type: String(r.type ?? 'message'),
    content: r.content ?? null,
    createdAt: String(r.created_at ?? ''),
  }))
}

// ── Fleur de couple évolutive ───────────────────────────────────

/** Persiste la fleur de couple (8 pétales) et journalise le recalcul. */
export async function saveDyadFleur(
  dyadId: number,
  fleur: Record<string, number>
): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  await exec(
    pool,
    `UPDATE ${T_DYADS()} SET fleur_json = ?, fleur_updated_at = NOW() WHERE id = ?`,
    [JSON.stringify(fleur), dyadId]
  )
  await addDyadEvent({ dyadId, type: 'fleur', content: 'Fleur de duo mise à jour' })
}

// ── Rituels relationnels ────────────────────────────────────────

export type DyadRitual = {
  id: number
  dyadId: number
  kind: string
  title: string
  cadenceDays: number
  active: boolean
  lastDoneAt: string | null
  nextDueAt: string | null
}

function mapRitual(r: RowDataPacket): DyadRitual {
  return {
    id: Number(r.id),
    dyadId: Number(r.dyad_id),
    kind: String(r.kind ?? 'weekly'),
    title: String(r.title ?? ''),
    cadenceDays: Number(r.cadence_days ?? 7),
    active: Number(r.active ?? 1) === 1,
    lastDoneAt: r.last_done_at ? String(r.last_done_at) : null,
    nextDueAt: r.next_due_at ? String(r.next_due_at) : null,
  }
}

export async function createRitual(input: {
  dyadId: number
  kind?: string
  title: string
  cadenceDays?: number
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  const cadence = Math.min(Math.max(input.cadenceDays ?? 7, 1), 90)
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_RITUALS()} (dyad_id, kind, title, cadence_days, active, next_due_at)
     VALUES (?, ?, ?, ?, 1, (NOW() + INTERVAL ? DAY))`,
    [input.dyadId, String(input.kind ?? 'weekly').slice(0, 32), String(input.title).slice(0, 160), cadence, cadence]
  )
  return { id: Number((res as ResultSetHeader).insertId) }
}

export async function listRituals(dyadId: number): Promise<DyadRitual[]> {
  if (!isDbConfigured()) return []
  await ensureDyadTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_RITUALS()} WHERE dyad_id = ? ORDER BY active DESC, next_due_at ASC`,
    [dyadId]
  )
  return rows.map(mapRitual)
}

/** Marque un rituel comme accompli : décale la prochaine échéance. */
export async function completeRitual(ritualId: number, dyadId: number): Promise<void> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureDyadTables()
  const pool = getPool()
  await exec(
    pool,
    `UPDATE ${T_RITUALS()}
        SET last_done_at = NOW(), next_due_at = (NOW() + INTERVAL cadence_days DAY)
      WHERE id = ? AND dyad_id = ?`,
    [ritualId, dyadId]
  )
  await addDyadEvent({ dyadId, type: 'ritual', content: 'Rituel accompli' })
}

/** Rituels échus (pour relances). Renvoie les deux membres de chaque dyade concernée. */
export async function findDueRituals(limit = 200): Promise<
  Array<{ ritualId: number; dyadId: number; title: string; userA: number; userB: number | null }>
> {
  if (!isDbConfigured()) return []
  await ensureDyadTables()
  const pool = getPool()
  const safe = Math.min(Math.max(limit, 1), 1000)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id AS ritual_id, r.dyad_id, r.title, d.user_a, d.user_b
       FROM ${T_RITUALS()} r
       JOIN ${T_DYADS()} d ON d.id = r.dyad_id
      WHERE r.active = 1 AND d.status = 'active'
        AND r.next_due_at IS NOT NULL AND r.next_due_at <= NOW()
      LIMIT ${safe}`
  )
  return rows.map((r) => ({
    ritualId: Number(r.ritual_id),
    dyadId: Number(r.dyad_id),
    title: String(r.title ?? ''),
    userA: Number(r.user_a),
    userB: r.user_b != null ? Number(r.user_b) : null,
  }))
}

export type DyadMemberProfile = {
  userId: number
  label: string
  petals: Record<string, number> | null
}

async function getUserPublicLabel(userId: number): Promise<string> {
  if (!isDbConfigured()) return `jardinier_${userId}`
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.user_email, u.display_name,
            COALESCE(um_p.meta_value, '') AS pseudo
     FROM ${tUsers} u
     LEFT JOIN ${tMeta} um_p ON um_p.user_id = u.ID AND um_p.meta_key = 'fleur_pseudo'
     WHERE u.ID = ? LIMIT 1`,
    [userId]
  )
  const r = rows?.[0]
  if (!r) return `jardinier_${userId}`
  const pseudo = String(r.pseudo ?? '').trim()
  const displayName = String(r.display_name ?? '').trim()
  const email = String(r.user_email ?? '').trim()
  if (pseudo) return pseudo
  if (displayName) return displayName
  if (email) return email.split('@')[0] || email
  return `jardinier_${userId}`
}

/** Profils pétales individuels des deux membres (pour affichage Jardin du couple). */
export async function getDyadMemberProfiles(
  userA: number,
  userB: number | null
): Promise<{ memberA: DyadMemberProfile; memberB: DyadMemberProfile | null }> {
  const [labelA, petalsA, labelB, petalsB] = await Promise.all([
    getUserPublicLabel(userA),
    resolveUserPetalsProfile(userA),
    userB != null ? getUserPublicLabel(userB) : Promise.resolve(''),
    userB != null ? resolveUserPetalsProfile(userB) : Promise.resolve(null),
  ])
  return {
    memberA: { userId: userA, label: labelA, petals: petalsA },
    memberB:
      userB != null
        ? { userId: userB, label: labelB, petals: petalsB }
        : null,
  }
}

export { userInDyad }
