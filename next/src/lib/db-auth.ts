/**
 * Opérations auth/account sur MariaDB (tables WordPress).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'
import { verifyWordPressPassword } from './auth-wordpress'
import { hash } from 'bcryptjs'

export type UserRecord = {
  id: number
  email: string
  login: string
  name: string
  wp_role: string
  app_role: string
  registered: string
  pseudo?: string | null
  bio?: string | null
  avatar?: string | null
  avatar_emoji?: string | null
  profile_public?: boolean
  points_de_rosee?: number
  avatar_graine_id?: string | null
  coach_headline?: string | null
  coach_short_bio?: string | null
  coach_long_bio?: string | null
  coach_specialties?: string[]
  coach_languages?: string[]
  coach_response_time_label?: string | null
  coach_response_time_hours?: number | null
  coach_is_listed?: boolean
  coach_years_experience?: number | null
  coach_reviews_label?: string | null
  coach_verified?: boolean
}

async function getWpRole(userId: number): Promise<string> {
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${prefix}usermeta WHERE user_id = ? AND meta_key = ?`,
    [userId, `${prefix}capabilities`]
  )
  const val = rows[0]?.meta_value
  if (!val) return 'subscriber'
  try {
    const caps = parseWpSerializedCaps(val) as Record<string, number>
    if (!caps || typeof caps !== 'object') return 'subscriber'
    const priority = ['administrator', 'editor', 'author', 'contributor', 'subscriber']
    for (const r of priority) {
      if (caps[r]) return r
    }
    return (Object.keys(caps)[0] as string) || 'subscriber'
  } catch {
    return 'subscriber'
  }
}

async function getAppRole(userId: number, wpRole: string): Promise<string> {
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT app_role FROM ${prefix}fleur_app_roles WHERE user_id = ?`,
      [userId]
    )
    const role = rows[0]?.app_role
    if (role) return String(role)
  } catch {
    // Table might not exist
  }
  return wpRole === 'administrator' ? 'admin' : 'user'
}

/** Parse WordPress serialized capabilities a:1:{s:10:"administrator";i:1;} */
function parseWpSerializedCaps(s: string): Record<string, number> | null {
  if (!s || typeof s !== 'string') return null
  const out: Record<string, number> = {}
  const re = /s:(\d+):"([^"]+)";i:(\d+);/g
  let m
  while ((m = re.exec(s)) !== null) {
    out[m[2]] = parseInt(m[3], 10)
  }
  return Object.keys(out).length ? out : null
}

async function appendProfileMeta(userId: number, out: Record<string, unknown>): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const keys = [
    'fleur_pseudo',
    'fleur_bio',
    'fleur_avatar',
    'fleur_avatar_emoji',
    'fleur_profile_public',
    'fleur_points_de_rosee',
    'fleur_avatar_graine_id',
    'fleur_coach_headline',
    'fleur_coach_short_bio',
    'fleur_coach_long_bio',
    'fleur_coach_specialties',
    'fleur_coach_languages',
    'fleur_coach_response_time_label',
    'fleur_coach_response_time_hours',
    'fleur_coach_is_listed',
    'fleur_coach_years_experience',
    'fleur_coach_reviews_label',
    'fleur_coach_verified',
  ]
  const placeholders = keys.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_key, meta_value FROM ${tbl} WHERE user_id = ? AND meta_key IN (${placeholders})`,
    [userId, ...keys]
  )
  const meta: Record<string, string> = {}
  for (const r of rows) {
    meta[r.meta_key] = r.meta_value
  }
  ;(out as Record<string, unknown>).pseudo = meta.fleur_pseudo || null
  ;(out as Record<string, unknown>).bio = meta.fleur_bio || null
  ;(out as Record<string, unknown>).avatar = meta.fleur_avatar || null
  ;(out as Record<string, unknown>).avatar_emoji = meta.fleur_avatar_emoji || null
  ;(out as Record<string, unknown>).profile_public = (meta.fleur_profile_public ?? '') === '1'
  ;(out as Record<string, unknown>).points_de_rosee = parseInt(meta.fleur_points_de_rosee ?? '5', 10)
  ;(out as Record<string, unknown>).avatar_graine_id = meta.fleur_avatar_graine_id || null
  ;(out as Record<string, unknown>).coach_headline = meta.fleur_coach_headline || null
  ;(out as Record<string, unknown>).coach_short_bio = meta.fleur_coach_short_bio || null
  ;(out as Record<string, unknown>).coach_long_bio = meta.fleur_coach_long_bio || null
  try {
    ;(out as Record<string, unknown>).coach_specialties = meta.fleur_coach_specialties
      ? JSON.parse(meta.fleur_coach_specialties)
      : []
  } catch {
    ;(out as Record<string, unknown>).coach_specialties = []
  }
  try {
    ;(out as Record<string, unknown>).coach_languages = meta.fleur_coach_languages
      ? JSON.parse(meta.fleur_coach_languages)
      : []
  } catch {
    ;(out as Record<string, unknown>).coach_languages = []
  }
  ;(out as Record<string, unknown>).coach_response_time_label = meta.fleur_coach_response_time_label || null
  ;(out as Record<string, unknown>).coach_response_time_hours = meta.fleur_coach_response_time_hours
    ? parseInt(meta.fleur_coach_response_time_hours, 10)
    : null
  ;(out as Record<string, unknown>).coach_is_listed = (meta.fleur_coach_is_listed ?? '1') !== '0'
  ;(out as Record<string, unknown>).coach_years_experience = meta.fleur_coach_years_experience
    ? parseInt(meta.fleur_coach_years_experience, 10)
    : null
  ;(out as Record<string, unknown>).coach_reviews_label = meta.fleur_coach_reviews_label || null
  ;(out as Record<string, unknown>).coach_verified = (meta.fleur_coach_verified ?? '0') === '1'
}

export async function authLogin(login: string, password: string): Promise<UserRecord> {
  const pool = getPool()
  const tbl = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_login, user_email, display_name, user_pass, user_registered, user_status
     FROM ${tbl} WHERE user_email = ? OR user_login = ? LIMIT 1`,
    [login, login]
  )
  const user = rows[0]
  if (!user) throw new Error('Identifiant ou mot de passe incorrect')

  const ok = await verifyWordPressPassword(password, user.user_pass || '')
  if (!ok) throw new Error('Identifiant ou mot de passe incorrect')

  const userId = Number(user.ID)
  await updateLastLogin(userId)

  const wpRole = await getWpRole(userId)
  const appRole = await getAppRole(userId, wpRole)
  const out: UserRecord = {
    id: userId,
    email: user.user_email || '',
    login: user.user_login || '',
    name: user.display_name || '',
    wp_role: wpRole,
    app_role: appRole,
    registered: user.user_registered || '',
  }
  await appendProfileMeta(userId, out as unknown as Record<string, unknown>)
  return out
}

