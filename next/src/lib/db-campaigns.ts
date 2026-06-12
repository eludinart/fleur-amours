/**
 * Campagnes rituelles — tables wp_ritual_* (WordPress / MariaDB).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomBytes } from 'crypto'
import { getPool, isDbConfigured, table } from './db'

async function tableColumns(tbl: string): Promise<Set<string>> {
  const pool = getPool()
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM ${tbl}`)
    return new Set(rows.map((r) => String(r.Field ?? '')))
  } catch {
    return new Set()
  }
}

function pickCol(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) if (cols.has(c)) return c
  return null
}

export async function listCampaignDefinitions(): Promise<Array<{ id: number; label: string; slug?: string }>> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tDef = table('ritual_definitions')
  const cols = await tableColumns(tDef)
  if (!cols.has('id')) return []
  const labelCol = pickCol(cols, ['label', 'title', 'name', 'slug']) ?? 'id'
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, ${labelCol} AS label FROM ${tDef} ORDER BY id ASC`
  )
  return rows.map((r) => ({
    id: Number(r.id),
    label: String(r.label ?? `Définition #${r.id}`),
  }))
}

export async function listCampaigns(params: {
  page?: number
  per_page?: number
}): Promise<{ campaigns: Array<Record<string, unknown>>; total: number }> {
  if (!isDbConfigured()) return { campaigns: [], total: 0 }
  const pool = getPool()
  const tCamp = table('ritual_campaigns')
  const cols = await tableColumns(tCamp)
  if (!cols.has('id')) return { campaigns: [], total: 0 }

  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(50, Math.max(1, params.per_page ?? 15))
  const offset = (page - 1) * perPage

  const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM ${tCamp}`)
  const total = Number(countRows[0]?.c ?? 0)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${tCamp} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [perPage, offset]
  )

  const tPart = table('ritual_participants')
  const tRes = table('ritual_results')
  const partCols = await tableColumns(tPart)
  const resCols = await tableColumns(tRes)

  const campaigns = await Promise.all(
    rows.map(async (r) => {
      const id = Number(r.id)
      let participant_count = 0
      let result_count = 0
      if (partCols.has('campaign_id')) {
        const [p] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS c FROM ${tPart} WHERE campaign_id = ?`,
          [id]
        )
        participant_count = Number(p[0]?.c ?? 0)
      }
      if (resCols.has('campaign_id')) {
        const [res] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS c FROM ${tRes} WHERE campaign_id = ?`,
          [id]
        )
        result_count = Number(res[0]?.c ?? 0)
      }
      return {
        id,
        definition_id: Number(r.definition_id ?? r.ritual_definition_id ?? 0),
        status: String(r.status ?? 'draft'),
        created_at: r.created_at ? String(r.created_at) : null,
        participant_count,
        result_count,
      }
    })
  )

  return { campaigns, total }
}

export async function getCampaign(id: number): Promise<Record<string, unknown> | null> {
  if (!isDbConfigured() || !id) return null
  const pool = getPool()
  const tCamp = table('ritual_campaigns')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${tCamp} WHERE id = ?`, [id])
  const r = rows[0]
  if (!r) return null

  const tPart = table('ritual_participants')
  const partCols = await tableColumns(tPart)
  let participants: Array<Record<string, unknown>> = []
  if (partCols.has('campaign_id')) {
    const [pRows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${tPart} WHERE campaign_id = ? ORDER BY id ASC`,
      [id]
    )
    participants = pRows.map((p) => ({
      id: Number(p.id),
      email: p.email ? String(p.email) : p.participant_email ? String(p.participant_email) : null,
      status: String(p.status ?? 'pending'),
    }))
  }

  const tRes = table('ritual_results')
  const resCols = await tableColumns(tRes)
  let result_count = 0
  if (resCols.has('campaign_id')) {
    const [res] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${tRes} WHERE campaign_id = ?`,
      [id]
    )
    result_count = Number(res[0]?.c ?? 0)
  }

  return {
    id: Number(r.id),
    definition_id: Number(r.definition_id ?? r.ritual_definition_id ?? 0),
    status: String(r.status ?? 'draft'),
    created_at: r.created_at ? String(r.created_at) : null,
    participant_count: participants.length,
    result_count,
    participants,
  }
}

export async function getCampaignResults(campaignId: number): Promise<Array<Record<string, unknown>>> {
  if (!isDbConfigured() || !campaignId) return []
  const pool = getPool()
  const tRes = table('ritual_results')
  const cols = await tableColumns(tRes)
  if (!cols.has('id') || !cols.has('campaign_id')) return []

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${tRes} WHERE campaign_id = ? ORDER BY id DESC`,
    [campaignId]
  )

  return rows.map((r) => {
    let payload: Record<string, unknown> = {}
    const raw = r.payload ?? r.result_json ?? r.data
    if (raw && typeof raw === 'string') {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
      } catch {
        payload = { raw }
      }
    } else if (raw && typeof raw === 'object') {
      payload = raw as Record<string, unknown>
    }
    return {
      id: Number(r.id),
      created_at: r.created_at ? String(r.created_at) : null,
      payload,
    }
  })
}

export async function createCampaign(params: {
  definition_id: number
  recipient_emails: string[]
  token_ttl_hours?: number
}): Promise<{ campaign_id: number; tokens: Array<{ email: string; token: string }> }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  const tCamp = table('ritual_campaigns')
  const tPart = table('ritual_participants')
  const tTok = table('ritual_tokens')

  const defId = Number(params.definition_id)
  if (!defId) throw new Error('definition_id requis')
  const emails = [...new Set(params.recipient_emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (!emails.length) throw new Error('recipient_emails requis')

  const campCols = await tableColumns(tCamp)
  if (!campCols.has('id')) throw new Error('Table ritual_campaigns indisponible')

  const defCol = campCols.has('definition_id') ? 'definition_id' : campCols.has('ritual_definition_id') ? 'ritual_definition_id' : null
  const statusCol = campCols.has('status') ? 'status' : null

  let campaignId = 0
  if (defCol && statusCol) {
    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${tCamp} (${defCol}, ${statusCol}, created_at) VALUES (?, 'draft', NOW())`,
      [defId]
    )
    campaignId = Number(ins.insertId)
  } else if (defCol) {
    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${tCamp} (${defCol}) VALUES (?)`,
      [defId]
    )
    campaignId = Number(ins.insertId)
  } else {
    const [ins] = await pool.execute<ResultSetHeader>(`INSERT INTO ${tCamp} () VALUES ()`)
    campaignId = Number(ins.insertId)
  }

  const partCols = await tableColumns(tPart)
  const tokCols = await tableColumns(tTok)
  const tokens: Array<{ email: string; token: string }> = []
  const ttlHours = Math.min(720, Math.max(1, Number(params.token_ttl_hours ?? 72)))

  for (const email of emails) {
    let participantId = 0
    if (partCols.has('campaign_id')) {
      const emailCol = pickCol(partCols, ['email', 'participant_email']) ?? 'email'
      const statusColP = partCols.has('status') ? ', status' : ''
      const statusVal = partCols.has('status') ? ", 'pending'" : ''
      const [pIns] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ${tPart} (campaign_id, ${emailCol}${statusColP}) VALUES (?, ?${statusVal})`,
        [campaignId, email]
      )
      participantId = Number(pIns.insertId)
    }

    if (tokCols.has('token')) {
      const token = randomBytes(24).toString('hex')
      const cols: string[] = []
      const vals: Array<string | number> = []
      if (tokCols.has('campaign_id')) {
        cols.push('campaign_id')
        vals.push(campaignId)
      }
      if (tokCols.has('participant_id') && participantId) {
        cols.push('participant_id')
        vals.push(participantId)
      }
      cols.push('token')
      vals.push(token)
      if (tokCols.has('expires_at')) {
        cols.push('expires_at')
        vals.push(new Date(Date.now() + ttlHours * 3600_000).toISOString().slice(0, 19).replace('T', ' '))
      }
      await pool.execute(
        `INSERT INTO ${tTok} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        vals
      )
      tokens.push({ email, token })
    }
  }

  return { campaign_id: campaignId, tokens }
}

export async function createCampaignDefinition(params: {
  label: string
  slug?: string
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  const tDef = table('ritual_definitions')
  const cols = await tableColumns(tDef)
  if (!cols.has('id')) throw new Error('Table ritual_definitions indisponible')

  const label = String(params.label ?? '').trim()
  if (!label) throw new Error('label requis')
  const slug = String(params.slug ?? label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (cols.has('slug') && cols.has('label')) {
    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${tDef} (slug, label) VALUES (?, ?)`,
      [slug, label]
    )
    return { id: Number(ins.insertId) }
  }
  if (cols.has('title')) {
    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ${tDef} (title) VALUES (?)`,
      [label]
    )
    return { id: Number(ins.insertId) }
  }
  const [ins] = await pool.execute<ResultSetHeader>(`INSERT INTO ${tDef} () VALUES ()`)
  return { id: Number(ins.insertId) }
}
