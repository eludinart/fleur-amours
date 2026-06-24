'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'
import { notificationsApi } from '@/api/notifications'

type Props = {
  onStatsLoaded?: (stats: {
    total?: number
    delivered?: number
    read?: number
    unread?: number
    unread_mine?: number
  }) => void
}

export function CommsStatusBar({ onStatsLoaded }: Props) {
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null)
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null)
  const [notifGuard, setNotifGuard] = useState<{
    devRestricted?: boolean
    devEmail?: string
    allowlistActive?: boolean
    allowlist?: string[] | null
  } | null>(null)
  const [testBusy, setTestBusy] = useState(false)
  const [stats, setStats] = useState<{
    total?: number
    delivered?: number
    read?: number
    unread?: number
    unread_mine?: number
  } | null>(null)

  const loadSmtp = useCallback(async () => {
    try {
      const data = (await api.get('/api/admin/system-status')) as {
        smtp?: { configured?: boolean; from?: string | null }
        notifications?: {
          devRestricted?: boolean
          devEmail?: string
          allowlistActive?: boolean
          allowlist?: string[] | null
        }
      }
      setSmtpOk(!!data.smtp?.configured)
      setSmtpFrom(data.smtp?.from ?? null)
      setNotifGuard(data.notifications ?? null)
    } catch {
      setSmtpOk(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const data = (await notificationsApi.stats()) as {
        total?: number
        delivered?: number
        read?: number
        unread?: number
        unread_mine?: number
      }
      setStats(data)
      onStatsLoaded?.(data)
    } catch {
      /* silent */
    }
  }, [onStatsLoaded])

  useEffect(() => {
    loadSmtp()
    loadStats()
  }, [loadSmtp, loadStats])

  async function sendTestEmail() {
    setTestBusy(true)
    try {
      await api.post('/api/admin/smtp-test', {})
      toast('E-mail de test envoyé à votre adresse admin', 'success')
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Échec du test SMTP', 'error')
    }
    setTestBusy(false)
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4 ${
          smtpOk
            ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 dark:border-emerald-900/60'
            : 'border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-orange-50/40 dark:from-amber-950/40 dark:to-orange-950/20 dark:border-amber-900/60'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden>
            {smtpOk ? '✉️' : '⚠️'}
          </span>
          <div className="text-sm min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              SMTP {smtpOk === null ? '…' : smtpOk ? 'opérationnel' : 'non configuré'}
            </p>
            {smtpFrom ? (
              <p className="text-xs text-slate-500 mt-0.5 truncate">Expéditeur : {smtpFrom}</p>
            ) : null}
            {!smtpOk && smtpOk !== null ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 max-w-xl">
                Variables SMTP dans <code className="font-mono text-[11px]">docker-compose.env</code>, puis
                redémarrage du serveur.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={loadSmtp}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            Rafraîchir
          </button>
          <button
            type="button"
            disabled={!smtpOk || testBusy}
            onClick={sendTestEmail}
            className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {testBusy ? 'Envoi…' : 'Test SMTP'}
          </button>
        </div>
      </div>

      {notifGuard?.devRestricted ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-900/60 p-4 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-semibold">Mode développement — envois restreints</p>
          <p className="text-xs mt-1 text-amber-900/90 dark:text-amber-200/90">
            Notifications in-app et e-mails transactionnels ne sont livrés qu&apos;à{' '}
            <strong>{notifGuard.devEmail ?? 'eludinart@gmail.com'}</strong>.
            Pour envoyer à toute la liste en local, ajoutez{' '}
            <code className="font-mono text-[11px]">NOTIFICATIONS_DEV_ONLY=false</code> dans{' '}
            <code className="font-mono text-[11px]">.env</code> ou{' '}
            <code className="font-mono text-[11px]">docker-compose.env</code>, puis redémarrez{' '}
            <code className="font-mono text-[11px]">npm run dev.vps:clean</code>.
            Commenter une ligne avec <code className="font-mono text-[11px]">#</code> ne suffit pas.
          </p>
        </div>
      ) : null}

      {notifGuard?.allowlistActive ? (
        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/90 dark:bg-violet-950/30 dark:border-violet-900/60 p-4 text-sm text-violet-950 dark:text-violet-100">
          <p className="font-semibold">Allowlist engagement active</p>
          <p className="text-xs mt-1 text-violet-900/90 dark:text-violet-200/90">
            Les relances cron (check-in, plan 14j…) ne partent que vers :{' '}
            {(notifGuard.allowlist ?? []).join(', ') || '—'}.
            Retirez ou commentez <code className="font-mono text-[11px]">ENGAGEMENT_REMIND_ALLOWLIST</code>{' '}
            pour désactiver ce filtre.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Les comptes virtuels Mycelium (
        <span className="font-mono">@demo-littoral.eludein.art</span>) sont toujours exclus des e-mails et
        notifications transactionnelles.
      </p>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Envoyées', value: stats.total, color: 'text-slate-800 dark:text-slate-100' },
            { label: 'Délivrées', value: stats.delivered, color: 'text-slate-700 dark:text-slate-200' },
            { label: 'Lues', value: stats.read, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Non lues (tous)', value: stats.unread, color: 'text-rose-500 dark:text-rose-400' },
            { label: 'Ma cloche', value: stats.unread_mine, color: 'text-amber-600 dark:text-amber-400' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
