#!/usr/bin/env node
/**
 * Exécute la migration 010 — channel_id nullable (fleur_notifications)
 * Usage: node next/scripts/run-migration-010.js [--production]
 *
 * Par défaut : tunnel VPS (127.0.0.1:3307, LOCAL_*). Tunnel doit être actif.
 * --production : base Hostinger (DB_*) pour le site déployé.
 */
import { createPool } from 'mysql2/promise'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(ROOT, '../.env'),
  resolve(ROOT, '.env.local'),
]
for (const p of envPaths) {
  if (existsSync(p)) {
    config({ path: p })
    break
  }
}

const env = process.env
const useTunnel = !!env.TUNNEL_LOCAL_PORT
const DB_HOST = env.MARIADB_HOST || (useTunnel ? '127.0.0.1' : env.DB_HOST) || 'localhost'
const DB_PORT = parseInt(env.MARIADB_PORT || env.TUNNEL_LOCAL_PORT || env.DB_PORT || '3306', 10)
// Tunnel = LOCAL_*, sinon MARIADB_* ou DB_*
const DB_NAME = useTunnel ? (env.LOCAL_DB || 'default') : (env.MARIADB_DATABASE || env.DB_NAME || env.LOCAL_DB || 'default')
const DB_USER = useTunnel ? (env.LOCAL_USER || 'mariadb') : (env.MARIADB_USER || env.DB_USER || env.LOCAL_USER || 'mariadb')
const DB_PASSWORD = useTunnel ? (env.LOCAL_PASS || '') : (env.MARIADB_PASSWORD || env.LOCAL_PASS || env.DB_PASS || '')
const DB_PREFIX = env.DB_PREFIX || 'wp_'

if (!DB_PASSWORD) {
  console.error('❌ MARIADB_PASSWORD ou LOCAL_PASS requis. Vérifiez .env')
  process.exit(1)
}

const pool = createPool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
})

const notificationsTbl = `${DB_PREFIX}fleur_notifications`
const deliveriesTbl = `${DB_PREFIX}fleur_notification_deliveries`
const chatMessagesTbl = `${DB_PREFIX}fleur_chat_messages`

async function hasColumn(pool, table, col) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, col]
  )
  return rows && rows.length > 0
}

async function ensureChannelIdNullable(pool, table) {
  const exists = await hasColumn(pool, table, 'channel_id')
  if (exists) {
    await pool.execute(`ALTER TABLE ${table} MODIFY COLUMN channel_id INT NULL`)
    console.log(`✓ ${table}.channel_id → nullable`)
  } else {
    await pool.execute(`ALTER TABLE ${table} ADD COLUMN channel_id INT NULL`)
    console.log(`✓ ${table}.channel_id ajouté (nullable)`)
  }
}

async function main() {
  console.log(`Connexion à ${DB_HOST}:${DB_PORT}/${DB_NAME}…`)

  const [tables] = await pool.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?)`,
    [DB_NAME, notificationsTbl, deliveriesTbl, chatMessagesTbl]
  )
  const found = (tables || []).map((r) => r.TABLE_NAME)

  if (found.includes(notificationsTbl)) {
    await ensureChannelIdNullable(pool, notificationsTbl)
  } else {
    console.log(`ℹ ${notificationsTbl} n'existe pas (ignoré)`)
  }

  if (found.includes(deliveriesTbl)) {
    await ensureChannelIdNullable(pool, deliveriesTbl)
  } else {
    console.log(`ℹ ${deliveriesTbl} n'existe pas (ignoré)`)
  }

  if (found.includes(chatMessagesTbl)) {
    await ensureChannelIdNullable(pool, chatMessagesTbl)
  } else {
    console.log(`ℹ ${chatMessagesTbl} n'existe pas (ignoré)`)
  }

  console.log('\n✅ Migration 010 terminée.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erreur:', err.message)
    process.exit(1)
  })
  .finally(() => pool.end())
