'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { billingApi, sapApi } from '@/api/billing'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type PackProduct = {
  id: string
  price_id: string
  label: string
  sap_units?: number
}

const MAX_GAUGE = 100

export function SapWallet({
  className = '',
  showPackButtons = true,
}: {
  className?: string
  /** Si false, affiche seulement la jauge (boutons d’achat regroupés ailleurs, ex. Boutique). */
  showPackButtons?: boolean
}) {
  const [balance, setBalance] = useState<number | null>(null)
  const [packs, setPacks] = useState<PackProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    try {
      const r = await sapApi.balance()
      if (r?.success && typeof r.data?.balance === 'number') setBalance(r.data.balance)
      else setBalance(0)
    } catch {
      setBalance(0)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('checkout') === 'success') {
        refresh()
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [refresh])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  useEffect(() => {
    let c = false
    setLoading(true)
    const loadPacks = showPackButtons
      ? billingApi
          .getProducts()
          .then((r) => {
            const list = (r as { products?: PackProduct[] })?.products ?? []
            const sap = list.filter((p) => /^sap_/.test(p.id) && p.price_id)
            if (!c) setPacks(sap.sort((a, b) => (a.sap_units ?? 0) - (b.sap_units ?? 0)))
          })
          .catch(() => {
            if (!c) setPacks([])
          })
      : Promise.resolve()

    Promise.all([refresh(), loadPacks]).finally(() => {
      if (!c) setLoading(false)
    })
    return () => {
      c = true
    }
  }, [refresh, showPackButtons])

  async function buy(p: PackProduct) {
    setErr('')
    setCheckoutId(p.id)
    const base = `${typeof window !== 'undefined' ? window.location.origin : ''}${basePath}`
    try {
      const res = (await billingApi.createCheckoutSession({
        price_id: p.price_id,
        product_id: p.id,
        success_url: `${base}/boutique?checkout=success`,
        cancel_url: `${base}/boutique?checkout=canceled`,
      })) as { url?: string }
      if (res?.url) window.location.href = res.url
      else setErr('Stripe non configuré ou prix manquant.')
    } catch (e) {
      setErr((e as Error)?.message || 'Paiement indisponible.')
    } finally {
      setCheckoutId(null)
    }
  }

  const pct = Math.min(100, ((balance ?? 0) / MAX_GAUGE) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border border-violet-200/70 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/40 via-white to-amber-50/30 dark:from-violet-950/25 dark:via-slate-900/40 dark:to-amber-950/15 p-6 ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
        <span>💧</span> Sève SAP
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Unité unique pour le Tuteur et les actions premium. Rechargement sécurisé via Stripe.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-4xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">
              {balance ?? 0}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">SAP</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-6">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400"
            />
          </div>

          {showPackButtons ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Packs</p>
              <div className="flex flex-wrap gap-2">
                {packs.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Définissez <code className="text-[10px]">STRIPE_PRICE_SAP_10</code>,{' '}
                    <code className="text-[10px]">STRIPE_PRICE_SAP_50</code>,{' '}
                    <code className="text-[10px]">STRIPE_PRICE_SAP_100</code> pour activer les achats.
                  </p>
                ) : (
                  packs.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!checkoutId}
                      onClick={() => buy(p)}
                      className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                    >
                      {checkoutId === p.id ? '…' : p.label}
                    </button>
                  ))
                )}
              </div>
              {err ? <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{err}</p> : null}
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('prairie.boutiqueSapGaugeHint')}</p>
          )}
        </>
      )}
    </motion.div>
  )
}
