/**
 * La Clairière (social / canaux chat) — MariaDB.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, table } from './db'
import { resonanceBetween, complementarityBetween, weakestPetals } from './grand-jardin-view'
import { buildLisierePublicProfile } from './lisiere-profile'
import { getSocialMeteo } from './community-meteo'
import { fetchMaturityStats, computeMaturityBadges, fetchMaturityStatsBatch, type MaturityBadgeId } from './community-maturity'
import { CLAIRIERE_REACTION_EMOJIS, type MessageReactionSummary } from './clairiere-reactions'

const PRESENCE_ONLINE_SECONDS = 300

function isOnlineFromLastSeen(lastSeenAt: string): boolean {
  if (!lastSeenAt) return false
  const s = String(lastSeenAt).trim()
  let ts: number
  // Stored format from our code: 'YYYY-MM-DD HH:mm:ss' (UTC without timezone marker)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    // Some environments may store ISO without timezone marker
    ts = new Date(s + 'Z').getTime()
  } else {
    ts = new Date(s).getTime()
  }
  if (isNaN(ts)) return false
  return (Date.now() - ts) / 1000 <= PRESENCE_ONLINE_SECONDS
}

async function touchSocialPresence(pool: Awaited<ReturnType<typeof getPool>>, userId: number): Promise<void> {
  if (userId <= 0) return
  // Persist with timezone marker to avoid server timezone issues.
  const now = new Date().toISOString()
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

/** Heartbeat navigateur (Layout) : met à jour la présence pour La Clairière, la Prairie et le chat coach. */
export async function recordSocialPresenceHeartbeat(userId: number): Promise<void> {
  const pool = getPool()
  await touchSocialPresence(pool, userId)
}

/** Récupère les canaux de dialogue (La Clairière) de l'utilisateur */
export async function getMyChannels(
  userId: string
): Promise<{
  channels: Array<{
    channelId: number
    otherUserId: number
    otherPseudo: string
    otherIsOnline: boolean
    otherLastSeenAt: string | null
    unreadCount: number
  }>
}> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')

  await touchSocialPresence(pool, uid)

  const tChannels = table('fleur_chat_channels')
  const tLinks = table('fleur_prairie_links')
  const tMeta = table('usermeta')
  const tUsers = table('users')

  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tChannels} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a INT NOT NULL,
        user_b INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pair (user_a, user_b),
        CHECK (user_a < user_b)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* table exists */
  }

  try {
    const [linkRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_a, user_b FROM ${tLinks} WHERE user_a = ? OR user_b = ?`,
      [uid, uid]
    )
    for (const row of linkRows) {
      let ua = Number(row.user_a)
      let ub = Number(row.user_b)
      if (ua > 0 && ub > 0 && ua !== ub) {
        if (ua > ub) {
          const tmp = ua
          ua = ub
          ub = tmp
        }
        await pool.execute(`INSERT IGNORE INTO ${tChannels} (user_a, user_b) VALUES (?, ?)`, [ua, ub])
      }
    }
  } catch {
    /* table may not exist */
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_a, user_b FROM ${tChannels} WHERE user_a = ? OR user_b = ?`,
    [uid, uid]
  )

  const t = table(P2P_MESSAGES_TABLE)
  await ensureMessagesTable(pool)

  const list: Array<{
    channelId: number
    otherUserId: number
    otherPseudo: string
    otherIsOnline: boolean
    otherLastSeenAt: string | null
    unreadCount: number
  }> = []

  for (const r of rows) {
    const otherId = Number(r.user_a) === uid ? Number(r.user_b) : Number(r.user_a)
    const [uRows] = await pool.execute<RowDataPacket[]>(`SELECT display_name FROM ${tUsers} WHERE ID = ?`, [otherId])
    const u = uRows[0]
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_pseudo'`,
      [otherId]
    )
    const p = pRows[0]
    const pseudo =
      (p && String(p.meta_value ?? '').trim()) ||
      (u && String(u.display_name ?? '').trim()) ||
      `jardinier_${Buffer.from(String(otherId)).toString('hex').slice(0, 6)}`
    const [seenRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at' LIMIT 1`,
      [otherId]
    )
    const lastSeenAt = seenRows[0]?.meta_value ? String(seenRows[0].meta_value).trim() : ''
    const channelId = Number(r.id)
    const [readMetaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
      [uid, `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`]
    )
    const lastReadAt = readMetaRows?.[0]?.meta_value ? String(readMetaRows[0].meta_value).trim() : null
    let unreadCount = 0
    if (lastReadAt) {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ? AND created_at > ?`,
        [channelId, otherId, lastReadAt]
      )
      unreadCount = Number(cRows?.[0]?.c ?? 0)
    } else {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ?`,
        [channelId, otherId]
      )
      unreadCount = Number(cRows?.[0]?.c ?? 0)
    }
    list.push({
      channelId,
      otherUserId: otherId,
      otherPseudo: pseudo,
      otherIsOnline: lastSeenAt ? isOnlineFromLastSeen(lastSeenAt) : false,
      otherLastSeenAt: lastSeenAt || null,
      unreadCount,
    })
  }

  return { channels: list }
}

/** Table dédiée P2P (évite conflit avec fleur_chat_messages du chat coach qui utilise conversation_id) */
const P2P_MESSAGES_TABLE = 'fleur_chat_channel_messages'

// Singleton DDL : CREATE TABLE ne s'exécute qu'une fois par process (évite les metadata locks)
let _ensureMessagesTablePromise: Promise<void> | null = null

function ensureMessagesTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureMessagesTablePromise) {
    const t = table(P2P_MESSAGES_TABLE)
    _ensureMessagesTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT,
        card_slug VARCHAR(100) DEFAULT NULL,
        temperature VARCHAR(20) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_channel (channel_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined).catch(() => { _ensureMessagesTablePromise = null })
  }
  return _ensureMessagesTablePromise
}

export type ChannelMessage = {
  id: number
  senderId: number
  body: string | null
  cardSlug: string | null
  temperature: string | null
  createdAt: string
  reactions?: MessageReactionSummary[]
}

const P2P_REACTIONS_TABLE = 'fleur_chat_channel_message_reactions'

let _ensureReactionsTablePromise: Promise<void> | null = null

function ensureReactionsTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureReactionsTablePromise) {
    const t = table(P2P_REACTIONS_TABLE)
    _ensureReactionsTablePromise = pool
      .execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(16) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_msg_user_emoji (message_id, user_id, emoji),
        INDEX idx_message (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => undefined)
      .catch(() => {
        _ensureReactionsTablePromise = null
      })
  }
  return _ensureReactionsTablePromise
}

function normalizeReactionEmoji(raw: string): string | null {
  const emoji = String(raw ?? '').trim()
  if (!emoji) return null
  return (CLAIRIERE_REACTION_EMOJIS as readonly string[]).includes(emoji) ? emoji : null
}

