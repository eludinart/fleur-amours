/**
 * « À deux » — profils ancre (historique) + paires duo multi-invitations.
 *
 * Modèle :
 *  - fleur_anchor : questionnaire rempli une fois par un utilisateur (porte ou complet).
 *  - duo_pairing  : invitation liée à un ancre ; plusieurs pairings par ancre.
 */
import crypto from 'crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import {
  calculateBetaScore,
  FLEUR_BETA_CHOICE_VALUES,
  orderQuestionsForPorte,
  type FleurBetaAnswerInput,
  type FleurBetaDoorKey,
} from './fleur-beta-data'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
const ALLOWED_BETA_VALUES = new Set(FLEUR_BETA_CHOICE_VALUES.map((v) => v))

const TBL_ANCHOR = () => table('fleur_anchor')
const TBL_PAIRING = () => table('duo_pairing')

export type QuestionnaireType = 'porte' | 'complet'

export type FleurAnchorRow = {
  id: number
  user_id: number
  questionnaire_type: QuestionnaireType
  porte: string | null
  questionnaire_version: string
  scores: Record<string, number>
  answers_json: unknown
  label: string | null
  created_at: string
}

export type DuoPairingRow = {
  id: number
  anchor_id: number
  invite_token: string
  invited_email: string | null
  partner_user_id: number | null
  partner_anchor_id: number | null
  status: 'pending' | 'complete'
  duo_interpretation_json: string | null
  couple_dyad_id: number | null
  created_at: string
  completed_at: string | null
}

function scoresFromDbRow(r: RowDataPacket): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PETALS) out[p] = Number(r[p] ?? 0)
  return out
}

function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(15))).toString('hex')
}

/** Convertit les scores 0–1 (porte) en échelle 0–5 pour l'UI duo héritée. */
export function scoresForDuoDisplay(
  scores: Record<string, number>,
  questionnaireType: QuestionnaireType
): Record<string, number> {
  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const max = vals.length ? Math.max(...vals) : 0
  if (questionnaireType === 'porte' || max <= 1.05) {
    return Object.fromEntries(
      PETALS.map((p) => [p, Math.round((scores[p] ?? 0) * 5 * 10) / 10])
    )
  }
  return { ...scores }
}

export async function ensureADeuxTables(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL_ANCHOR()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      questionnaire_type VARCHAR(16) NOT NULL DEFAULT 'porte',
      porte VARCHAR(32) DEFAULT NULL,
      questionnaire_version VARCHAR(32) NOT NULL DEFAULT 'porte-v1',
      agape DECIMAL(8,6) NOT NULL DEFAULT 0,
      philautia DECIMAL(8,6) NOT NULL DEFAULT 0,
      mania DECIMAL(8,6) NOT NULL DEFAULT 0,
      storge DECIMAL(8,6) NOT NULL DEFAULT 0,
      pragma DECIMAL(8,6) NOT NULL DEFAULT 0,
      philia DECIMAL(8,6) NOT NULL DEFAULT 0,
      ludus DECIMAL(8,6) NOT NULL DEFAULT 0,
      eros DECIMAL(8,6) NOT NULL DEFAULT 0,
      answers_json LONGTEXT NOT NULL,
      label VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_anchor_user (user_id, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL_PAIRING()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      anchor_id INT NOT NULL,
      invite_token VARCHAR(64) NOT NULL,
      invited_email VARCHAR(255) DEFAULT NULL,
      partner_user_id INT DEFAULT NULL,
      partner_anchor_id INT DEFAULT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      duo_interpretation_json LONGTEXT DEFAULT NULL,
      couple_dyad_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      UNIQUE KEY uk_invite_token (invite_token),
      INDEX idx_pairing_anchor (anchor_id),
      INDEX idx_pairing_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  return true
}

async function formatAnchorWithProfile(
  r: RowDataPacket,
  pool: Awaited<ReturnType<typeof getPool>>
): Promise<Record<string, unknown>> {
  const scores = scoresFromDbRow(r)
  const qType = String(r.questionnaire_type ?? 'porte') as QuestionnaireType
  let answers: unknown = []
  try {
    answers = JSON.parse(String(r.answers_json ?? '[]'))
  } catch {
    answers = []
  }
  const out: Record<string, unknown> = {
    id: Number(r.id),
    user_id: Number(r.user_id),
    questionnaire_type: qType,
    porte: r.porte ? String(r.porte) : null,
    questionnaire_version: String(r.questionnaire_version ?? ''),
    scores,
    scores_display: scoresForDuoDisplay(scores, qType),
    answers,
    label: r.label ? String(r.label) : null,
    created_at: r.created_at,
  }
  const uid = Number(r.user_id)
  if (!uid) return out
  try {
    const tblUsers = table('users')
    const tblMeta = table('usermeta')
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT display_name, user_email FROM ${tblUsers} WHERE ID = ?`,
      [uid]
    )
    const u = uRows[0]
    if (u?.display_name?.trim()) out.display_name = String(u.display_name).trim()
    if (u?.user_email?.trim()) out.email = String(u.user_email).trim()
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tblMeta} WHERE user_id = ? AND meta_key = 'fleur_pseudo'`,
      [uid]
    )
    if (pRows[0]?.meta_value?.trim()) out.pseudo = String(pRows[0].meta_value).trim()
  } catch {
    /* ignore */
  }
  return out
}

