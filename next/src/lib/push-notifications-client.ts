'use client'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const SW_URL = `${basePath}/api/firebase-messaging-sw`

export function pushTokenStorageKey(userId: number) {
  return `push_token_registered_${userId}`
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  )
}

/**
 * Enregistre le SW, demande la permission (déjà accordée = pas de popup), envoie le token au serveur.
 * @returns true si le token a été enregistré avec succès
 */
export async function registerPushTokenForUser(userId: number): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  if (!isWebPushConfigured()) return false

  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!firebaseProjectId || !firebaseApiKey || !vapidKey) return false

  if (Notification.permission === 'denied') return false

  const swReg = await navigator.serviceWorker.register(SW_URL, {
    scope: `${basePath}/`,
  })
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const { initializeApp, getApps, getApp } = await import('firebase/app')
  const { getMessaging, getToken } = await import('firebase/messaging')

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  const messaging = getMessaging(app)

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  })
  if (!token) return false

  const res = await fetch(`${basePath}/api/notifications/register_push_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, platform: 'web' }),
  })
  if (!res.ok) return false

  localStorage.setItem(pushTokenStorageKey(userId), '1')
  return true
}

export function shouldOfferPushPriming(userId: number): boolean {
  if (!isWebPushConfigured()) return false
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'default') return false
  if (sessionStorage.getItem('push_permission_priming_dismissed') === '1') return false
  const alreadyDone = localStorage.getItem(pushTokenStorageKey(userId)) === '1'
  return !alreadyDone
}
