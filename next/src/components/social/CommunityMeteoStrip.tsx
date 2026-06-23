// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { socialApi } from '@/api/social'
import { PETAL_DEFS } from '@/lib/petal-theme'
import { t } from '@/i18n'

/**
 * Bandeau léger : météo intérieure du jour + mode disponibilité (ouvert / intériorisation).
 */
export function CommunityMeteoStrip({ variant = 'inline', className = '' }) {
  const [meteoPetal, setMeteoPetal] = useState(null)
  const [socialMode, setSocialMode] = useState('open')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await socialApi.getMeteo()
      setMeteoPetal(data?.meteoPetal ?? null)
      setSocialMode(data?.socialMode === 'focus' ? 'focus' : 'open')
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const persist = async (patch) => {
    setSaving(true)
    try {
      const data = await socialApi.setMeteo(patch)
      setMeteoPetal(data?.meteoPetal ?? null)
      setSocialMode(data?.socialMode === 'focus' ? 'focus' : 'open')
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const toggleMode = () => {
    const next = socialMode === 'focus' ? 'open' : 'focus'
    persist({ socialMode: next })
  }

  if (loading) return null

  const compact = variant === 'compact'
  const needsMeteo = !meteoPetal

  if (compact && collapsed && !needsMeteo) return null

  return (
    <div
      className={`rounded-xl border border-slate-600/35 bg-slate-950/70 backdrop-blur-md ${
        compact ? 'px-2 py-1.5' : 'px-3 py-2'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-medium text-cyan-200/90 shrink-0`}>
            {needsMeteo ? t('meteo.prompt') : t('meteo.title')}
          </span>
          {compact && !needsMeteo && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-[9px] text-slate-500 hover:text-slate-300"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={toggleMode}
            className={`px-2 py-0.5 rounded-lg text-[9px] font-medium border transition-colors ${
              socialMode === 'focus'
                ? 'bg-violet-500/20 text-violet-200 border-violet-400/35'
                : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
            }`}
            title={socialMode === 'focus' ? t('meteo.focusHint') : t('meteo.openHint')}
          >
            {socialMode === 'focus' ? t('meteo.modeFocus') : t('meteo.modeOpen')}
          </button>
        </div>
      </div>
      {(needsMeteo || !compact) && (
        <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mt-1.5'}`}>
          {PETAL_DEFS.map((p) => {
            const active = meteoPetal === p.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                onClick={() => persist({ meteoPetal: active ? null : p.id })}
                className={`px-1.5 py-0.5 rounded-md text-[9px] border transition-colors ${
                  active
                    ? 'text-white border-transparent'
                    : 'text-slate-400 border-slate-600/40 hover:border-slate-500/60 hover:text-slate-200'
                }`}
                style={
                  active
                    ? { backgroundColor: `${p.color}55`, borderColor: `${p.color}88`, color: p.color }
                    : undefined
                }
                title={p.name}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      )}
      {meteoPetal && !compact && (
        <p className="text-[8px] text-slate-500 mt-1">{t('meteo.dayNote')}</p>
      )}
    </div>
  )
}
