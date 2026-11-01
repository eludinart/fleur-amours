/**
 * Cron carte du jour — Coolify.
 * Usage : node cron-daily-card.mjs [--dry-run] [--force]
 */
const log = (...args) => console.log('[cron-daily-card]', ...args)
const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')
const secret = process.env.CRON_SECRET || ''
const base =
  process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ||
  'https://app-fleurdamours.eludein.art/jardin'

if (!secret) {
  log('ERREUR: CRON_SECRET manquant')
  process.exit(1)
}

const url = `${base}/api/engagement/daily-card`
const body = JSON.stringify({ dryRun, force, skipWindowCheck: force })
log('POST', url, body)

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
  body,
})
const text = await res.text()
log('status', res.status, text.slice(0, 500))
process.exit(res.ok ? 0 : 1)
