'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api-client'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type OpenChat = { id: number; title?: string; updated_at?: string }

export default function ContactPage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [requestType, setRequestType] = useState('rdv')
  const [preference, setPreference] = useState('both')
  const [message, setMessage] = useState('')
  const [gdpr, setGdpr] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [openChats, setOpenChats] = useState<OpenChat[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)

  useEffect(() => {
    if (user?.email) setEmail(String(user.email))
    if (user?.name) setName(String(user.name))
  }, [user])

  useEffect(() => {
    if (!user) return
    setChatsLoading(true)
    api
      .get('/api/chat/conversations/my')
      .then((raw) => {
        const r = raw as { conversations?: Array<{ id: string; status?: string; last_message_at?: string }> }
        const list = (r.conversations ?? [])
          .filter((c) => c.status !== 'closed')
          .map((c) => ({ id: Number(c.id), updated_at: c.last_message_at }))
          .filter((c) => c.id > 0)
        setOpenChats(list.slice(0, 3))
      })
      .catch(() => setOpenChats([]))
      .finally(() => setChatsLoading(false))
  }, [user])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!gdpr) {
      setError(t('contact.gdprError'))
      return
    }
    setSending(true)
    try {
      await api.post('/api/contact_messages', {
        name: name.trim() || undefined,
        email: email.trim(),
        requestType,
        preference,
        message: message.trim(),
        gdprAccepted: true,
      })
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error || e?.message || t('contact.genericError'))
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-8 text-center">
          <p className="text-2xl mb-2">✉️</p>
          <h1 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{t('contact.successTitle')}</h1>
          <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-3">
            {t('contact.successBody', { email })}
          </p>
          <div className="flex flex-col gap-2 mt-8">
            <Link
              href="/"
              className="py-3 rounded-2xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition"
            >
              {t('contact.backHome')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setSuccess(false)
                setMessage('')
                setGdpr(false)
              }}
              className="py-3 rounded-2xl border border-slate-200 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300"
            >
              {t('contact.sendAnother')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-16">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{t('contact.pageTitle')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{t('contact.pageSubtitle')}</p>
      </header>

      {openChats.length > 0 ? (
        <section
          className="mb-8 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/30 p-4"
          aria-label={t('contact.openChatsAriaLabel')}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
            {t('contact.openChatsEyebrow')}
          </p>
          <p className="font-semibold text-violet-900 dark:text-violet-100 mt-1">
            {openChats.length === 1
              ? t('contact.openChatsTitleOne')
              : t('contact.openChatsTitleMany', { n: openChats.length })}
          </p>
          <p className="text-xs text-violet-800 dark:text-violet-200 mt-1">{t('contact.openChatsSubtitle')}</p>
          <ul className="mt-3 space-y-2">
            {openChats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat?conversation=${c.id}`}
                  className="block text-sm font-medium text-violet-700 dark:text-violet-300 hover:underline"
                >
                  → {c.title || `#${c.id}`}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/chat" className="inline-block mt-3 text-xs text-violet-600 dark:text-violet-400 underline">
            {t('contact.openChatsHistoryLink')}
          </Link>
        </section>
      ) : chatsLoading ? (
        <p className="text-xs text-slate-500 mb-6">{t('contact.openChatsLoading')}</p>
      ) : null}

      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 mb-8">
        <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm">{t('contact.whyTitle')}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{t('contact.whyDesc')}</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
            {t('contact.nameLabel')} <span className="text-slate-400 font-normal">{t('contact.nameOptional')}</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('contact.namePlaceholder')}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{t('contact.emailLabel')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{t('contact.requestTypeLabel')}</label>
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
          >
            <option value="rdv">{t('contact.requestTypeRdv')}</option>
            <option value="question">{t('contact.requestTypeQuestion')}</option>
            <option value="other">{t('contact.requestTypeOther')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{t('contact.preferenceLabel')}</label>
          <select
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
          >
            <option value="videoconference">{t('contact.videoconference')}</option>
            <option value="phone">{t('contact.phone')}</option>
            <option value="both">{t('contact.preferenceBoth')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{t('contact.messageLabel')}</label>
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('contact.messagePlaceholder')}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 resize-y"
          />
        </div>

        <label className="flex gap-3 items-start text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} className="mt-1" />
          <span>
            {t('contact.gdprText')}{' '}
            <a href="mailto:contact@eludein.art" className="text-violet-600 underline">
              contact@eludein.art
            </a>
          </span>
        </label>

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={sending}
          className="w-full py-3.5 rounded-2xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {sending ? t('contact.sending') : t('contact.sendBtn')}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link href="/chat" className="text-sm text-violet-600 dark:text-violet-400 underline">
          {t('contact.linkChatHistory')}
        </Link>
      </p>
    </div>
  )
}
