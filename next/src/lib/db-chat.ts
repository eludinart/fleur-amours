/**
 * Chat Coach (patient ↔ coach) — MariaDB.
 * Tables: fleur_chat_conversations, fleur_chat_messages.
 * assigned_coach_id : coach attitré (NULL = non assigné, visible par tous les coachs/admin).
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, table } from './db'

const TBL_CONV = 'fleur_chat_conversations'
const TBL_MSG = 'fleur_chat_messages'

/** Aligné sur La Clairière / Prairie : actif si dernière activité < 5 min. */
const COACH_PRESENCE_MAX_AGE_SEC = 300

function parseUtcTimestamp(value: string): number {
  const s = String(value).trim()
  if (!s) return NaN
  // Stored format from our code: 'YYYY-MM-DD HH:mm:ss' (UTC without timezone marker)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z').getTime()
  }
  // Some environments may already store ISO without timezone: 'YYYY-MM-DDTHH:mm:ss'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s + 'Z').getTime()
  }
  return new Date(s).getTime()
}

function coachOnlineFromLastSeen(value: string): boolean {
  const ts = parseUtcTimestamp(value)
  if (!Number.isFinite(ts)) return false
  return (Date.now() - ts) / 1000 <= COACH_PRESENCE_MAX_AGE_SEC
}

/** Migrations chat (conversations / messages) — à appeler avant une requête qui lit des colonnes récentes. */
export async function ensureChatSchema(): Promise<void> {
  await ensureTables(getPool())
}

async function ensureTables(pool: ReturnType<typeof getPool>): Promise<void> {
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tConv} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      user_email VARCHAR(255) DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'open',
      assigned_coach_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_status (status),
      INDEX idx_assigned_coach (assigned_coach_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tMsg} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      sender_role VARCHAR(20) NOT NULL DEFAULT 'user',
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_conv (conversation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  try {
    const [cols] = await pool.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'assigned_coach_id'`,
      [tConv]
    )
    if (cols.length === 0) {
      await pool.execute(`ALTER TABLE ${tConv} ADD COLUMN assigned_coach_id INT DEFAULT NULL`)
    }
  } catch {
    // Ignore
  }
  try {
    const [closedCols] = await pool.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'closed_by_role'`,
      [tConv]
    )
    if (closedCols.length === 0) {
      await pool.execute(`ALTER TABLE ${tConv} ADD COLUMN closed_by_role VARCHAR(20) DEFAULT NULL`)
      await pool.execute(
        `UPDATE ${tConv} SET closed_by_role = 'coach' WHERE status = 'closed' AND closed_by_role IS NULL`
      )
    }
  } catch {
    // Ignore
  }
  for (const col of ['coach_last_read_at', 'user_last_read_at'] as const) {
    try {
      const [readCols] = await pool.execute<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tConv, col]
      )
      if (readCols.length === 0) {
        await pool.execute(`ALTER TABLE ${tConv} ADD COLUMN ${col} DATETIME NULL DEFAULT NULL`)
      }
    } catch {
      // Ignore
    }
  }
}

export type CoachPublicCard = {
  id: number
  email: string
  name: string
  pseudo?: string
  avatar?: string
  avatar_emoji?: string
  coach_headline?: string
  coach_short_bio?: string
  coach_long_bio?: string
  coach_specialties?: string[]
  coach_languages?: string[]
  coach_response_time_label?: string
  coach_response_time_hours?: number
  coach_years_experience?: number
  coach_reviews_label?: string
  coach_verified?: boolean
  /** Présence (heartbeat / navigation sur le jardin, fenêtre ~5 min). */
  is_online?: boolean
  last_seen_at?: string | null
}