/** Regroupe les réactions par message_id. */
async function fetchReactionsByMessageIds(
  pool: Awaited<ReturnType<typeof getPool>>,
  messageIds: number[],
  currentUserId: number
): Promise<Map<number, MessageReactionSummary[]>> {
  const out = new Map<number, MessageReactionSummary[]>()
  if (messageIds.length === 0) return out
  await ensureReactionsTable(pool)
  const t = table(P2P_REACTIONS_TABLE)
  const placeholders = messageIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT message_id, emoji, user_id FROM ${t} WHERE message_id IN (${placeholders})`,
    messageIds
  )
  const grouped = new Map<number, Map<string, { count: number; mine: boolean }>>()
  for (const r of rows ?? []) {
    const mid = Number(r.message_id)
    const emoji = String(r.emoji ?? '')
    const uid = Number(r.user_id)
    if (!grouped.has(mid)) grouped.set(mid, new Map())
    const byEmoji = grouped.get(mid)!
    const prev = byEmoji.get(emoji) ?? { count: 0, mine: false }
    prev.count += 1
    if (uid === currentUserId) prev.mine = true
    byEmoji.set(emoji, prev)
  }
  for (const [mid, byEmoji] of grouped) {
    out.set(
      mid,
      Array.from(byEmoji.entries()).map(([emoji, v]) => ({
        emoji,
        count: v.count,
        mine: v.mine,
      }))
    )
  }
  return out
}

async function assertMessageChannelAccess(
  pool: Awaited<ReturnType<typeof getPool>>,
  messageId: number,
  userId: number
): Promise<{ channelId: number }> {
  const tMsg = table(P2P_MESSAGES_TABLE)
  const tCh = table('fleur_chat_channels')
  await ensureMessagesTable(pool)
  const [msgRows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.channel_id, c.user_a, c.user_b
     FROM ${tMsg} m
     JOIN ${tCh} c ON c.id = m.channel_id
     WHERE m.id = ?`,
    [messageId]
  )
  if (!msgRows?.length) throw new Error('Message introuvable')
  const ch = msgRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (userId !== ua && userId !== ub) throw new Error('Accès non autorisé à ce message')
  return { channelId: Number(ch.channel_id) }
}

/** Ajoute ou retire une réaction emoji sur un message Clairière. */
export async function toggleChannelMessageReaction(
  messageId: number,
  userId: number,
  emojiRaw: string
): Promise<{ action: 'added' | 'removed'; reactions: MessageReactionSummary[] }> {
  const pool = getPool()
  const uid = Number(userId)
  const mid = Number(messageId)
  if (!uid || !mid) throw new Error('messageId et userId requis')
  const emoji = normalizeReactionEmoji(emojiRaw)
  if (!emoji) throw new Error('Emoji non autorisé')

  await assertMessageChannelAccess(pool, mid, uid)
  await ensureReactionsTable(pool)
  const t = table(P2P_REACTIONS_TABLE)

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${t} WHERE message_id = ? AND user_id = ? AND emoji = ? LIMIT 1`,
    [mid, uid, emoji]
  )

  let action: 'added' | 'removed'
  if (existing?.length) {
    await pool.execute(`DELETE FROM ${t} WHERE message_id = ? AND user_id = ? AND emoji = ?`, [mid, uid, emoji])
    action = 'removed'
  } else {
    await pool.execute(`INSERT INTO ${t} (message_id, user_id, emoji) VALUES (?, ?, ?)`, [mid, uid, emoji])
    action = 'added'
  }

  const reactionsMap = await fetchReactionsByMessageIds(pool, [mid], uid)
  return { action, reactions: reactionsMap.get(mid) ?? [] }
}

/** Récupère les messages d'un canal (La Clairière) */
export async function getChannelMessages(
  channelId: number,
  userId: string
): Promise<ChannelMessage[]> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')

  await touchSocialPresence(pool, uid)

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) throw new Error('Canal introuvable')
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (uid !== ua && uid !== ub) throw new Error('Accès non autorisé à ce canal')

  await ensureMessagesTable(pool)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, sender_id, body, card_slug, temperature, created_at FROM ${t} WHERE channel_id = ? ORDER BY created_at ASC`,
    [channelId]
  )

  const messageIds = (rows ?? []).map((r) => Number(r.id))
  const reactionsMap = await fetchReactionsByMessageIds(pool, messageIds, uid)

  return (rows ?? []).map((r) => {
    const id = Number(r.id)
    return {
      id,
      senderId: Number(r.sender_id),
      body: r.body ? String(r.body) : null,
      cardSlug: r.card_slug ? String(r.card_slug) : null,
      temperature: r.temperature ? String(r.temperature) : null,
      createdAt: String(r.created_at ?? ''),
      reactions: reactionsMap.get(id) ?? [],
    }
  })
}

/** Récupère le timestamp de la dernière activité (created_at) du canal. */
export async function getChannelLastMessageAt(channelId: number, userId: string): Promise<string | null> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')

  // Maintenir la cohérence présence (même logique que getChannelMessages)
  await touchSocialPresence(pool, uid)

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) throw new Error('Canal introuvable')
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (uid !== ua && uid !== ub) throw new Error('Accès non autorisé à ce canal')

  await ensureMessagesTable(pool)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT MAX(created_at) as last_at FROM ${t} WHERE channel_id = ?`,
    [channelId]
  )
  const r = rows?.[0]
  const last = r?.last_at ? String(r.last_at) : null
  return last && last.trim() ? last : null
}

/** Messages d'un canal après un curseur created_at (pour incrémental). */
export async function getChannelMessagesSince(
  channelId: number,
  userId: string,
  since: string
): Promise<ChannelMessage[]> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')
  if (!channelId) throw new Error('channel_id requis')
  if (!since) throw new Error('since requis')

  await touchSocialPresence(pool, uid)

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) throw new Error('Canal introuvable')
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (uid !== ua && uid !== ub) throw new Error('Accès non autorisé à ce canal')

  await ensureMessagesTable(pool)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, sender_id, body, card_slug, temperature, created_at
     FROM ${t}
     WHERE channel_id = ? AND created_at > ?
     ORDER BY created_at ASC`,
    [channelId, since]
  )

  const messageIds = (rows ?? []).map((r) => Number(r.id))
  const reactionsMap = await fetchReactionsByMessageIds(pool, messageIds, uid)

  return (rows ?? []).map((r) => {
    const id = Number(r.id)
    return {
      id,
      senderId: Number(r.sender_id),
      body: r.body ? String(r.body) : null,
      cardSlug: r.card_slug ? String(r.card_slug) : null,
      temperature: r.temperature ? String(r.temperature) : null,
      createdAt: String(r.created_at ?? ''),
      reactions: reactionsMap.get(id) ?? [],
    }
  })
}

/** Envoie un message dans un canal P2P */
export async function sendChannelMessage(
  channelId: number,
  senderId: number,
  payload: { body?: string | null; cardSlug?: string | null }
): Promise<ChannelMessage> {
  const pool = getPool()
  const text = payload.body ? String(payload.body).trim() : null
  const cardSlug = payload.cardSlug ? String(payload.cardSlug).trim() || null : null
  if (!text && !cardSlug) throw new Error('body ou cardSlug requis')

  await touchSocialPresence(pool, senderId)

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) throw new Error('Canal introuvable')
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (senderId !== ua && senderId !== ub) throw new Error('Accès non autorisé à ce canal')

  await ensureMessagesTable(pool)

  await pool.execute(
    `INSERT INTO ${t} (channel_id, sender_id, body, card_slug, temperature, created_at) VALUES (?, ?, ?, ?, 'calm', NOW())`,
    [channelId, senderId, text ?? null, cardSlug]
  )

  const [inserted] = await pool.execute<RowDataPacket[]>(
    `SELECT id, sender_id, body, card_slug, temperature, created_at FROM ${t} WHERE channel_id = ? ORDER BY id DESC LIMIT 1`,
    [channelId]
  )
  const r = inserted?.[0]
  if (!r) throw new Error('Impossible de récupérer le message créé')

  return {
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }
}

const CHANNEL_READ_META_PREFIX = 'fleur_chat_channel_'
/** Fenêtre pendant laquelle un canal est considéré comme ouvert (polling client ≈ 15 s). */
const CHANNEL_VIEWING_SECONDS = 35

