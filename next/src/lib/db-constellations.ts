/**
 * Constellations — groupes éphémères 3–5 jardiniers, fleur de groupe, chat léger.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomBytes } from 'crypto'
import { getPool, table } from './db'
import { PETAL_IDS } from './grand-jardin-view'

const VALID_PETALS = new Set<string>(PETAL_IDS)
const MAX_MEMBERS = 5
const TTL_DAYS = 7
const MAX_MSG = 400
const MAX_ACTIVE_PER_USER = 3

let _ensureConstellationPromise: Promise<void> | null = null

function generateToken(): string {
  return randomBytes(9).toString('hex')
}

async function ensureConstellationTables(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureConstellationPromise) {
    const tC = table('fleur_constellations')
    const tM = table('fleur_constellation_members')
    const tMsg = table('fleur_constellation_messages')
    _ensureConstellationPromise = Promise.all([
      pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tC} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          token VARCHAR(32) NOT NULL,
          creator_id INT NOT NULL,
          title VARCHAR(120) DEFAULT NULL,
          petal_id VARCHAR(20) DEFAULT NULL,
          expires_at DATETIME NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_token (token),
          INDEX idx_expires (expires_at, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `),
      pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tM} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          constellation_id INT NOT NULL,
          user_id INT NOT NULL,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_member (constellation_id, user_id),
          INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `),
      pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tMsg} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          constellation_id INT NOT NULL,
          sender_id INT NOT NULL,
          body VARCHAR(500) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_const (constellation_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `),
    ])
      .then(() => undefined)
      .catch(() => {
        _ensureConstellationPromise = null
      })
  }
  return _ensureConstellationPromise
}

async function expireOldConstellations(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const tC = table('fleur_constellations')
  try {
    await pool.execute(
      `UPDATE ${tC} SET status = 'expired' WHERE status != 'expired' AND expires_at < NOW()`
    )
  } catch {
    /* ignore */
  }
}

