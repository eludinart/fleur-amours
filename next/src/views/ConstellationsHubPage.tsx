// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { socialApi } from '@/api/social'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'
import { FleurSociale } from '@/components/FleurSociale'
import { t } from '@/i18n'

export default function ConstellationsHubPage() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joinToken, setJoinToken] = useState('')
  const [error, setError] = useState('')
  const [petalId, setPetalId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await socialApi.listConstellations()
      setItems(data?.items ?? [])
    } catch (err) {
      setError((err as Error)?.message || '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const detail = await socialApi.createConstellation({
        petalId: petalId || null,
        title: petalId ? PETAL_BY_ID[petalId]?.name : undefined,
      })
      router.push(`/constellation/${detail.token}`)
    } catch (err) {
      setError((err as Error)?.message || '')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    const tok = joinToken.trim()
    if (!tok) return
    setError('')
    try {
      await socialApi.joinConstellation(tok)
      router.push(`/constellation/${tok}`)
    } catch (err) {
      setError((err as Error)?.message || '')
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22] text-slate-100">
      <header className="shrink-0 px-4 py-3 border-b border-slate-700/60 bg-slate-950/50">
        <h1 className="text-lg font-bold text-violet-200">✨ {t('constellations.title')}</h1>
        <p className="text-xs text-slate-400">{t('constellations.subtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl mx-auto w-full space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-900/30 border border-rose-800/40 text-rose-200 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-violet-700/35 bg-violet-950/20 p-4 space-y-3">
          <p className="text-sm text-slate-300">{t('constellations.createHint')}</p>
          <select
            value={petalId}
            onChange={(e) => setPetalId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600/50 text-sm"
          >
            <option value="">{t('constellations.petalOptional')}</option>
            {PETAL_DEFS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-medium text-sm hover:bg-violet-500 disabled:opacity-50"
          >
            {creating ? '…' : t('constellations.create')}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-600/40 bg-slate-950/50 p-4 space-y-2">
          <p className="text-sm text-slate-300">{t('constellations.joinHint')}</p>
          <div className="flex gap-2">
            <input
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              placeholder={t('constellations.tokenPlaceholder')}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-600/50 text-sm"
            />
            <button
              type="button"
              onClick={handleJoin}
              className="px-4 py-2 rounded-xl bg-cyan-600/80 text-white text-sm font-medium"
            >
              {t('constellations.join')}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-600/40 bg-slate-950/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">{t('constellations.mine')}</p>
          {loading ? (
            <p className="text-sm text-slate-500 animate-pulse">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">{t('constellations.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.token}>
                  <Link
                    href={`/constellation/${c.token}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-700/40 hover:bg-slate-800/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {c.title || t('constellations.untitled')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {c.memberCount}/{c.maxMembers} · {t('constellations.expires')} {new Date(c.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-slate-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
