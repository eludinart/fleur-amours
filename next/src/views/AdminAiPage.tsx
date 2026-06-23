'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/api/admin'
import { toast } from '@/hooks/useToast'
import { aiProviderLabel } from '@/lib/ai-providers'
import type { AiProvider } from '@/lib/ai-providers'
import type { AiTier } from '@/lib/ai-tiers'

type TierModels = Record<AiTier, string>

type AiConfigResponse = {
  config?: {
    provider: AiProvider
    openrouter_model: string | null
    mistral_model: string | null
    openrouter_models?: Partial<Record<AiTier, string | null>>
    mistral_models?: Partial<Record<AiTier, string | null>>
    source?: string
  }
  providers?: AiProvider[]
  keys?: { openrouter: boolean; mistral: boolean; openrouter_chars?: number; mistral_chars?: number }
  active?: { provider: AiProvider; model: string; models?: Record<AiTier, string>; configured: boolean }
}

type UsageStats = {
  totalCalls: number
  cachedCalls: number
  estimatedTokens: number
  byTask: Array<{ task_id: string; count: number; tokens: number }>
  byTier: Array<{ tier: string; count: number; tokens: number }>
}

const TIER_LABELS: Record<AiTier, string> = {
  light: 'Léger (coût minimal)',
  standard: 'Standard',
  premium: 'Premium (qualité max)',
}