function channelViewingMetaKey(channelId: number): string {
  return `${CHANNEL_READ_META_PREFIX}${channelId}_viewing_at`
}

/** Indique si l'utilisateur consulte actuellement ce canal Clairière. */
export async function isUserViewingChannel(channelId: number, userId: number): Promise<boolean> {
  const pool = getPool()
  const uid = Number(userId)
  const cid = Number(channelId)
  if (!uid || !cid) return false

  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [uid, channelViewingMetaKey(cid)]
  )
  const raw = rows?.[0]?.meta_value ? String(rows[0].meta_value).trim() : ''
  if (!raw) return false

  let ts: number
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    ts = new Date(raw.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)) {
    ts = new Date(raw.endsWith('Z') ? raw : raw + 'Z').getTime()
  } else {
    ts = new Date(raw).getTime()
  }
  if (!Number.isFinite(ts)) return false
  return (Date.now() - ts) / 1000 <= CHANNEL_VIEWING_SECONDS
}

/** Heartbeat : l'utilisateur a ce canal ouvert à l'écran. */
export async function recordChannelViewing(channelId: number, userId: string): Promise<void> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return

  const tCh = table('fleur_chat_channels')
  const tMeta = table('usermeta')
  const metaKey = channelViewingMetaKey(channelId)
  const now = new Date().toISOString()

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) return
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (uid !== ua && uid !== ub) return

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`,
    [uid, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [now, uid, metaKey])
  } else {
    await pool.execute(`INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [uid, metaKey, now])
  }
}

/** L'utilisateur a quitté le canal (notifications autorisées à nouveau). */
export async function clearChannelViewing(channelId: number, userId: string): Promise<void> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return
  const tMeta = table('usermeta')
  await pool.execute(`DELETE FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`, [
    uid,
    channelViewingMetaKey(channelId),
  ])
}

/** Retourne le nombre de messages non lus (La Clairière) pour l'utilisateur */
export async function getClairiereUnreadCount(userId: string): Promise<number> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) return 0

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')
  const metaPrefix = CHANNEL_READ_META_PREFIX

  await ensureMessagesTable(pool)

  // Single query: join channels + messages + usermeta to count all unread in one shot
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(sub.cnt), 0) AS total
     FROM (
       SELECT COUNT(m.id) AS cnt
       FROM ${tCh} c
       JOIN ${t} m
         ON m.channel_id = c.id
         AND m.sender_id != ?
       LEFT JOIN ${tMeta} um
         ON um.user_id = ?
         AND um.meta_key = CONCAT(?, c.id, '_last_read_at')
       WHERE (c.user_a = ? OR c.user_b = ?)
         AND (um.meta_value IS NULL OR m.created_at > um.meta_value)
       GROUP BY c.id
     ) sub`,
    [uid, uid, metaPrefix, uid, uid]
  )

  return Number(rows?.[0]?.total ?? 0)
}

/** Retourne l'ID de l'autre utilisateur dans un canal (pour notifications) */
export async function getOtherUserIdInChannel(
  channelId: number,
  currentUserId: number
): Promise<number | null> {
  const pool = getPool()
  const tCh = table('fleur_chat_channels')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ? LIMIT 1`,
    [channelId]
  )
  if (!rows?.length) return null
  const ua = Number(rows[0].user_a)
  const ub = Number(rows[0].user_b)
  if (currentUserId === ua) return ub
  if (currentUserId === ub) return ua
  return null
}

/** Crée une notification in-app pour un nouveau message Clairière (appelé après sendChannelMessage) */
export async function createClairiereMessageNotification(
  channelId: number,
  senderId: number,
  recipientId: number,
  body: string | null,
  cardSlug: string | null
): Promise<void> {
  if (await isUserViewingChannel(channelId, recipientId)) {
    return
  }

  const pool = getPool()
  const tNotif = table('fleur_notifications')
  const tDeliv = table('fleur_notification_deliveries')
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [senderRows] = await pool.execute<RowDataPacket[]>(
    `SELECT display_name FROM ${tUsers} WHERE ID = ? LIMIT 1`,
    [senderId]
  )
  let pseudo = senderRows?.[0]?.display_name ? String(senderRows[0].display_name).trim() : ''
  if (!pseudo) {
    const [metaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_pseudo' LIMIT 1`,
      [senderId]
    )
    pseudo = metaRows?.[0]?.meta_value ? String(metaRows[0].meta_value).trim() : 'Quelqu\'un'
  }
  if (!pseudo) pseudo = 'Quelqu\'un'

  const actionUrl = `/clairiere/${channelId}`
  const bodyText = cardSlug
    ? `${pseudo} a partagé une carte avec vous`
    : body
      ? `${pseudo} : ${body.length > 75 ? `${body.slice(0, 72)}...` : body}`
      : `${pseudo} vous a envoyé un message`
  const title = 'Nouveau message'

  try {
    let notifId: number | undefined
    for (const [sql, vals] of [
      [
        `INSERT INTO ${tNotif} (type, title, body, action_url, recipient_type, recipient_id, priority, source_type, source_id, channel_id) VALUES (?, ?, ?, ?, 'user', ?, 'normal', 'clairiere_channel', ?, ?)`,
        ['chat_new_message', title, bodyText, actionUrl, recipientId, channelId, channelId] as unknown[],
      ],
      [
        `INSERT INTO ${tNotif} (type, title, body, action_url, recipient_type, recipient_id, priority, source_type, source_id) VALUES (?, ?, ?, ?, 'user', ?, 'normal', 'clairiere_channel', ?)`,
        ['chat_new_message', title, bodyText, actionUrl, recipientId, channelId] as unknown[],
      ],
    ]) {
      try {
        const insertRes = await exec(pool, String(sql), vals as unknown[])
        const insert = insertRes[0] as { insertId?: number } | null
        notifId = insert?.insertId
        break
      } catch {
        /* essayer la variante suivante */
      }
    }
    let recipientEmail: string | null = null
    if (notifId) {
      const [userRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [recipientId]
      )
      recipientEmail = userRows?.[0]?.user_email ?? null
      try {
        await pool.execute(
          `INSERT INTO ${tDeliv} (notification_id, user_id, user_email, channel_id) VALUES (?, ?, ?, ?)`,
          [notifId, recipientId, recipientEmail, channelId]
        )
      } catch (delivErr: unknown) {
        const dm = String((delivErr as Error)?.message ?? '')
        if (dm.includes('Unknown column') && dm.includes('channel_id')) {
          try {
            await pool.execute(
              `INSERT INTO ${tDeliv} (notification_id, user_id, user_email) VALUES (?, ?, ?)`,
              [notifId, recipientId, recipientEmail]
            )
          } catch {
            /* schéma incompatible */
          }
        }
      }
    }
    try {
      const { sendFcmPush } = await import('./fcm')
      await sendFcmPush(recipientId, recipientEmail, title, bodyText, actionUrl)
    } catch {
      /* push optionnel */
    }
  } catch {
    /* notification optionnelle, ne pas faire échouer l'envoi */
  }
}

/** Marque un canal comme lu par l'utilisateur */
export async function markChannelAsRead(channelId: number, userId: string): Promise<void> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid || !channelId) return

  const tCh = table('fleur_chat_channels')
  const tMeta = table('usermeta')
  const metaKey = `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_a, user_b FROM ${tCh} WHERE id = ?`,
    [channelId]
  )
  if (!chRows?.length) return
  const ch = chRows[0]
  const ua = Number(ch.user_a)
  const ub = Number(ch.user_b)
  if (uid !== ua && uid !== ub) return

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`,
    [uid, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [now, uid, metaKey])
  } else {
    await pool.execute(`INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [uid, metaKey, now])
  }
}

