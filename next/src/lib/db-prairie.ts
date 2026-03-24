/**
 * Grand Jardin (Prairie) — MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
const PRESENCE_ONLINE_SECONDS = 300

function isOnlineFromLastSeen(lastSeenAt: string): boolean {
  if (!lastSeenAt) return false
  const normalized = String(lastSeenAt).trim().replace(' ', 'T')
  const ts = new Date(normalized).getTime()
  if (isNaN(ts)) return false
  return (Date.now() - ts) / 1000 <= PRESENCE_ONLINE_SECONDS
}

async function touchSocialPresence(pool: Awaited<ReturnType<typeof getPool>>, userId: number): Promise<void> {
  if (userId <= 0) return
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at'`,
    [userId]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at'`, [
      now,
      userId,
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, 'fleur_social_last_seen_at', ?)`,
      [userId, now]
    )
  }
}

async function socialStatsFor(
  pool: Awaited<ReturnType<typeof getPool>>,
  uid: number
): Promise<{ rosee_received_total: number; rosee_received_today: number; pollen_received_total: number; pollen_received_today: number }> {
  const tRosee = table('fleur_rosee_events')
  const tPollen = table('fleur_pollen')
  const out = { rosee_received_total: 0, rosee_received_today: 0, pollen_received_total: 0, pollen_received_today: 0 }
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) AS today FROM ${tRosee} WHERE to_user_id = ?`,
      [uid]
    )
    if (r[0]) {
      out.rosee_received_total = Number(r[0].total ?? 0)
      out.rosee_received_today = Number(r[0].today ?? 0)
    }
  } catch {
    /* table may not exist */
  }
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) AS today FROM ${tPollen} WHERE to_user_id = ?`,
      [uid]
    )
    if (r[0]) {
      out.pollen_received_total = Number(r[0].total ?? 0)
      out.pollen_received_today = Number(r[0].today ?? 0)
    }
  } catch {
    /* table may not exist */
  }
  return out
}

async function presenceFor(
  pool: Awaited<ReturnType<typeof getPool>>,
  uid: number
): Promise<{ is_online: boolean; last_seen_at: string | null }> {
  const tbl = table('usermeta')
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tbl} WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at' LIMIT 1`,
      [uid]
    )
    const v = r[0]?.meta_value ? String(r[0].meta_value).trim() : ''
    return {
      is_online: v ? isOnlineFromLastSeen(v) : false,
      last_seen_at: v || null,
    }
  } catch {
    return { is_online: false, last_seen_at: null }
  }
}

function pseudoFromUser(u: RowDataPacket, uid: number): string {
  const p = u.pseudo ? String(u.pseudo).trim() : ''
  const d = u.display_name ? String(u.display_name).trim() : ''
  return p || d || `jardinier_${Buffer.from(String(uid)).toString('hex').slice(0, 6)}`
}

