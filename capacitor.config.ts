import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Configuration Capacitor — Fleur d'AmOurs
 *
 * Modes de build :
 *
 *   1. APK local (même réseau WiFi) :
 *      Décommenter `server.url` et mettre l'IP de votre machine.
 *      Ex : http://192.168.1.42:8000
 *
 *   2. APK production (serveur déployé) :
 *      Mettre l'URL de production dans `server.url`.
 *      Ex : https://app.eludein.art
 *
 *   3. APK autonome (assets embarqués) :
 *      Laisser `server` commenté — les assets sont dans le bundle.
 *      L'API est configurée via NEXT_PUBLIC_API_URL au build (npm run build:apk).
 */

// Récupère l'URL du serveur depuis la variable d'environnement (build CI/CD)
const serverUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId:   'com.fleuramours.app',
  appName: "Fleur d'AmOurs",
  webDir:  serverUrl ? 'next/apk-webdir' : 'next/out',

  android: {
    // Autorise les connexions HTTP en clair (utile pour les tests sur réseau local)
    allowMixedContent: true,
    // Désactive la détection de débogage (pour les tests)
    // overrideUserAgent: 'FleurAmOursApp/1.0',
  },

  server: serverUrl
    ? { url: serverUrl, cleartext: true }
    : undefined,   // Mode autonome : le backend est appelé via VITE_API_URL embarqué

  plugins: {
    // Capacitor Preferences (remplace localStorage sur mobile)
  },
}

export default config
