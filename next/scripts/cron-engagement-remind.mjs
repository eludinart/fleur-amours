/**
 * Cron engagement/remind pour Coolify — client HTTP sans dépendances.
 * Appelle l'app via APP_PUBLIC_URL (le serveur Next a accès à MariaDB).
 *
 * Usage : node cron-engagement-remind.mjs [--dry-run]
 */
const dryRun = process.argv.includes('--dry-run')
const secret = process.env.CRON_SECRET || ''
const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '')

if (!secret) {
  console.error('CRON_SECRET manquant — ajoutez-le dans Coolify puis redéployez.')
  process.exit(1)
}
if (!base) {
  console.error('APP_PUBLIC_URL manquant — ex. https://app-fleurdamours.eludein.art/jardin')
  process.exit(1)
}

const url = `${base}/api/engagement/remind`
const body = JSON.stringify(
  dryRun
    ? { dryRun: true, limit: 120, cooldownHours: 20 }
    : { limit: 120, cooldownHours: 20 }
)

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
  console.error(`Échec HTTP vers ${url} :`, msg)
  process.exit(1)
}

const text = await res.text()
console.log(res.status, text)
if (!res.ok) process.exit(1)
