/**
 * Résumés opérationnels de dyade — historique MariaDB (règle jardin-ai-token-cache).
 * Chaque génération réussie est conservée ; pas de regénération IA si la signature
 * courante existe déjà en base.
 */
import { createHash } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import type { Dyad, DyadEvent, DyadMemberProfile, DyadRitual } from './db-dyads'
import { PETAL_BY_ID, PETAL_ORDER_IDS } from './petal-theme'

const TBL = () => table('fleur_dyad_summaries')

export type DyadOperationalSummary = {
  headline: string
  climate: string
  alignments: string
  gaps: string
  nextStep: string
}

export type DyadSummaryRecord = {
  id: number
  dyadId: number
  locale: string
  signature: string
  summary: DyadOperationalSummary
  provider: string | null
  createdAt: string
}

let _ensurePromise: Promise<void> | null = null

function pickSummaryField(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function parseSummaryJson(raw: string): DyadOperationalSummary | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const headline = pickSummaryField(parsed, ['headline', 'titre', 'title'])
    if (!headline) return null
    return {
      headline,
      climate: pickSummaryField(parsed, ['climate', 'climat', 'climate_actuel']),
      alignments: pickSummaryField(parsed, ['alignments', 'alignements', 'ressources']),
      gaps: pickSummaryField(parsed, ['gaps', 'ecarts', 'écarts', 'vigilance']),
      nextStep: pickSummaryField(parsed, ['nextStep', 'next_step', 'prochaine_etape', 'next']),
    }
  } catch {
    return null
  }
}

function mapRow(r: RowDataPacket): DyadSummaryRecord | null {
  const summary = parseSummaryJson(String(r.summary_json ?? ''))
  if (!summary) return null
  return {
    id: Number(r.id),
    dyadId: Number(r.dyad_id),
    locale: String(r.locale ?? 'fr'),
    signature: String(r.signature ?? ''),
    summary,
    provider: r.provider != null ? String(r.provider) : null,
    createdAt: String(r.created_at ?? ''),
  }
}

