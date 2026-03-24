// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { dreamscapeApi } from '@/api/dreamscape'
import { aiApi } from '@/api/ai'
import { t } from '@/i18n'
import { getShareBaseUrl, buildSocialCardImage } from '@/utils/dreamscapeShare'
import { canUseNativeShare } from '@/utils/share-social'
import { ShareSocialButtons } from '@/components/ShareSocialButtons'
import { proxyImageUrl } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'
import { FlowerSVG } from '@/components/FlowerSVG'
import { ALL_CARDS, BACK_IMG } from '@/data/tarotCards'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function findCardByName(name) {
  if (!name) return null
  return ALL_CARDS.find(c => (c.name || '').toLowerCase() === (name || '').toLowerCase()) ?? null
}

/** Affiche un texte long avec paragraphes (\n\n) ou fallback : découpe par phrases. */
function FormattedSummary({ text, className = '', baseClass = 'text-sm text-slate-700 dark:text-slate-200 leading-[1.7] max-w-prose' }) {
  if (!text?.trim()) return null
  const pClass = `${baseClass} ${className}`.trim()
  const parts = text.split(/\n\n+/)
  if (parts.length > 1) {
    return (
      <div className="space-y-4">
        {parts.map((p, i) => (
          <p key={i} className={pClass}>{p.trim()}</p>
        ))}
      </div>
    )
  }
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const paragraphs = []
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(' ').trim())
  }
  if (paragraphs.length <= 1) {
    return <p className={pClass}>{text}</p>
  }
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className={pClass}>{p}</p>
      ))}
    </div>
  )
}