function mapCoachRow(r: RowDataPacket): CoachPublicCard {
  let specialties: string[] = []
  let languages: string[] = []
  try {
    specialties = r.coach_specialties ? JSON.parse(String(r.coach_specialties)) : []
  } catch {
    specialties = []
  }
  try {
    languages = r.coach_languages ? JSON.parse(String(r.coach_languages)) : []
  } catch {
    languages = []
  }
  const rawSeen =
    r.social_last_seen_at != null && String(r.social_last_seen_at).trim() !== ''
      ? String(r.social_last_seen_at).trim()
      : ''
  return {
    id: Number(r.id),
    email: String(r.email ?? ''),
    name: String(r.name ?? ''),
    pseudo: String(r.pseudo ?? '').trim(),
    avatar: String(r.avatar ?? ''),
    avatar_emoji: String(r.avatar_emoji ?? ''),
    coach_headline: String(r.coach_headline ?? ''),
    coach_short_bio: String(r.coach_short_bio ?? ''),
    coach_long_bio: String(r.coach_long_bio ?? ''),
    coach_specialties: Array.isArray(specialties) ? specialties : [],
    coach_languages: Array.isArray(languages) ? languages : [],
    coach_response_time_label: String(r.coach_response_time_label ?? ''),
    coach_response_time_hours: r.coach_response_time_hours != null ? Number(r.coach_response_time_hours) : undefined,
    coach_years_experience: r.coach_years_experience != null ? Number(r.coach_years_experience) : undefined,
    coach_reviews_label: String(r.coach_reviews_label ?? ''),
    coach_verified: String(r.coach_verified ?? '0') === '1',
    is_online: rawSeen ? coachOnlineFromLastSeen(rawSeen) : false,
    last_seen_at: rawSeen || null,
  }
}

const COACH_CARD_SELECT = `
         u.ID as id,
         u.user_email as email,
         u.display_name as name,
         um_pseudo.meta_value as pseudo,
         um_avatar.meta_value as avatar,
         um_avatar_emoji.meta_value as avatar_emoji,
         um_headline.meta_value as coach_headline,
         um_short.meta_value as coach_short_bio,
         um_long.meta_value as coach_long_bio,
         um_specs.meta_value as coach_specialties,
         um_langs.meta_value as coach_languages,
         um_rtl.meta_value as coach_response_time_label,
         um_rth.meta_value as coach_response_time_hours,
         um_exp.meta_value as coach_years_experience,
         um_reviews.meta_value as coach_reviews_label,
         um_verified.meta_value as coach_verified,
         um_listed.meta_value as coach_is_listed,
         um_seen.meta_value as social_last_seen_at`

const COACH_CARD_JOINS = `
       LEFT JOIN TABLE_META um_headline ON um_headline.user_id = u.ID AND um_headline.meta_key = 'fleur_coach_headline'
       LEFT JOIN TABLE_META um_pseudo ON um_pseudo.user_id = u.ID AND um_pseudo.meta_key = 'fleur_pseudo'
       LEFT JOIN TABLE_META um_avatar ON um_avatar.user_id = u.ID AND um_avatar.meta_key = 'fleur_avatar'
       LEFT JOIN TABLE_META um_avatar_emoji ON um_avatar_emoji.user_id = u.ID AND um_avatar_emoji.meta_key = 'fleur_avatar_emoji'
       LEFT JOIN TABLE_META um_short ON um_short.user_id = u.ID AND um_short.meta_key = 'fleur_coach_short_bio'
       LEFT JOIN TABLE_META um_long ON um_long.user_id = u.ID AND um_long.meta_key = 'fleur_coach_long_bio'
       LEFT JOIN TABLE_META um_specs ON um_specs.user_id = u.ID AND um_specs.meta_key = 'fleur_coach_specialties'
       LEFT JOIN TABLE_META um_langs ON um_langs.user_id = u.ID AND um_langs.meta_key = 'fleur_coach_languages'
       LEFT JOIN TABLE_META um_rtl ON um_rtl.user_id = u.ID AND um_rtl.meta_key = 'fleur_coach_response_time_label'
       LEFT JOIN TABLE_META um_rth ON um_rth.user_id = u.ID AND um_rth.meta_key = 'fleur_coach_response_time_hours'
       LEFT JOIN TABLE_META um_exp ON um_exp.user_id = u.ID AND um_exp.meta_key = 'fleur_coach_years_experience'
       LEFT JOIN TABLE_META um_reviews ON um_reviews.user_id = u.ID AND um_reviews.meta_key = 'fleur_coach_reviews_label'
       LEFT JOIN TABLE_META um_verified ON um_verified.user_id = u.ID AND um_verified.meta_key = 'fleur_coach_verified'
       LEFT JOIN TABLE_META um_listed ON um_listed.user_id = u.ID AND um_listed.meta_key = 'fleur_coach_is_listed'
       LEFT JOIN TABLE_META um_seen ON um_seen.user_id = u.ID AND um_seen.meta_key = 'fleur_social_last_seen_at'`