async function countActiveConstellationsForUser(
  pool: Awaited<ReturnType<typeof getPool>>,
  userId: number
): Promise<number> {
  const tC = table('fleur_constellations')
  const tM = table('fleur_constellation_members')
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${tM} m
       INNER JOIN ${tC} c ON c.id = m.constellation_id
       WHERE m.user_id = ? AND c.status IN ('open', 'full') AND c.expires_at > NOW()`,
      [userId]
    )
    return Number(r?.[0]?.c ?? 0)
  } catch {
    return 0
  }
}

async function loadMemberProfiles(
  pool: Awaited<ReturnType<typeof getPool>>,
  memberIds: number[]
): Promise<
  Array<{
    userId: number
    pseudo: string
    avatarEmoji: string
    scores: Record<string, number>
  }>
> {
  if (!memberIds.length) return []
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tRes = table('fleur_amour_results')
  const placeholders = memberIds.map(() => '?').join(',')
  const profileById = new Map<number, { pseudo: string; avatarEmoji: string; displayName: string }>()
  try {
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID, u.display_name,
              COALESCE(ump.meta_value, '') AS pseudo,
              COALESCE(ume.meta_value, '🌸') AS avatar_emoji
       FROM ${tUsers} u
       LEFT JOIN ${tMeta} ump ON ump.user_id = u.ID AND ump.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} ume ON ume.user_id = u.ID AND ume.meta_key = 'fleur_avatar_emoji'
       WHERE u.ID IN (${placeholders})`,
      memberIds
    )
    for (const r of uRows) {
      profileById.set(Number(r.ID), {
        pseudo: String(r.pseudo ?? '').trim(),
        avatarEmoji: String(r.avatar_emoji ?? '🌸').trim() || '🌸',
        displayName: String(r.display_name ?? '').trim(),
      })
    }
  } catch {
    /* ignore */
  }

  const scoresById = new Map<number, Record<string, number>>()
  try {
    const [resRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id, agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at
       FROM ${tRes}
       WHERE user_id IN (${placeholders}) AND (parent_id IS NULL OR parent_id = 0)
       ORDER BY created_at DESC`,
      memberIds
    )
    for (const r of resRows) {
      const uid = Number(r.user_id)
      if (scoresById.has(uid)) continue
      scoresById.set(
        uid,
        Object.fromEntries(PETAL_IDS.map((p) => [p, Number(r[p] ?? 0)]))
      )
    }
  } catch {
    /* ignore */
  }

  return memberIds.map((id) => {
    const prof = profileById.get(id)
    const pseudo =
      prof?.pseudo ||
      prof?.displayName ||
      `jardinier_${Buffer.from(String(id)).toString('hex').slice(0, 6)}`
    return {
      userId: id,
      pseudo,
      avatarEmoji: prof?.avatarEmoji ?? '🌸',
      scores: scoresById.get(id) ?? Object.fromEntries(PETAL_IDS.map((p) => [p, 0])),
    }
  })
}

function computeGroupScores(
  members: Array<{ scores: Record<string, number> }>
): Record<string, number> {
  if (!members.length) return Object.fromEntries(PETAL_IDS.map((p) => [p, 0]))
  const totals = Object.fromEntries(PETAL_IDS.map((p) => [p, 0])) as Record<string, number>
  for (const m of members) {
    for (const p of PETAL_IDS) totals[p] += Number(m.scores[p] ?? 0)
  }
  const n = members.length
  return Object.fromEntries(PETAL_IDS.map((p) => [p, Math.round((totals[p] / n) * 10) / 10]))
}

export type ConstellationSummary = {
  id: number
  token: string
  title: string | null
  petalId: string | null
  status: string
  expiresAt: string
  memberCount: number
  maxMembers: number
  isMember: boolean
  inviteUrl: string
}

export type ConstellationDetail = ConstellationSummary & {
  members: Array<{
    userId: number
    pseudo: string
    avatarEmoji: string
    scores: Record<string, number>
  }>
  groupScores: Record<string, number>
  messages: Array<{ id: number; senderId: number; senderPseudo: string; body: string; createdAt: string }>
}

export async function createConstellation(
  creatorId: number,
  opts: { title?: string; petalId?: string | null }
): Promise<ConstellationDetail> {
  const pool = getPool()
  await ensureConstellationTables(pool)
  await expireOldConstellations(pool)

  const active = await countActiveConstellationsForUser(pool, creatorId)
  if (active >= MAX_ACTIVE_PER_USER) {
    const err = new Error('Tu participes déjà à 3 constellations actives.') as Error & { code?: string }
    err.code = 'constellation_limit'
    throw err
  }

  const petalId = opts.petalId && VALID_PETALS.has(opts.petalId) ? opts.petalId : null
  const title = opts.title ? String(opts.title).trim().slice(0, 120) : null
  const token = generateToken()
  const tC = table('fleur_constellations')
  const tM = table('fleur_constellation_members')

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tC} (token, creator_id, title, petal_id, expires_at, status)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${TTL_DAYS} DAY), 'open')`,
    [token, creatorId, title, petalId]
  )
  const constellationId = Number(result.insertId)
  await pool.execute(
    `INSERT INTO ${tM} (constellation_id, user_id) VALUES (?, ?)`,
    [constellationId, creatorId]
  )

  return (await getConstellationByToken(token, creatorId))!
}

export async function joinConstellation(userId: number, token: string): Promise<ConstellationDetail> {
  const pool = getPool()
  await ensureConstellationTables(pool)
  await expireOldConstellations(pool)

  const tC = table('fleur_constellations')
  const tM = table('fleur_constellation_members')
  const tok = String(token ?? '').trim()
  if (!tok) throw new Error('Token requis')

  const [cRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, status, expires_at FROM ${tC} WHERE token = ? LIMIT 1`,
    [tok]
  )
  const c = cRows?.[0]
  if (!c) throw new Error('Constellation introuvable')
  if (String(c.status) === 'expired' || new Date(String(c.expires_at)) < new Date()) {
    throw new Error('Cette constellation a expiré.')
  }

  const constellationId = Number(c.id)
  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tM} WHERE constellation_id = ?`,
    [constellationId]
  )
  const memberIds = (memberRows ?? []).map((r) => Number(r.user_id))
  if (memberIds.includes(userId)) {
    return (await getConstellationByToken(tok, userId))!
  }
  if (memberIds.length >= MAX_MEMBERS) {
    const err = new Error('Constellation complète (5 jardiniers max).') as Error & { code?: string }
    err.code = 'constellation_full'
    throw err
  }

  const active = await countActiveConstellationsForUser(pool, userId)
  if (active >= MAX_ACTIVE_PER_USER) {
    const err = new Error('Tu participes déjà à 3 constellations actives.') as Error & { code?: string }
    err.code = 'constellation_limit'
    throw err
  }

  await pool.execute(`INSERT INTO ${tM} (constellation_id, user_id) VALUES (?, ?)`, [
    constellationId,
    userId,
  ])

  const newCount = memberIds.length + 1
  if (newCount >= MAX_MEMBERS) {
    await pool.execute(`UPDATE ${tC} SET status = 'full' WHERE id = ?`, [constellationId])
  }

  return (await getConstellationByToken(tok, userId))!
}

