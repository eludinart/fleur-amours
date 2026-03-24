#!/usr/bin/env node
/**
 * Setup des notifications push Android — Fleur d'AmOurs
 * Next.js utilise config/fcm-service-account.json pour envoyer les push.
 */
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const ANDROID_APP_DIR = join(root, 'android', 'app')
const GOOGLE_SERVICES = join(ANDROID_APP_DIR, 'google-services.json')
const CONFIG_FCM_SA = join(root, 'config', 'fcm-service-account.json')

console.log('')
console.log('🌸 Fleur d\'AmOurs — Setup notifications push Android')
console.log('─'.repeat(55))
console.log('')

// 1. Service account JSON (Next.js)
if (!existsSync(CONFIG_FCM_SA)) {
  console.log('⚠ config/fcm-service-account.json manquant')
  console.log('  Firebase Console → Paramètres → Comptes de service → Générer nouvelle clé privée')
  console.log(`  Placer le JSON ici : ${CONFIG_FCM_SA}`)
  console.log('  Ou définir FCM_SERVICE_ACCOUNT_JSON dans .env')
} else {
  console.log('✓ config/fcm-service-account.json présent')
}

// 2. google-services.json
if (!existsSync(GOOGLE_SERVICES)) {
  console.log('')
  console.log('⚠ google-services.json manquant !')
  console.log('')
  console.log('  Étapes :')
  console.log('  1. Ouvrez la Firebase Console (dans votre navigateur)')
  console.log('  2. Créez un projet ou sélectionnez-en un')
  console.log('  3. Ajoutez une app Android → Package: com.fleuramours.app')
  console.log('  4. Téléchargez google-services.json')
  console.log(`  5. Placez-le ici : ${GOOGLE_SERVICES}`)
  console.log('')
} else {
  console.log('✓ google-services.json présent')
}

// 3. Ouvrir Firebase Console
const url = 'https://console.firebase.google.com/'
console.log('')
console.log(`Ouverture de la Firebase Console : ${url}`)
console.log('')
const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'
spawn(openCmd, [url], { stdio: 'ignore', shell: true })

// 4. Lancer le build
console.log('Build APK en cours…')
console.log('')
spawn('npm', ['run', 'build:apk'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
}).on('exit', (code) => {
  console.log('')
  if (code === 0) {
    console.log('✅ Build terminé. Dans Android Studio : Build → Assemble Project')
  } else {
    console.log('❌ Erreur lors du build.')
  }
  console.log('')
})
