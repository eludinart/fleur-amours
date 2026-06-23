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
  const [pairings, setPairings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError(t('duo.tokenNotFound'))
      setLoading(false)
      return
    }
    Promise.all([aDeuxApi.getDuoResult(token), aDeuxApi.getDashboard()])
      .then(([data, dash]) => {
        setPairings(dash.pairings || [])
        if (data.status === 'waiting_partner') {
          setError(t('duo.partnerNotYet'))
        } else {
          setDuoData({
            ...data,
            duo: computeDuoAnalysis(data.person_a, data.person_b),
            invite_token: token,
          })
        }
      })
      .catch(() => setError(t('duo.tokenNotFound')))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center text-slate-500">{t('common.loading')}</div>
  }

  if (error || !duoData) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <p className="text-slate-600">{error || t('duo.tokenNotFound')}</p>
        <Link href="/a-deux" className="text-accent underline">{t('aDeux.viewMesDuos')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 lg:py-8">
      <DuoSynthesisView
        duoData={duoData}
        allPairings={pairings}
        onReset={() => router.push('/a-deux')}
      />
    </div>
  )
}
