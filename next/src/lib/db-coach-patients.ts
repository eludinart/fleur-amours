/**
 * Coach patientèle (invitation + relations) — MariaDB.
 *
 * MVP:
 * - Coach invite (email + cadre/intention) via token.
 * - Le nouvel utilisateur consomme le token (register/login) puis la relation
 *   devient acceptée via fleur_social_seeds / fleur_prairie_links / fleur_chat_channels.
 * - La patientèle (coach => patients) est dérivée des seeds acceptées.
 */
import { randomBytes } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import { acceptSeedConnection, sendSeed } from './db-social'
import { getPool, isDbConfigured, table } from './db'
import { getScienceProfile } from './science-db'
import { getSapBalance } from './db-sap'

export type CoachPatient = {
  patientUserId: number
  email: string
  pseudo: string
  avatarEmoji: string
  intentionIds: string[]
  fleurMoyenne: { petals: number[]; lastUpdated?: string }
  channelId: number | null
  science: Awaited<ReturnType<typeof getScienceProfile>>
  sapBalance: number
  /** Relation via invitation coach → Direct (0 % commission côté produit) ; sinon Marketplace (20 %). */
  acquisitionChannel: 'direct' | 'marketplace'
}

export type CoachRelationship = {
  coachUserId: number
  email: string
  pseudo: string
  avatarEmoji: string
  intentionIds: string[]
  channelId: number | null
}

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

function normalizeEmail(s: string): string {
  return String(s ?? '').trim().toLowerCase()
}

const TBL_INVITES = () => table('fleur_coach_invitations')