/** Fiche affichable pour un utilisateur WP (coach assigné), y compris non listé dans le sélecteur. */
export async function getCoachPublicCard(wpUserId: number): Promise<CoachPublicCard | null> {
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const joins = COACH_CARD_JOINS.replace(/TABLE_META/g, tMeta)
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${COACH_CARD_SELECT}
       FROM ${tUsers} u
       ${joins}
       WHERE u.ID = ?`,
      [wpUserId]
    )
    if (rows.length === 0) return null
    return mapCoachRow(rows[0])
  } catch {
    return null
  }
}

/** Accompagnants listés : rôle coach ou admin (souvent un seul compte « coach + admin »). */
export async function listCoaches(): Promise<CoachPublicCard[]> {
  const pool = getPool()
  const tUsers = table('users')
  const tRoles = table('fleur_app_roles')
  const tMeta = table('usermeta')
  const joins = COACH_CARD_JOINS.replace(/TABLE_META/g, tMeta)
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${COACH_CARD_SELECT}
       FROM ${tUsers} u
       ${joins}
       WHERE u.ID IN (SELECT user_id FROM ${tRoles} WHERE app_role IN ('coach', 'admin'))
       AND COALESCE(um_listed.meta_value, '1') != '0'
       GROUP BY u.ID
       ORDER BY u.display_name ASC`
    )
    return rows
      .map(mapCoachRow)
      .sort((a, b) => {
        const ao = a.is_online ? 1 : 0
        const bo = b.is_online ? 1 : 0
        if (bo !== ao) return bo - ao
        return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })
      })
  } catch {
    return []
  }
}

/**
 * Crée ou récupère la conversation d'un utilisateur.
 * @param coachId `number` = assigner ce coach ; `null` = équipe (efface l'assignation) ;
 *   `undefined` = ne pas modifier l'assignation (ex. retry sans body).
 */
async function conversationMeta(
  pool: Awaited<ReturnType<typeof getPool>>,
  id: number
): Promise<{ status: string; closed_by_role: string | null }> {
  const tConv = table(TBL_CONV)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT status, closed_by_role FROM ${tConv} WHERE id = ?`,
    [id]
  )
  const r = rows[0]
  return {
    status: String(r?.status ?? 'open'),
    closed_by_role: r?.closed_by_role != null && String(r.closed_by_role).trim() !== '' ? String(r.closed_by_role) : null,
  }
}

export async function startConversation(
  userId: number,
  userEmail: string,
  coachId?: number | null
): Promise<{ id: number; status: string; closed_by_role: string | null }> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  // IMPORTANT:
  // - When coachId is provided (number or null), we must NOT "recycle" the latest conversation
  //   by mutating assigned_coach_id, otherwise clicking a coach can open an older thread whose
  //   messages belong to a different coach.
  // - Instead, look for an existing conversation already assigned to that coach (or unassigned for null).
  // - Only when coachId is undefined (no intent) do we fallback to "latest conversation".

  const coachIntent =
    coachId === undefined ? undefined : coachId != null && coachId > 0 ? Number(coachId) : null

  if (coachIntent !== undefined) {
    // Reuse an existing conversation only if it doesn't contain staff messages
    // from a different coach/admin than the intended coach. This prevents opening
    // "recycled" threads created by older buggy logic that reassigned assigned_coach_id.
    const [match] = await pool.execute<RowDataPacket[]>(
      coachIntent === null
        ? `SELECT c.id
           FROM ${tConv} c
           WHERE c.user_id = ?
             AND c.assigned_coach_id IS NULL
             AND c.status != 'deleted'
             AND NOT EXISTS (
               SELECT 1 FROM ${tMsg} m
               WHERE m.conversation_id = c.id
                 AND m.sender_role != 'user'
             )
           ORDER BY c.id DESC
           LIMIT 1`
        : `SELECT c.id
           FROM ${tConv} c
           WHERE c.user_id = ?
             AND c.assigned_coach_id = ?
             AND c.status != 'deleted'
             AND NOT EXISTS (
               SELECT 1 FROM ${tMsg} m
               WHERE m.conversation_id = c.id
                 AND m.sender_role != 'user'
                 AND m.sender_id != ?
             )
           ORDER BY c.id DESC
           LIMIT 1`,
      coachIntent === null ? [userId] : [userId, coachIntent, coachIntent]
    )
    if (match.length > 0) {
      const id = Number(match[0].id)
      const meta = await conversationMeta(pool, id)
      return { id, ...meta }
    }

    const [ins] = await pool.execute(
      `INSERT INTO ${tConv} (user_id, user_email, status, assigned_coach_id) VALUES (?, ?, 'open', ?)`,
      [userId, userEmail, coachIntent]
    )
    const id = Number((ins as unknown as { insertId: number }).insertId)
    return { id, status: 'open', closed_by_role: null }
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tConv} WHERE user_id = ? AND status != 'deleted' ORDER BY id DESC LIMIT 1`,
    [userId]
  )
  if (existing.length > 0) {
    const id = Number(existing[0].id)
    const meta = await conversationMeta(pool, id)
    return { id, ...meta }
  }

  const [ins] = await pool.execute(
    `INSERT INTO ${tConv} (user_id, user_email, status, assigned_coach_id) VALUES (?, ?, 'open', NULL)`,
    [userId, userEmail]
  )
  const id = Number((ins as unknown as { insertId: number }).insertId)
  return { id, status: 'open', closed_by_role: null }
}

