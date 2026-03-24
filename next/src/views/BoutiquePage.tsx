// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { billingApi } from '@/api/billing'
import { t } from '@/i18n'

export default function BoutiquePage() {
  const { user } = useAuth()
  const [access, setAccess] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    billingApi.getAccess().then(setAccess).catch(() => setAccess(null)).finally(() => setLoading(false))
  }, [])

  const tokenBalance = access?.token_balance ?? 0
  const eternalSap = access?.eternal_sap ?? 0

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
            {t('prairie.boutique')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Transformez votre Sève en Graines — nouvelles fonctionnalités à venir.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
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
