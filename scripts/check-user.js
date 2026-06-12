import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createPool } from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv(path) {
  const env = {}
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const sync = loadEnv(resolve(ROOT, 'sync-config.env'))
const docker = loadEnv(resolve(ROOT, 'docker-compose.env'))
const email = process.argv[2] || 'eludinart@gmail.com'

const pool = createPool({
  host: '127.0.0.1',
  port: parseInt(sync.TUNNEL_LOCAL_PORT || '3307', 10),
  database: sync.LOCAL_DB || docker.DB_NAME || 'default',
  user: sync.LOCAL_USER || docker.DB_USER || 'mariadb',
  password: sync.LOCAL_PASS || docker.DB_PASSWORD || '',
})

try {
  const [rows] = await pool.execute(
    'SELECT ID, user_email, user_login, display_name FROM wp_users WHERE user_email = ? LIMIT 1',
    [email]
  )
  console.log(rows[0] ? JSON.stringify(rows[0]) : 'NOT_FOUND')
} catch (e) {
  console.error('ERR', e.message)
} finally {
  await pool.end()
}
