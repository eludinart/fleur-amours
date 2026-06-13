#!/usr/bin/env node
/**
 * Vérification complète avant déploiement public.
 * Enchaîne : build → smoke API (public) → e2e public.
 *
 * Usage:
 *   node scripts/pre-deploy.mjs
 *   node scripts/pre-deploy.mjs --full   # inclut e2e authentifiés si .env.smoke
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const full = process.argv.includes('--full')

function run(cmd, cmdArgs, label) {
  console.log(`\n\x1b[1m▶ ${label}\x1b[0m\n`)
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error(`\n\x1b[31m✗ ${label} a échoué (code ${r.status})\x1b[0m\n`)
    process.exit(r.status || 1)
  }
}

console.log('\n\x1b[1m═══ Pré-déploiement Fleur d\'AmOurs ═══\x1b[0m')

run('npm', ['run', 'build', '--prefix', 'next'], 'Build Next.js')

if (existsSync(resolve(ROOT, '.env.smoke')) || process.env.SMOKE_EMAIL) {
  run('node', ['scripts/smoke-api.mjs', '--strict'], 'Smoke API (strict)')
} else {
  run('node', ['scripts/smoke-api.mjs', '--public'], 'Smoke API (public)')
  console.log('\n  \x1b[33mAstuce:\x1b[0m copiez .env.smoke.example → .env.smoke pour tests auth complets.\n')
}

const e2eArgs = full ? ['run', 'test:e2e'] : ['run', 'test:e2e:public']
run('npm', e2eArgs, full ? 'E2E complet' : 'E2E public')

console.log('\n\x1b[32m\x1b[1m═══ Pré-déploiement OK ═══\x1b[0m\n')
