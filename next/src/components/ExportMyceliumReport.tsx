'use client'

import { useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'

type Props = {
  getRoot: () => HTMLElement | null
  filename: string
}

export function ExportMyceliumReport({ getRoot, filename }: Props) {
  const [loading, setLoading] = useState(false)

  async function exportPdf() {
    const el = getRoot()
    if (!el) {
      toast(t('share.elementNotFound'), 'error')
      return
    }
    setLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const host = document.createElement('div')
      host.style.position = 'fixed'
      host.style.left = '-10000px'
      host.style.top = '0'
      host.style.background = '#ffffff'
      document.body.appendChild(host)

      const clone = el.cloneNode(true) as HTMLElement
      clone.style.position = 'relative'
      clone.style.left = '0'
      clone.style.width = '794px'
      clone.style.background = '#ffffff'
      clone.style.color = '#111'
      clone.setAttribute('data-pdf-export', '1')
      host.appendChild(clone)

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        } as Record<string, unknown>)
        .from(clone)
        .save()

      host.remove()
      toast(t('mycelium.reportExported'), 'success')
    } catch {
      toast(t('share.exportError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      disabled={loading}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
    >
      {loading ? '…' : t('mycelium.exportPdf')}
    </button>
  )
}
