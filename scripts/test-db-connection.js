#!/usr/bin/env node
/** Test rapide connexion MariaDB avec la même config que restart-next-dev-with-env.js */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mysql = require('../next/node_modules/mysql2/promise')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

let env = { ...process.env }
for (const file of ENV_FILES) env = loadEnvFile(file, env)
if (env.TUNNEL_LOCAL_PORT || env.SSH_VPS_HOST) {
  env.MARIADB_HOST = '127.0.0.1'
  env.MARIADB_PORT = env.TUNNEL_LOCAL_PORT || '3307'
  env.MARIADB_DATABASE = env.LOCAL_DB || env.DB_NAME || 'default'
  env.MARIADB_USER = env.LOCAL_USER || env.DB_USER || 'mariadb'
  env.MARIADB_PASSWORD = env.LOCAL_PASS || env.DB_PASSWORD || ''
  env.MARIADB_VIA_TUNNEL = 'true'
}

const cfg = {
  host: env.MARIADB_HOST || env.DB_HOST || 'localhost',
  port: Number(env.MARIADB_PORT || env.DB_PORT || 3306),
  user: env.MARIADB_USER || env.DB_USER || 'mariadb',
  password: env.MARIADB_PASSWORD || env.DB_PASSWORD || '',
  database: env.MARIADB_DATABASE || env.DB_NAME || 'default',
}

console.log('Target:', `${cfg.host}:${cfg.port}/${cfg.database} as ${cfg.user}`)
console.log('Password:', cfg.password ? '(set)' : 'MISSING')

try {
  const conn = await mysql.createConnection(cfg)
  const [rows] = await conn.query('SELECT 1 AS ok')
  console.log('DB OK', rows)
  await conn.end()
} catch (e) {
  console.error('DB FAIL', e.code || e.errno, e.message)
  process.exit(1)
}
