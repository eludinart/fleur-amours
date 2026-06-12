/**
 * GET  /api/notifications/preferences — préférences de notification de l'utilisateur.
 * POST /api/notifications/preferences — sauvegarde (JSON dans usermeta).
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAuth } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'

export const dynamic = 'force-dynamic'

const META_KEY = 'fleur_notification_prefs'

type Prefs = {
  in_app_enabled: boolean
  email_enabled: boolean
  email_digest: string
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

const DEFAULT_PREFS: Prefs = {
  in_app_enabled: true,
  email_enabled: true,
  email_digest: 'instant',
  quiet_hours_start: null,
  quiet_hours_end: null,
}

const DIGEST_VALUES = new Set(['instant', 'daily', 'weekly', 'never'])

function clampHour(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(n, 0), 23)
}

function normalizePrefs(raw: Record<string, unknown>): Prefs {
  return {
    in_app_enabled: raw.in_app_enabled !== false,
    email_enabled: raw.email_enabled !== false,
    email_digest: DIGEST_VALUES.has(String(raw.email_digest)) ? String(raw.email_digest) : 'instant',
    quiet_hours_start: clampHour(raw.quiet_hours_start),
    quiet_hours_end: clampHour(raw.quiet_hours_end),
  }
}

async function readPrefs(userId: number): Promise<Prefs> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (!rows?.length) return { ...DEFAULT_PREFS }
  try {
    return normalizePrefs(JSON.parse(String(rows[0].meta_value ?? '{}')))
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

async function writePrefs(userId: number, prefs: Prefs): Promise<void> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const json = JSON.stringify(prefs)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (existing?.length) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE umeta_id = ?`, [
      json,
      Number(existing[0].umeta_id),
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, META_KEY, json]
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json(DEFAULT_PREFS)
    const prefs = await readPrefs(parseInt(userId, 10))
    return NextResponse.json(prefs)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const prefs = normalizePrefs(body)
    await writePrefs(parseInt(userId, 10), prefs)
    return NextResponse.json(prefs)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