/** Crée les tables seeds et prairie_links si besoin */
async function ensureSeedsAndLinksTables(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const tSeeds = table('fleur_social_seeds')
  const tLinks = table('fleur_prairie_links')
  const tChannels = table('fleur_chat_channels')
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tSeeds} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT NOT NULL,
        to_user_id INT NOT NULL,
        intention_id VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        sap_spent INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_to_user (to_user_id, status),
        INDEX idx_from_user (from_user_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tLinks} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a INT NOT NULL,
        user_b INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pair (user_a, user_b),
        CHECK (user_a < user_b)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${tChannels} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a INT NOT NULL,
        user_b INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_pair (user_a, user_b),
        CHECK (user_a < user_b)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch {
    /* exists */
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Modération douce : sourdines (mutes) + signalements (reports) (B5)
// ────────────────────────────────────────────────────────────────────────────

const ensureModerationTablesPromise: { value: Promise<void> | null } = { value: null }

function ensureModerationTables(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (ensureModerationTablesPromise.value) return ensureModerationTablesPromise.value
  const tMutes = table('fleur_social_mutes')
  const tReports = table('fleur_social_reports')
  ensureModerationTablesPromise.value = (async () => {
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tMutes} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          muted_user_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_pair (user_id, muted_user_id),
          INDEX idx_user (user_id),
          INDEX idx_muted (muted_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch { /* exists */ }
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tReports} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          from_user_id INT NOT NULL,
          target_user_id INT NOT NULL,
          reason VARCHAR(64) NOT NULL,
          detail TEXT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_target (target_user_id, status),
          INDEX idx_from (from_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch { /* exists */ }
  })().catch(() => {
    ensureModerationTablesPromise.value = null
  })
  return ensureModerationTablesPromise.value as Promise<void>
}

/** Récupère l'ensemble des utilisateurs mis en sourdine par `userId`. */
export async function getMutedUserIds(userId: number): Promise<Set<number>> {
  const pool = getPool()
  await ensureModerationTables(pool)
  const tMutes = table('fleur_social_mutes')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT muted_user_id FROM ${tMutes} WHERE user_id = ?`,
      [userId]
    )
    return new Set(rows.map((r) => Number(r.muted_user_id)))
  } catch {
    return new Set()
  }
}

/** Active ou retire une sourdine. */
export async function setMute(
  userId: number,
  targetUserId: number,
  mute: boolean
): Promise<{ muted: boolean }> {
  if (userId === targetUserId) throw new Error('Impossible de se mettre soi-même en sourdine')
  const pool = getPool()
  await ensureModerationTables(pool)
  const tMutes = table('fleur_social_mutes')
  if (mute) {
    try {
      await pool.execute(
        `INSERT IGNORE INTO ${tMutes} (user_id, muted_user_id) VALUES (?, ?)`,
        [userId, targetUserId]
      )
    } catch {
      /* ignore unique constraint */
    }
    return { muted: true }
  }
  try {
    await pool.execute(
      `DELETE FROM ${tMutes} WHERE user_id = ? AND muted_user_id = ?`,
      [userId, targetUserId]
    )
  } catch {
    /* ignore */
  }
  return { muted: false }
}

/** Crée un signalement (motif simple). Garde la trace pour modération admin ultérieure. */
export async function reportUser(
  fromUserId: number,
  targetUserId: number,
  reason: string,
  detail?: string
): Promise<{ reportId: number }> {
  if (fromUserId === targetUserId) throw new Error('Impossible de se signaler soi-même')
  const trimmedReason = (reason ?? '').trim().slice(0, 64)
  if (!trimmedReason) throw new Error('Motif requis')
  const pool = getPool()
  await ensureModerationTables(pool)
  const tReports = table('fleur_social_reports')
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tReports} (from_user_id, target_user_id, reason, detail) VALUES (?, ?, ?, ?)`,
    [fromUserId, targetUserId, trimmedReason, detail ? String(detail).slice(0, 1000) : null]
  )
  // Mettre automatiquement en sourdine la cible signalée (UX naturelle).
  await setMute(fromUserId, targetUserId, true)
  return { reportId: Number(res.insertId) }
}

/**
 * Vérifie si une paire d'utilisateurs est en période de retenue (cooldown 7 j)
 * après un refus ou un report. Évite les Graines insistantes côté receveur.
 */
async function isSeedCooldownActive(
  pool: Awaited<ReturnType<typeof getPool>>,
  fromUserId: number,
  toUserId: number
): Promise<boolean> {
  const tSeeds = table('fleur_social_seeds')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT updated_at, status FROM ${tSeeds}
       WHERE from_user_id = ? AND to_user_id = ? AND status IN ('rejected', 'snoozed')
       ORDER BY updated_at DESC LIMIT 1`,
      [fromUserId, toUserId]
    )
    const row = rows?.[0]
    if (!row?.updated_at) return false
    const ts = new Date(String(row.updated_at).replace(' ', 'T') + 'Z').getTime()
    if (!Number.isFinite(ts)) return false
    const days = (Date.now() - ts) / 86400000
    return days < 7
  } catch {
    return false
  }
}

/** Indique si l'utilisateur a déjà utilisé sa Graine offerte (1ʳᵉ gratuite). */
export async function hasUsedFirstSeed(userId: number): Promise<boolean> {
  const pool = getPool()
  const tMeta = table('usermeta')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_first_seed_used' LIMIT 1`,
      [userId]
    )
    return String(rows?.[0]?.meta_value ?? '') === '1'
  } catch {
    return false
  }
}

async function markFirstSeedUsed(
  pool: Awaited<ReturnType<typeof getPool>>,
  userId: number
): Promise<void> {
  const tMeta = table('usermeta')
  try {
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_first_seed_used'`,
      [userId]
    )
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE ${tMeta} SET meta_value = '1' WHERE user_id = ? AND meta_key = 'fleur_first_seed_used'`,
        [userId]
      )
    } else {
      await pool.execute(
        `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, 'fleur_first_seed_used', '1')`,
        [userId]
      )
    }
  } catch {
    /* meta non bloquante */
  }
}

/**
 * Dépose une graine (demande de contact) vers un autre utilisateur.
 *
 * Politique d'accueil :
 *  - 1ʳᵉ Graine du jardinier = gratuite (`fleur_first_seed_used` non posé),
 *  - cooldown 7 j si la cible a refusé ou mis en sommeil la précédente Graine,
 *  - une seule Graine pending par paire à la fois.
 */
export async function sendSeed(
  fromUserId: number,
  toUserId: number,
  intentionId: string
): Promise<{ seedId: number; firstFree: boolean }> {
  const pool = getPool()
  if (fromUserId === toUserId) throw new Error('Impossible de déposer une graine pour soi-même')
  if (!intentionId?.trim()) throw new Error('intentionId requis')

  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('fleur_social_seeds')

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
    [fromUserId, toUserId]
  )
  if (existing.length > 0) throw new Error('Une graine est déjà en attente pour ce jardinier')

  if (await isSeedCooldownActive(pool, fromUserId, toUserId)) {
    const err = new Error('Ce jardinier souhaite une pause. Réessayez dans quelques jours.') as Error & { code?: string }
    err.code = 'seed_cooldown'
    throw err
  }

  const targetMeteo = await getSocialMeteo(toUserId)
  if (targetMeteo.socialMode === 'focus') {
    const err = new Error('Ce jardinier est en intériorisation — pas de nouvelle graine pour le moment.') as Error & {
      code?: string
    }
    err.code = 'social_focus'
    throw err
  }

  const firstFree = !(await hasUsedFirstSeed(fromUserId))

  const [inserted] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${tSeeds} (from_user_id, to_user_id, intention_id, status, sap_spent) VALUES (?, ?, ?, 'pending', 0)`,
    [fromUserId, toUserId, intentionId.trim()]
  )
  const seedId = Number(inserted.insertId ?? 0)
  if (seedId && firstFree) await markFirstSeedUsed(pool, fromUserId)
  if (!seedId) throw new Error('Impossible de récupérer l\'id de la graine')

  void (async () => {
    try {
      const { notifyPrairieInteraction } = await import('./db-prairie')
      const tUsers = table('users')
      const tMeta = table('usermeta')
      const [senderRows] = await pool.execute<RowDataPacket[]>(
        `SELECT display_name FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [fromUserId]
      )
      let pseudo = senderRows?.[0]?.display_name ? String(senderRows[0].display_name).trim() : ''
      if (!pseudo) {
        const [metaRows] = await pool.execute<RowDataPacket[]>(
          `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_pseudo' LIMIT 1`,
          [fromUserId]
        )
        pseudo = metaRows?.[0]?.meta_value ? String(metaRows[0].meta_value).trim() : ''
      }
      if (!pseudo) pseudo = 'Un jardinier'
      const [userRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [toUserId]
      )
      const recipientEmail = userRows?.[0]?.user_email ? String(userRows[0].user_email).trim() : null
      await notifyPrairieInteraction({
        type: 'prairie_seed',
        recipientId: toUserId,
        recipientEmail,
        senderId: fromUserId,
        senderPseudo: pseudo,
        body: `${pseudo} a déposé une graine dans votre jardin 🌱`,
        actionUrl: `/lisiere/${fromUserId}`,
      })
    } catch {
      /* notification optionnelle */
    }
  })()

  return { seedId, firstFree }
}

