// @ts-nocheck
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { billingApi } from '@/api/billing'
import { SapWallet } from '@/components/dashboard/SapWallet'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function priceLabel(p: { amount_cents?: number; unit?: string }): string | null {
  if (!p.amount_cents) return null
  const euros = (p.amount_cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${euros} €${p.unit ? `/${p.unit}` : ''}`
}

export default function BoutiquePage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [access, setAccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [canceledBanner, setCanceledBanner] = useState(false)

  useEffect(() => {
    billingApi.getAccess().then(setAccess).catch(() => setAccess(null)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    billingApi
      .getProducts()
      .then((r) => setProducts((r as { products?: unknown[] })?.products || []))
      .catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    const q = searchParams.get('checkout')
    if (q === 'success') {
      billingApi.getAccess().then(setAccess).catch(() => {})
    }
    if (q === 'canceled') {
      setCanceledBanner(true)
      router.replace(pathname || `${basePath}/boutique`)
    }
  }, [searchParams, router, pathname])

  const { sapPacks, subscriptions, otherPacks } = useMemo(() => {
    const list = Array.isArray(products) ? products : []
    return {
      sapPacks: list.filter((p) => String(p.id || '').startsWith('sap_') && p.price_id),
      subscriptions: list.filter((p) => p.type === 'subscription' && p.price_id),
      otherPacks: list.filter(
        (p) => p.type === 'pack' && p.price_id && !String(p.id || '').startsWith('sap_')
      ),
    }
  }, [products])

  async function handlePurchase(product: { id: string; price_id?: string }) {
    if (!user) return
    setCheckoutError('')
    setCheckoutLoading(product.id)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const base = `${origin}${basePath}`
    try {
      const { url } = (await billingApi.createCheckoutSession({
        price_id: product.price_id,
        product_id: product.id,
        success_url: `${base}/boutique?checkout=success`,
        cancel_url: `${base}/boutique?checkout=canceled`,
      })) as { url?: string }
      if (url) window.location.href = url
      else setCheckoutError(t('account.checkoutError'))
    } catch (err) {
      setCheckoutError(
        (err as { message?: string; detail?: string })?.message ||
          (err as { detail?: string })?.detail ||
          t('account.paymentError')
      )
    } finally {
      setCheckoutLoading(null)
    }
  }

  function renderProductButton(p: { id: string; label?: string; price_id?: string; amount_cents?: number; unit?: string }) {
    const pl = priceLabel(p)
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => handlePurchase(p)}
        disabled={!!checkoutLoading}
        className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-xl bg-gradient-to-br from-violet-600 to-rose-600 hover:from-violet-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50 disabled:hover:from-violet-600 disabled:hover:to-rose-600"
      >
        <span>{checkoutLoading === p.id ? t('account.redirecting') : p.label || p.id}</span>
        {pl ? <span className="text-xs font-medium text-white/90">{pl}</span> : null}
      </button>
    )
  }

  function renderSection(title: string, items: typeof products) {
    if (!items?.length) return null
    return (
      <div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">{title}</h3>
        <div className="flex flex-wrap gap-3">{items.map((p) => renderProductButton(p))}</div>
      </div>
    )
  }

  const tokenBalance = access?.token_balance ?? 0
  const eternalSap = access?.eternal_sap ?? 0
  const hasAnyOffer =
    sapPacks.length > 0 || subscriptions.length > 0 || otherPacks.length > 0

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
            {t('prairie.boutique')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('prairie.boutiqueSubtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {user ? <SapWallet className="mb-2" showPackButtons={false} /> : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20 p-6">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  {t('account.sapBadge')}
                </p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{tokenBalance}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.sapSaison')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-violet-50/50 dark:bg-violet-950/20 p-6">
                <p className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                  {t('account.cristalLabel')}
                </p>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-1">{eternalSap}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.sapEternelle')}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 space-y-4">
              <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                <span aria-hidden>📍</span> {t('prairie.boutiqueFlowTitle')}
              </h2>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{t('prairie.boutiqueWhereTitle')}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{t('prairie.boutiqueWhereBody')}</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{t('prairie.boutiqueWhenTitle')}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{t('prairie.boutiqueWhenBody')}</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{t('prairie.boutiqueHowTitle')}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{t('prairie.boutiqueHowBody')}</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{t('prairie.boutiqueWhyTitle')}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{t('prairie.boutiqueWhyBody')}</p>
                </li>
              </ul>
            </div>

            {canceledBanner && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                {t('prairie.boutiqueCanceled')}
              </div>
            )}

            {user ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-6">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span aria-hidden>💳</span> {t('prairie.boutiquePaymentsTitle')}
                </h2>
                {checkoutError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-300">
                    {checkoutError}
                  </div>
                )}
                {hasAnyOffer ? (
                  <div className="space-y-8">
                    {renderSection(t('prairie.boutiqueSapPacksTitle'), sapPacks)}
                    {renderSection(t('prairie.boutiqueSubscriptionsTitle'), subscriptions)}
                    {renderSection(t('prairie.boutiqueCreditsTitle'), otherPacks)}
                  </div>
                ) : (
                  !loading && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('prairie.boutiqueNoOffers')}</p>
                  )
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-5 text-sm text-slate-600 dark:text-slate-300">
                {t('prairie.boutiqueLoginHint')}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">🌱 Graines à venir</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                La Boutique des Saisons proposera bientôt des Graines à échanger contre votre Sève : thèmes visuels, effets cosmétiques pour la Prairie, et plus encore. Restez à l&apos;écoute !
              </p>
              <div className="mt-4 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600">
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  En construction — les Graines arrivent avec les prochaines saisons.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
