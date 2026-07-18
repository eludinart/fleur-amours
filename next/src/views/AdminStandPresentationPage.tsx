'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * Présentation stand (marchés / événements) — admin only, plein écran.
 * Contenu : `public/stand/presentation.html`.
 * Chargé via fetch + srcDoc (évite le blocage X-Frame-Options: DENY de next.config).
 */
export default function AdminStandPresentationPage() {
  const router = useRouter()
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${basePath}/stand/presentation.html`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!cancelled) setHtml(text)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Chargement impossible')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event?.data?.type === 'stand-presentation-exit') {
        router.push('/admin')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/admin')
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
    }
  }, [router])

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0a1e]">
      <Link
        href="/admin"
        className="absolute top-3 right-3 z-[110] rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md hover:bg-black/75 hover:text-white"
      >
        ← Admin
      </Link>

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-rose-300">Impossible de charger la présentation ({error}).</p>
          <a
            href={`${basePath}/stand/presentation.html`}
            className="text-sm text-violet-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le fichier HTML directement
          </a>
        </div>
      )}

      {!error && !html && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
        </div>
      )}

      {html && (
        <iframe
          title="Présentation stand Fleur d’AmOurs"
          srcDoc={html}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  )
}
