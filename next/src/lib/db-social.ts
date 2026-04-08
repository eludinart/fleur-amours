/**
 * La Clairière (social / canaux chat) — MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, table } from './db'

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

/** Crée la table des messages P2P si elle n'existe pas */
async function ensureMessagesTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  const t = table(P2P_MESSAGES_TABLE)
  try {
    await pool.execute(`
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
    `)
  } catch {
    /* table existe peut-être déjà */
  }
}

export type ChannelMessage = {
  id: number
  senderId: number
  body: string | null
  cardSlug: string | null
  temperature: string | null
  createdAt: string
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

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? ''),
  }))
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

  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    senderId: Number(r.sender_id),
    body: r.body ? String(r.body) : null,
    cardSlug: r.card_slug ? String(r.card_slug) : null,
    temperature: r.temperature ? String(r.temperature) : null,
    createdAt: String(r.created_at ?? ''),
  }))
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

/** Retourne le nombre de messages non lus (La Clairière) pour l'utilisateur */
export async function getClairiereUnreadCount(userId: string): Promise<number> {
  const pool = getPool()
  const uid = parseInt(userId, 10)
  if (!uid) return 0

  const tCh = table('fleur_chat_channels')
  const t = table(P2P_MESSAGES_TABLE)
  const tMeta = table('usermeta')

  await ensureMessagesTable(pool)

  const [chRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_a, user_b FROM ${tCh} WHERE user_a = ? OR user_b = ?`,
    [uid, uid]
  )
  if (!chRows?.length) return 0

  let total = 0
  for (const ch of chRows) {
    const channelId = Number(ch.id)
    const ua = Number(ch.user_a)
    const ub = Number(ch.user_b)
    const otherId = uid === ua ? ub : ua

    const [metaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
      [uid, `${CHANNEL_READ_META_PREFIX}${channelId}_last_read_at`]
    )
    const lastReadAt = metaRows?.[0]?.meta_value ? String(metaRows[0].meta_value).trim() : null

    let count: number
    if (lastReadAt) {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ? AND created_at > ?`,
        [channelId, otherId, lastReadAt]
      )
      count = Number(cRows?.[0]?.c ?? 0)
    } else {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM ${t} WHERE channel_id = ? AND sender_id = ?`,
        [channelId, otherId]
      )
      count = Number(cRows?.[0]?.c ?? 0)
    }
    total += count
  }
  return total
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

/** Dépose une graine (demande de contact) vers un autre utilisateur */
export async function sendSeed(
  fromUserId: number,
  toUserId: number,
  intentionId: string
): Promise<{ seedId: number }> {
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

  await pool.execute(
    `INSERT INTO ${tSeeds} (from_user_id, to_user_id, intention_id, status, sap_spent) VALUES (?, ?, ?, 'pending', 0)`,
    [fromUserId, toUserId, intentionId.trim()]
  )
  const [inserted] = await pool.execute<RowDataPacket[]>(`SELECT LAST_INSERT_ID() as id`)
  const seedId = Number(inserted?.[0]?.id ?? 0)
  if (!seedId) throw new Error('Impossible de récupérer l\'id de la graine')
  return { seedId }
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
  fleurMoyenne: { petals: number[]; lastUpdated?: string }
  relationStatusWithVisitor: 'none' | 'pending_out' | 'pending_in' | 'accepted'
  social?: { rosee_received_total: number; rosee_received_today: number; pollen_received_total: number; pollen_received_today: number }
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

  const [userRows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID, u.display_name,
      COALESCE(um_pseudo.meta_value, '') AS pseudo,
      COALESCE(um_emoji.meta_value, '🌸') AS avatar_emoji
    FROM ${tUsers} u
    INNER JOIN ${tMeta} um_pub ON um_pub.user_id = u.ID AND um_pub.meta_key = 'fleur_profile_public' AND um_pub.meta_value = '1'
    LEFT JOIN ${tMeta} um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
    LEFT JOIN ${tMeta} um_emoji ON um_emoji.user_id = u.ID AND um_emoji.meta_key = 'fleur_avatar_emoji'
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

  const petals = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
  let petalsNorm: number[] = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]
  let lastUpdated: string | undefined
  try {
    const [resRows] = await pool.execute<RowDataPacket[]>(
      `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at FROM ${tRes} WHERE user_id = ? AND (parent_id IS NULL OR parent_id = 0) ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    )
    const row = resRows?.[0]
    if (row) {
      const scores = petals.map((p) => Number(row[p] ?? 0))
      const maxVal = Math.max(1, ...scores)
      petalsNorm = scores.map((v) => (maxVal > 0 ? Math.min(1, v / maxVal) : 0.3))
      lastUpdated = row.created_at ? String(row.created_at) : undefined
    }
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

  return {
    userId: String(targetUserId),
    pseudo,
    avatarEmoji,
    fleurMoyenne: { petals: petalsNorm, lastUpdated },
    relationStatusWithVisitor: relationStatus,
  }
}
