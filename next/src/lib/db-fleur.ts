/**
 * Opérations Fleur / DUO sur MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table, exec } from './db'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

function formatResult(r: Record<string, unknown>): Record<string, unknown> {
  const scores: Record<string, number> = {}
  for (const p of PETALS) scores[p] = Number(r[p] ?? 0)
  let interpretation: Record<string, string> | null = null
  const raw = r.ai_interpretation
  if (raw && typeof raw === 'string') {
    try {
      const d = JSON.parse(raw) as Record<string, string>
      if (d?.summary || d?.insights || d?.reflection) interpretation = d
    } catch {
      /* ignore */
    }
  }
  const out: Record<string, unknown> = {
    id: Number(r.id),
    email: r.email ?? null,
    token: r.token ?? null,
    parent_id: r.parent_id ? Number(r.parent_id) : null,
    partner_email: r.partner_email ?? null,
    created_at: r.created_at,
    scores,
    interpretation,
  }
  if (r.user_id != null && r.user_id !== '') out.user_id = Number(r.user_id)
  return out
}

async function formatResultWithProfile(
  r: Record<string, unknown>,
  pool: Awaited<ReturnType<typeof getPool>>
): Promise<Record<string, unknown>> {
  const out = formatResult(r)
  const uid = r.user_id != null && r.user_id !== '' ? Number(r.user_id) : null
  if (!uid) return out
  try {
    const tblUsers = table('users')
    const tblMeta = table('usermeta')
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT display_name FROM ${tblUsers} WHERE ID = ?`,
      [uid]
    )
    const u = uRows[0]
    if (u?.display_name?.trim()) out.display_name = u.display_name.trim()
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tblMeta} WHERE user_id = ? AND meta_key = 'fleur_pseudo'`,
      [uid]
    )
    const p = pRows[0]
    if (p?.meta_value?.trim()) out.pseudo = String(p.meta_value).trim()
  } catch {
    /* ignore */
  }
  return out
}

/** Charge les questions d'une définition (ritual_definitions, ritual_questions, ritual_question_choices) */
export async function getQuestions(
  slug: string,
  locale: 'fr' | 'en' | 'es'
): Promise<Array<{ id: number; key: string; label: string; position: number; choices: Array<{ id: number; label: string; dimension: string; position: number }> }>> {
  const pool = getPool()
  const tDef = table('ritual_definitions')
  const tQ = table('ritual_questions')
  const tC = table('ritual_question_choices')

  const [defRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tDef} WHERE slug = ?`,
    [slug]
  )
  const def = defRows[0]
  if (!def) throw new Error('Definition not found')

  const defId = Number(def.id)
  const qLabelCol = locale === 'fr' ? 'q.label' : `COALESCE(q.label_${locale}, q.label)`
  const cLabelCol = locale === 'fr' ? 'c.label' : `COALESCE(c.label_${locale}, c.label)`

  let rows: RowDataPacket[]
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT q.id AS q_id, q.question_key, ${qLabelCol} AS q_label, q.position AS q_pos,
              c.id AS c_id, ${cLabelCol} AS c_label, c.dimension, c.position AS c_pos
       FROM ${tQ} q
       JOIN ${tC} c ON c.question_id = q.id
       WHERE q.definition_id = ?
       ORDER BY q.position, c.position`,
      [defId]
    )
    rows = r
  } catch {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT q.id AS q_id, q.question_key, q.label AS q_label, q.position AS q_pos,
              c.id AS c_id, c.label AS c_label, c.dimension, c.position AS c_pos
       FROM ${tQ} q
       JOIN ${tC} c ON c.question_id = q.id
       WHERE q.definition_id = ?
       ORDER BY q.position, c.position`,
      [defId]
    )
    rows = r
  }

  const byQid = new Map<number, { id: number; key: string; label: string; position: number; choices: Array<{ id: number; label: string; dimension: string; position: number }> }>()
  for (const row of rows) {
    const qid = Number(row.q_id)
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        id: qid,
        key: String(row.question_key ?? qid),
        label: String(row.q_label ?? ''),
        position: Number(row.q_pos ?? 0),
        choices: [],
      })
    }
    byQid.get(qid)!.choices.push({
      id: Number(row.c_id),
      label: String(row.c_label ?? ''),
      dimension: String(row.dimension ?? ''),
      position: Number(row.c_pos ?? 0),
    })
  }
  return Array.from(byQid.values()).sort((a, b) => a.position - b.position)
}

/** Soumet un questionnaire Fleur */
export async function submitFleur(payload: {
  definition_slug: string
  consent: boolean
  answers: Array<{ question_id: number; dimension_chosen: string; choice_label?: string }>
  user_id?: number
  email?: string
  partner_token?: string
  intended_duo?: boolean
}): Promise<{ result_id: number; token: string; scores: Record<string, number> }> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const tAns = table('fleur_amour_answers')
  const tDef = table('ritual_definitions')
  const tQ = table('ritual_questions')

  if (!payload.consent) throw new Error('Consent required')
  if (payload.answers.length !== 24) throw new Error('24 answers required')

  const [defRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${tDef} WHERE slug = ?`,
    [payload.definition_slug]
  )
  const def = defRows[0]
  if (!def) throw new Error('Definition not found')
  const defId = Number(def.id)

  const scores: Record<string, number> = { agape: 0, philautia: 0, mania: 0, storge: 0, pragma: 0, philia: 0, ludus: 0, eros: 0 }
  for (const a of payload.answers) {
    const dim = String(a.dimension_chosen ?? '').toLowerCase()
    if (dim in scores) scores[dim]++
  }

  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(15))).toString('hex')
  let parentId: number | null = null
  if (payload.partner_token) {
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${tRes} WHERE token = ?`,
      [payload.partner_token]
    )
    if (pRows[0]) parentId = Number(pRows[0].id)
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await pool.execute(
    `INSERT INTO ${tRes} (email, token, parent_id, user_id, intended_duo, agape, philautia, mania, storge, pragma, philia, ludus, eros, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.email ?? '',
      token,
      parentId,
      payload.user_id ?? null,
      payload.intended_duo ? 1 : 0,
      scores.agape,
      scores.philautia,
      scores.mania,
      scores.storge,
      scores.pragma,
      scores.philia,
      scores.ludus,
      scores.eros,
      now,
    ]
  )
  const [idRows] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
  const rid = Number((idRows[0] as { id: number }).id)

  const qids = payload.answers.map((a) => a.question_id)
  const placeholders = qids.map(() => '?').join(',')
  const [qRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, position FROM ${tQ} WHERE id IN (${placeholders})`,
    qids
  )
  const posMap = new Map(qRows.map((r) => [Number(r.id), Number(r.position)]))

  for (const a of payload.answers) {
    await pool.execute(
      `INSERT INTO ${tAns} (result_id, definition_id, question_id, question_position, dimension_chosen, choice_label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rid, defId, a.question_id, posMap.get(a.question_id) ?? 0, a.dimension_chosen ?? '', a.choice_label ?? null, now]
    )
  }

  return { result_id: rid, token, scores }
}

