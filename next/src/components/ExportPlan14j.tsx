'use client'

import { useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type ExportPlan14jProps = {
  targetRef?: React.RefObject<HTMLElement | null>
  pdfRef?: React.RefObject<HTMLElement | null>
  imageRef?: React.RefObject<HTMLElement | null>
  filename?: string
}

export function ExportPlan14j({ targetRef, pdfRef, imageRef, filename }: ExportPlan14jProps) {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  async function waitForImages(container: HTMLElement) {
    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
    if (imgs.length === 0) return
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve()
            const done = () => resolve()
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
          })
      )
    )
  }

  async function waitForFonts() {
    try {
      const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
      if (fonts?.ready) await fonts.ready
    } catch {
      // ignore
    }
  }

  const exportPdf = async () => {
    const el = (pdfRef ?? targetRef)?.current
    if (!el) {
      toast(t('share.elementNotFound'), 'error')
      return
    }
    setLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      // Create a temporary offscreen clone for capture (prevents UI flashing).
      const host = document.createElement('div')
      host.style.position = 'fixed'
      host.style.left = '-10000px'
      host.style.top = '0'
      host.style.opacity = '1'
      host.style.pointerEvents = 'none'
      host.style.zIndex = '-1'
      host.style.background = '#ffffff'
      document.body.appendChild(host)

      const clone = el.cloneNode(true) as HTMLElement
      // The source node is often hidden (opacity:0) in the UI; ensure the clone is visible for canvas capture.
      clone.style.opacity = '1'
      clone.style.visibility = 'visible'
      clone.style.pointerEvents = 'none'
      clone.style.transform = 'none'
      clone.style.position = 'relative'
      clone.style.left = '0'
      clone.style.top = '0'
      clone.style.background = '#ffffff'
      clone.style.width = '794px'
      clone.style.boxSizing = 'border-box'
      clone.setAttribute('data-pdf-export', '1')
      host.appendChild(clone)

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      await waitForFonts()
      await waitForImages(clone)

      await html2pdf()
        .set({
          margin: 10,
          filename: filename || "Exploration de Ma Fleur d'Amours — Fleur d'AmOurs.pdf",
          image: { type: 'jpeg', quality: 0.95 },
          pagebreak: { mode: ['css', 'legacy'], avoid: '.pdf-avoid-break, .day, h2, h3' },
          html2canvas: {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: clone.scrollWidth || undefined,
            windowHeight: clone.scrollHeight || undefined,
            onclone: (doc: Document) => {
              const root = doc.querySelector('[data-pdf-export="1"]') as HTMLElement | null
              if (!root) return
              // Force a clean print look.
              const style = doc.createElement('style')
              style.textContent = `
                [data-pdf-export="1"] { background: #fff !important; color: #000 !important; }
                [data-pdf-export="1"] { opacity: 1 !important; visibility: visible !important; transform: none !important; }
                [data-pdf-export="1"], [data-pdf-export="1"] * {
                  color: #000 !important;
                  text-shadow: none !important;
                  box-shadow: none !important;
                  background: transparent !important;
                }
                [data-pdf-export="1"] img, [data-pdf-export="1"] svg {
                  display: block !important;
                  margin-left: auto !important;
                  margin-right: auto !important;
                  max-width: 100% !important;
                }
                [data-pdf-export="1"] .pdf-avoid-break {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
              `
              doc.head.appendChild(style)
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(clone)
        .save()

      try {
        host.remove()
      } catch {}
      toast(t('share.pdfDownloaded'), 'success')
      setMenuOpen(false)
    } catch (e) {
      toast(t('share.exportError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const exportImage = async () => {
    const el = (imageRef ?? targetRef)?.current
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
