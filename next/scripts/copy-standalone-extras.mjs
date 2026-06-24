/**
 * Copie les fichiers utiles au runtime Docker dans le bundle standalone Next.js.
 */
import { chmodSync, copyFileSync, cpSync, existsSync } from 'fs'

const standaloneDir = '.next/standalone'
if (!existsSync(standaloneDir)) {
  console.log('postbuild: pas de bundle standalone — skip')
  process.exit(0)
}

// Assets requis par server.js (aligné Dockerfile.next + CI smoke)
if (existsSync('.next/static')) {
  cpSync('.next/static', `${standaloneDir}/.next/static`, { recursive: true })
}
if (existsSync('public')) {
  cpSync('public', `${standaloneDir}/public`, { recursive: true })
}

copyFileSync('scripts/cron-engagement-remind.mjs', `${standaloneDir}/cron-engagement-remind.mjs`)
copyFileSync('scripts/cron-engagement-remind.sh', `${standaloneDir}/cron-engagement-remind.sh`)
chmodSync(`${standaloneDir}/cron-engagement-remind.sh`, 0o755)
console.log('postbuild: standalone prêt (static + public + cron)')
