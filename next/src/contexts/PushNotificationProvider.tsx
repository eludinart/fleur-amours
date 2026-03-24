'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { notificationsApi } from '@/api/notifications'

const PushNotificationContext = createContext<{ isNative: boolean; registered: boolean } | null>(null)

/**
 * Enregistre le token push sur Android (Capacitor) et envoie au backend.
 * Ne fait rien sur navigateur.
 */
export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [isNative, setIsNative] = useState(false)
  const [registered, setRegistered] = useState(false)
  const registeredRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    let listeners: Array<{ remove: () => Promise<void> }> = []

    const setup = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        const { PushNotifications } = await import('@capacitor/push-notifications')

        if (!Capacitor.isNativePlatform()) return
        setIsNative(true)

        const u = user as { id?: string; email?: string } | null
        if (!u?.id && !u?.email) return

        const sendToken = async (token: string) => {
          if (cancelled || registeredRef.current) return
          try {
            await notificationsApi.registerPushToken({
              token,
              platform: 'android',
              user_id: u?.id ? parseInt(String(u.id), 10) : null,
              user_email: u?.email || null,
            })
            registeredRef.current = true
          } catch {
            /* ignore */
          }
        }

        const regListener = await PushNotifications.addListener('registration', (ev) => {
          sendToken(ev.value)
        })
        listeners.push(regListener)

        const regErrListener = await PushNotifications.addListener('registrationError', () => {
          /* log if needed */
        })
        listeners.push(regErrListener)

        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (ev) => {
            const url = ev.notification?.data?.action_url
            if (url && typeof window !== 'undefined') {
              const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
              const path = url.startsWith('/') ? url : `/${url}`
              window.location.href = `${window.location.origin}${basePath}${path}`
            }
          }
        )
        listeners.push(actionListener)

        const permStatus = await PushNotifications.checkPermissions()
        if (permStatus.receive === 'prompt') {
          await PushNotifications.requestPermissions()
        }

        if (permStatus.receive === 'denied') return

        await PushNotifications.createChannel({
          id: 'fleur_default',
          name: "Fleur d'AmOurs",
          importance: 4,
          visibility: 1,
        }).catch(() => {})

        await PushNotifications.register()
      } catch {
        /* Capacitor non disponible (navigateur) */
      }
    }

    setup()
    return () => {
      cancelled = true
      registeredRef.current = false
      listeners.forEach((l) => l.remove().catch(() => {}))
    }
  }, [user])

  return (
    <PushNotificationContext.Provider value={{ isNative, registered }}>
      {children}
    </PushNotificationContext.Provider>
  )
}

export function usePushNotifications() {
  return useContext(PushNotificationContext)
}
