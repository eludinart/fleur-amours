#!/usr/bin/env node
/**
 * Vérifie que la prod Coolify a bien reçu le dernier code Git.
 * Usage : node scripts/verify-prod-deploy.js
 *         PROD_URL=https://app-fleurdamours.eludein.art/jardin node scripts/verify-prod-deploy.js
 */
import { execSync } from 'child_process'

const BASE = (process.env.PROD_URL || 'https://app-fleurdamours.eludein.art/jardin').replace(
  /\/$/,
  ''
)

/** Routes ajoutées récemment : si la prod renvoie le stub catch-all, le déploiement est en retard. */
const MARKERS = [
  { method: 'POST', path: '/api/admin/smtp-test', label: 'admin/smtp-test (email)' },
  { method: 'POST', path: '/api/contact_messages', label: 'contact_messages' },
  { method: 'GET', path: '/api/dyads', label: 'dyads' },
]

let localSha = 'unknown'
try {
  execSync('git fetch origin', { stdio: 'ignore' })
  localSha = execSync('git rev-parse --short origin/main', { encoding: 'utf8' }).trim()
} catch {
  /* hors repo git */
}

async function probe(method, path) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  const stub = text.includes('Route non implémentée')
  return { status: res.status, stub, error: json?.error ?? text.slice(0, 120) }
}

console.log(`\nProd : ${BASE}`)
console.log(`Git  : origin/main → ${localSha}\n`)

let buildInfo = null
try {
  const r = await fetch(`${BASE}/build-info.json`)
  buildInfo = await r.json()
  console.log(`build-info.json : version=${buildInfo.version} commit=${buildInfo.commit}`)
} catch (e) {
  console.log(`build-info.json : inaccessible (${e.message})`)
}

console.log('\nMarqueurs de déploiement :')
let behind = false
for (const m of MARKERS) {
  const { status, stub, error } = await probe(m.method, m.path)
  const ok = !stub
  if (!ok) behind = true
  console.log(
    `  ${ok ? '✓' : '✗'} ${m.label} → HTTP ${status}${stub ? ' (stub catch-all = ancienne image)' : ''}`
  )
  if (!ok && error) console.log(`      ${error}`)
}

console.log('')
if (behind) {
  console.log('→ La prod n’a PAS le dernier code. Dans Coolify :')
  console.log('  1. Vérifier branche = main et repo = eludinart/fleur-amours')
  console.log('  2. Redeploy → Rebuild without cache (pas seulement Restart)')
  console.log('  3. Logs : commit sha importé =', localSha)
  console.log('  4. Pas de « Build step skipped » si vous attendez un nouveau build\n')
  process.exit(1)
}

if (buildInfo?.commit && buildInfo.commit !== 'unknown' && !buildInfo.commit.startsWith(localSha)) {
  console.log(`→ Routes OK mais build-info (${buildInfo.commit}) ≠ origin/main (${localSha})`)
  console.log('  Activez « Include source commit in build » dans Coolify ou ignorez si routes OK.\n')
} else {
  console.log('→ Marqueurs OK — le code récent semble déployé.\n')
}
