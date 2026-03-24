'use client'

import { useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type ExportPlan14jProps = {
  targetRef: React.RefObject<HTMLElement | null>
}

export function ExportPlan14j({ targetRef }: ExportPlan14jProps) {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const exportPdf = async () => {
    const el = targetRef?.current
    if (!el) {
      toast(t('share.elementNotFound'), 'error')
      return
    }
    setLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      await html2pdf()
        .set({
          margin: 10,
          filename: 'plan-14-jours.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save()
      toast(t('share.pdfDownloaded'), 'success')
      setMenuOpen(false)
    } catch (e) {
      toast(t('share.exportError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const exportImage = async () => {
    const el = targetRef?.current
    if (!el) {
      toast(t('share.elementNotFound'), 'error')
      return
    }
    setLoading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'plan-14-jours.png'
      a.click()
      toast(t('share.imageDownloaded'), 'success')
      setMenuOpen(false)
    } catch (e) {
      toast(t('share.exportError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
      >
        <span>{loading ? '…' : '📥'}</span>
        <span>{loading ? '…' : t('common.export')}</span>
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 min-w-[160px]">
            <button
              type="button"
              onClick={exportPdf}
              disabled={loading}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('common.downloadPdf')}
            </button>
            <button
              type="button"
              onClick={exportImage}
              disabled={loading}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('common.downloadImageFile')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
