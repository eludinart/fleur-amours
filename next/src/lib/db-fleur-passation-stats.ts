/**
 * Statistiques admin des passations Fleur (table fleur_amour_results).
 * Une passation « racine » = ligne avec parent_id NULL (solo ou début duo).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

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
  return {
    id: Number(r.id),
    email: r.email ?? null,
    token: r.token ?? null,
    parent_id: r.parent_id ? Number(r.parent_id) : null,
    created_at: r.created_at,
    scores,
    interpretation,
  }
}

function rootWhere(t: string): string {
  return `(r.parent_id IS NULL OR r.parent_id = 0)`
}

function isDuoExpr(t: string): string {
  return `(IFNULL(r.intended_duo, 0) != 0 OR EXISTS (SELECT 1 FROM ${t} c WHERE c.parent_id = r.id))`
}

export async function getPassationStatsOverview(): Promise<{
  total: number
  total_solo: number
  total_duo: number
  top_petals: { petal: string; count: number }[]
}> {
  const pool = getPool()
  const t = table('fleur_amour_results')
  const [aggRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN NOT ${isDuoExpr(t)} THEN 1 ELSE 0 END) AS total_solo,
       SUM(CASE WHEN ${isDuoExpr(t)} THEN 1 ELSE 0 END) AS total_duo
     FROM ${t} r
     WHERE ${rootWhere(t)}`
  )
  const agg = aggRows[0] ?? {}
  const [topRows] = await pool.execute<RowDataPacket[]>(
    `SELECT dominant AS petal, COUNT(*) AS count FROM (
       SELECT r.id,
         ELT(
           FIELD(GREATEST(r.agape, r.philautia, r.mania, r.storge, r.pragma, r.philia, r.ludus, r.eros),
             r.agape, r.philautia, r.mania, r.storge, r.pragma, r.philia, r.ludus, r.eros),
           'agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'
         ) AS dominant
       FROM ${t} r
       WHERE ${rootWhere(t)}
     ) q
     GROUP BY dominant
     ORDER BY count DESC
     LIMIT 8`
  )
  const top_petals = topRows.map((row) => ({
    petal: String(row.petal ?? ''),
    count: Number(row.count ?? 0),
  }))
  return {
    total: Number(agg.total ?? 0),
    total_solo: Number(agg.total_solo ?? 0),
    total_duo: Number(agg.total_duo ?? 0),
    top_petals,
  }
}

export async function getPassationStatsAverages(since?: string | null): Promise<{
  averages: Record<string, number>
  count: number
}> {
  const pool = getPool()
  const t = table('fleur_amour_results')
  const cols = PETALS.map((p) => `AVG(r.${p}) AS ${p}`).join(', ')
  const params: (string | number)[] = []
  let dateClause = ''
  if (since && /^\d{4}-\d{2}-\d{2}/.test(since)) {
    dateClause = ' AND r.created_at >= ?'
    params.push(since)
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt, ${cols}
     FROM ${t} r
     WHERE ${rootWhere(t)}${dateClause}`,
    params
  )
  const row = rows[0] ?? {}
  const count = Number(row.cnt ?? 0)
  const averages: Record<string, number> = {}
  for (const p of PETALS) {
    averages[p] = count > 0 ? Math.round(Number(row[p] ?? 0) * 100) / 100 : 0
  }
  return { averages, count }
}

export type PassationListRow = {
  id: number
  email: string | null
  is_duo: boolean
  created_at: string
}

export async function listPassationRoots(options: {
  page: number
  perPage: number
  search?: string
  soloOnly?: boolean
  duoOnly?: boolean
}): Promise<{ results: PassationListRow[]; total: number; pages: number }> {
  const pool = getPool()
  const t = table('fleur_amour_results')
  const page = Math.max(1, options.page)
  const perPage = Math.min(100, Math.max(1, options.perPage))
  const offset = (page - 1) * perPage

  const conditions: string[] = [rootWhere(t)]
  const params: (string | number)[] = []

  const search = (options.search ?? '').trim().slice(0, 200)
  if (search) {
    const esc = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like = `%${esc}%`
    conditions.push(
      `(r.email LIKE ? OR EXISTS (SELECT 1 FROM ${t} c WHERE c.parent_id = r.id AND c.email LIKE ?))`
    )
    params.push(like, like)
  }
  if (options.soloOnly) {
    conditions.push(`NOT ${isDuoExpr(t)}`)
  }
  if (options.duoOnly) {
    conditions.push(isDuoExpr(t))
  }

  const whereSql = conditions.join(' AND ')

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${t} r WHERE ${whereSql}`,
    params
  )
  const total = Number(countRows[0]?.n ?? 0)
  const pages = Math.max(1, Math.ceil(total / perPage))

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.email, r.created_at, r.intended_duo,
            EXISTS (SELECT 1 FROM ${t} c WHERE c.parent_id = r.id) AS has_child
     FROM ${t} r
     WHERE ${whereSql}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  )

  const results: PassationListRow[] = rows.map((r) => {
    const is_duo = Number(r.intended_duo ?? 0) !== 0 || !!r.has_child
    return {
      id: Number(r.id),
      email: r.email != null && String(r.email).trim() !== '' ? String(r.email) : null,
      is_duo,
      created_at: String(r.created_at ?? ''),
    }
  })

  return { results, total, pages }
}

export async function getAdminPassationDetail(resultId: number): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  const t = table('fleur_amour_results')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${t} WHERE id = ?`, [resultId])
  let root = rows[0] as unknown as Record<string, unknown> | undefined
  if (!root) return null
  if (root.parent_id) {
    const pid = Number(root.parent_id)
    const [prows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${t} WHERE id = ?`, [pid])
    root = prows[0] as unknown as Record<string, unknown> | undefined
    if (!root) return null
  }
  const rootId = Number(root.id)
  const [children] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${t} WHERE parent_id = ? ORDER BY id ASC`,
    [rootId]
  )
  const child = children[0] as unknown as Record<string, unknown> | undefined
  const is_duo = Number(root.intended_duo ?? 0) !== 0 || !!child
  const out: Record<string, unknown> = {
    ...formatResult(root),
    is_duo,
    intended_duo: Number(root.intended_duo ?? 0) !== 0,
  }
  if (child) {
    out.partner = formatResult(child)
  }
  return out
}

export async function deletePassationClusterById(resultId: number): Promise<boolean> {
  const pool = getPool()
  const t = table('fleur_amour_results')
  const tAns = table('fleur_amour_answers')
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id, parent_id FROM ${t} WHERE id = ?`, [resultId])
  const row = rows[0]
  if (!row) return false
  const rootId = row.parent_id ? Number(row.parent_id) : Number(row.id)

  const [childRows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM ${t} WHERE parent_id = ?`, [rootId])
  for (const c of childRows) {
    const cid = Number(c.id)
    await pool.execute(`DELETE FROM ${tAns} WHERE result_id = ?`, [cid])
    await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [cid])
  }
  await pool.execute(`DELETE FROM ${tAns} WHERE result_id = ?`, [rootId])
  await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [rootId])
  return true
}
