/**
 * Cron engagement/remind pour Coolify — client HTTP sans dépendances.
 * Usage : node cron-engagement-remind.mjs [--dry-run]
 */
const log = (...args) => console.log('[cron]', ...args)

const dryRun = process.argv.includes('--dry-run')
const secret = process.env.CRON_SECRET || ''
const base =
  process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ||
  'https://app-fleurdamours.eludein.art/jardin'

log('demarrage', dryRun ? 'dry-run' : 'envoi')
log('CRON_SECRET', secret ? 'ok' : 'MANQUANT')
log('base URL', base)

if (!secret) {
  log('ERREUR: CRON_SECRET manquant — Coolify → Environment Variables → redéployer')
  process.exit(1)
}

const url = `${base}/api/engagement/remind`
const body = JSON.stringify(
  dryRun
    ? { dryRun: true, limit: 250, cooldownHours: 20, inactiveDays: 15 }
    : { limit: 250, cooldownHours: 20, inactiveDays: 15 }
)

log('POST', url)

let res
try {
  res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body,
  })
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  log('ERREUR HTTP:', msg)
  process.exit(1)
}

const text = await res.text()
log('reponse', res.status, text)
if (!res.ok) {
  log('ERREUR: statut HTTP', res.status)
  process.exit(1)
}

log('succes')
