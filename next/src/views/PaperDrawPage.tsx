'use client'

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ChangeEvent,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { VoiceTextInput } from '@/components/VoiceTextInput'
import { PaperDrawLayoutGuide } from '@/components/paper-draw/PaperDrawLayoutGuide'
import {
  PAPER_DRAW_LAYOUTS,
  getPaperDrawLayout,
  type PaperDrawLayoutId,
} from '@/lib/paper-draw-layouts'
import { ALL_CARDS } from '@/data/tarotCards'
import { paperDrawApi } from '@/api/paperDraw'
import { toast } from '@/hooks/useToast'

type Step =
  | 'layout'
  | 'guide'
  | 'photo'
  | 'validate'
  | 'interpret'
  | 'dialogue'
  | 'done'

type CardEntry = {
  id: string
  name: string
  slot?: string
  role: 'core' | 'extra'
  duplicate?: boolean
  confidence?: number
}

function resizeImageToDataUrl(file: File, maxSize = 1200, maxBytes = 900000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width
      let h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h * maxSize) / w)
          w = maxSize
        } else {
          w = Math.round((w * maxSize) / h)
          h = maxSize
        }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      while (dataUrl.length > maxBytes && quality > 0.25) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(dataUrl)
    }
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = URL.createObjectURL(file)
  })
}

