'use client'

import { useState, useEffect } from 'react'
import { notificationsApi } from '@/api/notifications'
import { usePushNotifications } from '@/contexts/PushNotificationProvider'
import type { NotificationPrefs, NotificationTopicKey } from '@/lib/notification-prefs-types'
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOPICS,
  TOPIC_KEYS,
} from '@/lib/notification-prefs-types'

const DIGEST_OPTIONS = [
  { value: 'instant', label: 'Instantané', desc: 'Recevoir un email à chaque notification' },
  { value: 'daily', label: 'Quotidien', desc: 'Un résumé par jour' },
  { value: 'weekly', label: 'Hebdomadaire', desc: 'Un résumé par semaine' },
  { value: 'never', label: 'Jamais', desc: "Pas d'email de notification" },
]

const TOPIC_LABELS: Record<NotificationTopicKey, { label: string; desc: string }> = {
  carte_du_jour: {
    label: 'Carte du jour',
    desc: 'Proposition quotidienne (et série 3 jours) — hors limite hebdomadaire',
  },
  plan14j: {
    label: 'Plan 14 jours',
    desc: 'Rappels de micro-actions et clôture de parcours',
  },
  checkin: {
    label: 'Check-in',
    desc: 'Relances et échos liés à votre check-in',
  },
  social: {
    label: 'Social (Clairière, graines, duo)',
    desc: 'Activité relationnelle dans le jardin',
  },
  coach: {
    label: 'Coach / messages',
    desc: 'Échanges avec un accompagnant',
  },
  session_dreamscape: {
    label: 'Sessions & conversation intérieure',
    desc: 'Portes entrouvertes, dreamscape, reprises',
  },
}

export default function NotificationPreferencesPage() {
  const pushStatus = usePushNotifications()
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    notificationsApi
      .getPreferences()
      .then((p) => {
        const raw = p as NotificationPrefs
        setPrefs({
          ...DEFAULT_NOTIFICATION_PREFS,
          ...raw,
          topics: { ...DEFAULT_TOPICS, ...(raw.topics ?? {}) },
        })
      })
      .catch(() => setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, topics: { ...DEFAULT_TOPICS } }))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    setSaved(false)
    try {
      const data = (await notificationsApi.savePreferences(prefs)) as NotificationPrefs
      setPrefs({
        ...DEFAULT_NOTIFICATION_PREFS,
        ...data,
        topics: { ...DEFAULT_TOPICS, ...(data.topics ?? {}) },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      /* silent */
    }
    setSaving(false)
  }

  const toggleTopic = (key: NotificationTopicKey) => {
    setPrefs((p) =>
      p
        ? {
            ...p,
            topics: { ...p.topics, [key]: !p.topics[key] },
          }
        : p
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!prefs) return null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Préférences de notification</h1>
        <p className="text-sm text-slate-500 mt-1">Personnalisez comment vous recevez vos notifications</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Notifications in-app</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Afficher la cloche et les notifications dans l&apos;application
            </p>
            {pushStatus?.isNative && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {pushStatus.registered ? 'Push Android activées' : 'Push Android en cours d’activation…'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPrefs((p) => (p ? { ...p, in_app_enabled: !p.in_app_enabled } : p))}
            className={`relative w-11 h-6 rounded-full transition-colors ${prefs.in_app_enabled ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.in_app_enabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Notifications par email</p>
            <p className="text-xs text-slate-500 mt-0.5">Recevoir les notifications importantes par email</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefs((p) => (p ? { ...p, email_enabled: !p.email_enabled } : p))}
            className={`relative w-11 h-6 rounded-full transition-colors ${prefs.email_enabled ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.email_enabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>

        {prefs.email_enabled && (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Fréquence des emails</p>
            <div className="space-y-2">
              {DIGEST_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      prefs.email_digest === opt.value
                        ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                >
                  <input
                    type="radio"
                    name="digest"
                    checked={prefs.email_digest === opt.value}
                    onChange={() => setPrefs((p) => (p ? { ...p, email_digest: opt.value } : p))}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Types de messages</p>
          <p className="text-xs text-slate-500">Choisissez ce que vous souhaitez recevoir</p>
          <div className="space-y-2">
            {TOPIC_KEYS.map((key) => {
              const meta = TOPIC_LABELS[key]
              const on = prefs.topics?.[key] !== false
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{meta.label}</p>
                    <p className="text-xs text-slate-500">{meta.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTopic(key)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Heures calmes</p>
          <p className="text-xs text-slate-500">Pas de notifications entre ces heures (fuseau Paris)</p>
          <div className="flex items-center gap-3">
            <select
              value={prefs.quiet_hours_start ?? ''}
              onChange={(e) =>
                setPrefs((p) =>
                  p
                    ? { ...p, quiet_hours_start: e.target.value ? parseInt(e.target.value, 10) : null }
                    : p
                )
              }
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="">Désactivé</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            {prefs.quiet_hours_start !== null && prefs.quiet_hours_start !== undefined && (
              <>
                <span className="text-sm text-slate-400">→</span>
                <select
                  value={prefs.quiet_hours_end ?? ''}
                  onChange={(e) =>
                    setPrefs((p) =>
                      p
                        ? { ...p, quiet_hours_end: e.target.value ? parseInt(e.target.value, 10) : null }
                        : p
                    )
                  }
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            Préférences sauvegardées
          </span>
        )}
      </div>
    </div>
  )
}
