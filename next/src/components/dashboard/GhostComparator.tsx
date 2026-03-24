// @ts-nocheck
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlowerSVG } from '@/components/FlowerSVG'

function formatDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function GhostComparator({ timeline = [], className = '' }) {
  const [selectedArchive, setSelectedArchive] = useState<{ id: string; date: string; petals?: Record<string, number> } | null>(null)
  const hasData = timeline.length > 0
  const currentPetals = timeline[0]?.petals ?? {}
  const archivePetals = selectedArchive?.petals ?? {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 min-h-[320px] flex flex-col ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Comparaison</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Maintenant vs archive — choisissez une date</p>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-400 dark:text-slate-500">
          <span className="text-4xl mb-2">👻</span>
          <p className="text-sm">Complétez des sessions pour comparer</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedArchive(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedArchive ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'}`}
            >
              Actuel uniquement
            </button>
            {timeline.slice(1, 8).map((s) => (
              <button
                key={`${s.id}-${s.date}`}
                onClick={() => setSelectedArchive(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedArchive?.id === s.id && selectedArchive?.date === s.date ? 'ring-2 ring-slate-400 dark:ring-slate-500 bg-slate-100 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700'
                }`}
              >
                {formatDate(s.date)}
              </button>
            ))}
          </div>
          <div className="relative flex justify-center items-center flex-1 py-4 min-h-[260px]">
            <div className="relative w-[220px] h-[220px] flex items-center justify-center">
              {selectedArchive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 0.92 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <FlowerSVG petals={archivePetals} variant="silhouette" size={200} animate showLabels={false} showScores={false} />
                </motion.div>
              )}
              <motion.div layout className="relative z-10" animate={{ scale: selectedArchive ? 0.92 : 1 }} transition={{ duration: 0.3 }}>
                <FlowerSVG petals={currentPetals} size={200} animate showLabels showScores={false} />
              </motion.div>
            </div>
          </div>
          {selectedArchive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-6 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Maintenant
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border-2 border-slate-400" />
                {formatDate(selectedArchive.date)}
              </span>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