/**
 * Crée ou retrouve la conversation d’un patient (email WP) pour l’UI coach/admin « Ouvrir le chat ».
 * Coach : fixe assigned_coach_id sur le staff courant pour que le fil apparaisse dans sa liste.
 * Admin : ne modifie pas l’assignation sur une ligne existante.
 */
export async function ensureConversationForPatientByEmail(params: {
  patientEmail: string
  staffUserId: number
  isAdmin: boolean
  isCoach: boolean
}): Promise<{ id: number; created: boolean }> {
  const pool = getPool()
  await ensureTables(pool)
  const tUsers = table('users')
  const tConv = table(TBL_CONV)
  const emailNorm = String(params.patientEmail ?? '')
    .trim()
    .toLowerCase()
  if (!emailNorm || !emailNorm.includes('@')) {
    throw new Error('Email invalide')
  }

  const [urows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_email FROM ${tUsers} WHERE LOWER(TRIM(user_email)) = ? LIMIT 1`,
    [emailNorm]
  )
  if (!urows.length) {
    throw new Error('Aucun compte WordPress pour cet email')
  }
  const userId = Number(urows[0].ID)
  const userEmail = String(urows[0].user_email ?? params.patientEmail).trim()

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tConv} WHERE user_id = ? AND status != 'deleted' ORDER BY id DESC LIMIT 1`,
    [userId]
  )

  if (existing.length > 0) {
    const id = Number(existing[0].id)
    if (params.isCoach && !params.isAdmin) {
      await pool.execute(`UPDATE ${tConv} SET assigned_coach_id = ? WHERE id = ?`, [
        params.staffUserId,
        id,
      ])
    }
    return { id, created: false }
  }

  const insertAssigned = params.isCoach && !params.isAdmin ? params.staffUserId : null
  const [ins] = await pool.execute(
    `INSERT INTO ${tConv} (user_id, user_email, status, assigned_coach_id) VALUES (?, ?, 'open', ?)`,
    [userId, userEmail, insertAssigned]
  )
  const id = Number((ins as unknown as { insertId: number }).insertId)
  return { id, created: true }
}

/** Conversations de l'utilisateur (pour ChatPage) */
export async function getMyConversations(userId: number, userEmail: string): Promise<
  Array<{
    id: number
    status: string
    assigned_coach_id: number | null
    closed_by_role: string | null
    last_message_at: string | null
    last_message_preview: string | null
    last_message_sender_role: string | null
    assigned_coach_display_name: string | null
    created_at: string | null
  }>
> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  const tUsers = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
        c.id,
        c.status,
        c.assigned_coach_id,
        c.closed_by_role,
        c.created_at,
        coach_u.display_name AS assigned_coach_display_name,
        (SELECT MAX(created_at) FROM ${tMsg} m WHERE m.conversation_id = c.id) AS last_message_at,
        (
          SELECT m2.sender_role
          FROM ${tMsg} m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC, m2.id DESC
          LIMIT 1
        ) AS last_message_sender_role,
        (
          SELECT m3.content
          FROM ${tMsg} m3
          WHERE m3.conversation_id = c.id
          ORDER BY m3.created_at DESC, m3.id DESC
          LIMIT 1
        ) AS last_message_preview
     FROM ${tConv} c
     LEFT JOIN ${tUsers} coach_u ON coach_u.ID = c.assigned_coach_id
     WHERE c.user_id = ? AND c.status != 'deleted'
     ORDER BY c.id DESC`,
    [userId]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    status: String(r.status ?? 'open'),
    assigned_coach_id: r.assigned_coach_id != null ? Number(r.assigned_coach_id) : null,
    closed_by_role:
      r.closed_by_role != null && String(r.closed_by_role).trim() !== '' ? String(r.closed_by_role) : null,
    last_message_at: r.last_message_at ? String(r.last_message_at) : null,
    last_message_sender_role:
      r.last_message_sender_role != null && String(r.last_message_sender_role).trim() !== ''
        ? String(r.last_message_sender_role).trim()
        : null,
    last_message_preview:
      r.last_message_preview != null && String(r.last_message_preview).trim() !== ''
        ? String(r.last_message_preview)
        : null,
    assigned_coach_display_name:
      r.assigned_coach_display_name != null && String(r.assigned_coach_display_name).trim() !== ''
        ? String(r.assigned_coach_display_name).trim()
        : null,
    created_at: r.created_at ? String(r.created_at) : null,
  }))
}

/** Liste des conversations (coach/admin). Coach : seulement ses patients. Admin : toutes. */
export async function listConversations(
  callerUserId: number,
  isAdmin: boolean,
  isCoach: boolean,
  opts: { status?: string; per_page?: number; dedupe?: 'patient_coach' | 'none' }
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  const tUsers = table('users')
  const status = opts.status ?? 'open'
  const perPage = Math.min(100, Math.max(1, opts.per_page ?? 50))

  let where = "c.status != 'deleted'"
  const params: (string | number | boolean | null)[] = []

  // Backward/forward compatible "open":
  // historically we may have more than one "ongoing" status value (e.g. 'open', 'in_progress').
  // The UI expects the default filter to mean "not closed".
  if (status) {
    if (status === 'open') {
      where += " AND c.status != 'closed'"
    } else {
      where += ' AND c.status = ?'
      params.push(status)
    }
  }

  if (isCoach && !isAdmin) {
    where += ' AND (c.assigned_coach_id = ? OR c.assigned_coach_id IS NULL)'
    params.push(callerUserId)
  }

  const dedupeMode = opts.dedupe ?? 'patient_coach'
  const dedupeRank =
    dedupeMode === 'none'
      ? `ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY c.updated_at DESC, c.id DESC)`
      : `ROW_NUMBER() OVER (PARTITION BY c.user_id, COALESCE(c.assigned_coach_id, 0) ORDER BY c.updated_at DESC, c.id DESC)`

  const countRes = await exec(
    pool,
    `SELECT COUNT(*) as total FROM (
       SELECT ${dedupeRank} as rn FROM ${tConv} c WHERE ${where}
     ) t WHERE t.rn = 1`,
    params
  )
  const countRows = (countRes[0] ?? []) as RowDataPacket[]
  const total = Number(countRows[0]?.total ?? 0)

  const rowsRes = await exec(
    pool,
    `SELECT id, user_id, user_email, status, assigned_coach_id, closed_by_role, created_at, last_message_at, unread_count, assigned_coach_display_name
     FROM (
       SELECT c.id, c.user_id, c.user_email, c.status, c.assigned_coach_id, c.closed_by_role, c.created_at, c.updated_at,
              coach_u.display_name as assigned_coach_display_name,
              (SELECT MAX(created_at) FROM ${tMsg} m WHERE m.conversation_id = c.id) as last_message_at,
              (
                SELECT COUNT(*) FROM ${tMsg} m
                WHERE m.conversation_id = c.id
                  AND m.sender_role = 'user'
                  AND (
                    c.coach_last_read_at IS NULL
                    OR m.created_at > c.coach_last_read_at
                  )
              ) as unread_count,
              ${dedupeRank} as rn
       FROM ${tConv} c
       LEFT JOIN ${tUsers} coach_u ON coach_u.ID = c.assigned_coach_id
       WHERE ${where}
     ) ranked
     WHERE ranked.rn = 1
     ORDER BY ranked.last_message_at IS NULL, ranked.last_message_at DESC, ranked.updated_at DESC, ranked.id DESC
     LIMIT ?`,
    [...params, perPage]
  )
  const rows = (rowsRes[0] ?? []) as RowDataPacket[]

  const items = rows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    user_email: r.user_email ?? '',
    status: r.status ?? 'open',
    assigned_coach_id: r.assigned_coach_id != null ? Number(r.assigned_coach_id) : null,
    assigned_coach_display_name:
      r.assigned_coach_display_name != null && String(r.assigned_coach_display_name).trim() !== ''
        ? String(r.assigned_coach_display_name).trim()
        : null,
    closed_by_role:
      r.closed_by_role != null && String(r.closed_by_role).trim() !== '' ? String(r.closed_by_role) : null,
    created_at: r.created_at ?? null,
    last_message_at: r.last_message_at ?? null,
    unread_count: Number(r.unread_count ?? 0),
  }))

  return { items, total }
}

/** Marque la conversation comme lue côté coach ou côté patient (watermark = dernier message affiché). */
export async function markChatConversationRead(params: {
  conversationId: number
  readerRole: 'coach' | 'user'
  readerUserId: number
  isAdmin?: boolean
  isCoach?: boolean
}): Promise<{ ok: boolean }> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  const { conversationId, readerRole, readerUserId } = params
  const isAdmin = params.isAdmin ?? false
  const isCoach = params.isCoach ?? false

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, assigned_coach_id, status FROM ${tConv} WHERE id = ? AND status != 'deleted'`,
    [conversationId]
  )
  const row = rows[0]
  if (!row) return { ok: false }

  if (readerRole === 'user') {
    if (Number(row.user_id) !== readerUserId) return { ok: false }
  } else {
    if (!isCoach && !isAdmin) return { ok: false }
    if (!isAdmin) {
      const aid = row.assigned_coach_id != null ? Number(row.assigned_coach_id) : null
      if (aid != null && aid !== readerUserId) return { ok: false }
    }
  }

  const col = readerRole === 'user' ? 'user_last_read_at' : 'coach_last_read_at'
  // GREATEST(NOW(), MAX(created_at)) : le filigrane dépasse toujours le dernier message et l’instant courant,
  // ce qui évite les faux « non lus » (comparaison stricte created_at > coach_last_read_at).
  await pool.execute(
    `UPDATE ${tConv} c
     SET c.${col} = GREATEST(
       NOW(),
       COALESCE((SELECT MAX(m.created_at) FROM ${tMsg} m WHERE m.conversation_id = c.id), NOW())
     )
     WHERE c.id = ?`,
    [conversationId]
  )
  return { ok: true }
}

