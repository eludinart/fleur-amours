// @ts-nocheck
'use client'

import { useState } from 'react'
import { INTENTIONS } from '@/api/social'
import { t } from '@/i18n'

const SAP_COST = 5

/**
 * Modal "Déposer une Graine" — choix d'Intention de Pollinisation puis envoi (coût Sève).
 */
export function SeedModal({ targetUserId, targetPseudo, onClose, onSent, onError }) {
  const [intentionId, setIntentionId] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!intentionId) return
    setSending(true)
    try {
      await onSent(targetUserId, intentionId)
      onClose()
    } catch (err) {
      if (err?.code === 'insufficient_sap') {
        let available = 0
        let required = SAP_COST
        try { const d = JSON.parse(err.raw ?? '{}'); available = d.available ?? 0; required = d.required ?? SAP_COST } catch {}
        onError?.(`Sève insuffisante (${available}/${required}). Rechargez votre Sève pour déposer une Graine.`)
      } else {
        onError?.(err?.detail || err?.message)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-emerald-200/60 dark:border-emerald-800/60 shadow-xl overflow-hidden transition-all duration-500 ease-out bg-white dark:bg-[#0f172a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-emerald-950/80 dark:to-slate-900">
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-1">
            🌱 {t('social.deposerGraine') ?? 'Déposer une Graine'}
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
            {(t('social.deposerGraineDescAnonymous') ?? 'Choisis une intention. Coût : {{cost}} Sève.').replace('{{cost}}', String(SAP_COST))}
          </p>
          <div className="space-y-2 mb-4">
            {INTENTIONS.map((int) => (
              <label
                key={int.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${
                  intentionId === int.id
                    ? 'border-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-700'
                }`}
              >
                <input
                  type="radio"
                  name="intention"
                  value={int.id}
                  checked={intentionId === int.id}
                  onChange={() => setIntentionId(int.id)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{int.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!intentionId || sending}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {sending ? '…' : (t('social.confierTuteur') ?? 'Confier au Tuteur')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
