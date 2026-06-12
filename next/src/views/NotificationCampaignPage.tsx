'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function resolveCampaignId(pathname: string | null, propId?: string): string {
  if (propId?.trim()) return propId.trim()
  if (!pathname) return ''
  const rel = pathname.replace(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
  const segments = rel.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  const idx = segments.indexOf('campagne')
  if (idx >= 0 && segments[idx + 1]) return segments[idx + 1]
  return ''
}

type Props = { campaignId?: string }

export default function NotificationCampaignPage({ campaignId: campaignIdProp }: Props) {
  const pathname = usePathname()
  const id = resolveCampaignId(pathname, campaignIdProp)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Identifiant de message manquant.')
      return
    }
    setLoading(true)
    setError('')
    api
      .get(`/api/notifications/campaign/${encodeURIComponent(id)}`)
      .then((raw) => {
        const data = raw as { subject?: string; html?: string }
        setSubject(String(data.subject ?? ''))
        setHtml(String(data.html ?? ''))
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError) {
          setError(e.detail || e.message || 'Impossible de charger le message')
        } else {
          const err = e as { message?: string }
          setError(err?.message || 'Impossible de charger le message')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        Chargement du message…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <Link href="/notifications" className="inline-block mt-4 text-violet-600 underline text-sm">
          Retour aux notifications
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-16">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            Message reçu
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">{subject || 'Campagne e-mail'}</h1>
        </div>
        <Link
          href="/notifications"
          className="text-sm text-slate-500 hover:text-violet-600 shrink-0"
        >
          ← Notifications
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white overflow-hidden shadow-sm">
        {html ? (
          <iframe
            title={subject || 'Message'}
            sandbox="allow-same-origin"
            srcDoc={html}
            className="w-full min-h-[520px] border-0 bg-white"
          />
        ) : (
          <p className="p-8 text-sm text-slate-500 italic">Contenu indisponible.</p>
        )}
      </div>
    </div>
  )
}