/**
 * Met en sommeil une Graine reçue (« peut-être plus tard »).
 * Crée un cooldown de 7 j sans signifier de refus à l'envoyeur.
 */
export async function snoozeSeedConnection(params: {
  seedId: number
  snoozerUserId: number
}): Promise<void> {
  const seedId = Number(params.seedId)
  const snoozer = Number(params.snoozerUserId)
  if (!seedId || !snoozer) throw new Error('seedId et snoozerUserId requis')
  const pool = getPool()
  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('fleur_social_seeds')
  const [seedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, to_user_id, status FROM ${tSeeds} WHERE id = ?`,
    [seedId]
  )
  const seed = seedRows?.[0]
  if (!seed) throw new Error('Graine introuvable')
  if (Number(seed.to_user_id) !== snoozer) throw new Error('Seul le destinataire peut mettre la graine en sommeil')
  if (String(seed.status) !== 'pending') throw new Error('Cette graine a déjà été traitée')
  await pool.execute(`UPDATE ${tSeeds} SET status = 'snoozed', updated_at = NOW() WHERE id = ?`, [seedId])
}

/** Accepte une graine, crée le lien et le canal, retourne channelId */
export async function acceptSeedConnection(
  seedId: number,
  acceptorUserId: number
): Promise<{ channelId: number }> {
  const pool = getPool()
  if (!seedId || !acceptorUserId) throw new Error('seedId et acceptorUserId requis')

  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('fleur_social_seeds')
  const tLinks = table('fleur_prairie_links')
  const tChannels = table('fleur_chat_channels')

  const [seedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, from_user_id, to_user_id, status FROM ${tSeeds} WHERE id = ?`,
    [seedId]
  )
  const seed = seedRows?.[0]
  if (!seed) throw new Error('Graine introuvable')
  if (Number(seed.to_user_id) !== acceptorUserId) throw new Error('Seul le destinataire peut accepter cette graine')
  if (String(seed.status) !== 'pending') throw new Error('Cette graine a déjà été traitée')

  const fromUserId = Number(seed.from_user_id)
  const toUserId = Number(seed.to_user_id)
  const ua = Math.min(fromUserId, toUserId)
  const ub = Math.max(fromUserId, toUserId)

  await pool.execute(`UPDATE ${tSeeds} SET status = 'accepted', updated_at = NOW() WHERE id = ?`, [seedId])
  await pool.execute(`INSERT IGNORE INTO ${tLinks} (user_a, user_b) VALUES (?, ?)`, [ua, ub])
  await pool.execute(`INSERT IGNORE INTO ${tChannels} (user_a, user_b) VALUES (?, ?)`, [ua, ub])

  const [chanRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tChannels} WHERE user_a = ? AND user_b = ?`,
    [ua, ub]
  )
  const channelId = chanRows?.[0] ? Number(chanRows[0].id) : 0
  if (!channelId) throw new Error('Impossible de récupérer le canal')
  return { channelId }
}

export type PendingSeed = {
  id: number
  from_user_id: number
  to_user_id: number
  intention_id: string
  created_at: string | null
}

export async function listPendingSeedsIncoming(params: {
  userId: number
  intentionIds?: string[]
  limit?: number
}): Promise<PendingSeed[]> {
  const uid = Number(params.userId)
  if (!uid) throw new Error('userId requis')
  const pool = getPool()
  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('fleur_social_seeds')
  const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50)))
  const intentionIds = (params.intentionIds ?? []).map((s) => String(s).trim()).filter(Boolean)

  let where = `to_user_id = ? AND status = 'pending'`
  const args: Array<string | number> = [uid]
  if (intentionIds.length > 0) {
    where += ` AND intention_id IN (${intentionIds.map(() => '?').join(',')})`
    args.push(...intentionIds)
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, from_user_id, to_user_id, intention_id, created_at
     FROM ${tSeeds}
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
    [...args, limit]
  )
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    from_user_id: Number(r.from_user_id),
    to_user_id: Number(r.to_user_id),
    intention_id: String(r.intention_id ?? '').trim(),
    created_at: r.created_at ? String(r.created_at) : null,
  }))
}

export async function rejectSeedConnection(params: {
  seedId: number
  rejectorUserId: number
}): Promise<void> {
  const seedId = Number(params.seedId)
  const rejector = Number(params.rejectorUserId)
  if (!seedId || !rejector) throw new Error('seedId et rejectorUserId requis')
  const pool = getPool()
  await ensureSeedsAndLinksTables(pool)
  const tSeeds = table('fleur_social_seeds')
  const [seedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, to_user_id, status FROM ${tSeeds} WHERE id = ?`,
    [seedId]
  )
  const seed = seedRows?.[0]
  if (!seed) throw new Error('Graine introuvable')
  if (Number(seed.to_user_id) !== rejector) throw new Error('Seul le destinataire peut refuser cette graine')
  if (String(seed.status) !== 'pending') throw new Error('Cette graine a déjà été traitée')
  await pool.execute(`UPDATE ${tSeeds} SET status = 'rejected', updated_at = NOW() WHERE id = ?`, [seedId])
}

