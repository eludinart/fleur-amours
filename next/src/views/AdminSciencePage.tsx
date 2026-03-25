'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin'
import { toast } from '@/hooks/useToast'

type ScienceConfig = {
  confidence_min_facts: number
  confidence_low_max: number
  confidence_medium_max: number

  include_petals_aggregate: boolean
  include_dreamscape: boolean
  include_solo_fleur: boolean
  include_tarot_1card: boolean
  include_tarot_4doors: boolean
  include_ma_fleur: boolean
  include_duo: boolean
  include_chat_clairiere: boolean
  include_chat_coach: boolean

  evidence_initial_max_messages: number
  evidence_update_max_messages: number

  science_profile_ttl_minutes: number
  science_generation_version: string
}

export default function AdminSciencePage() {
  const [config, setConfig] = useState<ScienceConfig | null>(null)
  const [dbConfigured, setDbConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [rebuildUserId, setRebuildUserId] = useState<string>('')
  const [rebuildLocale, setRebuildLocale] = useState<'fr' | 'en' | 'es'>('fr')
  const [message, setMessage] = useState<string | null>(null)

  function show(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(null), 4500)
  }

  async function load() {
    setLoading(true)
    setMessage(null)
    try {
      const res = (await adminApi.getScienceConfig()) as { config?: ScienceConfig; db_configured?: boolean }
      setConfig(res?.config ?? null)
      setDbConfigured(res?.db_configured ?? false)
    } catch (e: unknown) {
      show(((e as Error)?.message ?? 'Erreur') + '')
      toast('Erreur chargement Science', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!config) return
    setBusy(true)
    try {
      await adminApi.saveScienceConfig(config as Record<string, unknown>)
      show('Configuration sauvegardée.')
      await load()
    } catch (e: unknown) {
      const msg = (e as any)?.detail ?? (e as any)?.message ?? 'Erreur'
      show(msg)
      toast('Sauvegarde Science échouée', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRebuild() {
    const uid = Number(rebuildUserId.trim())
    if (!Number.isFinite(uid) || uid <= 0) {
      show('user_id invalide.')
      return
    }
    setBusy(true)
    try {
      await adminApi.rebuildScienceProfile({ user_id: uid, locale: rebuildLocale })
      show('Rebuild déclenché (profil science mis à jour).')
    } catch (e: unknown) {
      const msg = (e as any)?.detail ?? (e as any)?.message ?? 'Erreur'
      show(msg)
      toast('Rebuild Science échouée', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
        Science de la Fleur (Admin)
      </h2>

      {!dbConfigured && (
        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
          Base MariaDB non configurée : la config science ne peut pas être stockée.
        </p>
      )}

      {message && (
        <div className="rounded-xl px-4 py-3 text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 space-y-5">
        <div>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Sources incluses</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contrôle la génération du profil global (Facts / Hypothèses). Dans ce MVP, seuls sont « câblés » : <b>Pétales (profil actuel)</b>, <b>Chats Coach</b>, <b>Clairière</b>. Les autres sources seront branchées sur la pipeline Evidence dans la suite.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config &&
            [
              ['include_petals_aggregate', 'Pétales (profil actuel)'],
              ['include_chat_coach', 'Chats Coach'],
              ['include_chat_clairiere', 'Clairière (P2P)'],
              ['include_dreamscape', 'Promenade onirique'],
              ['include_solo_fleur', 'Explorer ma Fleur'],
              ['include_tarot_1card', 'Tirage 1 carte'],
              ['include_tarot_4doors', 'Tirage 4 portes'],
              ['include_ma_fleur', 'Ma Fleur'],
              ['include_duo', 'Duo'],
            ].map(([key, label]) => (
              <label key={key as string} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean((config as any)[key])}
                  disabled={busy || !dbConfigured}
                  onChange={(e) => setConfig({ ...(config as any), [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
        </div>

        <div className="pt-2 flex gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={busy || !dbConfigured}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-500 text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 space-y-5">
        <div>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Seuils & cache</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hypothèse &rarr; Fait selon la confiance.</p>
        </div>

        {config && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block text-xs text-slate-500 dark:text-slate-400">confidence_min_facts</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                value={config.confidence_min_facts}
                disabled={busy || !dbConfigured}
                onChange={(e) => setConfig({ ...(config as any), confidence_min_facts: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 dark:text-slate-400">confidence_low_max</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                value={config.confidence_low_max}
                disabled={busy || !dbConfigured}
                onChange={(e) => setConfig({ ...(config as any), confidence_low_max: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 dark:text-slate-400">confidence_medium_max</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                value={config.confidence_medium_max}
                disabled={busy || !dbConfigured}
                onChange={(e) => setConfig({ ...(config as any), confidence_medium_max: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 dark:text-slate-400">science_profile_ttl_minutes</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
                type="number"
                step="1"
                value={config.science_profile_ttl_minutes}
                disabled={busy || !dbConfigured}
                onChange={(e) => setConfig({ ...(config as any), science_profile_ttl_minutes: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/20 p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Rebuild opérationnel (test)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pour l'instant, le rebuild se base sur les données chat + un snapshot petals optionnel (si fourni). La synthèse est best-effort si l'IA n'est pas disponible.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs text-slate-500 dark:text-slate-400">user_id</span>
            <input
              className="mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
              value={rebuildUserId}
              onChange={(e) => setRebuildUserId(e.target.value)}
              placeholder="123"
            />
          </label>

          <label className="text-sm">
            <span className="block text-xs text-slate-500 dark:text-slate-400">locale</span>
            <select
              className="mt-1 w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/50 px-3 py-2 text-sm"
              value={rebuildLocale}
              onChange={(e) => setRebuildLocale(e.target.value as any)}
            >
              <option value="fr">fr</option>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </label>

          <button
            onClick={handleRebuild}
            disabled={busy || !dbConfigured}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Rebuild…' : 'Recalculer profil'}
          </button>
        </div>
      </div>
    </div>
  )
}