export default function AdminAiPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [provider, setProvider] = useState<AiProvider>('openrouter')
  const [openrouterModels, setOpenrouterModels] = useState<TierModels>({
    light: '',
    standard: '',
    premium: '',
  })
  const [mistralModels, setMistralModels] = useState<TierModels>({
    light: '',
    standard: '',
    premium: '',
  })
  const [keys, setKeys] = useState({ openrouter: false, mistral: false, openrouter_chars: 0, mistral_chars: 0 })
  const [activeModels, setActiveModels] = useState<Record<AiTier, string>>({
    light: '',
    standard: '',
    premium: '',
  })
  const [source, setSource] = useState('env')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, usageRes] = await Promise.all([
        adminApi.getAiConfig() as Promise<AiConfigResponse>,
        adminApi.getAiUsage(7) as Promise<UsageStats>,
      ])
      setProvider(res.config?.provider ?? 'openrouter')
      const or = res.config?.openrouter_models
      const mi = res.config?.mistral_models
      setOpenrouterModels({
        light: String(or?.light ?? res.config?.openrouter_model ?? ''),
        standard: String(or?.standard ?? res.config?.openrouter_model ?? ''),
        premium: String(or?.premium ?? ''),
      })
      setMistralModels({
        light: String(mi?.light ?? res.config?.mistral_model ?? ''),
        standard: String(mi?.standard ?? res.config?.mistral_model ?? ''),
        premium: String(mi?.premium ?? ''),
      })
      setKeys({
        openrouter: res.keys?.openrouter ?? false,
        mistral: res.keys?.mistral ?? false,
        openrouter_chars: res.keys?.openrouter_chars ?? 0,
        mistral_chars: res.keys?.mistral_chars ?? 0,
      })
      setActiveModels(
        res.active?.models ?? {
          light: res.active?.model ?? '',
          standard: res.active?.model ?? '',
          premium: res.active?.model ?? '',
        }
      )
      setSource(res.config?.source ?? 'env')
      setUsage(usageRes)
    } catch (e: unknown) {
      toast((e as Error)?.message ?? 'Erreur chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function trimOrNull(v: string): string | null {
    const t = v.trim()
    return t || null
  }

  async function handleSave() {
    setBusy(true)
    setTestResult(null)
    try {
      await adminApi.saveAiConfig({
        provider,
        openrouter_model: trimOrNull(openrouterModels.standard),
        mistral_model: trimOrNull(mistralModels.standard),
        openrouter_models: {
          light: trimOrNull(openrouterModels.light),
          standard: trimOrNull(openrouterModels.standard),
          premium: trimOrNull(openrouterModels.premium),
        },
        mistral_models: {
          light: trimOrNull(mistralModels.light),
          standard: trimOrNull(mistralModels.standard),
          premium: trimOrNull(mistralModels.premium),
        },
      })
      toast('Configuration IA enregistrée', 'success')
      await load()
    } catch (e: unknown) {
      toast((e as Error)?.message ?? 'Erreur sauvegarde', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = (await adminApi.testAi()) as {
        ok?: boolean
        message?: string
        error?: string
        provider_label?: string
        results?: Array<{ tier: string; model: string; ok: boolean; message: string }>
      }
      if (res.ok && res.results?.length) {
        const lines = res.results.map((r) => `${r.tier}: ${r.ok ? '✓' : '✗'} ${r.model}`).join(' · ')
        setTestResult(`✓ ${res.message ?? 'OK'} — ${lines}`)
        toast('Connexion IA OK (tous tiers)', 'success')
      } else if (res.results?.length) {
        const lines = res.results.map((r) => `${r.tier}: ${r.message}`).join('; ')
        setTestResult(`✗ ${lines}`)
        toast('Échec sur un ou plusieurs tiers', 'error')
      } else {
        const msg = res.error ?? res.message ?? 'Échec du test'
        setTestResult(`✗ ${msg}`)
        toast(msg, 'error')
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Erreur test'
      setTestResult(`✗ ${msg}`)
      toast(msg, 'error')
    } finally {
      setTesting(false)
    }
  }

  const activeKeyOk = provider === 'mistral' ? keys.mistral : keys.openrouter
  const models = provider === 'mistral' ? mistralModels : openrouterModels
  const setModels = provider === 'mistral' ? setMistralModels : setOpenrouterModels

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
          Intelligence artificielle
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Provider global + modèles par tier (léger / standard / premium). Les clés API restent dans le .env serveur.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement…</p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Provider actif</label>
              <div className="flex flex-wrap gap-2">
                {(['openrouter', 'mistral'] as AiProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      provider === p
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400'
                    }`}
                  >
                    {aiProviderLabel(p)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Source : {source === 'db' ? 'administration (base)' : 'variable AI_PROVIDER (.env)'}
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                activeKeyOk
                  ? provider === 'mistral'
                    ? 'border-cyan-400/50 bg-cyan-50/50 dark:bg-cyan-950/20'
                    : 'border-violet-400/50 bg-violet-50/50 dark:bg-violet-950/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                {aiProviderLabel(provider)}
              </p>
              <p className={`text-[10px] mb-3 ${activeKeyOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                {activeKeyOk
                  ? `✓ Clé configurée (${provider === 'mistral' ? keys.mistral_chars : keys.openrouter_chars} car.)`
                  : '✗ clé absente — redémarrez le serveur après modification du .env'}
              </p>
              <div className="space-y-3">
                {(['light', 'standard', 'premium'] as AiTier[]).map((tier) => (
                  <div key={tier}>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      {TIER_LABELS[tier]}
                      {activeModels[tier] ? (
                        <span className="text-slate-400 ml-1">→ actif : {activeModels[tier]}</span>
                      ) : null}
                    </label>
                    <input
                      value={models[tier]}
                      onChange={(e) => setModels((prev) => ({ ...prev, [tier]: e.target.value }))}
                      placeholder={
                        tier === 'light'
                          ? 'ex. mistral-small-latest / gemini-flash-lite'
                          : tier === 'premium'
                            ? 'ex. mistral-large-latest / gemini-flash'
                            : 'modèle standard'
                      }
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>

            {!activeKeyOk && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
                Le provider sélectionné n&apos;a pas de clé API. L&apos;application utilisera les réponses de repli.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium disabled:opacity-50"
              >
                {testing ? 'Test…' : 'Tester les 3 tiers'}
              </button>
            </div>

            {testResult && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                {testResult}
              </p>
            )}
          </div>

          {usage && (
            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Usage IA (7 jours)</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2">
                  <p className="text-lg font-bold text-violet-600">{usage.totalCalls}</p>
                  <p className="text-[10px] text-slate-500">appels</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2">
                  <p className="text-lg font-bold text-emerald-600">{usage.cachedCalls}</p>
                  <p className="text-[10px] text-slate-500">cache</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2">
                  <p className="text-lg font-bold text-cyan-600">{usage.estimatedTokens.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] text-slate-500">tokens est.</p>
                </div>
              </div>
              {usage.byTier.length > 0 && (
                <div className="text-[11px] text-slate-500">
                  Par tier :{' '}
                  {usage.byTier.map((t) => `${t.tier} (${t.count})`).join(' · ')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