/** Visite la Lisière d'un utilisateur (profil public, relation, graines) */
export async function visitLisiere(
  visitorUserId: number,
  targetUserId: number
): Promise<{
  userId: string
  pseudo: string
  avatarEmoji: string
  bio: string | null
  age: number | null
  jardinIntention: string | null
  scores: Record<string, number>
  dominantPetal: string
  dominantPetalName: string
  topPetals: Array<{ id: string; name: string; value: number; color: string }>
  echoInflorescence: string
  resonanceWithVisitor: number
  complementarityWithVisitor?: number
  complementPetal?: string
  petalComparison?: Array<{ id: string; visitor: number; target: number }>
  meteoPetal?: string | null
  socialMode?: string
  maturityBadges?: MaturityBadgeId[]
  fleurMoyenne: { petals: number[]; lastUpdated?: string }
  relationStatusWithVisitor: 'none' | 'pending_out' | 'pending_in' | 'accepted'
  hasDuoLink: boolean
  presence?: { is_online: boolean; last_seen_at: string | null }
  lastActivityAt?: string | null
  social?: { rosee_received_total: number; rosee_received_today: number; pollen_received_total: number; pollen_received_today: number }
  recentArrosages?: Array<{ from_user_id: number; from_pseudo: string; avatar_emoji: string; created_at: string }>
  incomingSeedId?: number | null
}> {
  const pool = getPool()
  if (visitorUserId === targetUserId) throw new Error('user_id doit être différent du visiteur')

  await touchSocialPresence(pool, visitorUserId)
  await ensureSeedsAndLinksTables(pool)

  const tMeta = table('usermeta')
  const tUsers = table('users')
  const tRes = table('fleur_amour_results')
  const tLinks = table('fleur_prairie_links')
  const tSeeds = table('fleur_social_seeds')
  const tRosee = table('fleur_rosee_events')
  const tPollen = table('fleur_pollen')

  const [userRows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID, u.display_name,
      COALESCE(um_pseudo.meta_value, '') AS pseudo,
      COALESCE(um_emoji.meta_value, '🌸') AS avatar_emoji,
      COALESCE(um_bio.meta_value, '') AS bio,
      COALESCE(um_age.meta_value, '') AS age,
      COALESCE(um_intention.meta_value, '') AS jardin_intention
    FROM ${tUsers} u
    INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
    LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
    LEFT JOIN ${tMeta} um_emoji ON um_emoji.user_id = u.ID AND um_emoji.meta_key = 'fleur_avatar_emoji'
    LEFT JOIN ${tMeta} um_bio ON um_bio.user_id = u.ID AND um_bio.meta_key = 'fleur_bio'
    LEFT JOIN ${tMeta} um_age ON um_age.user_id = u.ID AND um_age.meta_key = 'fleur_age'
    LEFT JOIN ${tMeta} um_intention ON um_intention.user_id = u.ID AND um_intention.meta_key = 'fleur_jardin_intention'
    WHERE u.ID = ?`,
    [targetUserId]
  )
  const target = userRows?.[0]
  if (!target) throw new Error('Profil non trouvé ou non public')
  const pseudo =
    String(target.pseudo ?? '').trim() ||
    String(target.display_name ?? '').trim() ||
    `jardinier_${Buffer.from(String(targetUserId)).toString('hex').slice(0, 6)}`
  const avatarEmoji = String(target.avatar_emoji ?? '🌸').trim() || '🌸'
  const bioRaw = String(target.bio ?? '').trim()
  const bio = bioRaw ? bioRaw.slice(0, 320) : null
  const ageParsed = parseInt(String(target.age ?? ''), 10)
  const age = !isNaN(ageParsed) && ageParsed >= 16 && ageParsed <= 120 ? ageParsed : null
  const jardinIntention = String(target.jardin_intention ?? '').trim() || null

  const petals = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
  const scores: Record<string, number> = Object.fromEntries(petals.map((p) => [p, 0]))
  let petalsNorm: number[] = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]
  let lastUpdated: string | undefined
  let lastActivityAt: string | null = null

  try {
    const [resRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at FROM ${tRes} WHERE user_id = ? AND (parent_id IS NULL OR parent_id = 0) ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    )
    const row = resRows?.[0]
    if (row) {
      const rawScores = petals.map((p) => Number(row[p] ?? 0))
      petals.forEach((p, i) => { scores[p] = rawScores[i] })
      const maxVal = Math.max(1, ...rawScores)
      petalsNorm = rawScores.map((v) => (maxVal > 0 ? Math.min(1, v / maxVal) : 0.3))
      lastUpdated = row.created_at ? String(row.created_at) : undefined
      lastActivityAt = lastUpdated ?? null
    }
  } catch {
    /* ignore */
  }

  let visitorScores: Record<string, number> | undefined
  try {
    const [visitorRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros FROM ${tRes} WHERE user_id = ? AND (parent_id IS NULL OR parent_id = 0) ORDER BY created_at DESC LIMIT 1`,
      [visitorUserId]
    )
    const vRow = visitorRows?.[0]
    if (vRow) {
      visitorScores = Object.fromEntries(petals.map((p) => [p, Number(vRow[p] ?? 0)]))
    }
  } catch {
    /* ignore */
  }

  const profile = buildLisierePublicProfile(scores, bio)
  const resonanceWithVisitor = resonanceBetween(visitorScores, scores)
  const complementPetal = weakestPetals(visitorScores, 1)[0] ?? profile.dominantPetal
  const complementarityWithVisitor = complementarityBetween(visitorScores, scores, complementPetal)
  const petalComparison = petals.map((id) => ({
    id,
    visitor: Number(visitorScores?.[id] ?? 0),
    target: Number(scores[id] ?? 0),
  }))

  let targetMeteo: { meteoPetal: string | null; socialMode: string } = { meteoPetal: null, socialMode: 'open' }
  try {
    const m = await getSocialMeteo(targetUserId)
    targetMeteo = { meteoPetal: m.meteoPetal, socialMode: m.socialMode }
  } catch {
    /* ignore */
  }

  let social: { rosee_received_total: number; rosee_received_today: number; pollen_received_total: number; pollen_received_today: number } | undefined
  try {
    const [roseeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today FROM ${tRosee} WHERE to_user_id = ?`,
      [targetUserId]
    )
    const [pollenRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today FROM ${tPollen} WHERE to_user_id = ?`,
      [targetUserId]
    )
    social = {
      rosee_received_total: Number(roseeRows?.[0]?.total ?? 0),
      rosee_received_today: Number(roseeRows?.[0]?.today ?? 0),
      pollen_received_total: Number(pollenRows?.[0]?.total ?? 0),
      pollen_received_today: Number(pollenRows?.[0]?.today ?? 0),
    }
  } catch {
    /* tables may not exist */
  }

  let presence: { is_online: boolean; last_seen_at: string | null } | undefined
  try {
    const [presRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_social_last_seen_at' LIMIT 1`,
      [targetUserId]
    )
    const v = String(presRows?.[0]?.meta_value ?? '').trim()
    presence = { is_online: v ? isOnlineFromLastSeen(v) : false, last_seen_at: v || null }
  } catch {
    /* ignore */
  }

  let relationStatus: 'none' | 'pending_out' | 'pending_in' | 'accepted' = 'none'
  const ua = Math.min(visitorUserId, targetUserId)
  const ub = Math.max(visitorUserId, targetUserId)
  try {
    const [linkRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tLinks} WHERE user_a = ? AND user_b = ?`,
      [ua, ub]
    )
    if (linkRows?.length) {
      relationStatus = 'accepted'
    } else {
      const [seedOut] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
        [visitorUserId, targetUserId]
      )
      if (seedOut?.length) relationStatus = 'pending_out'
      else {
        const [seedIn] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
          [targetUserId, visitorUserId]
        )
        if (seedIn?.length) relationStatus = 'pending_in'
      }
    }
  } catch {
    /* ignore */
  }

  // Derniers arrosages reçus (max 5, sur 14 jours) — alimente le « ils m'ont arrosé récemment »
  let recentArrosages: Array<{ from_user_id: number; from_pseudo: string; avatar_emoji: string; created_at: string }> = []
  try {
    const [arrRows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.from_user_id, r.created_at,
              u.display_name,
              COALESCE(ump.meta_value, '') AS pseudo,
              COALESCE(ume.meta_value, '🌸') AS avatar_emoji
       FROM ${tRosee} r
       LEFT JOIN ${tUsers} u ON u.ID = r.from_user_id
       LEFT JOIN ${tMeta} ump ON ump.user_id = r.from_user_id AND ump.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} ume ON ume.user_id = r.from_user_id AND ume.meta_key = 'fleur_avatar_emoji'
       WHERE r.to_user_id = ? AND r.created_at >= (NOW() - INTERVAL 14 DAY)
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [targetUserId]
    )
    recentArrosages = (arrRows ?? []).map((r) => ({
      from_user_id: Number(r.from_user_id),
      from_pseudo:
        String(r.pseudo ?? '').trim() ||
        String(r.display_name ?? '').trim() ||
        `jardinier_${Buffer.from(String(r.from_user_id)).toString('hex').slice(0, 6)}`,
      avatar_emoji: String(r.avatar_emoji ?? '🌸').trim() || '🌸',
      created_at: String(r.created_at ?? ''),
    }))
  } catch {
    /* table peut ne pas exister */
  }

  // Détecte la Graine entrante (visiteur → cible) pour récupérer son seedId
  // (utile au receveur pour les actions Accueillir/Snoozer côté Lisière du sender).
  let incomingSeedId: number | null = null
  try {
    const [seedIncoming] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending' LIMIT 1`,
      [targetUserId, visitorUserId]
    )
    incomingSeedId = seedIncoming?.[0]?.id ? Number(seedIncoming[0].id) : null
  } catch {
    /* ignore */
  }

  let maturityBadges: MaturityBadgeId[] = []
  try {
    const mStats = await fetchMaturityStats(targetUserId)
    maturityBadges = computeMaturityBadges(mStats)
  } catch {
    /* ignore */
  }

  return {
    userId: String(targetUserId),
    pseudo,
    avatarEmoji,
    bio,
    age,
    jardinIntention,
    scores,
    dominantPetal: profile.dominantPetal,
    dominantPetalName: profile.dominantPetalName,
    topPetals: profile.topPetals,
    echoInflorescence: profile.echoInflorescence,
    resonanceWithVisitor,
    fleurMoyenne: { petals: petalsNorm, lastUpdated },
    relationStatusWithVisitor: relationStatus,
    hasDuoLink: relationStatus === 'accepted',
    presence,
    lastActivityAt,
    social,
    recentArrosages,
    incomingSeedId,
    complementarityWithVisitor,
    complementPetal,
    petalComparison,
    meteoPetal: targetMeteo.meteoPetal,
    socialMode: targetMeteo.socialMode,
    maturityBadges,
  }
}

