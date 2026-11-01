/**
 * Envoi one-shot : notification + e-mail carte du jour (campagne tirage).
 * Usage: cd next && npx tsx scripts/send-daily-card-test.ts [email]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { RowDataPacket } from 'mysql2'

const __dirname = dirname(fileURLToPath(import.meta.url))
const nextRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(nextRoot, '..')

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env) || !process.env[key]) process.env[key] = val
  }
}

loadEnvFile(resolve(workspaceRoot, '.env'))
loadEnvFile(resolve(workspaceRoot, 'docker-compose.env'))
loadEnvFile(resolve(workspaceRoot, 'sync-config.env'))
loadEnvFile(resolve(nextRoot, '.env.local'))

// Toujours le MariaDB VPS (tunnel), pas la DB WordPress Hostinger de .env
process.env.MARIADB_HOST = process.env.MARIADB_HOST || '127.0.0.1'
process.env.MARIADB_PORT = process.env.MARIADB_PORT || process.env.TUNNEL_LOCAL_PORT || '3307'
process.env.MARIADB_VIA_TUNNEL = 'true'
process.env.MARIADB_DATABASE = process.env.LOCAL_DB || 'default'
process.env.DB_NAME = process.env.LOCAL_DB || 'default'
process.env.MARIADB_USER = process.env.MARIADB_USER || process.env.LOCAL_USER || 'mariadb'
process.env.MARIADB_PASSWORD =
  process.env.MARIADB_PASSWORD || process.env.LOCAL_PASS || process.env.DB_PASSWORD || ''
if (!process.env.DB_PREFIX) process.env.DB_PREFIX = 'wp_'
if (!process.env.APP_PUBLIC_URL) {
  process.env.APP_PUBLIC_URL = 'https://app-fleurdamours.eludein.art/jardin'
}
process.env.NOTIFICATION_OUTBOUND_RESTRICTED = 'false'

const targetEmail = (
  process.argv[2] ||
  process.env.DEV_NOTIFICATION_EMAIL ||
  'eludinart@gmail.com'
)
  .trim()
  .toLowerCase()

async function main() {
  process.chdir(nextRoot)

  const { getPool, isDbConfigured, table } = await import('../src/lib/db')
  const { loadEngagementPersonalization } = await import('../src/lib/engagement-context')
  const { sendEngagementNotification } = await import('../src/lib/send-engagement-notification')
  const { pickDailyCardForUser } = await import('../src/lib/daily-card')

  if (!isDbConfigured()) {
    console.error('MariaDB non configurée — ouvrez le tunnel (port 3307).')
    process.exit(1)
  }

  const pool = getPool()
  const tUsers = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID as id, user_email as email, display_name as name
       FROM ${tUsers}
      WHERE LOWER(user_email) = ? LIMIT 1`,
    [targetEmail]
  )
  const user = rows[0]
  if (!user) {
    console.error(`Aucun utilisateur pour ${targetEmail}`)
    process.exit(1)
  }

  const userId = Number(user.id)
  const email = String(user.email)
  const card = await pickDailyCardForUser(userId)
  console.log('Cible:', { userId, email, name: user.name })
  console.log('Carte du jour:', card)

  const personalization = await loadEngagementPersonalization(userId, email)
  const result = await sendEngagementNotification({
    userId,
    email,
    campaignId: 'tirage',
    personalization,
    skipDevGuard: true,
  })

  console.log('Résultat envoi:', result)
  await pool.end().catch(() => undefined)
  process.exit(result.sent ? 0 : 2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
