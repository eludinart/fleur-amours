// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { prairieApi, type JardinPouls } from '@/api/prairie'
import { socialApi } from '@/api/social'
import { PETAL_BY_ID, PETAL_DEFS } from '@/lib/petal-theme'
import { t } from '@/i18n'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const ts = new Date(String(iso).replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(ts).toLocaleDateString()
}

export default function JardinFilPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [pouls, setPouls] = useState<JardinPouls | null>(null)
  const [semis, setSemis] = useState([])
  const [semisStatus, setSemisStatus] = useState({ canPostToday: true, todaySemis: null })
  const [semisPetal, setSemisPetal] = useState('')
  const [semisBody, setSemisBody] = useState('')
  const [semisFilter, setSemisFilter] = useState('')
  const [postingSemis, setPostingSemis] = useState(false)
  const [semisError, setSemisError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, semisData] = await Promise.all([
        prairieApi.getPouls(),
        socialApi.getSemis(semisFilter || undefined),
      ])
      setPouls(data)
      setSemis(semisData?.items ?? [])
      setSemisStatus(semisData?.status ?? { canPostToday: true, todaySemis: null })
    } catch (err) {
      setError((err as Error)?.message || 'Erreur')
      setPouls(null)
    } finally {
      setLoading(false)
    }
  }, [semisFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [user, load])

  useEffect(() => {
    if (!user) return
    socialApi
      .getSemis(semisFilter || undefined)
      .then((data) => {
        setSemis(data?.items ?? [])
        setSemisStatus(data?.status ?? { canPostToday: true, todaySemis: null })
      })
      .catch(() => {})
  }, [semisFilter, user])

  const dominant = pouls?.dominantPetalToday ? PETAL_BY_ID[pouls.dominantPetalToday] : null

  const handlePostSemis = async () => {
    if (!semisPetal || !semisBody.trim()) return
    setPostingSemis(true)
    setSemisError('')
    try {
      await socialApi.postSemis(semisPetal, semisBody.trim())
      setSemisBody('')
      await load()
    } catch (err) {
      setSemisError((err as Error)?.message || '')
    } finally {
      setPostingSemis(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <header className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📡 {t('pouls.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('pouls.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            title={t('pouls.refresh')}
          >
            🔄
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="mb-3 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        {loading && !pouls ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : pouls ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <PoulsCard
                icon="💧"
                value={pouls.arrosagesToday}
                label={t('pouls.arrosagesToday', { count: pouls.arrosagesToday })}
                tone="bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-200 border-cyan-200/60 dark:border-cyan-800/50"
              />
              <PoulsCard
                icon="🌸"
                value={pouls.pollensToday}
                label={t('pouls.pollensToday', { count: pouls.pollensToday })}
                tone="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border-amber-200/60 dark:border-amber-800/50"
              />
              <PoulsCard
                icon="🟢"
                value={pouls.jardiniersOnline}
                label={t('pouls.jardiniersOnline', { count: pouls.jardiniersOnline })}
                tone="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 border-emerald-200/60 dark:border-emerald-800/50"
              />
              <PoulsCard
                icon="🌼"
                value={pouls.fleursWeek}
                label={t('pouls.fleursWeek', { count: pouls.fleursWeek })}
                tone="bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-200 border-violet-200/60 dark:border-violet-800/50"
              />
            </section>

            {dominant && (
              <section
                className="rounded-2xl border p-4 flex items-center gap-3"
                style={{
                  backgroundColor: `${dominant.color}1a`,
                  borderColor: `${dominant.color}55`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: dominant.color, color: 'white' }}
                >
                  ✨
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('pouls.title')}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: dominant.color }}>
                    {t('pouls.dominantPetal', { petal: dominant.name })}
                  </p>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {t('semis.title')}
                </p>
                {(pouls.semisToday ?? 0) > 0 && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-300">
                    {t('semis.todayCount', { count: pouls.semisToday })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('semis.subtitle')}</p>

              {semisStatus.canPostToday ? (
                <div className="space-y-2">
                  <select
                    value={semisPetal}
                    onChange={(e) => setSemisPetal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-sm"
                  >
                    <option value="">{t('semis.choosePetal')}</option>
                    {PETAL_DEFS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <textarea
                    value={semisBody}
                    onChange={(e) => setSemisBody(e.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder={t('semis.placeholder')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-sm resize-none"
                  />
                  <button
                    type="button"
                    onClick={handlePostSemis}
                    disabled={postingSemis || !semisPetal || semisBody.trim().length < 8}
                    className="w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {t('semis.post')}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-emerald-600 dark:text-emerald-300">{t('semis.alreadyPosted')}</p>
              )}
              {semisError && <p className="text-xs text-rose-500">{semisError}</p>}

              <div className="flex flex-wrap gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setSemisFilter('')}
                  className={`px-2 py-0.5 rounded-lg text-xs ${!semisFilter ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                >
                  {t('semis.filterAll')}
                </button>
                {PETAL_DEFS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSemisFilter(p.id)}
                    className={`px-2 py-0.5 rounded-lg text-xs ${semisFilter === p.id ? 'text-white' : 'text-slate-500'}`}
                    style={semisFilter === p.id ? { backgroundColor: p.color } : undefined}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <ul className="space-y-2 max-h-80 overflow-y-auto pt-2">
                {semis.length === 0 ? (
                  <li className="text-sm text-slate-500">{t('semis.empty')}</li>
                ) : (
                  semis.map((s) => {
                    const def = PETAL_BY_ID[s.petalId]
                    return (
                      <li
                        key={s.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"
                        style={def ? { borderColor: `${def.color}44` } : undefined}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: def?.color }}>
                          {def?.name ?? s.petalId} · {t('semis.anonymous')} · {timeAgo(s.createdAt)}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{s.body}</p>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                {t('pouls.recentEclosions')}
              </p>
              {pouls.recentEclosions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('pouls.noEclosions')}</p>
              ) : (
                <ul className="space-y-2">
                  {pouls.recentEclosions.map((e) => (
                    <li key={`${e.userId}-${e.createdAt}`}>
                      <button
                        type="button"
                        onClick={() => router.push(`/lisiere/${e.userId}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                      >
                        <span className="text-2xl">{e.avatarEmoji || '🌸'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {e.pseudo}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            🌼 fleur éclose · {timeAgo(e.createdAt)}
                          </p>
                        </div>
                        <span className="text-slate-400 text-sm">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="text-center">
              <Link
                href="/prairie"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500"
              >
                🌻 {t('nav.grandJardin')}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PoulsCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: string
  value: number
  label: string
  tone: string
}) {
  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="text-2xl mb-0.5">{icon}</div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-sm mt-1 opacity-80 leading-snug">{label}</div>
    </div>
  )
}
