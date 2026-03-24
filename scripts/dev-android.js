#!/usr/bin/env node
/**
 * Lance le projet en mode Android Studio :
 * - Sync Capacitor avec l'URL du serveur de dev (pour live reload)
 * - Démarre le serveur de dev (Next.js) — comme npm run dev
 * - Ouvre Android Studio
 *
 * Émulateur : utilise 10.0.2.2 (alias du host dans l'émulateur)
 * Appareil physique : utilise ton IP locale (détectée ou CAP_SERVER_URL)
 */
import { spawn } from 'child_process'
import { execSync } from 'child_process'
import { platform } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const NEXT_PORT = 3001

function getLocalIp() {
  if (platform() !== 'win32') {
    try {
      const out = execSync('hostname -I 2>/dev/null || ip route get 1 2>/dev/null | awk \'{print $7;exit}\'', { encoding: 'utf8' })
      return out.trim().split(/\s+/)[0] || null
    } catch {
      return null
    }
  }
  try {
    const out = execSync('ipconfig', { encoding: 'utf8' })
    for (const m of out.matchAll(/IPv4[^:]*:\s*(\d+\.\d+\.\d+\.\d+)/g)) {
      const ip = m[1].trim()
      if (!ip.startsWith('127.')) return ip
    }
    return null
  } catch {
    return null
  }
}

function main() {
  const useDevice = process.argv.includes('--device')
  const serverUrl = process.env.CAP_SERVER_URL
    || (useDevice ? `http://${getLocalIp() || 'localhost'}:${NEXT_PORT}` : `http://10.0.2.2:${NEXT_PORT}`)

  console.log('')
  console.log('🌸 Fleur d\'AmOurs — Mode Android Studio')
  console.log('─'.repeat(50))
  console.log(`URL du serveur : ${serverUrl}`)
  if (!useDevice && !process.env.CAP_SERVER_URL) {
    console.log('(Émulateur : 10.0.2.2 = machine hôte)')
  }
  console.log('')

  const env = { ...process.env, CAP_SERVER_URL: serverUrl }

  // 1. Sync Capacitor
  console.log('1. Synchronisation Capacitor…')
  spawn('npx', ['cap', 'sync'], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: true,
  }).on('exit', (syncCode) => {
    if (syncCode !== 0) {
      console.error('Erreur lors du sync Capacitor.')
      process.exit(syncCode)
    }

    // 2. Démarrer le serveur de dev
    console.log('')
    console.log('2. Démarrage du serveur de dev (Next.js)…')
    const dev = spawn('npm', ['run', 'dev'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...env },
      shell: true,
    })

    // 3. Ouvrir Android Studio après un court délai
    setTimeout(() => {
      console.log('')
      console.log('3. Ouverture d\'Android Studio…')
      spawn('npx', ['cap', 'open', 'android'], {
        cwd: root,
        stdio: 'inherit',
        shell: true,
      }).on('exit', () => {
        console.log('')
        console.log('✅ Prêt ! Dans Android Studio : sélectionne un appareil/émulateur et lance l\'app (▶ Run).')
        console.log('')
      })
    }, 3000)
  })
}

main()
