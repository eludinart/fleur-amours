// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { TemperatureIndicator } from './TemperatureIndicator'
import { ALL_CARDS, FOUR_DOORS } from '@/data/tarotCards'
import { t } from '@/i18n'

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function findCardBySlug(slug) {
  if (!slug) return null
  const s = slug.toLowerCase().replace(/-/g, ' ')
  return ALL_CARDS.find((c) => slugify(c.name) === slug || c.name.toLowerCase().replace(/\s+/g, '-') === slug) || null
}

/**
 * Interface de chat P2P (La Clairière) — messages + input texte + sélecteur d’arcanes.
 */
export function DialogueStream({ channelId, otherPseudo, otherIsOnline = false }) {
  const { user } = useAuth()
  const meId = user?.id ? Number(user.id) : null
  const { messagesByChannel, temperatureByChannel, loadChannelMessages, sendMessage, markChannelRead } = useSocialStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [pendingMessages, setPendingMessages] = useState([])
  const listRef = useRef(null)

  const messages = messagesByChannel[String(channelId)] || []
  const visibleMessages = [...messages, ...pendingMessages]
  const temperature = temperatureByChannel[String(channelId)] || 'calm'

  useEffect(() => {
    if (!channelId) return
    let inFlight = false
    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        await loadChannelMessages(channelId)
        markChannelRead?.(channelId) // marquer comme lu à chaque rafraîchissement (canal consulté)
      } finally {
        inFlight = false
      }
    }

    refresh() // chargement immédiat
    const timer = setInterval(refresh, 15000) // polling toutes les 15 s pour limiter la charge DB

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelId, loadChannelMessages, markChannelRead])

  // Se placer sur le dernier message au changement de canal
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight
    }
    // juste après le rendu
    requestAnimationFrame(scrollToBottom)
  }, [channelId])

  // Et quand de nouveaux messages arrivent
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      // ne remonte en bas que si on est déjà proche du bas (pour ne pas casser la lecture d'un ancien message)
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      if (nearBottom) el.scrollTop = el.scrollHeight
    })
  }, [visibleMessages.length])

  const handleSendText = async () => {
    const text = input.trim()
    if (!text || sending) return
    const tempId = `tmp-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic = {
      id: tempId,
      senderId: meId,
      body: text,
      cardSlug: null,
      temperature: temperature || 'calm',
      createdAt: new Date().toISOString(),
    }
    setPendingMessages((prev) => [...prev, optimistic])
    setInput('')
    setSending(true)
    try {
      await sendMessage(channelId, { body: text })
    } finally {
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId))
      setSending(false)
    }
  }

  const handleSendCard = async (card) => {
    if (!card || sending) return
    const slug = slugify(card.name)
    const tempId = `tmp-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic = {
      id: tempId,
      senderId: meId,
      body: null,
      cardSlug: slug,
      temperature: temperature || 'calm',
      createdAt: new Date().toISOString(),
    }
    setPendingMessages((prev) => [...prev, optimistic])
    setSending(true)
    try {
      await sendMessage(channelId, { cardSlug: slug })
      setShowCardPicker(false)
    } finally {
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId))
      setSending(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-lime-50/80 to-emerald-50/60 dark:from-slate-900 dark:to-slate-900">
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-emerald-200/60 dark:border-slate-700">
        <TemperatureIndicator temperature={temperature} className="shrink-0" />
        <div className="min-w-0 flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${otherIsOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            {otherPseudo || (t('social.clairiere') ?? 'Clairière')}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            {otherIsOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>
      </header>

      {/* Zone scrollable des messages, avec padding bas pour ne pas passer sous l'input */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 pb-32 space-y-3">
        {visibleMessages.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
            {t('social.premierMessage') ?? 'Envoie un message ou une carte pour ouvrir l’échange.'}
          </p>
        )}
        {visibleMessages.map((msg, index) => {
          const isMe = msg.senderId === meId
          const card = msg.cardSlug ? findCardBySlug(msg.cardSlug) : null
          const baseId = String(msg.id ?? msg.messageId ?? `${msg.senderId || 'u'}-${msg.createdAt || 't'}`)
          const itemKey = `${baseId}-${index}`
          return (
            <div
              key={itemKey}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? 'bg-violet-500/20 dark:bg-violet-500/25 text-violet-900 dark:text-violet-100'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-600'
                }`}
              >
                {card ? (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-600 bg-black/5 dark:bg-black/20">
                      <img
                        src={card.img}
                        alt={card.name}
                        loading="lazy"
                        className="block w-full max-w-[220px] h-auto object-cover"
                      />
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.name}</div>
                    {msg.body && <div className="text-sm whitespace-pre-wrap">{msg.body}</div>}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer en bas de la colonne de chat (mais qui défile avec la page entière) */}
      <div className="shrink-0 p-3 border-t border-emerald-200/60 dark:border-slate-700 bg-white/80 dark:bg-slate-900/90 backdrop-blur">
        {showCardPicker && (
          <div className="mb-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 max-h-72 overflow-y-auto space-y-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t('social.choisirCarte') ?? 'Choisir une carte'}
            </p>
            {FOUR_DOORS.map((door) => (
              <div key={door.key} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {door.subtitle} - {door.group.length} cartes
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {door.group.map((card) => (
                    <button
                      key={`${door.key}-${card.name}`}
                      type="button"
                      onClick={() => handleSendCard(card)}
                      disabled={sending}
                      className="group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-violet-300 dark:hover:border-violet-500 transition-colors"
                      title={card.name}
                    >
                      <img
                        src={card.img}
                        alt={card.name}
                        loading="lazy"
                        className="w-full aspect-[3/4] object-cover"
                      />
                      <span className="block px-1 py-1 text-[10px] leading-tight text-slate-700 dark:text-slate-200 truncate">
                        {card.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <details className="pt-1">
              <summary className="cursor-pointer text-[11px] text-slate-500 dark:text-slate-400">
                Vue liste complete ({ALL_CARDS.length} cartes)
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_CARDS.map((card) => (
                  <button
                    key={`all-${card.name}`}
                    type="button"
                    onClick={() => handleSendCard(card)}
                    disabled={sending}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-violet-100 dark:hover:bg-violet-900/40"
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            </details>
            <button
              type="button"
              onClick={() => setShowCardPicker(false)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCardPicker(!showCardPicker)}
            className="shrink-0 p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30"
            title={t('social.envoyerCarte') ?? 'Envoyer une carte'}
          >
            🃏
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendText()}
            placeholder={t('social.ecrireMessage') ?? 'Écrire…'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          <button
            type="button"
            onClick={handleSendText}
            disabled={!input.trim() || sending}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 disabled:opacity-50"
          >
            {sending ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
