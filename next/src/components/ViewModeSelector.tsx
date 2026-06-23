'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { useMyceliumAccess } from '@/hooks/useMyceliumAccess'
import { t } from '@/i18n'
import {
  VIEW_MODE_ORDER,
  getAvailableViewModes,
  getViewModeDescriptor,
  resolveViewMode,
  type ViewMode,
} from '@/lib/view-modes'

/**
 * Sélecteur multi-vues pour utilisateurs multi-rôles.
 *
 * - Liste dynamiquement les modes disponibles selon les droits réels (admin, coach, RH, Mycelium).
 * - Si une seule vue est disponible, le sélecteur ne s'affiche pas (pas de bruit pour les users simples).
 * - Le mode sélectionné est persisté dans `useStore.viewMode` et filtré au rendu via `resolveViewMode()`.
 * - Aucun droit backend n'est altéré : c'est purement un masque UI côté menu.
 *
 * Pour ajouter un nouveau rôle : enrichir `lib/view-modes.ts` (descripteur + règle de droit dans
 * `getAvailableViewModes`). Le sélecteur prend la nouvelle vue en compte automatiquement.
 */
export function ViewModeSelector({ layout = 'inline' }: { layout?: 'inline' | 'sidebar' }) {
  const { user, isAdmin, isCoach, actsAsCoach, isManager, isRh } = useAuth()
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const { access: myceliumAccess } = useMyceliumAccess(!!user)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Activation du portail uniquement côté client (évite mismatch SSR).
  useEffect(() => {
    setMounted(true)
  }, [])

  // Positionne le menu en fixed sous le bouton (en contournant tous les `overflow:hidden` parents).
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const MENU_MIN_WIDTH = 256
    const GAP = 8
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuWidth =
        layout === 'sidebar'
          ? Math.min(Math.max(rect.width, MENU_MIN_WIDTH), window.innerWidth - GAP * 2)
          : MENU_MIN_WIDTH
      let left = rect.left
      if (left + menuWidth > window.innerWidth - GAP) {
        left = window.innerWidth - menuWidth - GAP
      }
      if (left < GAP) {
        left = GAP
      }
      setMenuPos({
        top: rect.bottom + 4,
        left,
        width: menuWidth,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, layout])

  // Fermeture au clic extérieur ou Escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const available = getAvailableViewModes({
    isAdmin,
    isCoach,
    actsAsCoach,
    isManager,
    isRh,
    myceliumAccess: myceliumAccess
      ? {
          showAdmin: myceliumAccess.showAdmin,
          showDashboard: myceliumAccess.showDashboard,
          showEspace: myceliumAccess.showEspace,
        }
      : null,
  })

  if (available.length <= 1) return null

  const current = resolveViewMode(viewMode, available)
  const currentDescriptor = getViewModeDescriptor(current)
  const orderedModes: ViewMode[] = VIEW_MODE_ORDER.filter((m) => available.includes(m))

  function handleSelect(mode: ViewMode) {
    setViewMode(mode)
    setOpen(false)
  }

  const menu =
    open && menuPos ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={t('nav.viewModes.selectorLabel')}
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 1000,
        }}
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('nav.viewModes.selectorLabel')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {t('nav.viewModes.selectorHint')}
          </p>
        </div>
        <ul className="py-1 max-h-72 overflow-y-auto">
          {orderedModes.map((mode) => {
            const desc = getViewModeDescriptor(mode)
            const isActive = mode === current
            return (
              <li key={mode}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(mode)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-slate-50 dark:bg-slate-800/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5" aria-hidden>
                    {desc.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t(desc.labelKey)}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {t(desc.descriptionKey)}
                    </span>
                  </span>
                  {isActive && (
                    <span className="text-violet-500 text-xs shrink-0 mt-1" aria-hidden>
                      ●
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    ) : null

  return (
    <div className={layout === 'sidebar' ? 'w-full' : 'shrink-0'}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t(currentDescriptor.descriptionKey)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.viewModes.selectorLabel')}
        className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${currentDescriptor.activeClass} ${
          layout === 'sidebar' ? 'w-full justify-between' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span aria-hidden>{currentDescriptor.icon}</span>
          <span
            className={
              layout === 'sidebar'
                ? 'truncate'
                : 'hidden sm:inline truncate max-w-[5.5rem] md:max-w-none'
            }
          >
            {t(currentDescriptor.labelKey)}
          </span>
        </span>
        <span className="text-[10px] opacity-70 shrink-0" aria-hidden>
          ▾
        </span>
      </button>
      {/* Rendu dans document.body via portail pour échapper aux `overflow:hidden` / stacking contexts parents. */}
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