export async function createAnchorPorte(params: {
  userId: number
  porte: FleurBetaDoorKey
  answers: FleurBetaAnswerInput[]
  label?: string | null
}): Promise<{ id: number; scores: Record<string, number> }> {
  await ensureADeuxTables()
  const ordered = orderQuestionsForPorte(params.porte)
  if (params.answers.length !== ordered.length) {
    throw new Error(`${ordered.length} réponses requises`)
  }
  for (const a of params.answers) {
    const v = Number(a.value)
    if (!ALLOWED_BETA_VALUES.has(v as (typeof FLEUR_BETA_CHOICE_VALUES)[number])) {
      throw new Error('Valeur de réponse invalide')
    }
  }
  const scores = calculateBetaScore(ordered, params.answers)
  const pool = getPool()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [ins] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_ANCHOR()} (
      user_id, questionnaire_type, porte, questionnaire_version,
      agape, philautia, mania, storge, pragma, philia, ludus, eros,
      answers_json, label, created_at
    ) VALUES (?, 'porte', ?, 'porte-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.userId,
      params.porte,
      scores.agape,
      scores.philautia,
      scores.mania,
      scores.storge,
      scores.pragma,
      scores.philia,
      scores.ludus,
      scores.eros,
      JSON.stringify(params.answers),
      params.label?.trim() || null,
      now,
    ]
  )
  return { id: Number(ins.insertId), scores }
}

export async function createAnchorComplet(params: {
  userId: number
  answers: Array<{ question_id: number; dimension_chosen: string; choice_label?: string }>
  label?: string | null
}): Promise<{ id: number; scores: Record<string, number> }> {
  await ensureADeuxTables()
  if (params.answers.length !== 24) throw new Error('24 réponses requises')
  const scores: Record<string, number> = {
    agape: 0,
    philautia: 0,
    mania: 0,
    storge: 0,
    pragma: 0,
    philia: 0,
    ludus: 0,
    eros: 0,
  }
  for (const a of params.answers) {
    const dim = String(a.dimension_chosen ?? '').toLowerCase()
    if (dim in scores) scores[dim]++
  }
  const pool = getPool()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [ins] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_ANCHOR()} (
      user_id, questionnaire_type, porte, questionnaire_version,
      agape, philautia, mania, storge, pragma, philia, ludus, eros,
      answers_json, label, created_at
    ) VALUES (?, 'complet', NULL, 'complet-v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.userId,
      scores.agape,
      scores.philautia,
      scores.mania,
      scores.storge,
      scores.pragma,
      scores.philia,
      scores.ludus,
      scores.eros,
      JSON.stringify(params.answers),
      params.label?.trim() || null,
      now,
    ]
  )
  return { id: Number(ins.insertId), scores }
}