async function updateLastLogin(userId: number): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, 'fleur_last_login']
  )
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [now, userId, 'fleur_last_login']
    )
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, 'fleur_last_login', now]
    )
  }
}

export async function authMe(userId: number): Promise<UserRecord> {
  const pool = getPool()
  const tbl = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_login, user_email, display_name, user_registered FROM ${tbl} WHERE ID = ?`,
    [userId]
  )
  const user = rows[0]
  if (!user) throw new Error('Utilisateur introuvable')

  const uid = Number(user.ID)
  const wpRole = await getWpRole(uid)
  const appRole = await getAppRole(uid, wpRole)
  const out: UserRecord = {
    id: uid,
    email: user.user_email || '',
    login: user.user_login || '',
    name: user.display_name || '',
    wp_role: wpRole,
    app_role: appRole,
    registered: user.user_registered || '',
  }
  await appendProfileMeta(uid, out as unknown as Record<string, unknown>)
  return out
}

export async function authRegister(
  email: string,
  password: string,
  name: string
): Promise<UserRecord> {
  const pool = getPool()
  const tbl = table('users')
  const prefix = process.env.DB_PREFIX || 'wp_'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Adresse email invalide')
  }
  if (password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères')
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${tbl} WHERE user_email = ? LIMIT 1`,
    [email]
  )
  if (existing.length > 0) throw new Error('Cet email est déjà utilisé')

  const baseLogin = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user'
  let userLogin = baseLogin
  let n = 0
  while (true) {
    const [dup] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tbl} WHERE user_login = ? OR user_email = ? LIMIT 1`,
      [userLogin, email]
    )
    if (dup.length === 0) break
    userLogin = baseLogin + ++n
  }

  const userPass = await hash(password, 10)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const nicename = (name || userLogin).replace(/[^a-z0-9\s\-_]/gi, '').slice(0, 50) || userLogin
  const displayName = name || userLogin

  await pool.execute(
    `INSERT INTO ${tbl} (user_login, user_pass, user_nicename, user_email, user_registered, user_status, display_name)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [userLogin, userPass, nicename, email, now, displayName]
  )
  const [ins] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
  const userId = Number(ins[0]?.id)

  await pool.execute(
    `INSERT INTO ${prefix}usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, `${prefix}capabilities`, `a:1:{s:10:"subscriber";i:1;}`]
  )
  await pool.execute(
    `INSERT INTO ${prefix}usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, `${prefix}user_level`, '0']
  )

  const wpRole = await getWpRole(userId)
  const appRole = await getAppRole(userId, wpRole)
  const out: UserRecord = {
    id: userId,
    email,
    login: userLogin,
    name: displayName,
    wp_role: wpRole,
    app_role: appRole,
    registered: now,
  }
  await appendProfileMeta(userId, out as unknown as Record<string, unknown>)
  return out
}

