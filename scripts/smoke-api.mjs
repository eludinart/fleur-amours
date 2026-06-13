#!/usr/bin/env node
/**
 * Smoke tests API — vérification pré/post déploiement.
 *
 * Usage:
 *   node scripts/smoke-api.mjs                    # public + auth si .env.smoke
 *   node scripts/smoke-api.mjs --public          # health + pages statiques uniquement
 *   node scripts/smoke-api.mjs --strict           # échoue si DB déconnectée ou IA absente
 *   SMOKE_BASE_URL=https://app-fleurdamours.eludein.art/jardin node scripts/smoke-api.mjs
 *
 * Variables : SMOKE_BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_TOKEN, SMOKE_STRICT
 */
import { spawn } from 'child_process'
import { loadSmokeEnv, smokeConfig } from './smoke-env.mjs'

const args = new Set(process.argv.slice(2))
const publicOnly = args.has('--public')
const strictFlag = args.has('--strict')
const spawnServer = args.has('--spawn')
const baseUrlArg = process.argv.find((a, i) => process.argv[i - 1] === '--base-url')

const env = loadSmokeEnv()
const cfg = smokeConfig(env)
if (baseUrlArg) cfg.baseUrl = baseUrlArg.replace(/\/+$/, '')
if (strictFlag) cfg.strict = true
cfg.apiUrl = `${cfg.baseUrl}/api`

const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
}

function warn(name, detail = '') {
  results.push({ name, ok: true, warn: true, detail })
  console.log(`  \x1b[33m!\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
}

async function fetchJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${cfg.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* */ }
    return { res, json, text, url }
  } finally {
    clearTimeout(timer)
  }
}

async function checkHealth() {
  const { res, json } = await fetchJson('/health')
  if (!res.ok) {
    fail('GET /api/health', `HTTP ${res.status}`)
    return null
  }
  if (!json?.ok) {
    fail('GET /api/health', 'ok !== true')
    return null
  }
  const db = json.db || 'unknown'
  if (db === 'connected') pass('GET /api/health', `db: ${db}`)
  else if (cfg.strict) fail('GET /api/health', `db: ${db}`)
  else warn('GET /api/health', `db: ${db}`)
  return json
}

async function checkLoginPage() {
  const url = `${cfg.baseUrl}/login`
  const res = await fetch(url, { redirect: 'follow' })
  const html = await res.text()
  if (!res.ok) {
    fail('GET /login', `HTTP ${res.status}`)
    return
  }
  if (!html.includes('login') && !html.includes('Fleur') && !html.includes('password')) {
    warn('GET /login', 'page chargée mais contenu inattendu')
  } else {
    pass('GET /login', `HTTP ${res.status}`)
  }
}

async function login() {
  if (cfg.token) return cfg.token
  if (!cfg.email || !cfg.password) return null
  const { res, json } = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: cfg.email, password: cfg.password }),
  })
  if (!res.ok) {
    fail('POST /api/auth/login', json?.error || `HTTP ${res.status}`)
    return null
  }
  if (!json?.token) {
    fail('POST /api/auth/login', 'token manquant')
    return null
  }
  pass('POST /api/auth/login', json.user?.email || json.user?.pseudo || 'ok')
  return json.token
}

async function authGet(path, token, label) {
  const { res, json } = await fetchJson(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    fail(label, json?.error || `HTTP ${res.status}`)
    return null
  }
  pass(label, `HTTP ${res.status}`)
  return json
}

async function checkAiStatus(token) {
  const { res, json } = await fetchJson('/ai/status', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    fail('GET /api/ai/status', json?.error || `HTTP ${res.status}`)
    return
  }
  if (json?.ok) pass('GET /api/ai/status', json.model || 'OpenRouter OK')
  else if (cfg.strict) fail('GET /api/ai/status', json?.message || 'OPENROUTER_API_KEY manquante')
  else warn('GET /api/ai/status', json?.message || 'IA non configurée')
}

async function checkAuthenticated(token) {
  const me = await authGet('/auth/me', token, 'GET /api/auth/me')
  if (!me?.user && !me?.id) warn('GET /api/auth/me', 'réponse utilisateur minimale')

  const prairie = await authGet('/prairie/fleurs', token, 'GET /api/prairie/fleurs')
  if (prairie) {
    const n = prairie.fleurs?.length ?? 0
    const meFleur = prairie.me_fleur ? 'oui' : 'non'
    pass('Prairie données', `${n} fleur(s), me_fleur: ${meFleur}`)
  }

  await checkAiStatus(token)
  await authGet('/social/my_channels', token, 'GET /api/social/my_channels')
  await authGet('/sessions/list', token, 'GET /api/sessions/list')

  const visitId = cfg.visitUserId
  if (visitId) {
    await authGet(`/social/visit_lisiere?user_id=${encodeURIComponent(visitId)}`, token, 'GET /api/social/visit_lisiere')
  }
}

function waitForHealth(maxMs = 90_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const { res, json } = await fetchJson('/health')
        if (res.ok && json?.ok) return resolve()
      } catch { /* retry */ }
      if (Date.now() - start > maxMs) return reject(new Error('Timeout en attendant le serveur'))
      setTimeout(tick, 1500)
    }
    tick()
  })
}

async function startLocalServer() {
  const childEnv = {
    ...process.env,
    PORT: '3001',
    JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-jwt-secret-min-32-chars-long',
    USE_NODE_API: 'true',
    NEXT_PUBLIC_BASE_PATH: '/jardin',
  }
  console.log('\n  Démarrage Next.js (npm run start --prefix next)…')
  const child = spawn('npm', ['run', 'start', '--prefix', 'next'], {
    cwd: process.cwd(),
    env: childEnv,
    shell: true,
    stdio: 'pipe',
  })
  child.stdout?.on('data', (d) => process.stderr.write(d))
  child.stderr?.on('data', (d) => process.stderr.write(d))
  await waitForHealth()
  return child
}

async function main() {
  console.log(`\n\x1b[1mSmoke API — ${cfg.baseUrl}\x1b[0m`)
  console.log(`  mode: ${publicOnly ? 'public' : 'complet'}${cfg.strict ? ' (strict)' : ''}\n`)

  let serverProc = null
  if (spawnServer) {
    try {
      serverProc = await startLocalServer()
    } catch (e) {
      fail('Démarrage serveur local', e.message)
      process.exit(1)
    }
  }

  try {
    await checkHealth()
    await checkLoginPage()

    if (!publicOnly) {
      const token = await login()
      if (token) await checkAuthenticated(token)
      else if (!cfg.email) warn('Auth', 'SMOKE_EMAIL/SMOKE_PASSWORD non définis — tests authentifiés ignorés')
    }
  } catch (e) {
    fail('Erreur fatale', e.message || String(e))
  } finally {
    if (serverProc) {
      serverProc.kill('SIGTERM')
      console.log('\n  Serveur local arrêté.')
    }
  }

  const failed = results.filter((r) => !r.ok)
  const warned = results.filter((r) => r.warn)
  console.log(`\n\x1b[1mRésumé:\x1b[0m ${results.length - failed.length}/${results.length} OK`)
  if (warned.length) console.log(`  ${warned.length} avertissement(s)`)
  if (failed.length) {
    console.log(`\n\x1b[31mÉchec — ${failed.length} check(s) en erreur.\x1b[0m\n`)
    process.exit(1)
  }
  console.log(`\n\x1b[32mSmoke OK — prêt pour vérification publique.\x1b[0m\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
