/**
 * Agrégation lecture seule pour fiche staff (coach / admin) : compte WP,
 * historiques produit (questionnaire, dreamscape, tarot), science, SAP, coaches liés.
 */
import type { RowDataPacket } from 'mysql2'
import type { Pool } from 'mysql2/promise'
import { table } from '@/lib/db'
import { getScienceProfile } from '@/lib/science-db'
import { readLegacySapSum } from '@/lib/db-sap'

function trunc(s: string, n: number): string {
  const t = String(s ?? '').trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

function previewFromScienceItems(items: unknown[], max = 6): string[] {
  const out: string[] = []
  for (const it of items ?? []) {
    if (out.length >= max) break
    if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>
      const text = o.text ?? o.statement ?? o.label ?? o.title ?? o.summary
      if (typeof text === 'string' && text.trim()) {
        out.push(trunc(text, 160))
        continue
      }
    }
    try {
      out.push(trunc(JSON.stringify(it), 120))
    } catch {
      out.push('—')
    }
  }
  return out
}

function tarotSummary(payload: Record<string, unknown>): string {
  const q = payload.question ?? payload.prompt ?? payload.topic ?? payload.spreadLabel
  if (typeof q === 'string' && q.trim()) return trunc(q, 140)
  const cards = payload.cards ?? payload.drawn
  if (Array.isArray(cards) && cards.length) {
    const names = cards
      .slice(0, 4)
      .map((c) => (c && typeof c === 'object' ? (c as { name?: string }).name : null))
      .filter(Boolean)
    if (names.length) return `Cartes : ${names.join(', ')}`
  }
  return 'Tirage'
}

export type PatientStaffOverview = {
  account: {
    user_id: number
    email: string
    login: string
    display_name: string
    registered_at: string | null
    pseudo: string | null
    bio_preview: string | null
    avatar_emoji: string | null
    app_role: string | null
    user_status: number | null
  } | null
  linked_coaches: Array<{
    user_id: number
    email: string
    display_name: string
  }>
  questionnaire_results: Array<{
    id: number
    created_at: string | null
    token: string
    intended_duo: boolean
    scores: Record<string, number>
  }>
  dreamscape_walks: Array<{
    id: number
    created_at: string | null
    poetic_preview: string | null
    petals: Record<string, number>
  }>
  tarot_readings: Array<{
    id: string
    type: string
    created_at: string | null
    summary: string
  }>
  science: {
    generated_at: string
    generation_version: string
    facts_count: number
    hypotheses_count: number
    facts_preview: string[]
    hypotheses_preview: string[]
  } | null
  sap_total: number | null
  usage_month: {
    period: string
    chat_messages_count: number
    sessions_count: number
    tirages_count: number
    fleur_submits_count: number
  } | null
}

const PETAL_SCORE_COLS = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
] as const

