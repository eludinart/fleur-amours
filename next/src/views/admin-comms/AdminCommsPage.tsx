'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { notificationsApi } from '@/api/notifications'
import { useNotifications } from '@/contexts/NotificationContext'
import { CommsStatusBar } from './CommsStatusBar'
import { CommsComposeNotification } from './CommsComposeNotification'
import { CommsComposeEmail } from './CommsComposeEmail'
import { CommsBroadcastHistory } from './CommsBroadcastHistory'
import { CommsNotificationRegistry } from './CommsNotificationRegistry'
import { CommsEngagementPanel } from './CommsEngagementPanel'
import { api } from '@/lib/api-client'

type Section = 'send' | 'history' | 'registry' | 'engagement'
type SendChannel = 'notification' | 'email'

const SECTIONS: Array<{ id: Section; label: string; icon: string; description: string }> = [
  { id: 'send', label: 'Envoyer', icon: '📤', description: 'Composer et diffuser' },
  { id: 'history', label: 'Campagnes', icon: '📋', description: 'Historique des diffusions' },
  { id: 'registry', label: 'Registre', icon: '📒', description: 'Journal & lectures' },
  { id: 'engagement', label: 'Relances auto', icon: '⏰', description: 'Engagement programmé' },
]

const CHANNELS: Array<{ id: SendChannel; label: string; icon: string; description: string }> = [
  {
    id: 'notification',
    label: 'Notification in-app',
    icon: '🔔',
    description: 'Cloche, push — message court avec lien vers une page',
  },
  {
    id: 'email',
    label: 'Campagne e-mail',
    icon: '✉️',
    description: 'HTML riche par destinataire + notification d\'aperçu',
  },
]

function parseSection(raw: string | null): Section {
  if (raw === 'history' || raw === 'registry' || raw === 'engagement') return raw
  return 'send'
}

function parseChannel(raw: string | null): SendChannel {
  return raw === 'email' ? 'email' : 'notification'
}

export default function AdminCommsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { fetchUnread } = useNotifications()

  const [section, setSection] = useState<Section>(() => parseSection(searchParams.get('section')))
  const [channel, setChannel] = useState<SendChannel>(() => parseChannel(searchParams.get('channel')))
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [statusKey, setStatusKey] = useState(0)
  const [testingNotif, setTestingNotif] = useState(false)

  useEffect(() => {
    setSection(parseSection(searchParams.get('section')))
    setChannel(parseChannel(searchParams.get('channel')))
  }, [searchParams])

  useEffect(() => {
    api
      .get('/api/admin/system-status')
      .then((data) => {
        const d = data as { smtp?: { configured?: boolean } }
        setSmtpOk(!!d.smtp?.configured)
      })
      .catch(() => setSmtpOk(false))
  }, [statusKey])

  const updateUrl = useCallback(
    (nextSection: Section, nextChannel?: SendChannel) => {
      const params = new URLSearchParams()
      if (nextSection !== 'send') params.set('section', nextSection)
      else if (nextChannel === 'email') params.set('channel', 'email')
      const q = params.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const goSection = (s: Section) => {
    setSection(s)
    updateUrl(s, channel)
  }

  const goChannel = (c: SendChannel) => {
    setChannel(c)
    setSection('send')
    updateUrl('send', c)
  }

  const onSent = useCallback(() => {
    setHistoryKey((k) => k + 1)
    setStatusKey((k) => k + 1)
    fetchUnread()
  }, [fetchUnread])

  async function quickTestNotif() {
    setTestingNotif(true)
    try {
      await notificationsApi.test()
      fetchUnread()
    } catch {
      /* silent */
    }
    setTestingNotif(false)
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Envois &amp; notifications
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Centre unique pour les campagnes e-mail, les notifications in-app et le suivi des diffusions.
          </p>
        </div>
        <button
          type="button"
          onClick={quickTestNotif}
          disabled={testingNotif}
          className="shrink-0 px-4 py-2 rounded-xl border border-violet-300 dark:border-violet-700 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50 transition-colors"
        >
          {testingNotif ? '…' : '🔔 Test cloche (moi)'}
        </button>
      </header>

      <CommsStatusBar key={statusKey} />

      <nav
        className="flex gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 overflow-x-auto"
        aria-label="Sections communications"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goSection(s.id)}
            className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-left transition-all
              ${section === s.id
                ? 'bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5 pl-6">{s.description}</span>
          </button>
        ))}
      </nav>

      {section === 'send' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => goChannel(c.id)}
                className={`text-left p-4 rounded-2xl border-2 transition-all
                  ${channel === c.id
                    ? c.id === 'email'
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-sm'
                      : 'border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                <span className="text-2xl" aria-hidden>
                  {c.icon}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2">{c.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
              </button>
            ))}
          </div>

          {channel === 'notification' ? (
            <CommsComposeNotification onSent={onSent} />
          ) : (
            <CommsComposeEmail smtpOk={smtpOk} onSent={onSent} />
          )}
        </div>
      )}

      {section === 'history' && <CommsBroadcastHistory key={historyKey} />}
      {section === 'registry' && <CommsNotificationRegistry onStatsChange={() => setStatusKey((k) => k + 1)} />}
      {section === 'engagement' && <CommsEngagementPanel />}
    </div>
  )
}