async function migrateSummaryTable(pool: ReturnType<typeof getPool>): Promise<void> {
  const t = TBL()
  try {
    await pool.execute(`ALTER TABLE ${t} DROP INDEX uk_dyad_locale`)
  } catch {
    /* index absent */
  }
  try {
    await pool.execute(
      `ALTER TABLE ${t} ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    )
  } catch {
    /* colonne déjà présente */
  }
  try {
    await pool.execute(
      `ALTER TABLE ${t} ADD INDEX idx_dyad_locale_created (dyad_id, locale, created_at)`
    )
  } catch {
    /* déjà présent */
  }
  try {
    await pool.execute(`ALTER TABLE ${t} MODIFY signature VARCHAR(64) NOT NULL`)
  } catch {
    /* colonne déjà adaptée */
  }
}

/** Empreinte stable pour la colonne DB (évite VARCHAR(96) trop court pour l'état complet). */
export function dyadSummarySignatureHash(signature: string): string {
  return createHash('sha256').update(signature, 'utf8').digest('hex')
}

/** Compare une signature en base (hash ou ancienne forme) à l'état courant. */
export function dyadSummaryStateMatches(stored: string, logical: string): boolean {
  if (!stored || !logical) return false
  return stored === dyadSummarySignatureHash(logical) || stored === logical
}

function ensureSummaryTable(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = (async () => {
      const pool = getPool()
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${TBL()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          dyad_id INT NOT NULL,
          locale VARCHAR(8) NOT NULL DEFAULT 'fr',
          signature VARCHAR(64) NOT NULL,
          summary_json MEDIUMTEXT NOT NULL,
          provider VARCHAR(40) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_dyad_created (dyad_id, created_at),
          INDEX idx_dyad_locale_created (dyad_id, locale, created_at),
          INDEX idx_signature (signature)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      await migrateSummaryTable(pool)
    })().catch((err) => {
      _ensurePromise = null
      throw err
    })
  }
  return _ensurePromise
}

function petalLine(label: string, petals: Record<string, number> | null): string {
  if (!petals) return `${label}: (profil non disponible)`
  const parts = PETAL_ORDER_IDS.map((id) => {
    const pct = Math.round((petals[id] ?? 0) * 100)
    return `${PETAL_BY_ID[id]?.name ?? id} ${pct}%`
  })
  return `${label}: ${parts.join(', ')}`
}

/** Signature de l'état relationnel exploité par le résumé. */
export function dyadSummarySignature(input: {
  dyad: Dyad
  events: DyadEvent[]
  rituals: DyadRitual[]
  memberA: DyadMemberProfile
  memberB: DyadMemberProfile | null
}): string {
  const fleurKey = input.dyad.fleur
    ? PETAL_ORDER_IDS.map((id) => Math.round((input.dyad.fleur![id] ?? 0) * 100)).join(',')
    : 'none'
  const aKey = input.memberA.petals
    ? PETAL_ORDER_IDS.map((id) => Math.round((input.memberA.petals![id] ?? 0) * 100)).join(',')
    : 'x'
  const bKey = input.memberB?.petals
    ? PETAL_ORDER_IDS.map((id) => Math.round((input.memberB!.petals![id] ?? 0) * 100)).join(',')
    : 'x'
  const lastEv = input.events[0]?.id ?? 0
  const lastRit = input.rituals[0]?.id ?? 0
  return `d${input.dyad.id}:f${fleurKey}:e${input.events.length}:${lastEv}:r${input.rituals.length}:${lastRit}:a${aKey}:b${bKey}`
}

/** Contexte texte envoyé au modèle. */
export function buildDyadSummaryContext(input: {
  dyad: Dyad
  members: { memberA: DyadMemberProfile; memberB: DyadMemberProfile | null }
  events: DyadEvent[]
  rituals: DyadRitual[]
}): string {
  const lines: string[] = []
  lines.push(`Dyade active depuis ${input.dyad.createdAt}`)
  lines.push(petalLine(input.members.memberA.label, input.members.memberA.petals))
  if (input.members.memberB) {
    lines.push(petalLine(input.members.memberB.label, input.members.memberB.petals))
  }
  if (input.dyad.fleur) {
    lines.push(petalLine('Fleur de couple (moyenne)', input.dyad.fleur))
  }

  const activeRituals = input.rituals.filter((r) => r.active)
  if (activeRituals.length) {
    lines.push('Rituels:')
    for (const r of activeRituals.slice(0, 8)) {
      lines.push(
        `- ${r.title}${r.nextDueAt ? ` (prochain: ${r.nextDueAt})` : ''}${r.lastDoneAt ? ` (dernier fait: ${r.lastDoneAt})` : ''}`
      )
    }
  }

  const thread = input.events
    .filter((e) => e.type !== 'mediation' || e.content)
    .slice(0, 12)
  if (thread.length) {
    lines.push('Fil récent:')
    for (const e of thread) {
      const snippet =
        e.type === 'mediation'
          ? '(médiation IA)'
          : (e.content ?? '').replace(/\s+/g, ' ').slice(0, 120)
      lines.push(`- ${e.createdAt} [${e.type}] ${snippet}`)
    }
  }

  return lines.join('\n')
}

/** Dernier résumé enregistré pour cette dyade et locale. */
export async function getLatestDyadSummary(
  dyadId: number,
  locale: string
): Promise<DyadSummaryRecord | null> {
  if (!isDbConfigured()) return null
  await ensureSummaryTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE dyad_id = ? AND locale = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    [dyadId, locale]
  )
  return rows?.length ? mapRow(rows[0]) : null
}

/** Résumé déjà calculé pour cet état (signature) — évite un nouvel appel IA. */
export async function getDyadSummaryBySignature(
  dyadId: number,
  locale: string,
  signature: string
): Promise<DyadSummaryRecord | null> {
  if (!isDbConfigured()) return null
  await ensureSummaryTable()
  const pool = getPool()
  const hash = dyadSummarySignatureHash(signature)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE dyad_id = ? AND locale = ? AND signature IN (?, ?) ORDER BY created_at DESC, id DESC LIMIT 1`,
    [dyadId, locale, hash, signature]
  )
  return rows?.length ? mapRow(rows[0]) : null
}

/** Historique des résumés (plus récent en premier). */
export async function listDyadSummaryHistory(
  dyadId: number,
  locale: string,
  limit = 40
): Promise<DyadSummaryRecord[]> {
  if (!isDbConfigured()) return []
  await ensureSummaryTable()
  const pool = getPool()
  const safe = Math.min(Math.max(parseInt(String(limit), 10) || 40, 1), 80)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE dyad_id = ? AND locale = ? ORDER BY created_at DESC, id DESC LIMIT ${safe}`,
    [dyadId, locale]
  )
  return rows.map(mapRow).filter((r): r is DyadSummaryRecord => r != null)
}

/** Enregistre un nouveau résumé (append — conserve l'historique). */
export async function appendDyadSummary(input: {
  dyadId: number
  locale: string
  signature: string
  summary: DyadOperationalSummary
  provider: string
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureSummaryTable()
  const pool = getPool()
  await migrateSummaryTable(pool)
  const json = JSON.stringify({
    ...input.summary,
    cached_at: new Date().toISOString(),
    provider: input.provider,
  })
  const sigDb = dyadSummarySignatureHash(input.signature)
  const provider = String(input.provider ?? '').slice(0, 40) || null
  const conn = await pool.getConnection()
  try {
    await conn.execute(
      `INSERT INTO ${TBL()} (dyad_id, locale, signature, summary_json, provider) VALUES (?, ?, ?, ?, ?)`,
      [input.dyadId, input.locale, sigDb, json, provider]
    )
    const [rows] = await conn.query<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
    return { id: Number(rows[0]?.id) }
  } finally {
    conn.release()
  }
}

/** @deprecated Utiliser getDyadSummaryBySignature */
export async function getCachedDyadSummary(
  dyadId: number,
  locale: string,
  signature: string
): Promise<DyadOperationalSummary | null> {
  const row = await getDyadSummaryBySignature(dyadId, locale, signature)
  return row?.summary ?? null
}

/** @deprecated Utiliser appendDyadSummary */
export async function setCachedDyadSummary(
  dyadId: number,
  locale: string,
  signature: string,
  summary: DyadOperationalSummary,
  provider: string
): Promise<void> {
  await appendDyadSummary({ dyadId, locale, signature, summary, provider })
}