// ── Mes Liens : agrégat des relations d'un jardinier ────────────────────────

export type LienItem = {
  userId: number
  pseudo: string
  avatarEmoji: string
  isOnline: boolean
  lastSeenAt: string | null
  channelId: number | null
  unreadCount: number
  relation: 'pending_in' | 'pending_out' | 'accepted' | 'arrosage_recent' | 'pollen_recent'
  lastSignalAt: string | null
  signalKind: 'message' | 'rosee' | 'pollen' | 'seed' | 'link'
  seedId: number | null
  intentionId: string | null
  maturityBadges?: MaturityBadgeId[]
}

/**
 * Récupère et agrège tous les liens du jardinier (graines, canaux, arrosages, pollens).
 * Une seule entrée par autre utilisateur ; la priorité de relation suit la hiérarchie :
 *   pending_in > pending_out > accepted > arrosage_recent > pollen_recent.
 */
export async function getMyLiens(userId: string): Promise<{ liens: LienItem[] }> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) throw new Error('user_id requis')

  await ensureSeedsAndLinksTables(pool)
  await ensureMessagesTable(pool)
  const mutedIds = await getMutedUserIds(uid)

  const tSeeds = table('fleur_social_seeds')
  const tCh = table('fleur_chat_channels')
  const tMsg = table(P2P_MESSAGES_TABLE)
  const tRosee = table('fleur_rosee_events')
  const tPollen = table('fleur_pollen')
  const tUsers = table('users')
  const tMeta = table('usermeta')

  // 1) Canaux acceptés (Clairière) + dernier message + non lus
  const acceptedChannels = new Map<
    number,
    { channelId: number; lastAt: string | null; unread: number }
  >()
  try {
    const [chRows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.id AS channel_id, c.user_a, c.user_b,
              (SELECT MAX(m.created_at) FROM ${tMsg} m WHERE m.channel_id = c.id) AS last_at,
              (SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = CONCAT('${CHANNEL_READ_META_PREFIX}', c.id, '_last_read_at') LIMIT 1) AS last_read
       FROM ${tCh} c
       WHERE c.user_a = ? OR c.user_b = ?`,
      [uid, uid, uid]
    )
    for (const r of chRows) {
      const ua = Number(r.user_a)
      const ub = Number(r.user_b)
      const otherId = ua === uid ? ub : ua
      const channelId = Number(r.channel_id)
      const lastAt = r.last_at ? String(r.last_at) : null
      const lastRead = r.last_read ? String(r.last_read) : null
      let unread = 0
      try {
        const [cRows] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS c FROM ${tMsg} WHERE channel_id = ? AND sender_id = ? ${
            lastRead ? 'AND created_at > ?' : ''
          }`,
          lastRead ? [channelId, otherId, lastRead] : [channelId, otherId]
        )
        unread = Number(cRows?.[0]?.c ?? 0)
      } catch {
        /* ignore */
      }
      acceptedChannels.set(otherId, { channelId, lastAt, unread })
    }
  } catch {
    /* ignore */
  }

  // 2) Graines pending (entrantes + sortantes)
  const pendingIn = new Map<number, { seedId: number; intentionId: string; at: string }>()
  const pendingOut = new Map<number, { seedId: number; intentionId: string; at: string }>()
  try {
    const [seedRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, from_user_id, to_user_id, intention_id, created_at
       FROM ${tSeeds}
       WHERE status = 'pending' AND (from_user_id = ? OR to_user_id = ?)`,
      [uid, uid]
    )
    for (const r of seedRows) {
      const from = Number(r.from_user_id)
      const to = Number(r.to_user_id)
      const seedId = Number(r.id)
      const intentionId = String(r.intention_id ?? '')
      const at = String(r.created_at ?? '')
      if (from === uid) pendingOut.set(to, { seedId, intentionId, at })
      else pendingIn.set(from, { seedId, intentionId, at })
    }
  } catch {
    /* ignore */
  }

  // 3) Arrosages reçus / envoyés récents (sur 30 j)
  const arrosageBy = new Map<number, string>()
  try {
    const [arrRows] = await pool.execute<RowDataPacket[]>(
      `SELECT other_id, MAX(created_at) AS mx FROM (
         SELECT from_user_id AS other_id, created_at FROM ${tRosee}
           WHERE to_user_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)
         UNION ALL
         SELECT to_user_id AS other_id, created_at FROM ${tRosee}
           WHERE from_user_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)
       ) t
       WHERE other_id != ?
       GROUP BY other_id`,
      [uid, uid, uid]
    )
    for (const r of arrRows) arrosageBy.set(Number(r.other_id), String(r.mx ?? ''))
  } catch {
    /* ignore */
  }

  // 4) Pollens récents
  const pollenBy = new Map<number, string>()
  try {
    const [polRows] = await pool.execute<RowDataPacket[]>(
      `SELECT other_id, MAX(created_at) AS mx FROM (
         SELECT from_user_id AS other_id, created_at FROM ${tPollen}
           WHERE to_user_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)
         UNION ALL
         SELECT to_user_id AS other_id, created_at FROM ${tPollen}
           WHERE from_user_id = ? AND created_at >= (NOW() - INTERVAL 30 DAY)
       ) t
       WHERE other_id != ?
       GROUP BY other_id`,
      [uid, uid, uid]
    )
    for (const r of polRows) pollenBy.set(Number(r.other_id), String(r.mx ?? ''))
  } catch {
    /* ignore */
  }

  // 5) Assembler la liste, en suivant la hiérarchie de relation
  const allIds = new Set<number>()
  for (const k of acceptedChannels.keys()) allIds.add(k)
  for (const k of pendingIn.keys()) allIds.add(k)
  for (const k of pendingOut.keys()) allIds.add(k)
  for (const k of arrosageBy.keys()) allIds.add(k)
  for (const k of pollenBy.keys()) allIds.add(k)
  allIds.delete(uid)
  // Filtrage doux : on retire les sourdines de la liste agrégée (les Clairière acceptées
  // restent atteignables par URL directe, c'est juste l'affichage par défaut qui les ignore).
  for (const m of mutedIds) allIds.delete(m)

  if (allIds.size === 0) return { liens: [] }

  // Profils + présence en batch
  const idList = Array.from(allIds)
  const placeholders = idList.map(() => '?').join(',')
  const profileById = new Map<
    number,
    { pseudo: string; avatarEmoji: string; lastSeenAt: string | null; displayName: string }
  >()
  try {
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID, u.display_name,
              COALESCE(ump.meta_value, '') AS pseudo,
              COALESCE(ume.meta_value, '🌸') AS avatar_emoji,
              COALESCE(ums.meta_value, '') AS last_seen
       FROM ${tUsers} u
       LEFT JOIN ${tMeta} ump ON ump.user_id = u.ID AND ump.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} ume ON ume.user_id = u.ID AND ume.meta_key = 'fleur_avatar_emoji'
       LEFT JOIN ${tMeta} ums ON ums.user_id = u.ID AND ums.meta_key = 'fleur_social_last_seen_at'
       WHERE u.ID IN (${placeholders})`,
      idList
    )
    for (const r of uRows) {
      const id = Number(r.ID)
      profileById.set(id, {
        pseudo: String(r.pseudo ?? '').trim(),
        avatarEmoji: String(r.avatar_emoji ?? '🌸').trim() || '🌸',
        lastSeenAt: String(r.last_seen ?? '').trim() || null,
        displayName: String(r.display_name ?? '').trim(),
      })
    }
  } catch {
    /* ignore */
  }

  const liens: LienItem[] = []
  for (const otherId of idList) {
    const prof = profileById.get(otherId)
    const pseudo =
      prof?.pseudo ||
      prof?.displayName ||
      `jardinier_${Buffer.from(String(otherId)).toString('hex').slice(0, 6)}`
    const avatarEmoji = prof?.avatarEmoji ?? '🌸'
    const lastSeenAt = prof?.lastSeenAt ?? null
    const isOnline = lastSeenAt ? isOnlineFromLastSeen(lastSeenAt) : false

    // Hiérarchie : pending_in > pending_out > accepted > arrosage_recent > pollen_recent
    if (pendingIn.has(otherId)) {
      const s = pendingIn.get(otherId)!
      liens.push({
        userId: otherId,
        pseudo,
        avatarEmoji,
        isOnline,
        lastSeenAt,
        channelId: null,
        unreadCount: 0,
        relation: 'pending_in',
        lastSignalAt: s.at,
        signalKind: 'seed',
        seedId: s.seedId,
        intentionId: s.intentionId,
      })
      continue
    }
    if (pendingOut.has(otherId)) {
      const s = pendingOut.get(otherId)!
      liens.push({
        userId: otherId,
        pseudo,
        avatarEmoji,
        isOnline,
        lastSeenAt,
        channelId: null,
        unreadCount: 0,
        relation: 'pending_out',
        lastSignalAt: s.at,
        signalKind: 'seed',
        seedId: s.seedId,
        intentionId: s.intentionId,
      })
      continue
    }
    if (acceptedChannels.has(otherId)) {
      const c = acceptedChannels.get(otherId)!
      liens.push({
        userId: otherId,
        pseudo,
        avatarEmoji,
        isOnline,
        lastSeenAt,
        channelId: c.channelId,
        unreadCount: c.unread,
        relation: 'accepted',
        lastSignalAt: c.lastAt,
        signalKind: c.lastAt ? 'message' : 'link',
        seedId: null,
        intentionId: null,
      })
      continue
    }
    if (arrosageBy.has(otherId)) {
      liens.push({
        userId: otherId,
        pseudo,
        avatarEmoji,
        isOnline,
        lastSeenAt,
        channelId: null,
        unreadCount: 0,
        relation: 'arrosage_recent',
        lastSignalAt: arrosageBy.get(otherId)!,
        signalKind: 'rosee',
        seedId: null,
        intentionId: null,
      })
      continue
    }
    if (pollenBy.has(otherId)) {
      liens.push({
        userId: otherId,
        pseudo,
        avatarEmoji,
        isOnline,
        lastSeenAt,
        channelId: null,
        unreadCount: 0,
        relation: 'pollen_recent',
        lastSignalAt: pollenBy.get(otherId)!,
        signalKind: 'pollen',
        seedId: null,
        intentionId: null,
      })
    }
  }

  // Tri : non lus, puis pending_in, puis activité décroissante
  liens.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    if (a.relation === 'pending_in' && b.relation !== 'pending_in') return -1
    if (b.relation === 'pending_in' && a.relation !== 'pending_in') return 1
    const at = a.lastSignalAt ? new Date(a.lastSignalAt).getTime() : 0
    const bt = b.lastSignalAt ? new Date(b.lastSignalAt).getTime() : 0
    return bt - at
  })

  const badgeMap = await fetchMaturityStatsBatch(liens.map((l) => l.userId))
  for (const lien of liens) {
    lien.maturityBadges = badgeMap.get(lien.userId) ?? []
  }

  await touchSocialPresence(pool, uid)
  return { liens }
}