export async function getAnchor(anchorId: number, userId?: number): Promise<Record<string, unknown> | null> {
  await ensureADeuxTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    userId != null
      ? `SELECT * FROM ${TBL_ANCHOR()} WHERE id = ? AND user_id = ? LIMIT 1`
      : `SELECT * FROM ${TBL_ANCHOR()} WHERE id = ? LIMIT 1`,
    userId != null ? [anchorId, userId] : [anchorId]
  )
  const r = rows[0]
  if (!r) return null
  return formatAnchorWithProfile(r, pool)
}

export async function listAnchors(userId: number): Promise<Record<string, unknown>[]> {
  await ensureADeuxTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL_ANCHOR()} WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  )
  return Promise.all(rows.map((r) => formatAnchorWithProfile(r, pool)))
}

export async function deleteAnchor(anchorId: number, userId: number): Promise<boolean> {
  await ensureADeuxTables()
  const pool = getPool()
  const [pairings] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${TBL_PAIRING()} WHERE anchor_id = ?`,
    [anchorId]
  )
  if (pairings.length) {
    const ids = pairings.map((p) => Number(p.id))
    const ph = ids.map(() => '?').join(',')
    await pool.execute(`DELETE FROM ${TBL_PAIRING()} WHERE id IN (${ph})`, ids)
  }
  const [res] = await pool.execute<ResultSetHeader>(
    `DELETE FROM ${TBL_ANCHOR()} WHERE id = ? AND user_id = ?`,
    [anchorId, userId]
  )
  return Number(res.affectedRows ?? 0) > 0
}

export async function createPairing(params: {
  anchorId: number
  userId: number
  invitedEmail?: string | null
}): Promise<{ id: number; invite_token: string }> {
  await ensureADeuxTables()
  const pool = getPool()
  const anchor = await getAnchor(params.anchorId, params.userId)
  if (!anchor) throw new Error('Profil ancre introuvable')

  const token = newToken()
  const email = params.invitedEmail?.trim().toLowerCase() || null
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [ins] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_PAIRING()} (anchor_id, invite_token, invited_email, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [params.anchorId, token, email, now]
  )
  return { id: Number(ins.insertId), invite_token: token }
}

export async function getPairingByToken(token: string): Promise<{
  pairing: DuoPairingRow
  anchor: Record<string, unknown>
  partner_anchor: Record<string, unknown> | null
} | null> {
  await ensureADeuxTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL_PAIRING()} WHERE invite_token = ? LIMIT 1`,
    [token.trim()]
  )
  const p = rows[0]
  if (!p) return null

  const [aRows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL_ANCHOR()} WHERE id = ? LIMIT 1`,
    [Number(p.anchor_id)]
  )
  const a = aRows[0]
  if (!a) return null

  let partnerAnchor: Record<string, unknown> | null = null
  if (p.partner_anchor_id) {
    const [paRows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${TBL_ANCHOR()} WHERE id = ? LIMIT 1`,
      [Number(p.partner_anchor_id)]
    )
    if (paRows[0]) partnerAnchor = await formatAnchorWithProfile(paRows[0], pool)
  }

  return {
    pairing: {
      id: Number(p.id),
      anchor_id: Number(p.anchor_id),
      invite_token: String(p.invite_token),
      invited_email: p.invited_email ? String(p.invited_email) : null,
      partner_user_id: p.partner_user_id != null ? Number(p.partner_user_id) : null,
      partner_anchor_id: p.partner_anchor_id != null ? Number(p.partner_anchor_id) : null,
      status: p.status === 'complete' ? 'complete' : 'pending',
      duo_interpretation_json: p.duo_interpretation_json ? String(p.duo_interpretation_json) : null,
      couple_dyad_id: p.couple_dyad_id != null ? Number(p.couple_dyad_id) : null,
      created_at: String(p.created_at ?? ''),
      completed_at: p.completed_at ? String(p.completed_at) : null,
    },
    anchor: await formatAnchorWithProfile(a, pool),
    partner_anchor: partnerAnchor,
  }
}