async function upsertUsermeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [metaValue, userId, metaKey]
    )
  } else {
    await pool.execute(
      `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, metaKey, metaValue]
    )
  }
}

async function forceUsermeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  await pool.execute(`DELETE FROM ${tbl} WHERE user_id = ? AND meta_key = ?`, [userId, metaKey])
  await pool.execute(
    `INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
    [userId, metaKey, metaValue]
  )
}

export async function updateProfile(
  userId: number,
  body: Record<string, unknown>
): Promise<UserRecord> {
  const pool = getPool()
  const tbl = table('users')
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = String(body.name ?? '').trim()
    await pool.execute(`UPDATE ${tbl} SET display_name = ? WHERE ID = ?`, [name, userId])
  }
  if (Object.prototype.hasOwnProperty.call(body, 'pseudo')) {
    const pseudo = String(body.pseudo ?? '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .trim()
    if (pseudo && !/^[a-z0-9_-]{3,30}$/.test(pseudo)) {
      throw new Error('Pseudo invalide : 3 à 30 caractères, lettres, chiffres, tirets et underscores uniquement')
    }
    if (pseudo) {
      const [dup] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id FROM ${table('usermeta')} WHERE meta_key = ? AND meta_value = ? AND user_id != ?`,
        ['fleur_pseudo', pseudo, userId]
      )
      if (dup.length > 0) throw new Error('Ce pseudo est déjà pris')
    }
    await upsertUsermeta(userId, 'fleur_pseudo', pseudo)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    const bio = String(body.bio ?? '').trim().slice(0, 500)
    await upsertUsermeta(userId, 'fleur_bio', bio)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
    const avatar = body.avatar
    if (avatar === null || avatar === '') {
      await upsertUsermeta(userId, 'fleur_avatar', '')
    } else if (typeof avatar === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(avatar)) {
      const raw = Buffer.from(avatar.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      if (raw.length <= 100000) {
        await upsertUsermeta(userId, 'fleur_avatar', avatar)
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar_emoji')) {
    const emoji = String(body.avatar_emoji ?? '').trim().slice(0, 8)
    await upsertUsermeta(userId, 'fleur_avatar_emoji', emoji)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'profile_public')) {
    const pub = body.profile_public ? '1' : '0'
    await forceUsermeta(userId, 'fleur_profile_public', pub)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'avatar_graine_id')) {
    const gid = String(body.avatar_graine_id ?? '').trim().slice(0, 50)
    await upsertUsermeta(userId, 'fleur_avatar_graine_id', gid)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_headline')) {
    const v = String(body.coach_headline ?? '').trim().slice(0, 120)
    await upsertUsermeta(userId, 'fleur_coach_headline', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_short_bio')) {
    const v = String(body.coach_short_bio ?? '').trim().slice(0, 280)
    await upsertUsermeta(userId, 'fleur_coach_short_bio', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_long_bio')) {
    const v = String(body.coach_long_bio ?? '').trim().slice(0, 2500)
    await upsertUsermeta(userId, 'fleur_coach_long_bio', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_specialties')) {
    const src = Array.isArray(body.coach_specialties) ? body.coach_specialties : []
    const values = src
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((x) => x.slice(0, 80))
    await upsertUsermeta(userId, 'fleur_coach_specialties', JSON.stringify(values))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_languages')) {
    const src = Array.isArray(body.coach_languages) ? body.coach_languages : []
    const values = src
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((x) => x.slice(0, 40))
    await upsertUsermeta(userId, 'fleur_coach_languages', JSON.stringify(values))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_response_time_label')) {
    const v = String(body.coach_response_time_label ?? '').trim().slice(0, 60)
    await upsertUsermeta(userId, 'fleur_coach_response_time_label', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_response_time_hours')) {
    const n = parseInt(String(body.coach_response_time_hours ?? ''), 10)
    const safe = !isNaN(n) && n >= 1 && n <= 168 ? n : 24
    await upsertUsermeta(userId, 'fleur_coach_response_time_hours', String(safe))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_is_listed')) {
    await upsertUsermeta(userId, 'fleur_coach_is_listed', body.coach_is_listed ? '1' : '0')
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_years_experience')) {
    const n = parseInt(String(body.coach_years_experience ?? ''), 10)
    const safe = !isNaN(n) && n >= 0 && n <= 60 ? n : 0
    await upsertUsermeta(userId, 'fleur_coach_years_experience', String(safe))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_reviews_label')) {
    const v = String(body.coach_reviews_label ?? '').trim().slice(0, 120)
    await upsertUsermeta(userId, 'fleur_coach_reviews_label', v)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'coach_verified')) {
    await upsertUsermeta(userId, 'fleur_coach_verified', body.coach_verified ? '1' : '0')
  }
  return authMe(userId)
}
