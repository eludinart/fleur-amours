/**
 * Copie / bundle les fichiers utiles au runtime Docker dans le bundle standalone Next.js.
 */
import { existsSync } from 'fs'
import { build } from 'esbuild'

const standaloneDir = '.next/standalone'
if (!existsSync(standaloneDir)) {
  console.log('postbuild: pas de bundle standalone — skip')
  process.exit(0)
}

await build({
  entryPoints: ['scripts/cron-engagement-remind-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: `${standaloneDir}/cron-engagement-remind.mjs`,
  packages: 'external',
  alias: {
    '@': './src',
  },
  tsconfig: 'tsconfig.json',
})

console.log('postbuild: cron-engagement-remind.mjs bundlé → .next/standalone/')
