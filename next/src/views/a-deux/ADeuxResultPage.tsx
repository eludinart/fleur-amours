// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { aDeuxApi } from '@/api/a-deux'
import { t } from '@/i18n'
import { DuoSynthesisView } from '@/components/a-deux/DuoSynthesisView'
import { computeDuoAnalysis } from '@/lib/duo-analysis'

export default function ADeuxResultPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''

  const [duoData, setDuoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError(t('duo.tokenNotFound'))
      setLoading(false)
      return
    }
    aDeuxApi
      .getDuoResult(token)
      .then((data) => {
        if (data.status === 'waiting_partner') {
          setError(t('duo.partnerNotYet'))
        } else {
          setDuoData({
            ...data,
            duo: computeDuoAnalysis(data.person_a, data.person_b),
            invite_token: token,
            invited_email: data.invited_email,
          })
        }
      })
      .catch(() => setError(t('duo.tokenNotFound')))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="max-w-lg mx-auto py-16 text-center text-slate-500">{t('common.loading')}</div>
  }

  if (error || !duoData) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-slate-600">{error || t('duo.tokenNotFound')}</p>
        <Link href="/mes-duos" className="text-accent underline">{t('aDeux.viewMesDuos')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-4">
      <DuoSynthesisView duoData={duoData} onReset={() => router.push('/a-deux')} />
    </div>
  )
}