function newCardId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function PaperDrawPage() {
  const locale = useStore((s) => s.locale)
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'new'
  const [pageTab, setPageTab] = useState<'new' | 'history'>(initialTab)
  const [historyItems, setHistoryItems] = useState<Record<string, unknown>[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(searchParams.get('reading'))

  const [step, setStep] = useState<Step>('layout')
  const [layoutId, setLayoutId] = useState<PaperDrawLayoutId | null>(null)
  const [intention, setIntention] = useState('')
  const [context, setContext] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [cards, setCards] = useState<CardEntry[]>([])
  const [recognizing, setRecognizing] = useState(false)
  const [interpretation, setInterpretation] = useState('')
  const [interpretLoading, setInterpretLoading] = useState(false)
  const [dialogueHistory, setDialogueHistory] = useState<Array<{ role: string; content: string }>>([])
  const [dialogueInput, setDialogueInput] = useState('')
  const [dialogueLoading, setDialogueLoading] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [addCardName, setAddCardName] = useState('')
  const [addAsExtra, setAddAsExtra] = useState(false)

  const layout = useMemo(
    () => (layoutId ? getPaperDrawLayout(layoutId) : undefined),
    [layoutId]
  )

  const cardsForApi = useMemo(
    () =>
      cards.map((c) => ({
        name: c.name,
        slot: c.slot,
        role: c.role,
        duplicate: c.duplicate,
      })),
    [cards]
  )

  const loadHistory = useCallback(() => {
    setHistoryLoading(true)
    paperDrawApi
      .my()
      .then((res: unknown) => {
        const items = (res as { items?: Record<string, unknown>[] })?.items ?? []
        setHistoryItems(items)
      })
      .catch(() => setHistoryItems([]))
      .finally(() => setHistoryLoading(false))
  }, [])

  useEffect(() => {
    if (pageTab === 'history') loadHistory()
  }, [pageTab, loadHistory])

  useEffect(() => {
    const rid = searchParams.get('reading')
    if (rid) {
      setDetailId(rid)
      setPageTab('history')
    }
  }, [searchParams])

  const detailItem = useMemo(
    () => historyItems.find((h) => String(h.id) === String(detailId)) ?? null,
    [historyItems, detailId]
  )

  useEffect(() => {
    if (pageTab === 'history' && detailId && !detailItem && !historyLoading) {
      loadHistory()
    }
  }, [pageTab, detailId, detailItem, historyLoading, loadHistory])

  const runRecognize = useCallback(
    async (imageDataUrl: string) => {
      if (!layoutId) return
      setRecognizing(true)
      try {
        const res = (await paperDrawApi.recognize({
          image: imageDataUrl,
          layout_template: layoutId,
        })) as { cards?: Array<{ name: string; confidence?: number }>; message?: string }
        const detected = res?.cards ?? []
        if (detected.length) {
          const slotIds = layout?.slots.map((s) => s.id) ?? []
          const slotCounts: Record<string, number> = {}
          setCards(
            detected.map((d, i) => {
              const slot = slotIds[i]
              let duplicate = false
              if (slot) {
                slotCounts[slot] = (slotCounts[slot] ?? 0) + 1
                duplicate = slotCounts[slot] > 1
              }
              return {
                id: newCardId(),
                name: d.name,
                slot,
                role: 'core' as const,
                duplicate,
                confidence: d.confidence,
              }
            })
          )
        } else if (res?.message) {
          toast(res.message, 'info')
        }
      } catch {
        toast(t('paperDraw.recognizeError'), 'error')
      } finally {
        setRecognizing(false)
        setStep('validate')
      }
    },
    [layoutId, layout]
  )

  const onPhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      setPhoto(dataUrl)
      await runRecognize(dataUrl)
    } catch {
      toast(t('paperDraw.photoError'), 'error')
    }
    e.target.value = ''
  }

  const addCard = () => {
    const name = addCardName.trim()
    if (!name) return
    const slotIds = layout?.slots.map((s) => s.id) ?? []
    const nextSlot = addAsExtra
      ? undefined
      : slotIds.find((id) => !cards.some((c) => c.slot === id && c.role === 'core'))
    setCards((prev) => [
      ...prev,
      {
        id: newCardId(),
        name,
        slot: nextSlot,
        role: addAsExtra ? 'extra' : 'core',
      },
    ])
    setAddCardName('')
  }

  const removeCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id))

  const updateCardSlot = (id: string, slot: string, asExtra: boolean) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const duplicate = !asExtra && prev.some((x) => x.id !== id && x.slot === slot && x.role === 'core')
        return {
          ...c,
          slot: asExtra ? undefined : slot || undefined,
          role: asExtra ? 'extra' : 'core',
          duplicate,
        }
      })
    )
  }

  const runInterpret = async () => {
    if (!layoutId || !cards.length) return
    setInterpretLoading(true)
    setStep('interpret')
    try {
      const res = (await paperDrawApi.interpret({
        layout_template: layoutId,
        intention,
        context,
        cards: cardsForApi,
        locale,
      })) as { interpretation?: string }
      setInterpretation(res?.interpretation ?? '')
      setStep('dialogue')
      void saveDraw({ interpretation: res?.interpretation ?? '' })
    } catch {
      toast(t('paperDraw.interpretError'), 'error')
    } finally {
      setInterpretLoading(false)
    }
  }

  const saveDraw = async (extra: Record<string, unknown> = {}) => {
    if (!layoutId) return null
    const payload = {
      intention,
      context,
      photo_thumb: photo ? photo.slice(0, 120000) : null,
      cards: cardsForApi,
      interpretation,
      dialogue: dialogueHistory,
      ...extra,
    }
    try {
      if (savedId) {
        await paperDrawApi.update(savedId, payload)
        return savedId
      }
      const saved = (await paperDrawApi.save({
        layout_template: layoutId,
        payload,
      })) as { id?: string | number }
      const id = String(saved?.id ?? '')
      setSavedId(id)
      return id
    } catch {
      return null
    }
  }

  const sendDialogue = async () => {
    const text = dialogueInput.trim()
    if (!text || !layoutId) return
    setDialogueLoading(true)
    const newHistory = [...dialogueHistory, { role: 'user', content: text }]
    setDialogueHistory(newHistory)
    setDialogueInput('')
    try {
      const res = (await paperDrawApi.dialogue({
        layout_template: layoutId,
        intention,
        context,
        cards: cardsForApi,
        history: dialogueHistory,
        transcript: text,
        locale,
      })) as { response_a?: string; question?: string }
      const assistantText = [res?.response_a, res?.question].filter(Boolean).join('\n\n')
      setDialogueHistory([...newHistory, { role: 'assistant', content: assistantText }])
      void saveDraw({ dialogue: [...newHistory, { role: 'assistant', content: assistantText }] })
    } catch {
      toast(t('paperDraw.dialogueError'), 'error')
    } finally {
      setDialogueLoading(false)
    }
  }

  const finishDraw = async () => {
    await saveDraw()
    loadHistory()
    setStep('done')
    toast(t('paperDraw.saveSuccess'), 'success')
  }

  const resetFlow = () => {
    setStep('layout')
    setLayoutId(null)
    setIntention('')
    setContext('')
    setPhoto(null)
    setCards([])
    setInterpretation('')
    setDialogueHistory([])
    setSavedId(null)
  }

  const slotOptions = layout?.slots ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
      <Breadcrumbs />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {t('paperDraw.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('paperDraw.subtitle')}</p>
      </header>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          type="button"
          onClick={() => {
            setPageTab('new')
            setDetailId(null)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            pageTab === 'new'
              ? 'bg-amber-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('paperDraw.tabNew')}
        </button>
        <button
          type="button"
          onClick={() => {
            setPageTab('history')
            setDetailId(null)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            pageTab === 'history'
              ? 'bg-amber-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('paperDraw.tabHistory')}
        </button>
      </div>

      {pageTab === 'history' && (
        <section className="space-y-4" id="section-paper-history">
          {historyLoading ? (
            <p className="text-sm text-slate-500">…</p>
          ) : detailItem ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-xs text-amber-600 hover:underline"
              >
                ← {t('paperDraw.tabHistory')}
              </button>
              <p className="text-xs text-slate-500">
                {String(detailItem.createdAt ?? detailItem.created_at ?? '')}
                {' · '}
                {String(detailItem.layout_template ?? '')}
              </p>
              {detailItem.intention ? (
                <p className="text-sm">
                  <span className="font-medium">{t('paperDraw.intentionLabel')} : </span>
                  {String(detailItem.intention)}
                </p>
              ) : null}
              {detailItem.context ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">{String(detailItem.context)}</p>
              ) : null}
              {Array.isArray(detailItem.cards) && (detailItem.cards as unknown[]).length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-1">
                    {t('paperDraw.historyCards')}
                  </p>
                  <p className="text-sm">
                    {(detailItem.cards as Array<{ name?: string }>)
                      .map((c) => c.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ) : null}
              {detailItem.interpretation ? (
                <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 p-3 text-sm whitespace-pre-wrap">
                  {String(detailItem.interpretation)}
                </div>
              ) : null}
              {Array.isArray(detailItem.dialogue) && (detailItem.dialogue as unknown[]).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {t('paperDraw.historyDialogue')}
                  </p>
                  {(detailItem.dialogue as Array<{ role: string; content: string }>).map((m, i) => (
                    <p
                      key={i}
                      className={`text-sm rounded-lg px-3 py-2 ${
                        m.role === 'user'
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'bg-violet-50 dark:bg-violet-950/40'
                      }`}
                    >
                      {m.content}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">{t('paperDraw.historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {historyItems.map((item) => {
                const cards = (item.cards as Array<{ name?: string }> | undefined) ?? []
                const label = cards
                  .map((c) => c.name)
                  .filter(Boolean)
                  .slice(0, 4)
                  .join(' · ')
                return (
                  <li key={String(item.id)}>
                    <button
                      type="button"
                      onClick={() => setDetailId(String(item.id))}
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-amber-400 transition-colors"
                    >
                      <p className="text-xs text-slate-500">
                        {String(item.createdAt ?? item.created_at ?? '')}
                        {' · '}
                        {String(item.layout_template ?? '')}
                      </p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">
                        {String(item.intention || label || t('paperDraw.title'))}
                      </p>
                      {label ? <p className="text-xs text-slate-500 mt-0.5">{label}</p> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {pageTab === 'new' && step === 'layout' && (
        <section className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('paperDraw.chooseLayout')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAPER_DRAW_LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLayoutId(l.id)
                  setStep('guide')
                }}
                className="text-left rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
              >
                <span className="text-2xl">{l.icon}</span>
                <p className="font-semibold text-slate-800 dark:text-slate-100 mt-2">
                  {t(l.labelKey)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t(l.descKey)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {pageTab === 'new' && step === 'guide' && layout && (
        <section className="space-y-6">
          <PaperDrawLayoutGuide layout={layout} />
          <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('paperDraw.intentionLabel')}
            </label>
            <VoiceTextInput
              value={intention}
              onChange={setIntention}
              placeholder={t('paperDraw.intentionPlaceholder')}
              rows={2}
            />
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('paperDraw.contextLabel')}
            </label>
            <VoiceTextInput
              value={context}
              onChange={setContext}
              placeholder={t('paperDraw.contextPlaceholder')}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('layout')}
              className="px-4 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600"
            >
              {t('paperDraw.back')}
            </button>
            <button
              type="button"
              onClick={() => setStep('photo')}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600"
            >
              {t('paperDraw.continueToPhoto')}
            </button>
          </div>
        </section>
      )}

      {pageTab === 'new' && step === 'photo' && (
        <section className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('paperDraw.photoHint')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoSelected}
          />
          {photo && (
            <img
              src={photo}
              alt=""
              className="w-full max-h-64 object-contain rounded-xl border border-slate-200 dark:border-slate-700"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('guide')}
              className="px-4 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600"
            >
              {t('paperDraw.back')}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white"
            >
              {photo ? t('paperDraw.retakePhoto') : t('paperDraw.takePhoto')}
            </button>
            {photo && (
              <button
                type="button"
                disabled={recognizing}
                onClick={() => runRecognize(photo)}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-white disabled:opacity-60"
              >
                {recognizing ? '…' : t('paperDraw.analyzePhoto')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCards([])
                setStep('validate')
              }}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 underline"
            >
              {t('paperDraw.skipToManual')}
            </button>
          </div>
        </section>
      )}

      {pageTab === 'new' && (step === 'validate' || recognizing) && (
        <section className="space-y-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('paperDraw.validateTitle')}
          </p>
          <p className="text-xs text-slate-500">{t('paperDraw.validateHint')}</p>

          <ul className="space-y-2">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100 flex-1 min-w-[8rem]">
                  {c.name}
                  {c.duplicate && (
                    <span className="ml-1 text-[10px] text-amber-600">×2</span>
                  )}
                </span>
                {slotOptions.length > 0 && (
                  <select
                    value={c.role === 'extra' ? '__extra__' : c.slot ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '__extra__') updateCardSlot(c.id, '', true)
                      else updateCardSlot(c.id, v, false)
                    }}
                    className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1"
                  >
                    <option value="">{t('paperDraw.unassigned')}</option>
                    {slotOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                    <option value="__extra__">{t('paperDraw.extraCard')}</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => removeCard(c.id)}
                  className="text-red-500 text-xs px-2"
                  aria-label={t('paperDraw.removeCard')}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 items-end">
            <select
              value={addCardName}
              onChange={(e) => setAddCardName(e.target.value)}
              className="flex-1 min-w-[10rem] text-sm rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-900"
            >
              <option value="">{t('paperDraw.addCard')}</option>
              {ALL_CARDS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {slotOptions.length > 0 && (
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={addAsExtra}
                  onChange={(e) => setAddAsExtra(e.target.checked)}
                />
                {t('paperDraw.extraCard')}
              </label>
            )}
            <button
              type="button"
              onClick={addCard}
              className="px-4 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-800"
            >
              +
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep('photo')}
              className="px-4 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600"
            >
              {t('paperDraw.back')}
            </button>
            <button
              type="button"
              disabled={!cards.length || interpretLoading}
              onClick={runInterpret}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white disabled:opacity-50"
            >
              {interpretLoading ? '…' : t('paperDraw.getInterpretation')}
            </button>
          </div>
        </section>
      )}

      {pageTab === 'new' && (step === 'interpret' || step === 'dialogue') && (
        <section className="space-y-4">
          {interpretLoading ? (
            <p className="text-sm text-slate-500">{t('paperDraw.interpretLoading')}</p>
          ) : (
            interpretation && (
              <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                <h2 className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">
                  {t('paperDraw.interpretationTitle')}
                </h2>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {interpretation}
                </p>
              </div>
            )
          )}

          {step === 'dialogue' && !interpretLoading && (
            <>
              <div className="space-y-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                {dialogueHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm rounded-lg px-3 py-2 ${
                      m.role === 'user'
                        ? 'bg-slate-100 dark:bg-slate-800 ml-4'
                        : 'bg-violet-50 dark:bg-violet-950/40 mr-4'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
              </div>
              <VoiceTextInput
                value={dialogueInput}
                onChange={setDialogueInput}
                placeholder={t('paperDraw.dialoguePlaceholder')}
                rows={2}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={dialogueLoading || !dialogueInput.trim()}
                  onClick={sendDialogue}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-50"
                >
                  {dialogueLoading ? '…' : t('paperDraw.send')}
                </button>
                <button
                  type="button"
                  onClick={finishDraw}
                  className="px-4 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600"
                >
                  {t('paperDraw.finish')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {pageTab === 'new' && step === 'done' && (
        <section className="text-center space-y-4 py-8">
          <p className="text-4xl">🌸</p>
          <p className="text-slate-700 dark:text-slate-300">{t('paperDraw.doneMessage')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={resetFlow}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white"
            >
              {t('paperDraw.newDraw')}
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600"
            >
              {t('nav.home')}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
