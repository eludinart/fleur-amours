/**
 * Redémarre Next.js dev en chargeant docker-compose.env (SMTP, etc.).
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ENV_FILES = [
  resolve(ROOT, 'sync-config.env'),
  resolve(ROOT, 'docker-compose.env'),
]

function loadEnvFile(path, env) {
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 1) continue
    const key = trimmed.slice(0, i).trim()
    let val = trimmed.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function buildNextEnv() {
  let env = { ...process.env }
  for (const file of ENV_FILES) env = loadEnvFile(file, env)
  // Tunnel dev-vps : MariaDB via 127.0.0.1:3307
  if (env.TUNNEL_LOCAL_PORT || env.SSH_VPS_HOST) {
    env.MARIADB_HOST = '127.0.0.1'
    env.MARIADB_PORT = env.TUNNEL_LOCAL_PORT || '3307'
    env.MARIADB_DATABASE = env.LOCAL_DB || env.DB_NAME || 'default'
    env.MARIADB_USER = env.LOCAL_USER || env.DB_USER || 'mariadb'
    env.MARIADB_PASSWORD = env.LOCAL_PASS || env.DB_PASSWORD || ''
    env.MARIADB_VIA_TUNNEL = 'true'
    env.USE_NODE_API = 'true'
  }
  return env
}

const child = spawn('npm', ['run', 'dev', '--prefix', 'next'], {
  cwd: ROOT,
  env: buildNextEnv(),
  stdio: 'inherit',
  shell: true,
})

child.on('close', (code) => process.exit(code ?? 0))