/**
 * Initialise le "non lu" pour les chats coachs/admin :
 * - uniquement pour les conversations dont `coach_last_read_at` est encore `NULL`
 * - watermark = MAX(created_at) de la conversation (donc les messages existants sont considérés lus)
 *
 * But : éviter d'afficher d'anciens messages comme "non lus" après la mise en place du suivi.
 */
export async function markCoachConversationsRead(params: {
  readerUserId: number
  isAdmin: boolean
  isCoach: boolean
}): Promise<{ updated: number }> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)

  const { readerUserId, isAdmin, isCoach } = params

  const whereCoachScope =
    isCoach && !isAdmin
      ? `AND (c.assigned_coach_id = ? OR c.assigned_coach_id IS NULL)`
      : ''

  const paramsList: (string | number | boolean | null)[] =
    isCoach && !isAdmin ? [readerUserId] : []

  // NOTE: MySQL/PMA n'a pas d'alias dans UPDATE SET sous la forme qu'on voudrait,
  // donc on utilise une sous-requête corrélée.
  const [res] = await pool.execute<any>(
    `
      UPDATE ${tConv} c
      SET c.coach_last_read_at = (
        SELECT MAX(m.created_at)
        FROM ${tMsg} m
        WHERE m.conversation_id = c.id
      )
      WHERE c.coach_last_read_at IS NULL
        AND c.status != 'deleted'
        ${whereCoachScope}
    `,
    paramsList
  )

  const updated = Number(res?.affectedRows ?? 0)
  return { updated }
}

