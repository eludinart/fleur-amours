'use client'

import { useState } from 'react'
import Link from 'next/link'
import { contactApi } from '@/api/contact'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function getRequestTypes() {
  return [
    { value: 'rdv', label: t('contact.requestTypeRdv') },
    { value: 'question', label: t('contact.requestTypeQuestion') },
    { value: 'other', label: t('contact.requestTypeOther') },
  ]
}

function getPreferences() {
  return [
    { value: 'visio', label: t('contact.videoconference') },
    { value: 'phone', label: t('contact.phone') },
    { value: 'both', label: t('contact.preferenceBoth') },
  ]
}

export function ContactPage() {
  useStore((s) => s.locale)
  const [form, setForm] = useState({
    name: '',
    email: '',
    request_type: 'rdv' as string,
    message: '',
    preference: 'both' as string,
    gdpr: false,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.gdpr) {
      setError(t('contact.gdprError'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await contactApi.submit({
        name: form.name,
        email: form.email,
        message: form.message,
        preference: form.preference,
        request_type: form.request_type,
      })
      setSuccess(true)
    } catch (err) {
      setError(
        (err as Error)?.message ||
          (err as { detail?: string })?.detail ||
          t('contact.genericError')
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-xl mx-auto px-4 py-16 text-center space-y-6 min-w-0">
          <div className="text-6xl">✉️</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t('contact.successTitle')}
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            {(() => {
              const body = t('contact.successBody')
              const parts = body.split('{email}')
              return parts.length === 2 ? (
                <>
                  {parts[0]}
                  <strong>{form.email}</strong>
                  {parts[1]}
                </>
              ) : (
                body
              )
            })()}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors"
            >
              {t('contact.backHome')}
            </Link>
            <button
              onClick={() => {
                setSuccess(false)
                setForm({
                  name: '',
                  email: '',
                  request_type: 'rdv',
                  message: '',
                  preference: 'both',
                  gdpr: false,
                })
              }}
              className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('contact.sendAnother')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const requestTypes = getRequestTypes()
  const preferences = getPreferences()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-8 min-w-0">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
            {t('contact.pageTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('contact.pageSubtitle')}
          </p>
        </div>

        <div className="rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 p-5 text-sm text-violet-800 dark:text-violet-200 space-y-2">
          <p className="font-medium">{t('contact.whyTitle')}</p>
          <p>{t('contact.whyDesc')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.nameLabel')}{' '}
              <span className="text-slate-400 font-normal">
                {t('contact.nameOptional')}
              </span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('contact.namePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.emailLabel')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="votre@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.requestTypeLabel')}
            </label>
            <div className="space-y-2">
              {requestTypes.map((rt) => (
                <label
                  key={rt.value}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="request_type"
                    value={rt.value}
                    checked={form.request_type === rt.value}
                    onChange={() => set('request_type', rt.value)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {rt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.preferenceLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {preferences.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('preference', p.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.preference === p.value
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400 dark:hover:border-violet-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.messageLabel')}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              required
              rows={5}
              placeholder={t('contact.messagePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
            />
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gdpr}
                onChange={(e) => set('gdpr', e.target.checked)}
                className="mt-1 w-4 h-4 accent-violet-600 shrink-0"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('contact.gdprText')}{' '}
                <a href="mailto:contact@eludein.art" className="underline">
                  contact@eludein.art
                </a>
                .
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading || !form.email || !form.message || !form.gdpr
            }
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold text-base shadow-lg hover:shadow-violet-500/25 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? t('contact.sending') : t('contact.sendBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}