async function ensureInvitesTable(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const t = TBL_INVITES()

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_user_id INT NOT NULL,
      invite_email VARCHAR(255) NOT NULL,
      intention_id VARCHAR(64) NOT NULL,
      invite_token VARCHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      consumed_user_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      consumed_at DATETIME DEFAULT NULL,
      UNIQUE KEY uk_token (invite_token),
      INDEX idx_email (invite_email),
      INDEX idx_coach (coach_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function patientHasDirectCoachInvite(coachUserId: number, patientUserId: number): Promise<boolean> {
  if (!isDbConfigured()) return false
  try {
    await ensureInvitesTable()
    const pool = getPool()
    const t = TBL_INVITES()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 AS ok FROM ${t} WHERE coach_user_id = ? AND consumed_user_id = ? AND status = 'accepted' LIMIT 1`,
      [coachUserId, patientUserId]
    )
    return (rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function getUserBasics(userId: number): Promise<{ email: string; pseudo: string; avatarEmoji: string }> {
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')

  const [rows] = await pool.execute<RowDataPacket[]>(
    `
      SELECT
        u.ID,
        u.user_email,
        u.display_name,
        COALESCE(um_p.meta_value, '') AS pseudo,
        COALESCE(um_a.meta_value, '') AS avatar_emoji
      FROM ${tUsers} u
      LEFT JOIN ${tMeta} um_p
        ON um_p.user_id = u.ID AND um_p.meta_key = 'fleur_pseudo'
      LEFT JOIN ${tMeta} um_a
        ON um_a.user_id = u.ID AND um_a.meta_key = 'fleur_avatar_emoji'
      WHERE u.ID = ?
      LIMIT 1
    `,
    [userId]
  )

  const r = rows?.[0]
  if (!r) {
    return {
      email: '',
      pseudo: `jardinier_${String(userId).slice(0, 6)}`,
      avatarEmoji: '🌸',
    }
  }

  const email = String(r.user_email ?? '')
  const displayName = String(r.display_name ?? '').trim()
  const pseudo = String(r.pseudo ?? '').trim() || displayName || `jardinier_${String(userId).slice(0, 6)}`
  const avatarEmoji = String(r.avatar_emoji ?? '').trim() || '🌸'

  return { email, pseudo, avatarEmoji }
}

async function getFleurMoyenne(userId: number): Promise<{ petals: number[]; lastUpdated?: string }> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
        SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at
        FROM ${tRes}
        WHERE user_id = ?
          AND (parent_id IS NULL OR parent_id = 0)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [userId]
    )

    const row = rows?.[0]
    if (!row) {
      return { petals: PETAL_IDS.map(() => 0.3) }
    }

    const scores = PETAL_IDS.map((id) => Number((row as any)?.[id] ?? 0))
    const maxVal = Math.max(1, ...scores)
    const petals = scores.map((v) => Math.min(1, Math.max(0, v / maxVal)))

    return {
      petals,
      lastUpdated: row.created_at ? String(row.created_at) : undefined,
    }
  } catch {
    return { petals: PETAL_IDS.map(() => 0.3) }
  }
}

async function getChannelIdBetween(userA: number, userB: number): Promise<number | null> {
  const pool = getPool()
  const tCh = table('fleur_chat_channels')
  const ua = Math.min(userA, userB)
  const ub = Math.max(userA, userB)

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tCh} WHERE user_a = ? AND user_b = ? LIMIT 1`,
      [ua, ub]
    )
    const id = rows?.[0]?.id ? Number(rows[0].id) : null
    return id && Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

function petalsArrayToRecord(petals: number[] | null | undefined): Record<string, number> {
  const arr = Array.isArray(petals) ? petals : []
  const out: Record<string, number> = {}
  for (const [i, id] of PETAL_IDS.entries()) {
    const v = arr[i]
    out[id] = Number.isFinite(v) ? Math.max(0, Math.min(1, Number(v))) : 0.3
  }
  return out
}

export async function assertCoachHasAcceptedPatient(params: {
  coachUserId: number
  patientUserId: number
}): Promise<{ intentionIds: string[] }> {
  const { coachUserId, patientUserId } = params
  if (!isDbConfigured()) return { intentionIds: [] }

  const pool = getPool()
  const tSeeds = table('fleur_social_seeds')

  // Uniquement seeds créées par le coach courant.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT intention_id
     FROM ${tSeeds}
     WHERE from_user_id = ? AND to_user_id = ? AND status = 'accepted'`,
    [coachUserId, patientUserId]
  )

  const intentionIds = Array.from(
    new Set(
      (rows ?? [])
        .map((r) => String((r as any)?.intention_id ?? '').trim())
        .filter(Boolean)
    )
  )

  if (!intentionIds.length) {
    // Relation non trouvée => on considère que le coach n'a pas accès.
    const err = new Error('Patient non lié à ce coach')
    ;(err as any).status = 403
    throw err
  }

  return { intentionIds }
}

/** E-mails patients (seeds acceptées, coach → patient) normalisés en minuscules. */
export async function listCoachPatientEmailsNormalized(coachUserId: number): Promise<string[]> {
  if (!isDbConfigured() || !coachUserId) return []
  const pool = getPool()
  const tSeeds = table('fleur_social_seeds')
  const tUsers = table('users')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `
          SELECT DISTINCT u.user_email
          FROM ${tSeeds} s
          JOIN ${tUsers} u ON u.ID = s.to_user_id
          WHERE s.from_user_id = ? AND s.status = 'accepted'
        `,
      [coachUserId]
    )
    return Array.from(
      new Set(
        (rows ?? [])
          .map((r) => normalizeEmail(String((r as { user_email?: string })?.user_email ?? '')))
          .filter(Boolean)
      )
    )
  } catch {
    return []
  }
}

export async function createCoachInvitation(params: {
  coachUserId: number
  inviteEmail: string
  intentionId: string
}): Promise<{ token: string }> {
  if (!isDbConfigured()) throw new Error('Base MariaDB non configurée')
  await ensureInvitesTable()

  const pool = getPool()
  const t = TBL_INVITES()
  const token = randomBytes(16).toString('hex')
  const email = normalizeEmail(params.inviteEmail)
  const intentionId = String(params.intentionId).trim()

  if (!params.coachUserId || params.coachUserId <= 0) throw new Error('coachUserId requis')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email invalide')
  if (!intentionId) throw new Error('intentionId requis')

  await pool.execute(
    `
      INSERT INTO ${t} (coach_user_id, invite_email, intention_id, invite_token, status)
      VALUES (?, ?, ?, ?, 'pending')
    `,
    [params.coachUserId, email, intentionId, token]
  )

  return { token }
}

export async function consumeCoachInvitation(params: {
  inviteToken: string
  acceptorUserId: number
}): Promise<{ coachUserId: number; intentionId: string }> {
  if (!isDbConfigured()) throw new Error('Base MariaDB non configurée')
  await ensureInvitesTable()

  const pool = getPool()
  const tInv = TBL_INVITES()

  const inviteToken = String(params.inviteToken ?? '').trim()
  if (!inviteToken) throw new Error('inviteToken requis')
  if (!params.acceptorUserId || params.acceptorUserId <= 0) throw new Error('acceptorUserId requis')

  // Résoudre l'email de l'utilisateur acceptant (pour valider l'invitation)
  const tUsers = table('users')
  const [acceptRows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
    [params.acceptorUserId]
  )
  const acceptEmail = normalizeEmail(String(acceptRows?.[0]?.user_email ?? ''))

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, coach_user_id, invite_email, intention_id, status FROM ${tInv} WHERE invite_token = ? AND status = 'pending' LIMIT 1`,
    [inviteToken]
  )
  const inv = rows?.[0]
  if (!inv) {
    // Token déjà consommé / invalide => on considère comme "ok" pour éviter de casser un onboarding en double clic.
    return { coachUserId: 0, intentionId: '' }
  }

  const inviteId = Number(inv.id)
  const coachUserId = Number(inv.coach_user_id)
  const storedEmail = normalizeEmail(String(inv.invite_email ?? ''))
  const intentionId = String(inv.intention_id ?? '').trim()

  if (storedEmail && acceptEmail && storedEmail !== acceptEmail) {
    throw new Error('Invitation invalide pour cet utilisateur')
  }

  // Marquer invitation comme consommée (avant la création de la relation)
  await pool.execute(
    `UPDATE ${tInv} SET status = 'accepted', consumed_user_id = ?, consumed_at = NOW() WHERE id = ?`,
    [params.acceptorUserId, inviteId]
  )

  // Créer la relation sociale (seed -> lien -> canal)
  // On s'assure d'être robuste si des seeds existent déjà (ex: retry).
  try {
    const { seedId } = await sendSeed(coachUserId, params.acceptorUserId, intentionId)
    await acceptSeedConnection(seedId, params.acceptorUserId)
  } catch {
    // fallback: chercher une seed existante pending/accepted puis accepter si besoin.
    const tSeeds = table('fleur_social_seeds')
    const [existingAccepted] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1`,
      [coachUserId, params.acceptorUserId]
    )
    const accepted = existingAccepted?.[0]?.id ? Number(existingAccepted[0].id) : null
    if (accepted) return { coachUserId, intentionId }

    const [existingPending] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tSeeds} WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
      [coachUserId, params.acceptorUserId]
    )
    const pending = existingPending?.[0]?.id ? Number(existingPending[0].id) : null
    if (pending) {
      await acceptSeedConnection(pending, params.acceptorUserId)
      return { coachUserId, intentionId }
    }

    throw new Error('Impossible de créer la relation patientèle depuis l\'invitation')
  }

  return { coachUserId, intentionId }
}

export async function getCoachPatients(coachUserId: number): Promise<{ patients: CoachPatient[] }> {
  if (!isDbConfigured()) return { patients: [] }

  const pool = getPool()
  const tSeeds = table('fleur_social_seeds')

  let seedRows: RowDataPacket[] = []
  try {
    ;[seedRows] = await pool.execute<RowDataPacket[]>(
      `SELECT from_user_id, to_user_id, intention_id, updated_at
       FROM ${tSeeds}
       WHERE status = 'accepted'
         AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY updated_at DESC`,
      [coachUserId, coachUserId]
    )
  } catch {
    return { patients: [] }
  }

  const byPatient = new Map<
    number,
    {
      patientUserId: number
      intentionIds: Set<string>
    }
  >()

  for (const r of seedRows ?? []) {
    const fromId = Number((r as any).from_user_id)
    const toId = Number((r as any).to_user_id)
    const pid = fromId === coachUserId ? toId : fromId
    const intentionId = String((r as any).intention_id ?? '').trim()
    if (!pid || !intentionId) continue
    if (!byPatient.has(pid)) byPatient.set(pid, { patientUserId: pid, intentionIds: new Set() })
    byPatient.get(pid)!.intentionIds.add(intentionId)
  }

  const patientIds = Array.from(byPatient.keys())
  const tResScience = new Map<number, Awaited<ReturnType<typeof getScienceProfile>>>()

  // Best-effort: charger science en parallèle sans saturer.
  await Promise.all(
    patientIds.map(async (pid) => {
      try {
        const sp = await getScienceProfile(pid)
        tResScience.set(pid, sp)
      } catch {
        tResScience.set(pid, null)
      }
    })
  )

  const patients: Array<CoachPatient> = []
  for (const pid of patientIds) {
    const basics = await getUserBasics(pid)
    const fleurMoyenne = await getFleurMoyenne(pid)
    const channelId = await getChannelIdBetween(coachUserId, pid)
    const science = tResScience.get(pid) ?? null

    const intentionIds = Array.from(byPatient.get(pid)?.intentionIds ?? [])

    let sapBalance = 0
    try {
      sapBalance = await getSapBalance(pid)
    } catch {
      sapBalance = 0
    }
    const direct = await patientHasDirectCoachInvite(coachUserId, pid)

    patients.push({
      patientUserId: pid,
      email: basics.email,
      pseudo: basics.pseudo,
      avatarEmoji: basics.avatarEmoji,
      intentionIds,
      fleurMoyenne,
      channelId,
      science,
      sapBalance,
      acquisitionChannel: direct ? 'direct' : 'marketplace',
    })
  }

  return { patients }
}

export async function getUserCoaches(userId: number): Promise<{ coaches: CoachRelationship[] }> {
  if (!isDbConfigured()) return { coaches: [] }

  const pool = getPool()
  const tSeeds = table('fleur_social_seeds')

  let seedRows: RowDataPacket[] = []
  try {
    ;[seedRows] = await pool.execute<RowDataPacket[]>(
      `SELECT from_user_id, to_user_id, intention_id, updated_at
       FROM ${tSeeds}
       WHERE status = 'accepted'
         AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY updated_at DESC`,
      [userId, userId]
    )
  } catch {
    return { coaches: [] }
  }

  const byCoach = new Map<
    number,
    {
      coachUserId: number
      intentionIds: Set<string>
    }
  >()

  for (const r of seedRows ?? []) {
    const fromId = Number((r as any).from_user_id)
    const toId = Number((r as any).to_user_id)
    const cid = fromId === userId ? toId : fromId
    const intentionId = String((r as any).intention_id ?? '').trim()
    if (!cid || !intentionId) continue
    if (!byCoach.has(cid)) byCoach.set(cid, { coachUserId: cid, intentionIds: new Set() })
    byCoach.get(cid)!.intentionIds.add(intentionId)
  }

  const coachIds = Array.from(byCoach.keys())
  const coaches: CoachRelationship[] = []

  for (const cid of coachIds) {
    const basics = await getUserBasics(cid)
    const channelId = await getChannelIdBetween(cid, userId)
    coaches.push({
      coachUserId: cid,
      email: basics.email,
      pseudo: basics.pseudo,
      avatarEmoji: basics.avatarEmoji,
      intentionIds: Array.from(byCoach.get(cid)?.intentionIds ?? []),
      channelId,
    })
  }

  return { coaches }
}

export async function getPatientFleurMoyennePetalsRecord(patientUserId: number): Promise<{
  petalsRecord: Record<string, number>
  lastUpdated?: string
}> {
  const fm = await getFleurMoyenne(patientUserId)
  return { petalsRecord: petalsArrayToRecord(fm.petals), lastUpdated: fm.lastUpdated }
}