export default function DreamscapeHistoriquePage() {
  const router = useRouter()
  const [dreamscapeHistory, setDreamscapeHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [summaries, setSummaries] = useState({}) // id -> summary
  const [loadingSummary, setLoadingSummary] = useState({}) // id -> true
  const [shareLoadingId, setShareLoadingId] = useState(null)
  const [shareMenuId, setShareMenuId] = useState(null)
  const [shareMenuUrl, setShareMenuUrl] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    dreamscapeApi.my()
      .then((res) => setDreamscapeHistory(res?.items ?? []))
      .catch((e) => setError(e?.message || 'Impossible de charger l\'historique'))
      .finally(() => setLoading(false))
  }, [])

  const fetchSummary = useCallback(async (item) => {
    if (!item?.history?.length || summaries[item.id]) return
    setLoadingSummary((prev) => ({ ...prev, [item.id]: true }))
    try {
      const closing = item.history?.find(m => m.role === 'closing')
      const res = await aiApi.dreamscapeSummarize({
        history: item.history,
        slots: item.slots,
        petals: item.petals,
        path: closing?.path,
        actions: closing?.actions,
      })
      const s = res?.summary ?? ''
      setSummaries((prev) => ({ ...prev, [item.id]: s }))
    } catch {
      setSummaries((prev) => ({ ...prev, [item.id]: 'Résumé indisponible.' }))
    } finally {
      setLoadingSummary((prev) => ({ ...prev, [item.id]: false }))
    }
  }, [summaries])

  useEffect(() => {
    if (!expandedId) return
    const item = dreamscapeHistory.find((i) => i.id === expandedId)
    if (item?.history?.length) fetchSummary(item)
  }, [expandedId, dreamscapeHistory, fetchSummary])

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-20">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">Chargement de l'historique…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-20 px-4">
        <p className="text-amber-600 dark:text-amber-400 text-center">{error}</p>
        <Link href="/dreamscape" className="mt-4 px-5 py-2.5 bg-violet-500 text-white rounded-xl font-medium hover:opacity-90">
          Retour au Dreamscape
        </Link>
      </div>
    )
  }

  if (!dreamscapeHistory.length) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/dreamscape" className="text-sm text-violet-500 hover:text-violet-400 mb-4 inline-block">
            ← Retour à la Promenade Onirique
          </Link>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center">
            <span className="text-5xl mb-4 block">🌙</span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Aucune promenade sauvegardée
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Sauvegardez une promenade onirique depuis le Dreamscape pour la retrouver ici.
            </p>
            <Link
              href="/dreamscape"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-rose-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Commencer une promenade
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link href="/dreamscape" className="text-sm text-violet-500 hover:text-violet-400 order-2 sm:order-1 shrink-0">
            ← Retour au Dreamscape
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 order-1 sm:order-2 text-center sm:text-left">
            Historique des promenades oniriques
          </h1>
        </div>

        <ul className="space-y-3">
          <AnimatePresence mode="popLayout">
            {dreamscapeHistory.map((item) => {
              const isExpanded = expandedId === item.id
              const synthesis = item.poeticReflection || (item.history?.find(m => m.role === 'assistant')?.content)
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full text-left p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-2"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-200 italic line-clamp-2 leading-relaxed">
                      {(() => {
                        const s = (synthesis || '').replace(/\s+/g, ' ').trim()
                        return s ? `"${s.slice(0, 180)}${s.length > 180 ? '…' : ''}"` : 'Promenade sans réflexion enregistrée'
                      })()}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>🌙</span> {formatDate(item.savedAt)}
                      {item.slots?.filter(s => !s.faceDown).length > 0 && (
                        <> · {item.slots.filter(s => !s.faceDown).length} carte(s) révélée(s)</>
                      )}
                      {!item.history?.some(m => m.role === 'closing') && (
                        <span className="text-amber-500 font-medium">
                          · {t('dreamscapeHistorique.inProgress')}
                        </span>
                      )}
                    </p>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-200 dark:border-slate-700 overflow-hidden"
                      >
                        <div className="p-5 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-800/30">
                          {/* Snapshot visuel (cartes + fleur) */}
                          {item.snapshot && (
                            <div className="w-fit mx-auto">
                              <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">
                                {t('dreamscapeHistorique.snapshot')}
                              </p>
                              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-900">
                                <img
                                  src={item.snapshot}
                                  alt="Tirage Dreamscape"
                                  className="max-w-sm max-h-[360px] w-auto block object-contain"
                                />
                              </div>
                            </div>
                          )}
                          {/* Résumé de la discussion */}
                          {item.history?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Résumé de la discussion
                              </p>
                              {loadingSummary[item.id] ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500 italic">
                                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                  Génération du résumé…
                                </div>
                              ) : (
                                <FormattedSummary text={summaries[item.id] || '—'} />
                              )}
                            </div>
                          )}

                          {/* Synthèse poétique */}
                          {item.poeticReflection && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">
                                Ce qui en ressort
                              </p>
                              <FormattedSummary
                                text={item.poeticReflection}
                                baseClass="text-sm italic text-slate-700 dark:text-slate-200 leading-[1.7] max-w-prose"
                              />
                            </div>
                          )}

                          {/* Cartes */}
                          {item.slots?.length > 0 && (
                            <div className="w-fit">
                              <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">
                                Cartes
                              </p>
                              <div className="flex flex-wrap gap-3 justify-center">
                                {item.slots.map((slot, j) => {
                                  const card = findCardByName(slot.card)
                                  const img = slot.faceDown ? BACK_IMG : (card?.img || BACK_IMG)
                                  return (
                                    <div key={j} className="flex flex-col items-center gap-1 flex-shrink-0">
                                      <div
                                        className="w-14 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600"
                                        title={slot.faceDown ? 'Face cachée' : slot.card}
                                      >
                                        <img
                                          src={proxyImageUrl(img) ?? img ?? ''}
                                          alt={slot.card}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <span className="text-[10px] font-semibold text-violet-400/90 text-center leading-tight max-w-[56px]">
                                        {slot.position ?? '—'}
                                      </span>
                                      {!slot.faceDown && slot.card !== slot.position && (
                                        <span className="text-[9px] text-white/40 text-center leading-tight max-w-[56px] truncate" title={slot.card}>
                                          {slot.card}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Trajectoire et actions (clôture) */}
                          {(() => {
                            const closing = item.history?.find(m => m.role === 'closing')
                            if (!closing?.path?.length && !closing?.actions?.length) return null
                            return (
                              <div className="space-y-3">
                                {closing?.path?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">
                                      Trajectoire choisie
                                    </p>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                                      {closing.path.join(' → ')}
                                    </p>
                                  </div>
                                )}
                                {closing?.actions?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                                      Actions à œuvrer
                                    </p>
                                    <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1 list-disc list-inside">
                                      {closing.actions.map((a, i) => (
                                        <li key={i}>{a}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* Fleur */}
                          {item.petals && Object.keys(item.petals).some(k => item.petals[k] > 0) && (
                            <div>
                              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">
                                Fleur (intensités des pétales)
                              </p>
                              <div className="flex justify-center">
                                <FlowerSVG
                                  petals={item.petals}
                                  size={140}
                                  animate={false}
                                  showLabels
                                  showScores={false}
                                />
                              </div>
                            </div>
                          )}

                          <div className="pt-2 flex flex-wrap gap-2">
                            {!item.history?.some(m => m.role === 'closing') && (
                              <button
                                type="button"
                                onClick={() => router.push(`/dreamscape?resume=${item.id}`)}
                                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-medium hover:opacity-90 transition-opacity"
                              >
                                {t('dreamscapeHistorique.resumeBtn')}
                              </button>
                            )}
                            <div className="flex gap-2 flex-wrap relative">
                              <button
                                type="button"
                                onClick={async () => {
                                  setShareLoadingId(item.id)
                                  try {
                                    const res = await dreamscapeApi.share(item.id)
                                    const base = getShareBaseUrl()
                                    const fullUrl = `${base}${res.shareUrl || `/dreamscape/partage/${res.shareToken}`}`
                                    const sharePayload = {
                                      url: fullUrl,
                                      title: 'Promenade Onirique — Fleur d\'AmOurs',
                                      text: 'Découvrez ma promenade onirique',
                                    }
                                    if (canUseNativeShare()) {
                                      try {
                                        const files = []
                                        if (item.snapshot) {
                                          try {
                                            const socialImg = await buildSocialCardImage(item.snapshot)
                                            if (socialImg) {
                                              const imgRes = await fetch(socialImg)
                                              const blob = await imgRes.blob()
                                              files.push(new File([blob], `promenade-${item.id}.png`, { type: 'image/png' }))
                                            }
                                          } catch { /* ignore */ }
                                        }
                                        await navigator.share({
                                          ...sharePayload,
                                          ...(files.length ? { files } : {}),
                                        })
                                        toast(t('share.shareSuccess'), 'success')
                                      } catch (e) {
                                        if ((e as Error).name !== 'AbortError') {
                                          setShareMenuId(item.id)
                                          setShareMenuUrl(fullUrl)
                                        }
                                      }
                                    } else {
                                      setShareMenuId(item.id)
                                      setShareMenuUrl(fullUrl)
                                    }
                                  } catch (e) {
                                    toast(e?.message || 'Impossible de partager', 'error')
                                  } finally {
                                    setShareLoadingId(null)
                                  }
                                }}
                                disabled={shareLoadingId === item.id}
                                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-100 font-semibold hover:bg-violet-500/30 hover:border-violet-400/60 transition-colors disabled:opacity-50"
                              >
                                {shareLoadingId === item.id ? '…' : '📤 ' + t('common.share')}
                              </button>
                              {item.snapshot && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const socialImg = await buildSocialCardImage(item.snapshot)
                                      const a = document.createElement('a')
                                      a.href = socialImg || item.snapshot
                                      a.download = `promenade-onirique-${item.id}-reseaux-sociaux.png`
                                      a.click()
                                      toast(t('share.imageDownloaded'), 'success')
                                    } catch {
                                      const a = document.createElement('a')
                                      a.href = item.snapshot
                                      a.download = `promenade-onirique-${item.id}.png`
                                      a.click()
                                      toast(t('share.imageDownloaded'), 'success')
                                    }
                                  }}
                                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white/90 font-medium hover:bg-white/20 transition-colors"
                                >
                                  {t('dreamscapeHistorique.downloadSocial')}
                                </button>
                              )}
                              {shareMenuId === item.id && shareMenuUrl && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => { setShareMenuId(null); setShareMenuUrl(null) }} aria-hidden="true" />
                                  <div className="absolute left-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 min-w-[200px]">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('common.share')}</p>
                                    <ShareSocialButtons
                                      payload={{ url: shareMenuUrl, title: 'Promenade Onirique — Fleur d\'AmOurs', text: 'Découvrez ma promenade onirique' }}
                                      onCopyLink={() => { setShareMenuId(null); setShareMenuUrl(null) }}
                                      variant="labels"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}