export async function fetchPatientStaffOverview(pool: Pool, emailNorm: string): Promise<PatientStaffOverview> {
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const tRoles = table('fleur_app_roles')
  const tSeeds = table('fleur_social_seeds')
  const tDream = table('fleur_dreamscape')
  const tTarot = table('fleur_tarot_readings')
  const tAmour = table('fleur_amour_results')
  const tUsage = table('fleur_user_usage_monthly')

  const empty: PatientStaffOverview = {
    account: null,
    linked_coaches: [],
    questionnaire_results: [],
    dreamscape_walks: [],
    tarot_readings: [],
    science: null,
    sap_total: null,
    usage_month: null,
  }

  let userId: number | null = null

  try {
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ID, user_login, user_email, display_name, user_registered, user_status
       FROM ${tUsers} WHERE LOWER(TRIM(user_email)) = ? LIMIT 1`,
      [emailNorm]
    )
    const u = uRows?.[0]
    if (u) {
      userId = Number(u.ID)
      let pseudo: string | null = null
      let bio: string | null = null
      let avatar_emoji: string | null = null
      let app_role: string | null = null
      try {
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT meta_key, meta_value FROM ${tMeta}
           WHERE user_id = ? AND meta_key IN ('fleur_pseudo','fleur_bio','fleur_avatar_emoji')`,
          [userId]
        )
        const meta: Record<string, string> = {}
        for (const r of mRows ?? []) {
          meta[String(r.meta_key)] = String(r.meta_value ?? '')
        }
        pseudo = meta.fleur_pseudo?.trim() || null
        bio = meta.fleur_bio?.trim() || null
        avatar_emoji = meta.fleur_avatar_emoji?.trim() || null
      } catch {
        /* ignore */
      }
      try {
        const [rRows] = await pool.execute<RowDataPacket[]>(
          `SELECT app_role FROM ${tRoles} WHERE user_id = ? LIMIT 1`,
          [userId]
        )
        app_role = rRows?.[0]?.app_role != null ? String(rRows[0].app_role) : null
      } catch {
        /* ignore */
      }
      empty.account = {
        user_id: userId,
        email: String(u.user_email ?? emailNorm),
        login: String(u.user_login ?? ''),
        display_name: String(u.display_name ?? ''),
        registered_at: u.user_registered != null ? String(u.user_registered) : null,
        pseudo,
        bio_preview: bio ? trunc(bio, 280) : null,
        avatar_emoji,
        app_role,
        user_status: u.user_status != null ? Number(u.user_status) : null,
      }
    }
  } catch {
    /* users table */
  }

  if (userId != null) {
    try {
      const [cRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT s.from_user_id AS cid, uc.user_email AS coach_email, uc.display_name AS coach_name
        FROM ${tSeeds} s
        JOIN ${tUsers} uc ON uc.ID = s.from_user_id
        WHERE s.to_user_id = ? AND s.status = 'accepted'
        `,
        [userId]
      )
      empty.linked_coaches = (cRows ?? []).map((r) => ({
        user_id: Number(r.cid),
        email: String(r.coach_email ?? ''),
        display_name: String(r.coach_name ?? ''),
      }))
    } catch {
      /* seeds */
    }

    try {
      empty.sap_total = await readLegacySapSum(pool, userId)
    } catch {
      empty.sap_total = null
    }

    try {
      const period = new Date().toISOString().slice(0, 7)
      const [usRows] = await pool.execute<RowDataPacket[]>(
        `SELECT chat_messages_count, sessions_count, tirages_count, fleur_submits_count
         FROM ${tUsage} WHERE user_id = ? AND period = ? LIMIT 1`,
        [userId, period]
      )
      const ur = usRows?.[0]
      if (ur) {
        empty.usage_month = {
          period,
          chat_messages_count: Math.max(0, Number(ur.chat_messages_count) || 0),
          sessions_count: Math.max(0, Number(ur.sessions_count) || 0),
          tirages_count: Math.max(0, Number(ur.tirages_count) || 0),
          fleur_submits_count: Math.max(0, Number(ur.fleur_submits_count) || 0),
        }
      }
    } catch {
      /* usage table may not exist */
    }

    try {
      const prof = await getScienceProfile(userId)
      if (prof) {
        empty.science = {
          generated_at: prof.generated_at,
          generation_version: prof.generation_version,
          facts_count: prof.facts?.length ?? 0,
          hypotheses_count: prof.hypotheses?.length ?? 0,
          facts_preview: previewFromScienceItems(prof.facts ?? []),
          hypotheses_preview: previewFromScienceItems(prof.hypotheses ?? []),
        }
      }
    } catch {
      /* science */
    }

    try {
      const [dRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, created_at, poetic_reflection, petals_json
         FROM ${tDream} WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
        [String(userId)]
      )
      empty.dreamscape_walks = (dRows ?? []).map((r) => {
        let petals: Record<string, number> = {}
        try {
          petals = JSON.parse(String(r.petals_json || '{}'))
        } catch {
          petals = {}
        }
        return {
          id: Number(r.id),
          created_at: r.created_at != null ? String(r.created_at) : null,
          poetic_preview: r.poetic_reflection ? trunc(String(r.poetic_reflection), 220) : null,
          petals,
        }
      })
    } catch {
      /* dreamscape */
    }

    try {
      const [tarRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, type, payload, created_at FROM ${tTarot}
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`,
        [userId]
      )
      empty.tarot_readings = (tarRows ?? []).map((r) => {
        let payload: Record<string, unknown> = {}
        try {
          const raw = r.payload
          if (typeof raw === 'string') payload = JSON.parse(raw || '{}')
          else if (raw && typeof raw === 'object') payload = raw as Record<string, unknown>
        } catch {
          payload = {}
        }
        return {
          id: String(r.id ?? ''),
          type: String(r.type ?? 'simple'),
          created_at: r.created_at != null ? String(r.created_at) : null,
          summary: tarotSummary(payload),
        }
      })
    } catch {
      /* tarot */
    }

    const scoreSelect = PETAL_SCORE_COLS.map((c) => `r.${c}`).join(', ')
    try {
      const [amRows] = await pool.execute<RowDataPacket[]>(
        `SELECT r.id, r.token, r.created_at, r.intended_duo, ${scoreSelect}
         FROM ${tAmour} r
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC LIMIT 15`,
        [userId]
      )
      empty.questionnaire_results = (amRows ?? []).map((r) => {
        const scores: Record<string, number> = {}
        for (const k of PETAL_SCORE_COLS) scores[k] = Number(r[k] ?? 0) || 0
        return {
          id: Number(r.id),
          created_at: r.created_at != null ? String(r.created_at) : null,
          token: String(r.token ?? ''),
          intended_duo: Number(r.intended_duo ?? 0) === 1,
          scores,
        }
      })
    } catch {
      /* amour */
    }
  }

  /* Questionnaire / tarot par email seul (sans user_id ou anciennes lignes) */
  try {
    const scoreSelect = PETAL_SCORE_COLS.map((c) => `r.${c}`).join(', ')
    const [amRows2] = await pool.execute<RowDataPacket[]>(
      `SELECT r.id, r.token, r.created_at, r.intended_duo, r.user_id, ${scoreSelect}
       FROM ${tAmour} r
       WHERE LOWER(TRIM(r.email)) = ?
       ORDER BY r.created_at DESC LIMIT 15`,
      [emailNorm]
    )
    const seen = new Set(empty.questionnaire_results.map((x) => x.id))
    for (const r of amRows2 ?? []) {
      const id = Number(r.id)
      if (seen.has(id)) continue
      seen.add(id)
      const scores: Record<string, number> = {}
      for (const k of PETAL_SCORE_COLS) scores[k] = Number(r[k] ?? 0) || 0
      empty.questionnaire_results.push({
        id,
        created_at: r.created_at != null ? String(r.created_at) : null,
        token: String(r.token ?? ''),
        intended_duo: Number(r.intended_duo ?? 0) === 1,
        scores,
      })
    }
    empty.questionnaire_results.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
    empty.questionnaire_results = empty.questionnaire_results.slice(0, 20)
  } catch {
    /* */
  }

  try {
    const [tarRows2] = await pool.execute<RowDataPacket[]>(
      `SELECT id, type, payload, created_at FROM ${tTarot}
       WHERE LOWER(TRIM(email)) = ? AND (user_id IS NULL OR user_id = 0)
       ORDER BY created_at DESC LIMIT 20`,
      [emailNorm]
    )
    const seenT = new Set(empty.tarot_readings.map((x) => x.id))
    for (const r of tarRows2 ?? []) {
      const id = String(r.id ?? '')
      if (seenT.has(id)) continue
      seenT.add(id)
      let payload: Record<string, unknown> = {}
      try {
        const raw = r.payload
        if (typeof raw === 'string') payload = JSON.parse(raw || '{}')
        else if (raw && typeof raw === 'object') payload = raw as Record<string, unknown>
      } catch {
        payload = {}
      }
      empty.tarot_readings.push({
        id,
        type: String(r.type ?? 'simple'),
        created_at: r.created_at != null ? String(r.created_at) : null,
        summary: tarotSummary(payload),
      })
    }
    empty.tarot_readings.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })
    empty.tarot_readings = empty.tarot_readings.slice(0, 50)
  } catch {
    /* */
  }

  return empty
}
