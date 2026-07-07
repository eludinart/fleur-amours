'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'
import { useNotifications } from '@/contexts/NotificationContext'
import { CommsEngagementAudienceModal } from './CommsEngagementAudienceModal'

type EngagementPreview = {
  campaignId: string
  notification: {
    type: string
    title: string
    body: string
    action_url: string
    action_label: string
    priority: string
  }
  email: { subject: string; html: string; text: string }
}

const CAMPAIGN_LABELS: Record<string, string> = {
  plan14j: 'Plan 14 jours',
  checkin: 'Check-in',
  tirage: 'Tirage carte',
  fleur: "Fleur d'AmOurs",
  session: 'Session porte',
  dreamscape: 'Conversation intérieure',
  comeback: 'Retour au jardin (peu connectés)',
}

const COOLDOWN_PRESET_LABELS: Record<string, string> = {
  daily: '1 fois par jour',
  weekly: '1 fois par semaine',
  monthly: '1 fois par mois',
}

type EngagementConfig = {
  enabled: boolean
  cooldownHours: number
  cooldownPreset: string
  inactiveDays: number
  limit: number
  updatedAt: string | null
}

type CooldownPreset = { id: string; label: string; hours: number }

export function CommsEngagementPanel() {
  const { fetchUnread } = useNotifications()
  const [engagementConfig, setEngagementConfig] = useState<EngagementConfig | null>(null)
  const [configPresets, setConfigPresets] = useState<CooldownPreset[]>([])
  const [configEnabled, setConfigEnabled] = useState(true)
  const [configPreset, setConfigPreset] = useState('weekly')
  const [configSaving, setConfigSaving] = useState(false)
  const [engagementPreviews, setEngagementPreviews] = useState<EngagementPreview[] | null>(null)
  const [engagementLoading, setEngagementLoading] = useState(false)
  const [engagementLocale, setEngagementLocale] = useState('fr')
  const [selectedCampaign, setSelectedCampaign] = useState('plan14j')
  const [testAdminId, setTestAdminId] = useState<number | ''>('')
  const [testAdmins, setTestAdmins] = useState<Array<{ id: number; email: string; name: string }>>([])
  const [testBusy, setTestBusy] = useState<'notif' | 'email' | 'both' | null>(null)
  const [useRealProfile, setUseRealProfile] = useState(true)
  const [audienceOpen, setAudienceOpen] = useState(false)

  const loadEngagementConfig = useCallback(async () => {
    try {
      const data = (await api.get('/api/admin/engagement/config')) as {
        config?: EngagementConfig
        presets?: CooldownPreset[]
      }
      if (data.config) {
        setEngagementConfig(data.config)
        setConfigEnabled(data.config.enabled)
        setConfigPreset(data.config.cooldownPreset || 'weekly')
      }
      if (data.presets?.length) setConfigPresets(data.presets)
    } catch {
      /* silencieux */
    }
  }, [])

  useEffect(() => {
    void loadEngagementConfig()
  }, [loadEngagementConfig])

  const saveEngagementConfig = async () => {
    setConfigSaving(true)
    try {
      const res = (await api.post('/api/admin/engagement/config', {
        enabled: configEnabled,
        cooldownPreset: configPreset,
      })) as { config?: EngagementConfig }
      if (res.config) {
        setEngagementConfig(res.config)
        setConfigEnabled(res.config.enabled)
        setConfigPreset(res.config.cooldownPreset)
      }
      toast('Planification enregistrée', 'success')
    } catch (err: unknown) {
      toast((err as { message?: string })?.message || 'Erreur enregistrement', 'error')
    }
    setConfigSaving(false)
  }

  const fetchEngagementPreviews = useCallback(async () => {
    setEngagementLoading(true)
    try {
      const data = (await api.get(`/api/engagement/preview?locale=${engagementLocale}`)) as {
        campaigns?: EngagementPreview[]
      }
      setEngagementPreviews(data.campaigns ?? [])
      if (data.campaigns?.length && !data.campaigns.some((c) => c.campaignId === selectedCampaign)) {
        setSelectedCampaign(data.campaigns[0].campaignId)
      }
    } catch {
      toast('Impossible de charger les aperçus', 'error')
    }
    setEngagementLoading(false)
  }, [engagementLocale, selectedCampaign])

  useEffect(() => {
    fetchEngagementPreviews()
  }, [fetchEngagementPreviews])

  useEffect(() => {
    void api
      .get('/api/admin/users/search?role=admins&limit=30')
      .then((data) => {
        const items = (data as { items?: Array<{ id: number; email: string; name: string }> }).items ?? []
        setTestAdmins(items)
        if (!testAdminId && items[0]) setTestAdminId(items[0].id)
      })
      .catch(() => {})
  }, [testAdminId])

  const sendAdminTest = async (mode: 'notif' | 'email' | 'both') => {
    if (!testAdminId) {
      toast('Choisissez un administrateur', 'error')
      return
    }
    setTestBusy(mode)
    try {
      const res = (await api.post('/api/notifications/admin-test', {
        admin_user_id: testAdminId,
        campaign: selectedCampaign,
        send_notification: mode === 'notif' || mode === 'both',
        send_email: mode === 'email' || mode === 'both',
        use_real_profile: useRealProfile,
      })) as { ok?: boolean; locale?: string }
      toast(
        res.ok ? `Test envoyé — ${res.locale ?? engagementLocale}` : 'Échec du test',
        res.ok ? 'success' : 'error',
      )
      if (mode === 'notif' || mode === 'both') fetchUnread()
    } catch (err: unknown) {
      toast((err as { message?: string })?.message || 'Erreur test', 'error')
    }
    setTestBusy(null)
  }

  const preview = engagementPreviews?.find((c) => c.campaignId === selectedCampaign)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Planification automatique</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Chaque utilisateur ne reçoit qu&apos;une seule relance (notification ou e-mail) sur la période choisie,
              quel que soit le type (plan 14j, tirage, check-in…). La cron Coolify lit ces réglages à chaque passage.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
              configEnabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
            }`}
          >
            {configEnabled ? 'Relances actives' : 'Relances suspendues'}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={configEnabled}
              onChange={(e) => setConfigEnabled(e.target.checked)}
              className="rounded"
            />
            Relances automatiques activées
          </label>

          <div className="min-w-[220px]">
            <label className="block text-xs text-slate-500 mb-1">Fréquence max par utilisateur</label>
            <select
              value={configPreset}
              onChange={(e) => setConfigPreset(e.target.value)}
              disabled={!configEnabled}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50"
            >
              {(configPresets.length ? configPresets : [
                { id: 'daily', label: '1 fois par jour', hours: 24 },
                { id: 'weekly', label: '1 fois par semaine', hours: 168 },
                { id: 'monthly', label: '1 fois par mois', hours: 720 },
              ]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void saveEngagementConfig()}
            disabled={configSaving}
            className="px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {configSaving ? '…' : 'Enregistrer'}
          </button>
        </div>

        {engagementConfig?.updatedAt && (
          <p className="text-[11px] text-slate-400">
            Dernière modification : {new Date(engagementConfig.updatedAt).toLocaleString('fr-FR')}
            {engagementConfig.cooldownHours
              ? ` — cooldown ${COOLDOWN_PRESET_LABELS[engagementConfig.cooldownPreset] ?? `${engagementConfig.cooldownHours} h`}`
              : ''}
          </p>
        )}

        {!configEnabled && (
          <p className="text-xs text-rose-600 dark:text-rose-400 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 px-3 py-2">
            Les relances cron sont suspendues : aucun envoi automatique tant que cette case est décochée (les tests
            manuels ci-dessous restent possibles).
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Prochain envoi cron</h3>
          <p className="text-xs text-slate-500 mt-1">
            Liste des personnes qui recevraient une relance au prochain passage automatique, avec le contenu exact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAudienceOpen(true)}
          className="px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 shrink-0"
        >
          Voir destinataires & contenu
        </button>
      </div>

      <CommsEngagementAudienceModal open={audienceOpen} onClose={() => setAudienceOpen(false)} />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tester une relance</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs text-slate-500 mb-1">Administrateur cible</label>
            <select
              value={testAdminId}
              onChange={(e) => setTestAdminId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              {testAdmins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.email} ({a.email})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pb-2">
            <input
              type="checkbox"
              checked={useRealProfile}
              onChange={(e) => setUseRealProfile(e.target.checked)}
              className="rounded"
            />
            Profil réel (Fleur, tirages, session)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!testBusy}
            onClick={() => sendAdminTest('notif')}
            className="px-4 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {testBusy === 'notif' ? '…' : 'Notification'}
          </button>
          <button
            type="button"
            disabled={!!testBusy}
            onClick={() => sendAdminTest('email')}
            className="px-4 py-2 text-sm rounded-xl border border-violet-300 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50"
          >
            {testBusy === 'email' ? '…' : 'E-mail'}
          </button>
          <button
            type="button"
            disabled={!!testBusy}
            onClick={() => sendAdminTest('both')}
            className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {testBusy === 'both' ? '…' : 'Les deux'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={engagementLocale}
          onChange={(e) => setEngagementLocale(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="it">Italiano</option>
          <option value="de">Deutsch</option>
        </select>
        <button
          type="button"
          onClick={fetchEngagementPreviews}
          disabled={engagementLoading}
          className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {engagementLoading ? '…' : 'Actualiser les aperçus'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(engagementPreviews ?? []).map((c) => (
          <button
            key={c.campaignId}
            type="button"
            onClick={() => setSelectedCampaign(c.campaignId)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
              ${selectedCampaign === c.campaignId
                ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 border-violet-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}
          >
            {CAMPAIGN_LABELS[c.campaignId] ?? c.campaignId}
          </button>
        ))}
      </div>

      {engagementLoading && <p className="text-sm text-slate-500">Chargement…</p>}

      {preview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Notification in-app</h3>
            <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-xl shrink-0" aria-hidden>
                🔔
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{preview.notification.title}</p>
                <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">{preview.notification.body}</p>
                {preview.notification.action_label && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">
                    → {preview.notification.action_label}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">E-mail transactionnel</h3>
            <p className="text-xs text-slate-500 mb-3">Objet : {preview.email.subject}</p>
            <div
              className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white [color-scheme:light]"
              style={{ colorScheme: 'light' }}
              dangerouslySetInnerHTML={{ __html: preview.email.html }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
