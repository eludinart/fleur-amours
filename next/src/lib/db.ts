/**
 * Connexion MariaDB pour l'API Next.js.
 * Variables d'environnement : MARIADB_HOST, MARIADB_PORT, MARIADB_DATABASE, MARIADB_USER, MARIADB_PASSWORD, DB_PREFIX
 * Uniquement MariaDB (MARIADB_*).
 */
import mysql from 'mysql2/promise'

const DB_HOST = process.env.MARIADB_HOST ?? 'localhost'
const DB_PORT = parseInt(process.env.MARIADB_PORT ?? '3306', 10)
const DB_NAME = process.env.MARIADB_DATABASE ?? 'default'
const DB_USER = process.env.MARIADB_USER ?? 'mariadb'
const DB_PASSWORD = process.env.MARIADB_PASSWORD ?? process.env.MARIADB_PASS ?? ''
const DB_PREFIX = process.env.DB_PREFIX ?? 'wp_'

const POOL_CONNECTION_LIMIT = (() => {
  const raw = process.env.MARIADB_POOL_LIMIT ?? ''
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 2
})()

const POOL_QUEUE_LIMIT = (() => {
  const raw = process.env.MARIADB_POOL_QUEUE_LIMIT ?? ''
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 10
})()

const POOL_IDLE_TIMEOUT_MS = (() => {
  const raw = process.env.MARIADB_POOL_IDLE_TIMEOUT_MS ?? ''
  const n = parseInt(raw, 10)
  // mysql2 default is 60000; keep it explicit so we can tune in prod.
  return Number.isFinite(n) && n >= 0 ? n : 60_000
})()

declare global {
  // eslint-disable-next-line no-var
  var __fleur_mariadb_pool: mysql.Pool | undefined
}

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  // In Next.js dev (HMR), modules can be re-evaluated and a module-scoped singleton
  // may be recreated, leaking MariaDB connections. Cache the pool on globalThis.
  if (!pool) {
    if (globalThis.__fleur_mariadb_pool) {
      pool = globalThis.__fleur_mariadb_pool
      return pool
    }
    if (!DB_PASSWORD) {
      throw new Error('MARIADB_PASSWORD requis pour la connexion MariaDB')
    }
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: POOL_CONNECTION_LIMIT,
      // Avoid keeping many idle sockets open when MariaDB has a low max_connections.
      maxIdle: POOL_CONNECTION_LIMIT,
      idleTimeout: POOL_IDLE_TIMEOUT_MS,
      queueLimit: POOL_QUEUE_LIMIT,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
    globalThis.__fleur_mariadb_pool = pool
  }
  return pool
}

export function table(name: string): string {
  return `${DB_PREFIX}${name}`
}

export function isDbConfigured(): boolean {
  return !!(DB_HOST && DB_NAME && DB_USER && DB_PASSWORD)
}

/** Infos de connexion (pour affichage admin, sans mot de passe) */
export function getDbConnectionInfo(): {
  host: string
  port: number
  database: string
  user: string
  prefix: string
  viaTunnel: boolean
  tunnelTarget: string
} {
  return {
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    prefix: DB_PREFIX,
    viaTunnel: process.env.MARIADB_VIA_TUNNEL === 'true',
    tunnelTarget: process.env.MARIADB_TUNNEL_TARGET ?? '',
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const p = getPool()
    const [rows] = await p.execute('SELECT 1 as ok')
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** Bypass mysql2 strict overload typing for parameterized queries */
export function exec(
  pool: mysql.Pool,
  sql: string,
  values?: unknown[]
): Promise<[unknown, unknown]> {
  return (pool as { execute: (s: string, v?: unknown[]) => Promise<[unknown, unknown]> }).execute(
    sql,
    values
  )
}
