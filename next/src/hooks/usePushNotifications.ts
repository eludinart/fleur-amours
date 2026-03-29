'use client'

import { useEffect, useRef } from 'react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const SW_URL = `${basePath}/api/firebase-messaging-sw`

/**
 * Enregistre le service worker Firebase Messaging et demande la permission
 * de notifications push au premier montage (utilisateur connecté uniquement).
 *
 * Flux :
 * 1. Vérifie le support (Notification API + ServiceWorker API)
 * 2. Enregistre le SW via la route Next.js qui embarque la config Firebase
 * 3. Demande la permission notifications si pas encore accordée
 * 4. Génère le token FCM et le poste en DB via /api/notifications/register_push_token
 */
export function usePushNotifications(userId?: number | null) {
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    if (registeredRef.current) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    if (!('serviceWorker' in navigator)) return

    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

    if (!firebaseProjectId || !firebaseApiKey || !vapidKey) return

    // Permission déjà refusée : ne pas insister
    if (Notification.permission === 'denied') return

    registeredRef.current = true

    async function setup() {
      try {
        // 1. Enregistrer le service worker
        const swReg = await navigator.serviceWorker.register(SW_URL, {
          scope: `${basePath}/`,
        })

        // 2. Attendre que le SW soit actif
        await navigator.serviceWorker.ready

        // 3. Demander la permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // 4. Initialiser Firebase et obtenir le token FCM
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

        if (!token) return

        // 5. Enregistrer le token en base
        await fetch(`${basePath}/api/notifications/register_push_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, platform: 'web' }),
        })
      } catch (err) {
        // Silencieux si Firebase non configuré ou permission refusée
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PushNotifications] setup error:', err)
        }
        registeredRef.current = false
      }
    }

    setup()
  }, [userId])
}
