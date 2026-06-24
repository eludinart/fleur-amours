/**
 * Point d'entrée cron Coolify — bundlé dans cron-engagement-remind.mjs au postbuild.
 */
import { runEngagementRemind } from '../src/lib/engagement-remind-run'

const dryRun = process.argv.includes('--dry-run')

if (!process.env.CRON_SECRET) {
  console.error('CRON_SECRET manquant — ajoutez-le dans Coolify puis redéployez.')
  process.exit(1)
}

const result = await runEngagementRemind({
  dryRun,
  limit: 120,
  cooldownHours: 20,
})

if ('error' in result) {
  console.error(result.status, result.error)
  process.exit(1)
}

console.log(JSON.stringify(result))