export async function getFleurs(
  userId: string
): Promise<{ fleurs: Array<Record<string, unknown>>; me_fleur: Record<string, unknown> | null; links: Array<{ user_a: number; user_b: number }> }> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id required')

  await touchSocialPresence(pool, uid)

  const tMeta = table('usermeta')
  const tRes = table('fleur_amour_results')
  const tSess = table('fleur_sessions')
  const tTarot = table('fleur_tarot_readings')
  const tUsers = table('users')

  const userCols = `u.ID, u.user_email, u.display_name,
    COALESCE(um_pseudo.meta_value, '') AS pseudo,
    COALESCE(um_emoji.meta_value, '🌸') AS avatar_emoji,
    COALESCE(um_graine.meta_value, '') AS avatar_graine_id`

  const [users] = await pool.execute<RowDataPacket[]>(
    `SELECT ${userCols}
     FROM ${tUsers} u
     INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
     LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
     LEFT JOIN ${tMeta} um_emoji ON um_emoji.user_id = u.ID AND um_emoji.meta_key = 'fleur_avatar_emoji'
     LEFT JOIN ${tMeta} um_graine ON um_graine.user_id = u.ID AND um_graine.meta_key = 'fleur_avatar_graine_id'
     WHERE u.ID != ?`,
    [uid]
  )

  let meFleur: Record<string, unknown> | null = null
  const [meRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${userCols}
     FROM ${tUsers} u
     INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
     LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
     LEFT JOIN ${tMeta} um_emoji ON um_emoji.user_id = u.ID AND um_emoji.meta_key = 'fleur_avatar_emoji'
     LEFT JOIN ${tMeta} um_graine ON um_graine.user_id = u.ID AND um_graine.meta_key = 'fleur_avatar_graine_id'
     WHERE u.ID = ?`,
    [uid]
  )
  const uMe = meRows[0]
  if (uMe) {
    const scores: Record<string, number> = { agape: 0, philautia: 0, mania: 0, storge: 0, pragma: 0, philia: 0, ludus: 0, eros: 0 }
    let lastActivity: string | null = null
    const [rRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at FROM ${tRes} WHERE user_id = ? AND parent_id IS NULL ORDER BY created_at DESC LIMIT 1`,
      [uid]
    )
    const rRow = rRows[0]
    if (rRow) {
      for (const p of PETALS) scores[p] = Number(rRow[p] ?? 0)
      lastActivity = rRow.created_at ? String(rRow.created_at) : null
    }
    const userEmail = String(uMe.user_email ?? '').trim()
    if (userEmail) {
      const [sRows] = await pool.execute<RowDataPacket[]>(`SELECT MAX(created_at) AS mx FROM ${tSess} WHERE email = ?`, [
        userEmail,
      ])
      const sAt = sRows[0]?.mx
      if (sAt && (!lastActivity || new Date(String(sAt)) > new Date(lastActivity))) lastActivity = String(sAt)
    }
    const [tRows] = await pool.execute<RowDataPacket[]>(
      `SELECT MAX(created_at) AS mx FROM ${tTarot} WHERE user_id = ?`,
      [uid]
    )
    const tAt = tRows[0]?.mx
    if (tAt && (!lastActivity || new Date(String(tAt)) > new Date(lastActivity))) lastActivity = String(tAt)

    meFleur = {
      id: 'p_me',
      user_id: uid,
      pseudo: pseudoFromUser(uMe, uid),
      avatar_emoji: (uMe.avatar_emoji && String(uMe.avatar_emoji).trim()) || '🌸',
      avatar_graine_id: (uMe.avatar_graine_id && String(uMe.avatar_graine_id).trim()) || null,
      scores,
      last_activity_at: lastActivity,
      position: { x: 0.5, y: 0.5 },
      is_me: true,
      social: await socialStatsFor(pool, uid),
      presence: await presenceFor(pool, uid),
    }
  }

  const fleurs: Array<Record<string, unknown>> = []
  for (const u of users) {
    const oid = Number(u.ID)
    const scores: Record<string, number> = { agape: 0, philautia: 0, mania: 0, storge: 0, pragma: 0, philia: 0, ludus: 0, eros: 0 }
    let lastActivity: string | null = null
    const [rRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at FROM ${tRes} WHERE user_id = ? AND parent_id IS NULL ORDER BY created_at DESC LIMIT 1`,
      [oid]
    )
    const rRow = rRows[0]
    if (rRow) {
      for (const p of PETALS) scores[p] = Number(rRow[p] ?? 0)
      lastActivity = rRow.created_at ? String(rRow.created_at) : null
    }
    const userEmail = String(u.user_email ?? '').trim()
    if (userEmail) {
      const [sRows] = await pool.execute<RowDataPacket[]>(`SELECT MAX(created_at) AS mx FROM ${tSess} WHERE email = ?`, [
        userEmail,
      ])
      const sAt = sRows[0]?.mx
      if (sAt && (!lastActivity || new Date(String(sAt)) > new Date(lastActivity))) lastActivity = String(sAt)
    }
    const [tRows] = await pool.execute<RowDataPacket[]>(
      `SELECT MAX(created_at) AS mx FROM ${tTarot} WHERE user_id = ?`,
      [oid]
    )
    const tAt = tRows[0]?.mx
    if (tAt && (!lastActivity || new Date(String(tAt)) > new Date(lastActivity))) lastActivity = String(tAt)

    const px = ((oid * 2654435761) % 1000) / 1000
    const py = ((oid * 1597334677) % 1000) / 1000
    fleurs.push({
      id: `p_${oid}`,
      user_id: oid,
      pseudo: pseudoFromUser(u, oid),
      avatar_emoji: (u.avatar_emoji && String(u.avatar_emoji).trim()) || '🌸',
      avatar_graine_id: (u.avatar_graine_id && String(u.avatar_graine_id).trim()) || null,
      scores,
      last_activity_at: lastActivity,
      position: { x: px, y: py },
      social: await socialStatsFor(pool, oid),
      presence: await presenceFor(pool, oid),
    })
  }

  const visibleIds = users.map((u) => Number(u.ID))
  const visibleIdsWithMe = visibleIds.includes(uid) ? visibleIds : [...visibleIds, uid]
  let links: Array<{ user_a: number; user_b: number }> = []
  const seen = new Set<string>()

  if (visibleIdsWithMe.length > 0) {
    const placeholders = visibleIdsWithMe.map(() => '?').join(',')
    const params = [...visibleIdsWithMe, ...visibleIdsWithMe]
    try {
      const [linkRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT COALESCE(p.user_id, 0) AS user_a, COALESCE(c.user_id, 0) AS user_b
         FROM ${tRes} p
         INNER JOIN ${tRes} c ON c.parent_id = p.id AND c.user_id IS NOT NULL AND c.user_id != ''
         WHERE p.parent_id IS NULL AND p.user_id IS NOT NULL AND p.user_id != ''
           AND p.user_id IN (${placeholders}) AND c.user_id IN (${placeholders})
           AND p.user_id < c.user_id`,
        params
      )
      for (const row of linkRows) {
        const a = Number(row.user_a)
        const b = Number(row.user_b)
        if (a > 0 && b > 0 && a !== b) {
          const key = a < b ? `${a}-${b}` : `${b}-${a}`
          if (!seen.has(key)) {
            links.push({ user_a: a, user_b: b })
            seen.add(key)
          }
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const tLinks = table('fleur_prairie_links')
      const placeholders2 = visibleIdsWithMe.map(() => '?').join(',')
      const params2 = [...visibleIdsWithMe, ...visibleIdsWithMe]
      const [plRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_a, user_b FROM ${tLinks} WHERE user_a IN (${placeholders2}) AND user_b IN (${placeholders2})`,
        params2
      )
      for (const row of plRows) {
        const a = Number(row.user_a)
        const b = Number(row.user_b)
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`
        if (!seen.has(key)) {
          links.push({ user_a: a, user_b: b })
          seen.add(key)
        }
      }
    } catch {
      /* table may not exist */
    }
  }

  return { fleurs, me_fleur: meFleur, links }
}
