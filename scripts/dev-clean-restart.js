#!/usr/bin/env node
/**
 * Répare un dev local cassé (cache .next corrompu, port occupé).
 * Usage : npm run dev.vps:clean
 */
import { spawn, spawnSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { platform } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const NEXT_DIR = resolve(ROOT, 'next')
const PORTS = [3001, 3307, 3098, 3099]

/** Arrête les serveurs next start / standalone laissés par des tests smoke locaux. */
function killStrayNextServers() {
  if (platform() !== 'win32') return
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'standalone[/\\\\]server\\.js|next[/\\\\]dist[/\\\\]bin[/\\\\]next.*start' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: 'ignore' }
  )
  if (ps.status !== 0) return
}

function killPortWin(port) {
  const r = spawnSync('cmd', ['/c', 'netstat -ano'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const pids = new Set()
  for (const line of (r.stdout || '').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 5 || !parts[0].startsWith('TCP') || !/LISTEN/i.test(parts[3])) continue
    const m = parts[1].match(/:(\d+)$/)
    if (!m || Number(m[1]) !== port) continue
    const pid = parts[parts.length - 1]
    if (/^\d+$/.test(pid)) pids.add(pid)
  }
  for (const pid of pids) {
    spawnSync('taskkill', ['/F', '/T', '/PID', pid], { stdio: 'ignore' })
  }
}

function killPorts() {
  for (const port of PORTS) {
    if (platform() === 'win32') killPortWin(port)
    else spawnSync('sh', ['-c', `lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9`], { stdio: 'ignore' })
  }
}

function removeNextCache() {
  const nextCache = resolve(NEXT_DIR, '.next')
  if (!existsSync(nextCache)) return
  killStrayNextServers()
  try {
    rmSync(nextCache, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    console.log('   Cache next/.next supprimé')
    return
  } catch (err) {
    if (platform() !== 'win32') throw err
    // Windows : fichiers parfois verrouillés par un process node — PowerShell plus fiable
    const ps = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `Remove-Item -LiteralPath '${nextCache.replace(/'/g, "''")}' -Recurse -Force -ErrorAction Stop`],
      { stdio: 'pipe', encoding: 'utf8' }
    )
    if (ps.status !== 0) {
      killStrayNextServers()
      const retry = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', `Remove-Item -LiteralPath '${nextCache.replace(/'/g, "''")}' -Recurse -Force -ErrorAction Stop`],
        { stdio: 'pipe', encoding: 'utf8' }
      )
      if (retry.status !== 0) {
        console.error(retry.stderr || retry.stdout || ps.stderr || ps.stdout || String(err))
        throw err
      }
    }
    console.log('   Cache next/.next supprimé (PowerShell)')
  }
}

console.log('\n🧹 Nettoyage dev local…')
killPorts()
console.log(`   Ports libérés : ${PORTS.join(', ')}`)

removeNextCache()

console.log('\n▶  Relance dev.vps…\n')
const child = spawn('node', ['scripts/dev-vps.js'], { cwd: ROOT, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
