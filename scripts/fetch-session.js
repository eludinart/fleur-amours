#!/usr/bin/env node
/**
 * Récupère une session Jardin depuis MariaDB (dev uniquement).
 * Usage:
 *   node scripts/fetch-session.js           → dernière session
 *   node scripts/fetch-session.js 42        → session id=42
 *   node scripts/fetch-session.js --list    → liste des 10 dernières sessions
 *
 * Config : .env (MARIADB_*, LOCAL_*, DB_*).
 * MariaDB sur VPS : tunnel SSH requis avant exécution, ex. ssh -L 3307:localhost:3306 user@vps
 */
import { createPool } from 'mysql2/promise'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const paths = [resolve(ROOT, '.env')]
  const env = { ...process.env }
  for (const p of paths) {
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  return env
}

const env = loadEnv()
const DB_HOST = env.MARIADB_HOST || (env.TUNNEL_LOCAL_PORT ? '127.0.0.1' : env.DB_HOST) || 'localhost'
const DB_PORT = parseInt(env.MARIADB_PORT || env.TUNNEL_LOCAL_PORT || env.DB_PORT || '3306', 10)
const DB_NAME = env.MARIADB_DATABASE || env.DB_NAME || env.LOCAL_DB || 'default'
const DB_USER = env.MARIADB_USER || env.DB_USER || env.LOCAL_USER || 'mariadb'
const DB_PASS = env.MARIADB_PASSWORD || env.LOCAL_PASS || env.DB_PASSWORD || env.DB_PASS || ''
const PREFIX = env.DB_PREFIX || 'wp_'
const tbl = () => `${PREFIX}fleur_sessions`

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function main() {
  if (!DB_PASS) {
    console.error('❌ MARIADB_PASSWORD ou LOCAL_PASS requis. Vérifiez .env')
    process.exit(1)
  }

  const pool = createPool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS,
  })

  const arg = process.argv[2]
  const listOnly = arg === '--list' || arg === '-l'
  const t = tbl()

  try {
    if (listOnly) {
      const [rows] = await pool.execute(
        `SELECT id, email, first_words, door_suggested, turn_count, status, created_at FROM ${t} ORDER BY created_at DESC LIMIT 10`
      )
      const items = rows || []
      console.log('\n📋 Dernières sessions (10)\n')
      for (const s of items) {
        console.log(`  #${s.id}  ${formatDate(s.created_at)}  ${s.turn_count} tours  ${s.status}  ${(s.first_words || '').slice(0, 50)}...`)
      }
      console.log('')
      return
    }

    let sessionId = arg ? parseInt(arg, 10) : null
    if (!sessionId) {
      const [rows] = await pool.execute(
        `SELECT id FROM ${t} ORDER BY created_at DESC LIMIT 1`
      )
      const items = rows || []
      if (!items.length) {
        console.error('Aucune session trouvée.')
        process.exit(1)
      }
      sessionId = items[0].id
      console.log(`\n📌 Session la plus récente : #${sessionId}\n`)
    }

    const [rows] = await pool.execute(
      `SELECT id, email, first_words, door_suggested, petals_json, history_json, cards_json, anchors_json, plan14j_json, step_data_json, doors_locked, turn_count, status, duration_seconds, created_at FROM ${t} WHERE id = ?`,
      [sessionId]
    )
    const r = (rows || [])[0]
    if (!r) {
      console.error('Session introuvable.')
      process.exit(1)
    }

    const cardsRaw = JSON.parse(r.cards_json || '[]')
    const cards = Array.isArray(cardsRaw) ? cardsRaw : []
    const session = {
      id: Number(r.id),
      email: r.email,
      first_words: r.first_words,
      door_suggested: r.door_suggested,
      petals: JSON.parse(r.petals_json || '{}'),
      history: JSON.parse(r.history_json || '[]'),
      cards_drawn: cards,
      anchors: JSON.parse(r.anchors_json || '[]'),
      step_data: JSON.parse(r.step_data_json || 'null'),
      doors_locked: r.doors_locked ? r.doors_locked.split(',') : [],
      turn_count: Number(r.turn_count),
      status: r.status,
      duration_seconds: Number(r.duration_seconds),
      created_at: r.created_at,
    }

    console.log('═══════════════════════════════════════════════════')
    console.log(`  Session #${session.id}`)
    console.log('═══════════════════════════════════════════════════')
    console.log(`  Date       : ${formatDate(session.created_at)}`)
    console.log(`  Email      : ${session.email || '—'}`)
    console.log(`  Porte      : ${session.door_suggested ?? '—'}`)
    console.log(`  Tours      : ${session.turn_count}`)
    console.log(`  Statut     : ${session.status}`)
    console.log(`  Durée      : ${session.duration_seconds ? Math.round(session.duration_seconds / 60) + ' min' : '—'}`)
    console.log('')

    if (session.first_words) {
      console.log('── Premiers mots (seuil) ─────────────────────────────')
      console.log(session.first_words)
      console.log('')
    }

    const userMsgs = (session.history || []).filter((m) => m.role === 'user')
    if (userMsgs.length) {
      console.log('── Vos messages (interactions) ────────────────────────')
      userMsgs.forEach((m, i) => {
        const txt = (m.content ?? '').trim()
        if (txt) console.log(`\n  [${i + 1}] ${txt}`)
      })
      console.log('')
    }

    const anchors = session.anchors || []
    if (anchors.length) {
      console.log('── Ancres (synthèses par porte) ───────────────────────')
      const doorLabels = { love: 'Cœur', vegetal: 'Temps', elements: 'Climat', life: 'Histoire' }
      anchors.forEach((a) => {
        const door = doorLabels[a.door] ?? a.subtitle ?? a.door
        console.log(`\n  ${door}:`)
        if (a.synthesis) console.log(`    « ${a.synthesis} »`)
        if (a.habit) console.log(`    Habitude: ${a.habit}`)
      })
      console.log('')
    }

    if (process.argv.includes('--json')) {
      console.log('── JSON brut ──────────────────────────────────────────')
      console.log(JSON.stringify(session, null, 2))
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('Erreur:', e.message)
  process.exit(1)
})
