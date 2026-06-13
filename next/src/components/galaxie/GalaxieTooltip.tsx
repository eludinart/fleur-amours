'use client'

import { PETAL_BY_ID } from '@/lib/petal-theme'
import { t } from '@/i18n'

type GalaxieTooltipProps = {
  node: {
    pseudo?: string
    avatar_emoji?: string
    dominantPetal?: string
    isContact?: boolean
    isMe?: boolean
    presence?: { is_online?: boolean }
    is_online?: boolean
    resonanceWithMe?: number
    last_activity_at?: string
  }
  x: number
  y: number
  containerW: number
  containerH: number
}

export function GalaxieTooltip({ node, x, y, containerW, containerH }: GalaxieTooltipProps) {
  const pseudo = String(node.pseudo ?? '').trim() || 'Jardinier'
  const petal = PETAL_BY_ID[node.dominantPetal ?? '']?.name ?? node.dominantPetal ?? '—'
  const online = !!(node.presence?.is_online ?? node.is_online)
  const resonance = node.resonanceWithMe
  const tw = 168
  const left = Math.max(8, Math.min(x - tw / 2, containerW - tw - 8))
  const top = Math.max(8, Math.min(y - 88, containerH - 100))

  return (
    <div
      className="absolute z-30 pointer-events-none px-2.5 py-2 rounded-lg border border-slate-600/50 bg-slate-950/92 backdrop-blur-md shadow-xl text-[11px]"
      style={{ left, top, width: tw }}
      role="tooltip"
    >
      <p className="font-semibold text-amber-100 truncate">
        {pseudo} {node.avatar_emoji ?? '🌸'}
      </p>
      <p className="text-slate-400 mt-0.5">
        {t('prairie.tooltipPetal')}: <span className="text-slate-200">{petal}</span>
      </p>
      {node.isMe ? (
        <p className="text-amber-300/90 mt-0.5">{t('prairie.you')}</p>
      ) : (
        <>
          {typeof resonance === 'number' && (
            <p className="text-slate-400 mt-0.5">
              {t('prairie.tooltipResonance')}:{' '}
              <span className="text-cyan-200">{Math.round(resonance * 100)}%</span>
            </p>
          )}
          <p className="text-slate-400 mt-0.5">
            {online ? (
              <span className="text-emerald-400">{t('prairie.legendOnline')}</span>
            ) : (
              <span className="text-slate-500">{t('prairie.tooltipOffline')}</span>
            )}
            {node.isContact && (
              <span className="text-violet-300 ml-1.5">· {t('prairie.legendContact')}</span>
            )}
          </p>
          {!node.isMe && (
            <p className="text-slate-500 mt-1.5 text-[10px] italic">{t('prairie.tooltipClickHint')}</p>
          )}
        </>
      )}
    </div>
  )
}
