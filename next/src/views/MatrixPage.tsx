'use client'

import { useState } from 'react'
import { useStore } from '@/store/useStore'

type Card = { slug?: string; name?: string; sections?: unknown[]; info?: Record<string, unknown>; [k: string]: unknown }

export default function MatrixPage() {
  const cards = useStore((s) => s.cards) as Card[]
  const [key, setKey] = useState('')
  const [built, setBuilt] = useState(false)

  function build() { setBuilt(true) }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Matrice des paramètres</h2>
      <div className="flex gap-3 items-end">
        <label className="text-sm">
          Champ numérique
          <input
            className="ml-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ex: score"
          />
        </label>
        <button
          onClick={build}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Construire
        </button>
      </div>

      {built && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {['slug', 'nom', 'sections', key || 'valeur'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const secs = Array.isArray(c.sections) ? c.sections.length
                  : (c.info?.sections ? (c.info.sections as unknown[]).length : 0)
                const raw = key ? (c[key] !== undefined ? c[key] : c.info?.[key] ?? '') : ''
                const val = key ? (isNaN(Number(raw)) ? raw : Number(raw)) : ''
                return (
                  <tr key={c.slug ?? ''} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2 font-mono text-xs">{c.slug}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-center">{secs}</td>
                    <td className="px-4 py-2">{String(val)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
