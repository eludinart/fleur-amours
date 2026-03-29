'use client'

import { useEffect, useRef, useCallback } from 'react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const SW_URL = `${basePath}/api/firebase-messaging-sw`

function storageKey(userId: number) {
  return `push_token_registered_${userId}`
}

/**
 * Enregistre le service worker Firebase Messaging et demande la permission
 * de notifications push.
 *
 * - Au premier appel après login : demande la permission et enregistre le token.
 * - Sur les rechargements suivants : silencieux si token déjà enregistré.
 * - Expose `triggerPushSetup()` pour forcer le setup après login.
 */
export function usePushNotifications(userId?: number | null) {
  const runningRef = useRef(false)

  const setup = useCallback(async (uid: number, force = false) => {
    if (runningRef.current) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!firebaseProjectId || !firebaseApiKey || !vapidKey) return

    // Déjà enregistré pour cet utilisateur et pas de forçage → silencieux
    const alreadyDone = localStorage.getItem(storageKey(uid)) === '1'
    if (alreadyDone && !force && Notification.permission !== 'default') return

    // Permission refusée explicitement → ne pas insister
    if (Notification.permission === 'denied') return

    runningRef.current = true
    try {
      const swReg = await navigator.serviceWorker.register(SW_URL, {
        scope: `${basePath}/`,
      })
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

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

      await fetch(`${basePath}/api/notifications/register_push_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, platform: 'web' }),
      })

      // Mémoriser que ce user a déjà enregistré son token
      localStorage.setItem(storageKey(uid), '1')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PushNotifications] setup error:', err)
      }
    } finally {
      runningRef.current = false
    }
  }, [])

  // Sur rechargement de page : setup silencieux si pas encore fait
  useEffect(() => {
    if (!userId) return
    setup(userId)
  }, [userId, setup])

  // Retourner une fonction pour déclencher le setup immédiatement (après login)
  const triggerAfterLogin = useCallback((uid: number) => {
    // Réinitialise le flag de session pour forcer le passage même si déjà mémorisé
    // (cas : nouveau navigateur, token expiré)
    setup(uid, false)
  }, [setup])

  return { triggerAfterLogin }
}
