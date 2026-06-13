/**
 * Charge .env, docker-compose.env et variables SMOKE_* pour les scripts de vérification.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ENV_FILES = [
  resolve(ROOT, '.env'),
  resolve(ROOT, 'docker-compose.env'),
  resolve(ROOT, '.env.smoke'),
]

export function loadSmokeEnv() {
  const env = { ...process.env }
  for (const p of ENV_FILES) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = trimmed.match(/^([^#=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return env
}

export function smokeConfig(env = loadSmokeEnv()) {
  const base = (env.SMOKE_BASE_URL || env.APP_PUBLIC_URL || 'http://127.0.0.1:3001/jardin').replace(/\/+$/, '')
  return {
    baseUrl: base,
    apiUrl: `${base}/api`,
    email: env.SMOKE_EMAIL || env.SMOKE_LOGIN || '',
    password: env.SMOKE_PASSWORD || '',
    token: env.SMOKE_TOKEN || '',
    strict: env.SMOKE_STRICT === '1' || env.SMOKE_STRICT === 'true',
    visitUserId: env.SMOKE_VISIT_USER_ID || '',
    timeoutMs: Number(env.SMOKE_TIMEOUT_MS || 15_000),
  }
}