/** Récupère un résultat par ID */
export async function getResult(resultId: number, userId?: string): Promise<Record<string, unknown>> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${tRes} WHERE id = ?`, [resultId])
  const row = rows[0]
  if (!row) throw new Error('Result not found')

  if (userId) {
    const rowUserId = row.user_id != null && row.user_id !== '' ? Number(row.user_id) : null
    let allowed = rowUserId === Number(userId)
    const parentId = row.parent_id ? Number(row.parent_id) : null
    if (!allowed && parentId) {
      const [pRows] = await pool.execute<RowDataPacket[]>(`SELECT user_id FROM ${tRes} WHERE id = ?`, [parentId])
      allowed = pRows[0] && Number(pRows[0].user_id) === Number(userId)
    }
    if (!allowed && rowUserId != null) throw new Error('Accès non autorisé')
  }

  return formatResult(row as unknown as Record<string, unknown>)
}

/** Récupère les réponses d'un résultat */
export async function getAnswers(
  resultId: number,
  userId: string
): Promise<{ result_id: number; email: string | null; answers: Array<{ dimension_chosen: string; choice_label: string | null; position: number; question: string }> }> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const tAns = table('fleur_amour_answers')
  const tQ = table('ritual_questions')

  const [resRows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${tRes} WHERE id = ?`, [resultId])
  const res = resRows[0]
  if (!res) throw new Error('Result not found')

  const resultUserId = res.user_id != null && res.user_id !== '' ? Number(res.user_id) : 0
  const parentId = Number(res.parent_id ?? 0)
  let allowed = resultUserId === Number(userId)
  if (!allowed && parentId > 0) {
    const [pRows] = await pool.execute<RowDataPacket[]>(`SELECT user_id FROM ${tRes} WHERE id = ?`, [parentId])
    allowed = !!(pRows[0] && Number(pRows[0].user_id) === Number(userId))
  }
  if (!allowed) throw new Error('Accès non autorisé à ces réponses')

  const [ansRows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.dimension_chosen, a.choice_label, q.position, q.label AS question
     FROM ${tAns} a
     JOIN ${tQ} q ON q.id = a.question_id
     WHERE a.result_id = ?
     ORDER BY q.position`,
    [resultId]
  )

  return {
    result_id: resultId,
    email: res.email ?? null,
    answers: ansRows.map((r) => ({
      dimension_chosen: String(r.dimension_chosen ?? ''),
      choice_label: r.choice_label ?? null,
      position: Number(r.position ?? 0),
      question: String(r.question ?? ''),
    })),
  }
}

/** Liste les résultats d'un utilisateur (Mes Fleurs) */
export async function getMyResults(userId: string): Promise<{ items: Array<Record<string, unknown>> }> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.* FROM ${tRes} r WHERE r.user_id = ? ORDER BY r.created_at DESC`,
    [userId]
  )

  const seen = new Set<string>()
  const items: Array<Record<string, unknown>> = []

  for (const r of rows) {
    let token: string | null = null
    let isDuo = false

    if (r.parent_id != null) {
      const [pRows] = await pool.execute<RowDataPacket[]>(`SELECT token FROM ${tRes} WHERE id = ?`, [r.parent_id])
      token = pRows[0]?.token ?? null
      isDuo = true
    } else {
      token = r.token ?? null
      const [cRows] = await pool.execute<RowDataPacket[]>(`SELECT 1 FROM ${tRes} WHERE parent_id = ?`, [r.id])
      isDuo = cRows.length > 0 || !!r.intended_duo
    }

    if (!token || seen.has(token)) continue
    seen.add(token)

    const item: Record<string, unknown> = {
      token,
      type: isDuo ? 'duo' : 'solo',
      id: Number(r.id),
      created_at: r.created_at,
    }
    if (isDuo) {
      const rootId = r.parent_id ? Number(r.parent_id) : Number(r.id)
      const [cntRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM ${tRes} WHERE id = ? OR parent_id = ?`,
        [rootId, rootId]
      )
      const count = Number(cntRows[0]?.cnt ?? 0)
      item.status = count >= 2 ? 'complete' : 'waiting_partner'
      if (r.parent_id != null) {
        const [pRows] = await pool.execute<RowDataPacket[]>(`SELECT email FROM ${tRes} WHERE id = ?`, [r.parent_id])
        item.partner_email = pRows[0]?.email ?? null
      } else {
        const [cRows] = await pool.execute<RowDataPacket[]>(
          `SELECT email FROM ${tRes} WHERE parent_id = ? LIMIT 1`,
          [r.id]
        )
        item.partner_email = cRows[0]?.email ?? null
        if (item.status === 'waiting_partner' && r.invited_email) {
          item.invited_email = String(r.invited_email).trim()
        }
      }
    }
    items.push(item)
  }

  return { items }
}

/** Récupère le résultat DUO par token */
export async function getDuoResult(
  token: string
): Promise<{ status: 'waiting_partner' | 'complete'; token: string; person_a: Record<string, unknown>; person_b?: Record<string, unknown> }> {
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${tRes} WHERE token = ? ORDER BY id`,
    [token]
  )

  if (rows.length === 0) throw new Error('Token not found')
  const rowA = rows[0] as unknown as Record<string, unknown>

  const [rowBRows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${tRes} WHERE parent_id = ?`, [Number(rowA.id)])
  const rowB = rowBRows[0]

  if (!rowB) {
    return {
      status: 'waiting_partner',
      token,
      person_a: await formatResultWithProfile(rowA, pool),
    }
  }

  return {
    status: 'complete',
    token,
    person_a: await formatResultWithProfile(rowA, pool),
    person_b: await formatResultWithProfile(rowB as unknown as Record<string, unknown>, pool),
  }
}

/** Prévient le créateur du Duo (personne A) lorsque le partenaire a soumis ses réponses. */
export async function notifyDuoPartnerSubmitted(partnerToken: string, submittingUserId: number): Promise<void> {
  if (!partnerToken || !submittingUserId) return
  try {
    const pool = getPool()
    const tRes = table('fleur_amour_results')
    const tUsers = table('users')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, user_id, email, token FROM ${tRes} WHERE token = ? LIMIT 1`,
      [partnerToken.trim()]
    )
    const row = rows[0]
    if (!row) return
    const ownerId = row.user_id != null && row.user_id !== '' ? Number(row.user_id) : 0
    if (!ownerId || ownerId === submittingUserId) return

    const [urows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_email FROM ${tUsers} WHERE ID = ? LIMIT 1`,
      [ownerId]
    )
    const email = urows[0]?.user_email ? String(urows[0].user_email) : null

    const title = 'Duo complété'
    const body = 'Ton partenaire a terminé son questionnaire Duo. Vous pouvez voir le résultat commun.'
    const tok = String(row.token ?? partnerToken)
    const actionUrl = `/duo?token=${encodeURIComponent(tok)}`

    const { createNotification } = await import('./db-notifications')
    const { sendFcmPush } = await import('./fcm')
    await createNotification({
      type: 'duo_partner_submitted',
      title,
      body,
      action_url: actionUrl,
      recipient_type: 'user',
      recipient_id: ownerId,
      recipient_email: email,
      created_by: submittingUserId,
    })
    await sendFcmPush(ownerId, email, title, body, actionUrl)
  } catch {
    /* optionnel */
  }
}
