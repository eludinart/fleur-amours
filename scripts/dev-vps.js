#!/usr/bin/env node
/**
 * Lance le tunnel SSH vers le MariaDB du VPS (Coolify/Docker), puis démarre Next.js dev.
 * Usage : npm run dev.vps
 *
 * Coolify : MariaDB est dans un conteneur Docker. Le script récupère l'IP du
 * conteneur et tunnelise vers celle-ci (localhost sur le VPS ne marche pas).
 *
 * Config : sync-config.env ou .env (SSH_VPS_*, MARIADB_CONTAINER)
 */
import { spawn, spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const env = { ...process.env }
  for (const p of [
    resolve(ROOT, 'sync-config.env'),
    resolve(ROOT, '.env'),
  ]) {
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  return env
}

const env = loadEnv()
const SSH_HOST = env.SSH_VPS_HOST || env.VPS_HOST || '187.124.42.135'
const SSH_USER = env.SSH_VPS_USER || env.VPS_USER || 'root'
const TUNNEL_PORT = env.TUNNEL_LOCAL_PORT || '3307'
const MARIADB_PORT = '3306'
const MARIADB_CONTAINER = env.MARIADB_CONTAINER || env.LOCAL_HOST || env.LOCAL_DB_CONTAINER || 'mariadb'

// Coolify : MariaDB est sur le réseau Docker, inaccessible depuis l'hôte.
// Il faut un relais socat sur le VPS (setup-mariadb-tunnel-vps.sh) qui expose
// 127.0.0.1:3306. Le tunnel SSH pointe donc vers localhost.
const dbTarget = 'localhost'

console.log(`\n🔗 Tunnel SSH → ${SSH_USER}@${SSH_HOST}  localhost:${TUNNEL_PORT} → ${dbTarget}:${MARIADB_PORT}`)
console.log('   (nécessite le relais socat sur le VPS : voir scripts/setup-mariadb-tunnel-vps.sh)\n')

let tunnel = spawn('ssh', buildSshOpts(dbTarget), { stdio: 'inherit' })

function buildSshOpts(target) {
  return [
    '-N',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=6',
    '-o', 'TCPKeepAlive=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=no',
    '-L', `${TUNNEL_PORT}:${target}:${MARIADB_PORT}`,
    `${SSH_USER}@${SSH_HOST}`,
  ]
}

function restartTunnel() {
  console.log('\n🔄 Reconnexion du tunnel SSH...')
  tunnel = spawn('ssh', buildSshOpts(dbTarget), { stdio: 'inherit' })
  tunnel.on('error', onTunnelError)
  tunnel.on('close', onTunnelClose)
}

function onTunnelError(err) {
  console.error('Impossible de lancer le tunnel SSH :', err.message)
  console.error(`Vérifiez la clé SSH : type $env:USERPROFILE\\.ssh\\id_rsa.pub | ssh ${SSH_USER}@${SSH_HOST} "cat >> ~/.ssh/authorized_keys"`)
  process.exit(1)
}

function onTunnelClose() {
  if (nextProcess && !exiting) {
    const now = Date.now()
    if (now - lastRestart < 5000) {
      console.error('\n❌ Tunnel inaccessible. Relancez npm run dev.vps plus tard.')
      process.exit(1)
    }
    lastRestart = now
    console.error('\n⚠ Tunnel SSH fermé. Reconnexion dans 2 s...')
    setTimeout(restartTunnel, 2000)
  }
}

tunnel.on('error', onTunnelError)
tunnel.on('close', onTunnelClose)

let nextProcess = null
let exiting = false
let lastRestart = 0

// Attendre que le tunnel soit établi avant de lancer Next.js
setTimeout(() => {
  console.log('\n▶  Démarrage Next.js dev...\n')

  // Forcer MARIADB_* pour que Next.js se connecte au tunnel, pas à Hostinger (DB_*)
  // loadEnv() injecte .env + sync-config.env pour que Next reçoive toutes les variables
  const nextEnv = {
    ...process.env,
    ...env,
    MARIADB_HOST: '127.0.0.1',
    MARIADB_PORT: env.TUNNEL_LOCAL_PORT || '3307',
    MARIADB_DATABASE: env.LOCAL_DB || 'default',
    MARIADB_USER: env.LOCAL_USER || 'mariadb',
    MARIADB_PASSWORD: env.LOCAL_PASS || '',
    MARIADB_VIA_TUNNEL: 'true',
    MARIADB_TUNNEL_TARGET: env.SSH_VPS_HOST || env.VPS_HOST || '',
    USE_NODE_API: 'true',
  }

  nextProcess = spawn('npm', ['run', 'dev', '--prefix', 'next'], {
    stdio: 'inherit',
    shell: true,
    env: nextEnv,
  })

  nextProcess.on('close', (code) => {
    exiting = true
    tunnel.kill()
    process.exit(code ?? 0)
  })
}, 2000)

function shutdown() {
  exiting = true
  if (nextProcess) nextProcess.kill()
  tunnel.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
