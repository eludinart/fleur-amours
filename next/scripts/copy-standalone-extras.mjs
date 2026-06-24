/**
 * Copie les fichiers utiles au runtime Docker dans le bundle standalone Next.js.
 */
import { chmodSync, copyFileSync, existsSync } from 'fs'

const standaloneDir = '.next/standalone'
if (!existsSync(standaloneDir)) {
  console.log('postbuild: pas de bundle standalone — skip')
  process.exit(0)
}

copyFileSync('scripts/cron-engagement-remind.mjs', `${standaloneDir}/cron-engagement-remind.mjs`)
copyFileSync('scripts/cron-engagement-remind.sh', `${standaloneDir}/cron-engagement-remind.sh`)
chmodSync(`${standaloneDir}/cron-engagement-remind.sh`, 0o755)
console.log('postbuild: cron-engagement-remind.{mjs,sh} → .next/standalone/')
