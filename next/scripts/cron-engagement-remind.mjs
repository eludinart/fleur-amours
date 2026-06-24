/**
 * Déclenchement cron engagement/remind depuis Coolify (sans curl).
 * Usage : node cron-engagement-remind.mjs [--dry-run]
 */
const dryRun = process.argv.includes('--dry-run')
const port = process.env.PORT || '3000'
const secret = process.env.CRON_SECRET || ''
const url = `http://127.0.0.1:${port}/jardin/api/engagement/remind`
const body = JSON.stringify(
  dryRun
    ? { dryRun: true, limit: 120, cooldownHours: 20 }
    : { limit: 120, cooldownHours: 20 }
)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': secret,
  },
  body,
})
const text = await res.text()
console.log(res.status, text)
if (!res.ok) process.exit(1)
