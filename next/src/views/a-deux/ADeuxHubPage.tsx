// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { aDeuxApi } from '@/api/a-deux'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

function formatDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ADeuxHubPage() {
  useStore((s) => s.locale)
  const router = useRouter()
  const searchParams = useSearchParams()
  const anchorIdParam = searchParams?.get('anchor')

  const [anchors, setAnchors] = useState([])
  const [pairings, setPairings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    aDeuxApi
      .getDashboard()
      .then((d) => {
        setAnchors(d.anchors || [])
        setPairings(d.pairings || [])
      })
      .catch(() => setError(t('aDeux.loadError')))
      .finally(() => setLoading(false))
  }, [])

  const pendingPairings = pairings.filter((p) => p.status === 'pending')
  const completePairings = pairings.filter((p) => p.status === 'complete')

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-accent">{t('aDeux.hubTitle')} 💞</h1>
        <p className="text-sm text-slate-500">{t('aDeux.hubSubtitle')}</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">{t('common.loading')}</div>
      ) : (
        <>
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 p-4 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-3">
            <Link
              href="/a-deux/par-une-porte"
              className="rounded-2xl border-2 border-accent/40 bg-accent/5 dark:bg-accent/10 p-5 hover:scale-[1.01] transition-transform"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚪</span>
                <div>
                  <p className="font-bold text-lg">{t('aDeux.porteCardTitle')}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{t('aDeux.porteCardDesc')}</p>
                  <span className="inline-block mt-2 text-xs font-semibold text-accent">{t('aDeux.recommended')}</span>
                </div>
              </div>
            </Link>

            <Link
              href="/a-deux/complet"
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="font-bold">{t('aDeux.completCardTitle')}</p>
                  <p className="text-sm text-slate-500 mt-1">{t('aDeux.completCardDesc')}</p>
                </div>
              </div>
            </Link>
          </div>

          {anchors.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('aDeux.myAnchors')}</h2>
              <ul className="space-y-2">
                {anchors.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {a.questionnaire_type === 'porte'
                          ? t('aDeux.anchorPorte', { porte: a.porte || '—' })
                          : t('aDeux.anchorComplet')}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(a.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/a-deux?anchor=${a.id}`)}
                      className="shrink-0 text-xs font-semibold text-accent underline"
                    >
                      {t('aDeux.inviteFromAnchor')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(pendingPairings.length > 0 || completePairings.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('aDeux.recentDuos')}</h2>
                <Link href="/mes-duos" className="text-xs font-semibold text-accent underline">
                  {t('aDeux.viewAll')}
                </Link>
              </div>
              <ul className="space-y-2">
                {[...pendingPairings, ...completePairings].slice(0, 4).map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.partner_label || p.invited_email || t('aDeux.waitingPartner')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.status === 'complete' ? t('mesFleurs.complete') : t('mesFleurs.waiting')}
                      </p>
                    </div>
                    {p.status === 'complete' ? (
                      <Link
                        href={`/a-deux/result?token=${encodeURIComponent(p.invite_token)}`}
                        className="text-xs font-semibold text-accent"
                      >
                        {t('aDeux.viewSynthesis')}
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-600">⏳</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {anchorIdParam && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
              <p className="text-sm mb-3">{t('aDeux.inviteFromAnchorHint')}</p>
              <Link
                href={`/a-deux/par-une-porte?anchor=${anchorIdParam}&invite=1`}
                className="inline-flex px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
              >
                {t('aDeux.createInvite')}
              </Link>
            </div>
          )}

          <Link
            href="/mes-duos"
            className="block text-center text-sm font-medium text-slate-500 underline"
          >
            {t('aDeux.viewMesDuos')}
          </Link>
        </>
      )}
    </div>
  )
}
