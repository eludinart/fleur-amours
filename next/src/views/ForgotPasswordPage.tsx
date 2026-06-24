'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/api/auth'
import { t, setLocale as syncI18nLocale } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function ForgotPasswordPage() {
  const locale = useStore((s) => s.locale)
  if (typeof window !== 'undefined') {
    syncI18nLocale(locale || 'fr')
  }
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      const ex = err as { detail?: string; message?: string }
      setError(ex.detail || ex.message || t('login.error'))
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-rose-50 to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-xl shadow-rose-500/35 p-2.5 mb-4">
            <img src={`${basePath}/juste-la-fleur.png`} alt="" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
            {t('forgotPassword.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('forgotPassword.subtitle')}
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 shadow-xl p-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {t('forgotPassword.success')}
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-xl shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/35 active:scale-[0.98] transition-all"
            >
              {t('forgotPassword.backToLogin')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 shadow-xl p-6 space-y-4"
            autoComplete="off"
          >
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('forgotPassword.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('forgotPassword.emailPlaceholder')}
                required
                autoFocus
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-xl shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/35 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('forgotPassword.sending')}
                </span>
              ) : (
                t('forgotPassword.submit')
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full mt-1 py-2 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              {t('forgotPassword.backToLogin')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
