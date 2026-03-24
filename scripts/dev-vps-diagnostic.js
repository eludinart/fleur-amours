#!/usr/bin/env node
/**
 * Diagnostic : affiche les infos du conteneur MariaDB sur le VPS (Coolify).
 * Usage : npm run dev.vps:diagnostic
 */
import { spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const env = { ...process.env }
  for (const p of [resolve(ROOT, 'sync-config.env'), resolve(ROOT, '.env')]) {
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

function ssh(cmd) {
  const r = spawnSync('ssh', [
    '-o', 'ConnectTimeout=5',
    '-o', 'StrictHostKeyChecking=no',
    `${SSH_USER}@${SSH_HOST}`,
    cmd,
  ], { encoding: 'utf8' })
  return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status }
}

console.log('\n=== Diagnostic MariaDB VPS (Coolify) ===\n')
console.log(`SSH: ${SSH_USER}@${SSH_HOST}\n`)

console.log('1. Tous les conteneurs Docker (20 premiers):')
const r1 = ssh('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -25')
console.log(r1.stdout || r1.stderr || '(docker non disponible)')

console.log('\n2. Conteneurs avec 3306 dans les ports:')
const r1b = ssh('docker ps -a --format "{{.Names}} {{.Ports}}" 2>/dev/null | grep 3306 || echo "(aucun)"')
console.log(r1b.stdout || r1b.stderr)

console.log('\n3. Réseaux du premier conteneur DB (maria/mysql/3306):')
const containerId = ssh('docker ps -q --filter "name=mariadb" 2>/dev/null | head -1').stdout.trim()
  || ssh('docker ps -q --filter "name=mysql" 2>/dev/null | head -1').stdout.trim()
  || ssh('docker ps -a --format "{{.ID}}" 2>/dev/null | head -1').stdout.trim()
const r2 = containerId
  ? ssh(`docker inspect ${containerId} --format '{{json .NetworkSettings.Networks}}' 2>/dev/null || echo "{}"`)
  : { stdout: '{}' }
let nets = {}
try {
  nets = JSON.parse((r2.stdout || '{}').trim())
} catch {}
for (const [name, cfg] of Object.entries(nets)) {
  console.log(`   ${name}: IP ${cfg?.IPAddress || '?'}`)
}
if (Object.keys(nets).length === 0) {
  console.log('   (aucun réseau ou conteneur non trouvé)')
}

console.log('\n4. Test connexion MariaDB depuis le VPS:')
const ip = Object.values(nets)[0]?.IPAddress
if (ip) {
  const r3 = ssh(`timeout 3 bash -c "echo >/dev/tcp/${ip}/3306" 2>&1 && echo "OK: port 3306 ouvert" || echo "ÉCHEC: port 3306 fermé ou MariaDB n'écoute pas"`)
  console.log(`   IP ${ip}:3306 → ${r3.stdout.trim() || r3.stderr.trim()}`)
} else {
  console.log('   (IP inconnue, impossible de tester)')
}

console.log('\n=== Fin diagnostic ===\n')
