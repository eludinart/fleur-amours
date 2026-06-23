// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { socialApi } from '@/api/social'
import { t } from '@/i18n'

type Props = {
  targetUserId: number | string
  targetPseudo?: string
  onMuted?: () => void
  onReported?: () => void
}

const REPORT_REASONS = [
  { id: 'spam', label: 'moderation.reasonSpam' },
  { id: 'harassment', label: 'moderation.reasonHarassment' },
  { id: 'inappropriate', label: 'moderation.reasonInappropriate' },
  { id: 'other', label: 'moderation.reasonOther' },
]

/**
 * Petit menu "⋯" (B5) : mettre en sourdine ou signaler un autre jardinier.
 * UX volontairement légère : un clic, confirmation simple, pas de modale lourde.
 */
export function ModerationMenu({ targetUserId, targetPseudo, onMuted, onReported }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open && !reporting) return
    const onDocClick = (e: MouseEvent) => {
      const el = wrapperRef.current
      if (el && !el.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, reporting])

  const handleMute = async () => {
    if (busy) return
    setBusy(true)
    try {
      await socialApi.muteUser(targetUserId, true)
      onMuted?.()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const submitReport = async () => {
    if (!reason || busy) return
    setBusy(true)
    try {
      await socialApi.reportUser(targetUserId, reason, detail || undefined)
      onReported?.()
      setReporting(false)
      setOpen(false)
      setReason('')
      setDetail('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('moderation.menuLabel')}
        className="w-9 h-9 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 text-lg flex items-center justify-center border border-slate-600/40"
      >
        ⋯
      </button>

      {open && !reporting && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700/70 bg-slate-900/95 shadow-xl backdrop-blur z-30 overflow-hidden">
          <button
            type="button"
            onClick={handleMute}
            disabled={busy}
            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            🔕 {t('moderation.mute')}
          </button>
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/40"
          >
            🚩 {t('moderation.report')}
          </button>
        </div>
      )}

      {reporting && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-rose-700/50 bg-slate-900/95 shadow-xl z-30 p-3 space-y-2">
          <p className="text-xs font-semibold text-rose-200">
            {t('moderation.reportTitle', { pseudo: targetPseudo ?? '' })}
          </p>
          <div className="space-y-1">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                  reason === r.id
                    ? 'bg-rose-900/40 text-rose-100'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  className="sr-only"
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                />
                <span>{t(r.label)}</span>
              </label>
            ))}
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={t('moderation.detailPlaceholder')}
            rows={2}
            className="w-full text-xs rounded-md border border-slate-600/60 bg-slate-950/60 p-2 text-slate-200 placeholder:text-slate-500"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setReporting(false)
                setReason('')
                setDetail('')
              }}
              disabled={busy}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={submitReport}
              disabled={!reason || busy}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? '…' : t('moderation.submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