export type ChatStaffKind = 'user' | 'assigned_coach' | 'admin' | 'coach_other'

export function staffKindForMessage(
  senderRole: string,
  senderId: number,
  assignedCoachId: number | null,
  adminSenderIds: Set<number>
): ChatStaffKind {
  if (senderRole === 'user') return 'user'
  if (adminSenderIds.has(senderId)) return 'admin'
  if (assignedCoachId != null && senderId === assignedCoachId) return 'assigned_coach'
  return 'coach_other'
}

export type ChatMessageRow = {
  id: number
  sender_id: number
  sender_role: string
  sender_display_name: string | null
  content: string
  created_at: string
}

/** Messages d'une conversation */
export async function getMessages(
  conversationId: number,
  since?: string | null
): Promise<ChatMessageRow[]> {
  const pool = getPool()
  await ensureTables(pool)
  const tMsg = table(TBL_MSG)
  const tUsers = table('users')
  let sql = `SELECT m.id, m.sender_id, m.sender_role, m.content, m.created_at,
       u.display_name AS sender_display_name
     FROM ${tMsg} m
     LEFT JOIN ${tUsers} u ON u.ID = m.sender_id
     WHERE m.conversation_id = ?`
  const params: (string | number | boolean | null)[] = [conversationId]
  if (since) {
    sql += ' AND m.created_at > ?'
    params.push(since)
  }
  sql += ' ORDER BY m.created_at ASC'
  const rowsRes = await exec(pool, sql, params)
  const rows = (rowsRes[0] ?? []) as RowDataPacket[]
  return rows.map((r) => ({
    id: Number(r.id),
    sender_id: Number(r.sender_id ?? 0),
    sender_role: String(r.sender_role ?? 'user'),
    sender_display_name:
      r.sender_display_name != null && String(r.sender_display_name).trim() !== ''
        ? String(r.sender_display_name).trim()
        : null,
    content: String(r.content ?? ''),
    created_at: String(r.created_at ?? ''),
  }))
}

