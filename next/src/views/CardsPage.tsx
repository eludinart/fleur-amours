// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { cardsApi } from '@/api/cards'
import { cardImageUrl } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'

export default function CardsPage() {
  const { currentCard, setCurrentCard, setCards } = useStore()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cardsApi.list().then((d) => setCards(d.cards || [])).catch(() => toast('Erreur chargement cartes', 'error'))
  }, [setCards])

  useEffect(() => {
    if (currentCard) {
      setForm({
        name: currentCard.name || '',
        slug: currentCard.slug || '',
        tags: (currentCard.tags || []).join(', '),
        sections: JSON.stringify(currentCard.sections || [], null, 2),
        info: JSON.stringify(currentCard.info || {}, null, 2),
      })
    }
  }, [currentCard])

  async function save() {
    if (!currentCard || !form) return
    let sections, info
    try {
      sections = JSON.parse(form.sections)
      info = JSON.parse(form.info)
    } catch {
      toast('JSON invalide dans sections ou info', 'error')
      return
    }
    const updated = {
      ...currentCard,
      name: form.name,
      slug: form.slug,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      sections,
      info,
    }
    setSaving(true)
    try {
      await cardsApi.update(form.slug || currentCard.slug, updated)
      setCurrentCard(updated)
      const d = await cardsApi.list()
      setCards(d.cards || [])
      toast('Carte enregistrée', 'success')
    } catch (e) {
      toast('Erreur: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <span className="text-5xl">🃏</span>
        <p className="text-lg">Sélectionnez une carte dans la barre latérale</p>
      </div>
    )
  }

  const imgUrl = cardImageUrl(currentCard.meta?.image)

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">{currentCard.name || currentCard.slug}</h2>

      {imgUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={imgUrl}
            alt={currentCard.name || currentCard.slug}
            className="max-h-72 rounded-2xl shadow-lg object-contain"
          />
        </div>
      )}

      {form && (
        <div className="space-y-4">
          <Field label="Nom">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputCls}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </Field>
          <Field label="Tags (séparés par des virgules)">
            <input
              className={inputCls}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          <Field label="Sections (JSON)">
            <textarea
              rows={6}
              className={`${inputCls} font-mono text-sm`}
              value={form.sections}
              onChange={(e) => setForm({ ...form, sections: e.target.value })}
            />
          </Field>
          <Field label="Info (JSON)">
            <textarea
              rows={6}
              className={`${inputCls} font-mono text-sm`}
              value={form.info}
              onChange={(e) => setForm({ ...form, info: e.target.value })}
            />
          </Field>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/40 text-sm'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  )
}
