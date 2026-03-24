#!/usr/bin/env node
/**
 * Donne les droits admin à un utilisateur par email.
 * Usage: cd next && node scripts/grant-admin.js [email]
 *
 * Utilise la config DB de .env (racine)
 */
import { createPool } from 'mysql2/promise'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const paths = [resolve(ROOT, '../.env'), resolve(ROOT, '.env.local')]
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
const DB_PASSWORD = env.MARIADB_PASSWORD || env.LOCAL_PASS || env.DB_PASS || ''
const DB_PREFIX = env.DB_PREFIX || 'wp_'

const email = process.argv[2] || 'eludinart@gmail.com'

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

async function main() {
  const usersTbl = `${DB_PREFIX}users`
  const rolesTbl = `${DB_PREFIX}fleur_app_roles`
  const metaTbl = `${DB_PREFIX}usermeta`

  const [rows] = await pool.execute(
    `SELECT ID, user_email, display_name FROM ${usersTbl} WHERE user_email = ?`,
    [email]
  )

  if (!rows || rows.length === 0) {
    console.error(`❌ Utilisateur non trouvé : ${email}`)
    process.exit(1)
  }

  const userId = rows[0].ID
  console.log(`✓ Utilisateur trouvé : ID=${userId} (${rows[0].display_name || email})`)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${rolesTbl} (
      user_id BIGINT UNSIGNED PRIMARY KEY,
      app_role VARCHAR(50) NOT NULL DEFAULT 'user'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(
    `INSERT INTO ${rolesTbl} (user_id, app_role) VALUES (?, 'admin')
     ON DUPLICATE KEY UPDATE app_role = 'admin'`,
    [userId]
  )

  console.log(`✓ Rôle admin attribué`)

  const capKey = `${DB_PREFIX}capabilities`
  const [existing] = await pool.execute(
    `SELECT umeta_id FROM ${metaTbl} WHERE user_id = ? AND meta_key = ?`,
    [userId, capKey]
  )

  const adminCaps = 'a:1:{s:13:"administrator";i:1;}'
  if (existing && existing.length > 0) {
    await pool.execute(
      `UPDATE ${metaTbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [adminCaps, userId, capKey]
    )
  } else {
    await pool.execute(
      `INSERT INTO ${metaTbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, capKey, adminCaps]
    )
  }
  console.log(`✓ Capabilities WordPress mises à jour`)

  console.log(`\n✅ ${email} a les droits administrateur. Reconnectez-vous pour voir Admin et Campagnes.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erreur:', err.message)
    process.exit(1)
  })
  .finally(() => pool.end())
