/**
 * Copie les fichiers utiles au runtime Docker dans le bundle standalone Next.js.
 */
import { copyFileSync, cpSync, existsSync } from 'fs'

const standaloneDir = '.next/standalone'
if (!existsSync(standaloneDir)) {
  console.log('postbuild: pas de bundle standalone — skip')
  process.exit(0)
}

// Assets requis par server.js (aligné Dockerfile.next)
if (existsSync('.next/static')) {
  cpSync('.next/static', `${standaloneDir}/.next/static`, { recursive: true })
}
if (existsSync('public')) {
  cpSync('public', `${standaloneDir}/public`, { recursive: true })
}

copyFileSync('scripts/cron-engagement-remind.mjs', `${standaloneDir}/cron-engagement-remind.mjs`)
console.log('postbuild: standalone prêt (static + cron)')