/** Envoie un message. Si coach répond à une conv non assignée, l'assigne automatiquement. */
export async function sendMessage(
  conversationId: number,
  senderId: number,
  senderRole: 'user' | 'coach',
  content: string
): Promise<ChatMessageRow & { conversation_id: number }> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  const tMsg = table(TBL_MSG)
  const tUsers = table('users')

  if (senderRole === 'coach') {
    await pool.execute(
      `UPDATE ${tConv} SET assigned_coach_id = ? WHERE id = ? AND assigned_coach_id IS NULL`,
      [senderId, conversationId]
    )
  }
  const [ins] = await pool.execute(
    `INSERT INTO ${tMsg} (conversation_id, sender_id, sender_role, content) VALUES (?, ?, ?, ?)`,
    [conversationId, senderId, senderRole, content]
  )
  const id = Number((ins as unknown as { insertId: number }).insertId)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT m.id, m.conversation_id, m.sender_id, m.sender_role, m.content, m.created_at,
            u.display_name AS sender_display_name
     FROM ${tMsg} m
     LEFT JOIN ${tUsers} u ON u.ID = m.sender_id
     WHERE m.id = ?`,
    [id]
  )
  const r = rows[0]
  return {
    id: Number(r.id),
    conversation_id: Number(r.conversation_id),
    sender_id: Number(r.sender_id ?? senderId),
    sender_role: String(r.sender_role),
    sender_display_name:
      r.sender_display_name != null && String(r.sender_display_name).trim() !== ''
        ? String(r.sender_display_name).trim()
        : null,
    content: String(r.content),
    created_at: String(r.created_at ?? ''),
  }
}

/**
 * Notification in-app + push FCM pour les messages du chat d’accompagnement (patient ↔ coach/admin).
 */
export async function notifyCoachChatNewMessage(
  conversationId: number,
  senderRole: 'user' | 'coach',
  senderId: number,
  content: string
): Promise<void> {
  try {
    const pool = getPool()
    await ensureTables(pool)
    const tConv = table(TBL_CONV)
    const tUsers = table('users')
    const tRoles = table('fleur_app_roles')

    const [convRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id, user_email, assigned_coach_id FROM ${tConv} WHERE id = ? LIMIT 1`,
      [conversationId]
    )
    if (!convRows.length) return
    const conv = convRows[0]
    const patientId = Number(conv.user_id)
    const assignedRaw = conv.assigned_coach_id
    const assignedCoach =
      assignedRaw != null && assignedRaw !== '' && !Number.isNaN(Number(assignedRaw))
        ? Number(assignedRaw)
        : null

    const preview = content.length > 120 ? `${content.slice(0, 117)}…` : content

    const [senderRows] = await pool.execute<RowDataPacket[]>(
      `SELECT display_name FROM ${tUsers} WHERE ID = ? LIMIT 1`,
      [senderId]
    )
    const senderName = senderRows[0]?.display_name ? String(senderRows[0].display_name).trim() : 'Quelqu’un'

    const { createNotification } = await import('./db-notifications')
    const { sendFcmPush } = await import('./fcm')

    const actionPatient = '/chat'
    const actionStaff = '/coach/chat'

    if (senderRole === 'coach') {
      const title = 'Nouveau message du coach'
      const [urows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [patientId]
      )
      const email = urows[0]?.user_email ? String(urows[0].user_email) : null
      await createNotification({
        type: 'coach_chat_message',
        title,
        body: preview,
        action_url: actionPatient,
        recipient_type: 'user',
        recipient_id: patientId,
        recipient_email: email,
        created_by: senderId,
      })
      await sendFcmPush(patientId, email, title, preview, actionPatient)
      return
    }

    const title = `Nouveau message de ${senderName}`
    if (assignedCoach) {
      const [crows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
        [assignedCoach]
      )
      const cemail = crows[0]?.user_email ? String(crows[0].user_email) : null
      await createNotification({
        type: 'coach_chat_message',
        title,
        body: preview,
        action_url: actionStaff,
        recipient_type: 'user',
        recipient_id: assignedCoach,
        recipient_email: cemail,
        created_by: senderId,
      })
      await sendFcmPush(assignedCoach, cemail, title, preview, actionStaff)
      return
    }

    await createNotification({
      type: 'coach_chat_message',
      title,
      body: preview,
      action_url: actionStaff,
      recipient_type: 'role',
      recipient_role: 'coach',
      created_by: senderId,
    })
    await createNotification({
      type: 'coach_chat_message',
      title,
      body: preview,
      action_url: actionStaff,
      recipient_type: 'role',
      recipient_role: 'admin',
      created_by: senderId,
    })

    const [staffRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT u.ID AS id, u.user_email AS email
       FROM ${tUsers} u
       INNER JOIN ${tRoles} r ON r.user_id = u.ID
       WHERE r.app_role IN ('coach', 'admin')
         AND u.user_email IS NOT NULL AND TRIM(u.user_email) != ''`
    )
    const seen = new Set<number>()
    for (const row of staffRows) {
      const sid = Number(row.id)
      if (!Number.isFinite(sid) || seen.has(sid)) continue
      seen.add(sid)
      const em = row.email ? String(row.email) : null
      await sendFcmPush(sid, em, title, preview, actionStaff)
    }
  } catch {
    /* ne pas bloquer l’envoi du message */
  }
}

export async function closeConversation(id: number): Promise<void> {
  const pool = getPool()
  await ensureTables(pool)
  const tConv = table(TBL_CONV)
  await pool.execute(`UPDATE ${tConv} SET status = 'closed', closed_by_role = 'coach' WHERE id = ?`, [id])
}

export async function deleteConversation(id: number): Promise<void> {
  const pool = getPool()
  const tConv = table(TBL_CONV)
  await pool.execute(`UPDATE ${tConv} SET status = 'deleted' WHERE id = ?`, [id])
}

export async function stats(isAdmin: boolean, isCoach: boolean, coachUserId?: number): Promise<{
  total: number
  open: number
  unread_messages: number
}> {
  const pool = getPool()
  await ensureTables(pool)
  const { items } = await listConversations(
    coachUserId ?? 0,
    isAdmin,
    isCoach,
    { status: '', per_page: 1000 }
  )
  const open = items.filter((c) => c.status === 'open').length
  const unread_messages = items.reduce((s, c) => s + Number((c as any).unread_count ?? 0), 0)
  return { total: items.length, open, unread_messages }
}
