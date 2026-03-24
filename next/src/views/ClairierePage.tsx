// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { socialApi } from '@/api/social'
import { DialogueStream } from '@/components/social/DialogueStream'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export default function ClairierePage() {
  const pathname = usePathname()
  const pathWithoutBase = (pathname || '').replace(basePath, '').replace(/^\/+|\/+$/g, '') || ''
  const pathSegments = pathWithoutBase.split('/').filter(Boolean)
  const channelId = pathSegments[0] === 'clairiere' && pathSegments[1] ? pathSegments[1] : null
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [otherPseudo, setOtherPseudo] = useState('')
  const [otherIsOnline, setOtherIsOnline] = useState(false)

  const withUserId = searchParams.get('with')

  const fetchChannels = useCallback(async (signalAborted) => {
    try {
      const data = await socialApi.getMyChannels()
      const list = data?.channels || []
      if (signalAborted?.()) return
      setChannels(list)

      if (withUserId && list.length > 0) {
        const ch = list.find((c) => String(c.otherUserId) === String(withUserId))
        if (ch) {
          router.replace(`/clairiere/${ch.channelId}`)
          return
        }
      }

      if (channelId && list.length > 0) {
        const ch = list.find((c) => String(c.channelId) === String(channelId))
        if (ch && !signalAborted?.()) {
          setOtherPseudo(ch.otherPseudo || '')
          setOtherIsOnline(!!ch.otherIsOnline)
        }
      }
    } catch {
      if (!signalAborted?.()) setChannels([])
    } finally {
      if (!signalAborted?.()) setLoading(false)
    }
  }, [channelId, withUserId, router])

  useEffect(() => {
    let cancelled = false
    const abort = () => cancelled
    if (channels.length === 0) setLoading(true)
    fetchChannels(abort)
    return () => { cancelled = true }
  }, [channelId, withUserId, router, fetchChannels])

  // Rafraîchir la présence (en ligne / hors ligne) toutes les 30 s
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => fetchChannels(() => false), 60000)
    return () => clearInterval(interval)
  }, [user, fetchChannels])

  if (!user) return null
  if (loading && !channelId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (channelId) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <DialogueStream channelId={Number(channelId)} otherPseudo={otherPseudo} otherIsOnline={otherIsOnline} />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-100 dark:bg-slate-900">
      <header className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-100">
          🌿 {t('social.clairiere') ?? 'La Clairière'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('social.clairiereDesc') ?? 'Dialogues avec les jardiniers en lien.'}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {channels.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">
            {t('social.aucunCanal') ?? 'Aucun dialogue pour l’instant. Accepte une Graine ou dépose-en une depuis la Lisière.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {channels.map((ch) => (
              <li key={ch.channelId}>
                <button
                  type="button"
                  onClick={() => router.push(`/clairiere/${ch.channelId}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/60 hover:bg-emerald-50 transition-colors text-left shadow-sm"
                >
                  <span className="text-2xl">🌸</span>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${ch.otherIsOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {ch.otherPseudo}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {ch.otherIsOnline ? 'En ligne' : 'Hors ligne'}
                    </p>
                  </div>
                  <span className="ml-auto flex items-center gap-2">
                    {(ch.unreadCount ?? 0) > 0 && (
                      <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold">
                        {ch.unreadCount > 99 ? '99+' : ch.unreadCount}
                      </span>
                    )}
                    <span className="text-slate-500 dark:text-slate-400">→</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
