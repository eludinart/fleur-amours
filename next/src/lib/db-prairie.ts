/**
 * Grand Jardin (Prairie) — MariaDB.
 * Optimisé : batch queries au lieu de N requêtes par utilisateur (N+1 → 8 requêtes total).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
const PRESENCE_ONLINE_SECONDS = 300

function isOnlineFromLastSeen(lastSeenAt: string): boolean {
  if (!lastSeenAt) return false
  const s = String(lastSeenAt).trim()
  let ts: number
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s + 'Z').getTime()
  } else {
    ts = new Date(s).getTime()
  }
  if (isNaN(ts)) return false
  return (Date.now() - ts) / 1000 <= PRESENCE_ONLINE_SECONDS
}

async function touchSocialPresence(pool: Awaited<ReturnType<typeof getPool>>, userId: number): Promise<void> {
  if (userId <= 0) return
  const now = new Date().toISOString()
  const tbl = table('usermeta')
  // UPSERT pattern: évite SELECT+INSERT/UPDATE séquentiels
  try {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value)
       VALUES (?, 'fleur_social_last_seen_at', ?)
       ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
      [userId, now]
    )
  } catch {
    // Fallback si pas de contrainte UNIQUE sur (user_id, meta_key)
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at'`,
      [userId]
    )
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at'`,
        [now, userId]
      )
    } else {
      await pool.execute(
        `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, 'fleur_social_last_seen_at', ?)`,
        [userId, now]
      )
    }
  }
}

function pseudoFromUser(u: RowDataPacket, uid: number): string {
  const p = u.pseudo ? String(u.pseudo).trim() : ''
  const d = u.display_name ? String(u.display_name).trim() : ''
  return p || d || `jardinier_${Buffer.from(String(uid)).toString('hex').slice(0, 6)}`
}

function ph(n: number) { return Array(n).fill('?').join(',') }

export async function getFleurs(
  userId: string
): Promise<{ fleurs: Array<Record<string, unknown>>; me_fleur: Record<string, unknown> | null; links: Array<{ user_a: number; user_b: number }> }> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id required')

  // Requête 1 : touch presence (fire-and-forget, non bloquante pour la suite)
  const presencePromise = touchSocialPresence(pool, uid)

  const tMeta  = table('usermeta')
  const tRes   = table('fleur_amour_results')
  const tSess  = table('fleur_sessions')
  const tTarot = table('fleur_tarot_readings')
  const tUsers = table('users')
  const tRosee  = table('fleur_rosee_events')
  const tPollen = table('fleur_pollen')

  const userCols = `u.ID, u.user_email, u.display_name,
    COALESCE(um_pseudo.meta_value, '') AS pseudo,
    COALESCE(um_emoji.meta_value, '🌸') AS avatar_emoji,
    COALESCE(um_graine.meta_value, '') AS avatar_graine_id`

  // Requête 2 : tous les utilisateurs publics (sauf moi) + moi — 2 requêtes parallèles
  const [usersResult, meResult] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT ${userCols}
       FROM ${tUsers} u
       INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
       LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} um_emoji  ON um_emoji.user_id  = u.ID AND um_emoji.meta_key  = 'fleur_avatar_emoji'
       LEFT JOIN ${tMeta} um_graine ON um_graine.user_id = u.ID AND um_graine.meta_key = 'fleur_avatar_graine_id'
       WHERE u.ID != ?`,
      [uid]
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT ${userCols}
       FROM ${tUsers} u
       INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
       LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} um_emoji  ON um_emoji.user_id  = u.ID AND um_emoji.meta_key  = 'fleur_avatar_emoji'
       LEFT JOIN ${tMeta} um_graine ON um_graine.user_id = u.ID AND um_graine.meta_key = 'fleur_avatar_graine_id'
       WHERE u.ID = ?`,
      [uid]
    ),
  ])
  const users = usersResult[0]
  const uMe   = meResult[0][0] ?? null

  const allUsers = uMe ? [...users, uMe] : users
  const allIds   = allUsers.map(u => Number(u.ID))
  const allEmails = allUsers.map(u => String(u.user_email ?? '').trim()).filter(Boolean)

  if (allIds.length === 0) {
    await presencePromise
    return { fleurs: [], me_fleur: null, links: [] }
  }

  // ── Batch queries (toutes parallèles) ─────────────────────────────────────

  // Requête 3 : derniers scores Fleur par user_id
  const fleurResultsPromise = pool.execute<RowDataPacket[]>(
    `SELECT r.user_id, r.agape, r.philautia, r.mania, r.storge, r.pragma, r.philia, r.ludus, r.eros, r.created_at
     FROM ${tRes} r
     INNER JOIN (
       SELECT user_id, MAX(created_at) AS max_at
       FROM ${tRes}
       WHERE parent_id IS NULL AND user_id IN (${ph(allIds.length)})
       GROUP BY user_id
     ) latest ON r.user_id = latest.user_id AND r.created_at = latest.max_at
     WHERE r.parent_id IS NULL`,
    allIds
  )

  // Requête 4 : dernière session par email
  const sessionsPromise = allEmails.length > 0
    ? pool.execute<RowDataPacket[]>(
        `SELECT email, MAX(created_at) AS mx FROM ${tSess} WHERE email IN (${ph(allEmails.length)}) GROUP BY email`,
        allEmails
      )
    : Promise.resolve([[] as RowDataPacket[], [] as any] as [RowDataPacket[], any])

  // Requête 5 : dernier tirage tarot par user_id
  const tarotPromise = pool.execute<RowDataPacket[]>(
    `SELECT user_id, MAX(created_at) AS mx FROM ${tTarot} WHERE user_id IN (${ph(allIds.length)}) GROUP BY user_id`,
    allIds
  )

  // Requête 6 : stats rosée
  const roseePromise = pool.execute<RowDataPacket[]>(
    `SELECT to_user_id,
       COUNT(*) AS total,
       SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today
     FROM ${tRosee} WHERE to_user_id IN (${ph(allIds.length)}) GROUP BY to_user_id`,
    allIds
  ).catch(() => [[] as RowDataPacket[], [] as any] as [RowDataPacket[], any])

  // Requête 7 : stats pollen
  const pollenPromise = pool.execute<RowDataPacket[]>(
    `SELECT to_user_id,
       COUNT(*) AS total,
       SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today
     FROM ${tPollen} WHERE to_user_id IN (${ph(allIds.length)}) GROUP BY to_user_id`,
    allIds
  ).catch(() => [[] as RowDataPacket[], [] as any] as [RowDataPacket[], any])

  // Requête 8 : présence
  const presenceBatchPromise = pool.execute<RowDataPacket[]>(
    `SELECT user_id, meta_value FROM ${tMeta}
     WHERE user_id IN (${ph(allIds.length)}) AND meta_key = 'fleur_social_last_seen_at'`,
    allIds
  )

  // Attendre tout en parallèle
  const [
    [fleurRows],
    [sessionRows],
    [tarotRows],
    [roseeRows],
    [pollenRows],
    [presenceRows],
  ] = await Promise.all([
    fleurResultsPromise,
    sessionsPromise,
    tarotPromise,
    roseePromise,
    pollenPromise,
    presenceBatchPromise,
  ])

  // ── Index en mémoire (O(1) lookup) ────────────────────────────────────────

  const fleurByUser = new Map<number, RowDataPacket>()
  for (const r of fleurRows) fleurByUser.set(Number(r.user_id), r)

  const sessionByEmail = new Map<string, string>()
  for (const r of sessionRows) if (r.email) sessionByEmail.set(String(r.email).trim(), String(r.mx ?? ''))

  const tarotByUser = new Map<number, string>()
  for (const r of tarotRows) tarotByUser.set(Number(r.user_id), String(r.mx ?? ''))

  const roseeByUser = new Map<number, { total: number; today: number }>()
  for (const r of roseeRows) roseeByUser.set(Number(r.to_user_id), { total: Number(r.total ?? 0), today: Number(r.today ?? 0) })

  const pollenByUser = new Map<number, { total: number; today: number }>()
  for (const r of pollenRows) pollenByUser.set(Number(r.to_user_id), { total: Number(r.total ?? 0), today: Number(r.today ?? 0) })

  const presenceByUser = new Map<number, { is_online: boolean; last_seen_at: string | null }>()
  for (const r of presenceRows) {
    const v = String(r.meta_value ?? '').trim()
    presenceByUser.set(Number(r.user_id), { is_online: v ? isOnlineFromLastSeen(v) : false, last_seen_at: v || null })
  }

  // ── Assembler les fleurs (pure mémoire, 0 requête DB) ─────────────────────

  function buildFleur(u: RowDataPacket, oid: number, isMe: boolean): Record<string, unknown> {
    const scores: Record<string, number> = { agape: 0, philautia: 0, mania: 0, storge: 0, pragma: 0, philia: 0, ludus: 0, eros: 0 }
    let lastActivity: string | null = null

    const rRow = fleurByUser.get(oid)
    if (rRow) {
      for (const p of PETALS) scores[p] = Number(rRow[p] ?? 0)
      lastActivity = rRow.created_at ? String(rRow.created_at) : null
    }

    const email = String(u.user_email ?? '').trim()
    const sAt = email ? sessionByEmail.get(email) : undefined
    if (sAt && (!lastActivity || new Date(sAt) > new Date(lastActivity))) lastActivity = sAt

    const tAt = tarotByUser.get(oid)
    if (tAt && (!lastActivity || new Date(tAt) > new Date(lastActivity))) lastActivity = tAt

    const rosee  = roseeByUser.get(oid)  ?? { total: 0, today: 0 }
    const pollen = pollenByUser.get(oid) ?? { total: 0, today: 0 }

    return {
      id: isMe ? 'p_me' : `p_${oid}`,
      user_id: oid,
      pseudo: pseudoFromUser(u, oid),
      avatar_emoji: (u.avatar_emoji && String(u.avatar_emoji).trim()) || '🌸',
      avatar_graine_id: (u.avatar_graine_id && String(u.avatar_graine_id).trim()) || null,
      scores,
      last_activity_at: lastActivity,
      position: isMe ? { x: 0.5, y: 0.5 } : {
        x: ((oid * 2654435761) % 1000) / 1000,
        y: ((oid * 1597334677) % 1000) / 1000,
      },
      ...(isMe ? { is_me: true } : {}),
      social: {
        rosee_received_total: rosee.total,
        rosee_received_today: rosee.today,
        pollen_received_total: pollen.total,
        pollen_received_today: pollen.today,
      },
      presence: presenceByUser.get(oid) ?? { is_online: false, last_seen_at: null },
    }
  }

  const fleurs: Array<Record<string, unknown>> = users.map(u => buildFleur(u, Number(u.ID), false))
  const me_fleur: Record<string, unknown> | null = uMe ? buildFleur(uMe, uid, true) : null

  // ── Liens (déjà en batch) ─────────────────────────────────────────────────

  const visibleIds = users.map(u => Number(u.ID))
  const visibleIdsWithMe = visibleIds.includes(uid) ? visibleIds : [...visibleIds, uid]
  const seen = new Set<string>()
  const links: Array<{ user_a: number; user_b: number }> = []

  if (visibleIdsWithMe.length > 0) {
    const placeholders = ph(visibleIdsWithMe.length)
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
        const a = Number(row.user_a), b = Number(row.user_b)
        if (a > 0 && b > 0 && a !== b) {
          const key = `${Math.min(a,b)}-${Math.max(a,b)}`
          if (!seen.has(key)) { links.push({ user_a: a, user_b: b }); seen.add(key) }
        }
      }
    } catch { /* ignore */ }

    try {
      const tLinks = table('fleur_prairie_links')
      const [plRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_a, user_b FROM ${tLinks} WHERE user_a IN (${placeholders}) AND user_b IN (${placeholders})`,
        params
      )
      for (const row of plRows) {
        const a = Number(row.user_a), b = Number(row.user_b)
        const key = `${Math.min(a,b)}-${Math.max(a,b)}`
        if (!seen.has(key)) { links.push({ user_a: a, user_b: b }); seen.add(key) }
      }
    } catch { /* table may not exist */ }
  }

  await presencePromise
  return { fleurs, me_fleur, links }
}
