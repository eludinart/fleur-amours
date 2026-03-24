'use client'

import { useState, useMemo } from 'react'
import { FlowerSVG, scoresToPetals } from './FlowerSVG'

type SessionSnapshot = {
  id?: string
  petals?: Record<string, number>
  created_at?: string
  first_words?: string
}

type CrystalTimelineProps = {
  currentSession: SessionSnapshot | null
  snapshots?: SessionSnapshot[]
  size?: number
}

export function CrystalTimeline({
  currentSession,
  snapshots = [],
  size = 280,
}: CrystalTimelineProps) {
  const others = useMemo(() => {
    if (!currentSession?.id) return snapshots
    return snapshots.filter((s) => s.id !== currentSession?.id)
  }, [currentSession?.id, snapshots])

  const defaultRefIndex = useMemo(() => {
    if (others.length === 0) return 0
    const currDate = currentSession?.created_at
      ? new Date(currentSession.created_at).getTime()
      : 0
    const idx = others.findIndex(
      (s) => new Date(s.created_at || 0).getTime() < currDate
    )
    return idx >= 0 ? idx : 0
  }, [currentSession?.created_at, others])

  const [referenceIndex, setReferenceIndex] = useState(defaultRefIndex)

  const currentPetals = useMemo(() => {
    const p = currentSession?.petals
    if (!p || typeof p !== 'object') return {}
    return scoresToPetals(p)
  }, [currentSession?.petals])

  const referenceSnapshot = others[referenceIndex]
  const referencePetals = useMemo(() => {
    const p = referenceSnapshot?.petals
    if (!p || typeof p !== 'object') return {}
    return scoresToPetals(p)
  }, [referenceSnapshot?.petals])

  const formatDate = (iso: string | undefined) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  }

  if (others.length === 0 || !currentSession?.petals) return null

  return (
    <div className="CrystalTimeline rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">
          ✦ Timeline de Cristal
        </p>
        <span className="text-[9px] text-slate-500">Comparaison morphologique</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-[9px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Fleur actuelle
        </span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-slate-400 bg-slate-300/50" />
          Fleur de référence
        </span>
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ minHeight: size + 24 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <FlowerSVG
            petals={referencePetals}
            variant="silhouette"
            size={size}
            animate={false}
            showLabels={false}
            showScores={false}
          />
        </div>
        <div className="relative z-10">
          <FlowerSVG
            petals={currentPetals}
            size={size * 0.92}
            animate={false}
            showLabels={true}
            showScores={false}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400 shrink-0">
            Référence :
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, others.length - 1)}
            value={referenceIndex}
            onChange={(e) => setReferenceIndex(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700"
            style={{ accentColor: '#8b5cf6' } as React.CSSProperties}
          />
          <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
            {referenceIndex + 1} / {others.length}
          </span>
        </div>
        {referenceSnapshot && (
          <p className="text-[10px] text-slate-500 truncate">
            « {referenceSnapshot.first_words || 'Session'} » —{' '}
            {formatDate(referenceSnapshot.created_at)}
          </p>
        )}
      </div>
    </div>
  )
}