export async function listMyConstellations(userId: number): Promise<ConstellationSummary[]> {
  const pool = getPool()
  await ensureConstellationTables(pool)
  await expireOldConstellations(pool)

  const tC = table('fleur_constellations')
  const tM = table('fleur_constellation_members')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id, c.token, c.title, c.petal_id, c.status, c.expires_at,
              (SELECT COUNT(*) FROM ${tM} m2 WHERE m2.constellation_id = c.id) AS member_count
       FROM ${tC} c
       INNER JOIN ${tM} m ON m.constellation_id = c.id AND m.user_id = ?
       WHERE c.status IN ('open', 'full') AND c.expires_at > NOW()
       ORDER BY c.expires_at ASC`,
      [userId]
    )
    return (rows ?? []).map((r) => ({
      id: Number(r.id),
      token: String(r.token),
      title: r.title ? String(r.title) : null,
      petalId: r.petal_id ? String(r.petal_id) : null,
      status: String(r.status),
      expiresAt: String(r.expires_at ?? ''),
      memberCount: Number(r.member_count ?? 0),
      maxMembers: MAX_MEMBERS,
      isMember: true,
      inviteUrl: `/constellation/${String(r.token)}`,
    }))
  } catch {
    return []
  }
}

export async function getConstellationByToken(
  token: string,
  viewerId: number
): Promise<ConstellationDetail | null> {
  const pool = getPool()
  await ensureConstellationTables(pool)
  await expireOldConstellations(pool)

  const tC = table('fleur_constellations')
  const tM = table('fleur_constellation_members')
  const tMsg = table('fleur_constellation_messages')
  const tok = String(token ?? '').trim()

  const [cRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, token, title, petal_id, status, expires_at, creator_id FROM ${tC} WHERE token = ? LIMIT 1`,
    [tok]
  )
  const c = cRows?.[0]
  if (!c) return null

  const constellationId = Number(c.id)
  const [memberRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${tM} WHERE constellation_id = ? ORDER BY joined_at ASC`,
    [constellationId]
  )
  const memberIds = (memberRows ?? []).map((r) => Number(r.user_id))
  const isMember = memberIds.includes(viewerId)
  const members = await loadMemberProfiles(pool, memberIds)
  const groupScores = computeGroupScores(members)

  let messages: ConstellationDetail['messages'] = []
  if (isMember) {
    try {
      const [msgRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, sender_id, body, created_at FROM ${tMsg}
         WHERE constellation_id = ? ORDER BY created_at DESC LIMIT 40`,
        [constellationId]
      )
      const pseudoById = new Map(members.map((m) => [m.userId, m.pseudo]))
      messages = (msgRows ?? [])
        .reverse()
        .map((r) => ({
          id: Number(r.id),
          senderId: Number(r.sender_id),
          senderPseudo: pseudoById.get(Number(r.sender_id)) ?? 'Jardinier',
          body: String(r.body),
          createdAt: String(r.created_at ?? ''),
        }))
    } catch {
      /* ignore */
    }
  }

  return {
    id: constellationId,
    token: String(c.token),
    title: c.title ? String(c.title) : null,
    petalId: c.petal_id ? String(c.petal_id) : null,
    status: String(c.status),
    expiresAt: String(c.expires_at ?? ''),
    memberCount: memberIds.length,
    maxMembers: MAX_MEMBERS,
    isMember,
    inviteUrl: `/constellation/${String(c.token)}`,
    members,
    groupScores,
    messages,
  }
}

export async function postConstellationMessage(
  userId: number,
  token: string,
  body: string
): Promise<{ id: number; createdAt: string }> {
  const pool = getPool()
  await ensureConstellationTables(pool)
  const detail = await getConstellationByToken(token, userId)
  if (!detail) throw new Error('Constellation introuvable')
  if (!detail.isMember) throw new Error('Accès non autorisé')
  if (detail.status === 'expired') throw new Error('Constellation expirée')

  const text = String(body ?? '').trim().slice(0, MAX_MSG)
  if (text.length < 1) throw new Error('Message vide')

  const tMsg = table('fleur_constellation_messages')
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tMsg} (constellation_id, sender_id, body) VALUES (?, ?, ?)`,
    [detail.id, userId, text]
  )
  return { id: Number(result.insertId), createdAt: new Date().toISOString() }
}