export async function completePairing(params: {
  inviteToken: string
  partnerUserId: number
  partnerAnchorId: number
}): Promise<void> {
  await ensureADeuxTables()
  const pool = getPool()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE ${TBL_PAIRING()} SET
      partner_user_id = ?, partner_anchor_id = ?, status = 'complete', completed_at = ?
     WHERE invite_token = ? AND status = 'pending'`,
    [params.partnerUserId, params.partnerAnchorId, now, params.inviteToken.trim()]
  )
  if (Number(res.affectedRows ?? 0) === 0) {
    throw new Error('Invitation invalide ou déjà complétée')
  }
}

export async function listPairingsForUser(userId: number): Promise<Record<string, unknown>[]> {
  await ensureADeuxTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.*, a.questionnaire_type, a.porte, a.label AS anchor_label, a.user_id AS anchor_user_id
     FROM ${TBL_PAIRING()} p
     INNER JOIN ${TBL_ANCHOR()} a ON a.id = p.anchor_id
     WHERE a.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  )

  const items: Record<string, unknown>[] = []
  for (const r of rows) {
    const anchor = await getAnchor(Number(r.anchor_id))
    let partnerLabel = r.invited_email ? String(r.invited_email) : null
    if (r.partner_anchor_id) {
      const pa = await getAnchor(Number(r.partner_anchor_id))
      if (pa) {
        partnerLabel =
          (pa.display_name as string) ||
          (pa.pseudo as string) ||
          (pa.email as string) ||
          partnerLabel
      }
    }
    items.push({
      id: Number(r.id),
      invite_token: String(r.invite_token),
      status: r.status === 'complete' ? 'complete' : 'pending',
      invited_email: r.invited_email ? String(r.invited_email) : null,
      partner_label: partnerLabel,
      anchor_id: Number(r.anchor_id),
      anchor_label: r.anchor_label ? String(r.anchor_label) : null,
      questionnaire_type: String(r.questionnaire_type ?? 'porte'),
      porte: r.porte ? String(r.porte) : null,
      created_at: r.created_at,
      completed_at: r.completed_at ?? null,
      couple_dyad_id: r.couple_dyad_id != null ? Number(r.couple_dyad_id) : null,
      anchor,
    })
  }
  return items
}

/** Résultat duo au format attendu par l'UI (compatible DuoPage). */
export async function getDuoPairingResult(token: string): Promise<{
  status: 'waiting_partner' | 'complete'
  token: string
  questionnaire_type: QuestionnaireType
  porte: string | null
  pairing_id: number
  invited_email?: string | null
  person_a: Record<string, unknown>
  person_b?: Record<string, unknown>
}> {
  const data = await getPairingByToken(token)
  if (!data) throw new Error('Token not found')

  const qType = (data.anchor.questionnaire_type as QuestionnaireType) ?? 'porte'
  const personA = {
    ...data.anchor,
    scores: data.anchor.scores_display ?? data.anchor.scores,
  }

  if (data.pairing.status !== 'complete' || !data.partner_anchor) {
    return {
      status: 'waiting_partner',
      token,
      questionnaire_type: qType,
      porte: data.anchor.porte as string | null,
      pairing_id: data.pairing.id,
      invited_email: data.pairing.invited_email,
      person_a: personA,
    }
  }

  const personB = {
    ...data.partner_anchor,
    scores: data.partner_anchor.scores_display ?? data.partner_anchor.scores,
  }

  return {
    status: 'complete',
    token,
    questionnaire_type: qType,
    porte: data.anchor.porte as string | null,
    pairing_id: data.pairing.id,
    invited_email: data.pairing.invited_email,
    person_a: personA,
    person_b: personB,
  }
}

export async function deletePairing(pairingId: number, userId: number): Promise<boolean> {
  await ensureADeuxTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id FROM ${TBL_PAIRING()} p
     INNER JOIN ${TBL_ANCHOR()} a ON a.id = p.anchor_id
     WHERE p.id = ? AND a.user_id = ?`,
    [pairingId, userId]
  )
  if (!rows[0]) return false
  const [res] = await pool.execute<ResultSetHeader>(`DELETE FROM ${TBL_PAIRING()} WHERE id = ?`, [
    pairingId,
  ])
  return Number(res.affectedRows ?? 0) > 0
}

