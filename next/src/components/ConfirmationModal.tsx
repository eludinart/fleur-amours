'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type ConfirmationModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  action?: string
  fromSablier?: number
  fromCristal?: number
  cost?: number
  loading?: boolean
  title?: string
  bodyTemplate?: string
}

/**
 * ConfirmationModal — Modale de confirmation avant action consommatrice (ex: open_door).
 */
export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  fromSablier = 15,
  fromCristal = 0,
  cost = 15,
  loading = false,
  title = "Confirmer l'action",
  bodyTemplate,
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !open) return null

  const defaultBody =
    bodyTemplate ??
    `Cette action consomme ${cost} SAP (unité Sève du Jardin). Confirmer ?`

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
    >
      <div
        className="rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirmation-title"
          className="font-semibold text-slate-800 dark:text-slate-100"
        >
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {defaultBody}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