// ── Onboarding communautaire (1ʳᵉ visite) ───────────────────────────────────

export async function getCommunityOnboardingStatus(
  userId: number
): Promise<{ done: boolean; firstSeedUsed: boolean }> {
  const pool = getPool()
  const tMeta = table('usermeta')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_key, meta_value FROM ${tMeta}
       WHERE user_id = ? AND meta_key IN ('fleur_community_onboarding_done', 'fleur_first_seed_used')`,
      [userId]
    )
    const map: Record<string, string> = {}
    for (const r of rows) map[String(r.meta_key)] = String(r.meta_value ?? '')
    return {
      done: (map.fleur_community_onboarding_done ?? '') === '1',
      firstSeedUsed: (map.fleur_first_seed_used ?? '') === '1',
    }
  } catch {
    return { done: false, firstSeedUsed: false }
  }
}

export async function markCommunityOnboardingDone(userId: number): Promise<void> {
  const pool = getPool()
  const tMeta = table('usermeta')
  try {
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_community_onboarding_done'`,
      [userId]
    )
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE ${tMeta} SET meta_value = '1' WHERE user_id = ? AND meta_key = 'fleur_community_onboarding_done'`,
        [userId]
      )
    } else {
      await pool.execute(
        `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, 'fleur_community_onboarding_done', '1')`,
        [userId]
      )
    }
  } catch {
    /* non bloquant */
  }
}
