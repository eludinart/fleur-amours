// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { PETAL_DEFS } from '@/components/FlowerSVG'

const PETAL_COLORS: Record<string, string> = {
  agape: '#f43f5e',
  philautia: '#f59e0b',
  mania: '#ef4444',
  storge: '#0d9488',
  pragma: '#6366f1',
  philia: '#10b981',
  ludus: '#0ea5e9',
  eros: '#8b5cf6',
}

const PETAL_LABELS = Object.fromEntries(PETAL_DEFS.map((p) => [p.id, p.name]))

export function EvolutionChart({ timeline = [], className = '' }) {
  const [selectedPetals, setSelectedPetals] = useState(new Set(['agape', 'philia', 'pragma']))

  const chartData = useMemo(() => {
    const reversed = [...timeline].reverse()
    return reversed.map((s) => {
      const d = new Date(s.date)
      const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      return { date: s.date, label, ...(s.petals || {}) }
    })
  }, [timeline])

  function togglePetal(id: string) {
    setSelectedPetals((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (next.size === 0) next.add(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!timeline.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 ${className}`}
      >
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Évolution des pétales</h3>
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <span className="text-4xl mb-2">📈</span>
          <p className="text-sm">Complétez des sessions pour voir l&apos;évolution</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white/70 to-slate-50/50 dark:from-slate-900/70 dark:to-slate-950/50 backdrop-blur-sm p-6 ${className}`}
    >
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Évolution des pétales</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Filtrez par pétale pour voir l&apos;évolution dans le temps</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PETAL_DEFS.map((p) => (
          <button
            key={p.id}
            onClick={() => togglePetal(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedPetals.has(p.id) ? 'ring-1 ring-offset-1 dark:ring-offset-slate-900' : 'opacity-40 hover:opacity-70'}`}
            style={
              selectedPetals.has(p.id)
                ? { backgroundColor: `${p.color}20`, color: p.color, ringColor: p.color }
                : {}
            }
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="h-64 min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#94a3b8" strokeOpacity={0.5} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#94a3b8" strokeOpacity={0.5} tickFormatter={(v) => Math.round(v * 100) + '%'} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value) => [Math.round((value ?? 0) * 100) + '%', '']}
              labelFormatter={(label) => label}
            />
            <Legend />
            {[...selectedPetals].map((pId) => (
              <Line key={pId} type="monotone" dataKey={pId} name={PETAL_LABELS[pId] || pId} stroke={PETAL_COLORS[pId] || '#94a3b8'} strokeWidth={2} dot={{ r: 3, fill: PETAL_COLORS[pId] }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
