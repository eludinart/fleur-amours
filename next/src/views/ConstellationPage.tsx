// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { socialApi } from '@/api/social'
import { FleurSociale } from '@/components/FleurSociale'
import { PETAL_BY_ID } from '@/lib/petal-theme'
import { t } from '@/i18n'

function timeAgo(iso) {
  if (!iso) return ''
  const ts = new Date(String(iso).replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return ''
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  return new Date(ts).toLocaleDateString()
}

export default function ConstellationPage() {
  const pathname = usePathname()
  const segments = (pathname || '').replace(/^\/+/, '').split('/').filter(Boolean)
  const token = segments[0] === 'constellation' && segments[1] ? segments[1] : null
  const router = useRouter()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await socialApi.getConstellation(token)
      setDetail(data)
    } catch (err) {
      setError((err as Error)?.message || '')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const handleSend = async () => {
    if (!message.trim() || !token || !detail?.isMember) return
    setSending(true)
    try {
      await socialApi.postConstellationMessage(token, message.trim())
      setMessage('')
      await load()
    } catch (err) {
      setError((err as Error)?.message || '')
    } finally {
      setSending(false)
    }
  }

  const copyInvite = () => {
    if (!token || typeof window === 'undefined') return
    const url = `${window.location.origin}/jardin/constellation/${token}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }

  if (!token) return null

  if (loading && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <span className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400">
        <p>{error || t('constellations.notFound')}</p>
        <button type="button" onClick={() => router.push('/constellations')} className="mt-4 text-violet-300 text-sm">
          ← {t('constellations.back')}
        </button>
      </div>
    )
  }

  const petalDef = detail.petalId ? PETAL_BY_ID[detail.petalId] : null
  const groupScores = detail.groupScores ?? {}

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-[#050b1a] via-[#0a1630] to-[#070d22] text-slate-100">
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <button type="button" onClick={() => router.push('/constellations')} className="p-2 text-slate-400">←</button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-violet-100 truncate">
            {detail.title || t('constellations.untitled')}
          </h1>
          <p className="text-[10px] text-slate-500">
            {detail.memberCount}/{detail.maxMembers} · {t('constellations.expires')} {new Date(detail.expiresAt).toLocaleDateString()}
          </p>
        </div>
        {detail.isMember && (
          <button type="button" onClick={copyInvite} className="text-[10px] px-2 py-1 rounded-lg border border-violet-500/40 text-violet-200">
            {t('constellations.copyInvite')}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-4">
        {petalDef && (
          <p className="text-xs" style={{ color: petalDef.color }}>
            {t('constellations.petalFocus', { petal: petalDef.name })}
          </p>
        )}

        <section className="rounded-2xl border border-slate-600/40 bg-slate-950/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">{t('constellations.groupFlower')}</p>
          <div className="flex justify-center mb-3">
            <FleurSociale scores={groupScores} size={80} variant="portrait" pseudo="" />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {(detail.members ?? []).map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => router.push(`/lisiere/${m.userId}`)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-xs"
              >
                <span>{m.avatarEmoji}</span>
                <span className="truncate max-w-[6rem]">{m.pseudo}</span>
              </button>
            ))}
          </div>
          {!detail.isMember && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await socialApi.joinConstellation(token)
                  await load()
                } catch (err) {
                  setError((err as Error)?.message || '')
                }
              }}
              className="mt-4 w-full py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
            >
              {t('constellations.joinThis')}
            </button>
          )}
        </section>

        {detail.isMember && (
          <section className="rounded-2xl border border-slate-600/40 bg-slate-950/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{t('constellations.chat')}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {(detail.messages ?? []).length === 0 ? (
                <p className="text-xs text-slate-500">{t('constellations.chatEmpty')}</p>
              ) : (
                detail.messages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <span className="text-violet-300 font-medium">{msg.senderPseudo}</span>
                    <span className="text-slate-500 ml-1">{timeAgo(msg.createdAt)}</span>
                    <p className="text-slate-300 mt-0.5">{msg.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('constellations.messagePlaceholder')}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-600/50 text-sm"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-600/80 text-white text-sm disabled:opacity-50"
              >
                →
              </button>
            </div>
          </section>
        )}

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  )
}
