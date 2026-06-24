'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi } from '@/api/auth'
import { t, setLocale as syncI18nLocale } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function ResetPasswordPage() {
  const locale = useStore((s) => s.locale)
  if (typeof window !== 'undefined') {
    syncI18nLocale(locale || 'fr')
  }
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('resetPassword.tooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'))
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
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
            {t('resetPassword.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('resetPassword.subtitle')}
          </p>
        </div>

        {!token ? (
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 shadow-xl p-6 space-y-4">
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {t('resetPassword.invalidLink')}
            </div>
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-xl shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/35 active:scale-[0.98] transition-all"
            >
              {t('resetPassword.requestNew')}
            </button>
          </div>
        ) : done ? (
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 shadow-xl p-6 space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {t('resetPassword.success')}
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-xl shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/35 active:scale-[0.98] transition-all"
            >
              {t('resetPassword.goToLogin')}
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
                {t('resetPassword.newPasswordLabel')}{' '}
                <span className="text-slate-400 font-normal">{t('login.passwordHint')}</span>
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={showPwd ? t('login.hidePwd') : t('login.showPwd')}
                >
                  {showPwd ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('resetPassword.confirmLabel')}
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-xl shadow-rose-500/30 hover:shadow-2xl hover:shadow-rose-500/35 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('resetPassword.saving')}
                </span>
              ) : (
                t('resetPassword.submit')
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
