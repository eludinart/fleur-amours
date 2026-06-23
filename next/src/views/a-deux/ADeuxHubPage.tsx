// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { aDeuxApi } from '@/api/a-deux'
import { fleurApi } from '@/api/fleur'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { AnchorInviteSection } from '@/components/a-deux/AnchorInviteSection'

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
  const [legacyItems, setLegacyItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedAnchor, setExpandedAnchor] = useState<number | null>(() => {
    const id = Number(anchorIdParam)
    return Number.isFinite(id) && id > 0 ? id : null
  })

  function load() {
    setError('')
    return Promise.all([
      aDeuxApi.getDashboard(),
      fleurApi.getMyResults().catch(() => ({ items: [] })),
    ])
      .then(([dash, legacy]) => {
        setAnchors(dash.anchors || [])
        setPairings(dash.pairings || [])
        setLegacyItems((legacy.items || []).filter((i) => i.type === 'duo' || i.type === 'solo'))
      })
      .catch(() => setError(t('aDeux.loadError')))
  }

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const id = Number(anchorIdParam)
    if (Number.isFinite(id) && id > 0) setExpandedAnchor(id)
  }, [anchorIdParam])

  async function deletePairing(id) {
    if (!window.confirm(t('aDeux.deletePairingConfirm'))) return
    try {
      await aDeuxApi.deletePairing(id)
      load()
    } catch {
      setError(t('mesFleurs.deleteError'))
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-accent">{t('aDeux.hubTitle')} 💞</h1>
        <p className="text-sm text-slate-500">{t('aDeux.hubSubtitleUnified')}</p>
      </div>

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

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('aDeux.myAnchors')}</h2>
        {anchors.length === 0 ? (
          <p className="text-sm text-slate-500">{t('aDeux.noAnchors')}</p>
        ) : (
          <ul className="space-y-2">
            {anchors.map((a) => (
              <li key={a.id}>
                <AnchorInviteSection
                  anchor={{
                    id: Number(a.id),
                    questionnaire_type: a.questionnaire_type,
                    porte: a.porte,
                    created_at: a.created_at,
                  }}
                  expanded={expandedAnchor === a.id}
                  onExpandedChange={(open) => setExpandedAnchor(open ? Number(a.id) : null)}
                  onDeleted={() => load()}
                  onPairingCreated={() => load()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('aDeux.allPairings')}</h2>
        {pairings.length === 0 ? (
          <p className="text-sm text-slate-500">{t('aDeux.noPairings')}</p>
        ) : (
          <ul className="space-y-2">
            {pairings.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-accent/30"
                onClick={() =>
                  p.status === 'complete'
                    ? router.push(`/a-deux/result?token=${encodeURIComponent(p.invite_token)}`)
                    : undefined
                }
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {p.partner_label || p.invited_email || t('aDeux.waitingPartner')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.status === 'complete' ? t('mesFleurs.complete') : t('mesFleurs.waiting')} · {formatDate(p.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {p.status === 'complete' && (
                    <Link
                      href={`/a-deux/result?token=${encodeURIComponent(p.invite_token)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-violet-700 dark:text-violet-300 underline"
                    >
                      {t('aDeux.openDuoSpace')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deletePairing(Number(p.id))
                    }}
                    className="text-xs text-red-500"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {legacyItems.length > 0 && (
        <section className="space-y-2 opacity-80">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{t('aDeux.legacySection')}</h2>
          <p className="text-xs text-slate-500">{t('aDeux.legacyHint')}</p>
          <ul className="space-y-1">
            {legacyItems.slice(0, 5).map((item, i) => (
              <li key={i}>
                <Link
                  href={item.type === 'duo' ? `/duo?token=${item.token}` : `/fleur?result=${item.id}`}
                  className="text-sm text-slate-600 underline"
                >
                  {item.type === 'duo' ? t('mesFleurs.duo') : t('nav.fleur')} — {formatDate(item.created_at)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