export async function invitePairingByEmail(params: {
  inviteToken: string
  fromUserId: number
  partnerEmail: string
  inviteUrl: string
  inviterName?: string
}): Promise<{ sent: boolean; error?: string }> {
  const data = await getPairingByToken(params.inviteToken)
  if (!data) throw new Error('Invitation introuvable')
  if (Number(data.anchor.user_id) !== params.fromUserId) throw new Error('Non autorisé')
  if (data.pairing.status === 'complete') throw new Error('Ce duo est déjà complété')

  const pool = getPool()
  await pool.execute(`UPDATE ${TBL_PAIRING()} SET invited_email = ? WHERE invite_token = ?`, [
    params.partnerEmail.trim().toLowerCase(),
    params.inviteToken.trim(),
  ])

  const inviter = params.inviterName?.trim() || "Quelqu'un"
  const anchor = data.anchor
  const scores = (anchor.scores_display ?? anchor.scores) as Record<string, number>
  const qType = String(anchor.questionnaire_type ?? 'porte')
  const inviterDisplay =
    (anchor.pseudo as string | undefined)?.trim() ||
    (anchor.display_name as string | undefined)?.trim() ||
    inviter
  const { sendDuoInviteEmail } = await import('./email')
  const result = await sendDuoInviteEmail({
    to: params.partnerEmail.trim(),
    inviterName: inviter,
    inviterDisplayName: inviterDisplay,
    inviteUrl: params.inviteUrl,
    scores: scores ?? {},
    kind: qType === 'complet' ? 'a_deux_complet' : 'a_deux_porte',
    porteKey: anchor.porte ? String(anchor.porte) : null,
    ctaLabel: 'Rejoindre le parcours',
  })

  if (result.sent) {
    try {
      const { createNotification } = await import('./db-notifications')
      await createNotification({
        type: 'a_deux_invite',
        title: 'Invitation À deux',
        body: `${inviter} vous invite à un parcours À deux.`,
        action_url: params.inviteUrl.replace(/^https?:\/\/[^/]+/, ''),
        recipient_type: 'user',
        recipient_email: params.partnerEmail.trim().toLowerCase(),
        created_by: params.fromUserId,
      })
    } catch {
      /* optionnel */
    }
  }

  return result
}

export async function notifyPairingCompleted(inviteToken: string, partnerUserId: number): Promise<void> {
  const data = await getPairingByToken(inviteToken)
  if (!data) return
  const ownerId = Number(data.anchor.user_id)
  if (!ownerId || ownerId === partnerUserId) return
  try {
    const pool = getPool()
    const tblUsers = table('users')
    const [urows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_email FROM ${tblUsers} WHERE ID = ? LIMIT 1`,
      [ownerId]
    )
    const email = urows[0]?.user_email ? String(urows[0].user_email) : null
    const actionUrl = `/a-deux/result?token=${encodeURIComponent(inviteToken)}`
    const { createNotification } = await import('./db-notifications')
    const { sendFcmPush } = await import('./fcm')
    const title = 'Duo complété'
    const body = 'Votre partenaire a terminé son questionnaire. Vous pouvez voir la synthèse.'
    await createNotification({
      type: 'a_deux_partner_submitted',
      title,
      body,
      action_url: actionUrl,
      recipient_type: 'user',
      recipient_id: ownerId,
      recipient_email: email,
      created_by: partnerUserId,
    })
    await sendFcmPush(ownerId, email, title, body, actionUrl)
  } catch {
    /* optionnel */
  }
}

export async function getDashboard(userId: number): Promise<{
  anchors: Record<string, unknown>[]
  pairings: Record<string, unknown>[]
}> {
  const [anchors, pairings] = await Promise.all([listAnchors(userId), listPairingsForUser(userId)])
  return { anchors, pairings }
}
