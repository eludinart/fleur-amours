'use client'

import { t } from '@/i18n'

type PrairieOptInModalProps = {
  open: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  saving?: boolean
}

export function PrairieOptInModal({
  open,
  onConfirm,
  onCancel,
  saving = false,
}: PrairieOptInModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="relative rounded-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md shadow-xl bg-white dark:bg-[#0f172a]"
        role="dialog"
        aria-labelledby="prairie-optin-title"
        aria-modal="true"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌻</span>
            <h2
              id="prairie-optin-title"
              className="text-lg font-bold text-slate-800 dark:text-slate-100"
            >
              {t('prairie.optInTitle')}
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('prairie.optInBody')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {t('prairie.optInRgpd')}
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '…' : t('prairie.optInConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
