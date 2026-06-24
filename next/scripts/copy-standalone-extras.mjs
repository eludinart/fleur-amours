/**
 * Copie les fichiers utiles au runtime Docker dans le bundle standalone Next.js.
 */
import { copyFileSync, existsSync } from 'fs'

const standaloneDir = '.next/standalone'
if (!existsSync(standaloneDir)) {
  console.log('postbuild: pas de bundle standalone — skip')
  process.exit(0)
}

copyFileSync('scripts/cron-engagement-remind.mjs', `${standaloneDir}/cron-engagement-remind.mjs`)
console.log('postbuild: cron-engagement-remind.mjs → .next/standalone/')
