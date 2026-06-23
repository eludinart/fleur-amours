'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dyadsApi } from '@/api/dyads'

/** Redirige vers l'espace duo unifié (Mes duos / résultat par token). */
export default function DyadePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const acceptToken = searchParams?.get('token') || ''
  const pairingToken = searchParams?.get('pairing') || ''

  useEffect(() => {
    async function go() {
      if (acceptToken) {
        try {
          await dyadsApi.accept(acceptToken)
        } catch {
          /* invitation déjà traitée ou invalide */
        }
      }
      if (pairingToken) {
        router.replace(`/a-deux/result?token=${encodeURIComponent(pairingToken)}`)
        return
      }
      router.replace('/a-deux')
    }
    void go()
  }, [acceptToken, pairingToken, router])

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" aria-hidden />
    </div>
  )
}
