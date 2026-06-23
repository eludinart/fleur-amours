/**
 * Position du sommaire manuel — ref React + sessionStorage (secours rechargement).
 */

const STORAGE_KEY = 'manuel_toc_scroll_v1'
const MAIN_SCROLL_ID = 'jardin-main-scroll'

export type ManuelTocScrollStored = {
  anchor: string
  scrollTop: number
}

/** Mémoire en session (survit aux changements sommaire ↔ chapitre dans ManuelOnlinePage). */
let pendingTocReturn: ManuelTocScrollStored | null = null

export function manuelTocAnchorFromFile(file: string): string {
  const base = file.replace(/\.md$/i, '').replace(/[^\w-]/g, '-')
  return `manuel-toc-${base}`
}

export function findManuelScrollContainer(from?: HTMLElement | null): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const byId = document.getElementById(MAIN_SCROLL_ID)
  if (byId) return byId

  let node: HTMLElement | null = from ?? null
  while (node) {
    const style = getComputedStyle(node)
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
    node = node.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? null
}

function readStored(): ManuelTocScrollStored | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ManuelTocScrollStored
    if (!parsed || typeof parsed.scrollTop !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(payload: ManuelTocScrollStored): void {
  pendingTocReturn = payload
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function getPendingTocReturn(): ManuelTocScrollStored | null {
  return pendingTocReturn ?? readStored()
}

/** Mémorise la position avant d'ouvrir un chapitre depuis le sommaire. */
export function rememberManuelTocReturn(anchorId: string, fromEl?: HTMLElement | null): void {
  const scrollEl = findManuelScrollContainer(fromEl)
  writeStored({
    anchor: anchorId,
    scrollTop: scrollEl?.scrollTop ?? pendingTocReturn?.scrollTop ?? 0,
  })
}

/** Met à jour le scrollTop mémorisé pendant la lecture du sommaire. */
export function syncManuelTocScrollTop(): void {
  const scrollEl = findManuelScrollContainer()
  if (!scrollEl) return
  const prev = getPendingTocReturn()
  writeStored({
    anchor: prev?.anchor ?? '',
    scrollTop: scrollEl.scrollTop,
  })
}

function resolveRestoreTarget(): ManuelTocScrollStored | null {
  const pending = getPendingTocReturn()
  if (typeof window === 'undefined') return pending
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.startsWith('manuel-toc-')) {
    return { anchor: hash, scrollTop: pending?.scrollTop ?? 0 }
  }
  return pending
}

function applyScroll(main: HTMLElement, stored: ManuelTocScrollStored): boolean {
  if (stored.anchor) {
    const anchorEl = document.getElementById(stored.anchor)
    if (anchorEl) {
      anchorEl.scrollIntoView({ block: 'center', behavior: 'auto' })
      return true
    }
  }
  if (stored.scrollTop > 0) {
    main.scrollTop = stored.scrollTop
    return true
  }
  return false
}

/** Restaure la position après retour sur le sommaire. */
export function restoreManuelTocScroll(): void {
  if (typeof window === 'undefined') return
  const stored = resolveRestoreTarget()
  if (!stored) return

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  const delays = [0, 16, 50, 100, 200, 350, 600, 900]
  for (const delay of delays) {
    window.setTimeout(() => {
      const main = findManuelScrollContainer()
      if (!main) return
      applyScroll(main, stored)
    }, delay)
  }
}

export function scrollManuelMainToTop(): void {
  const main = findManuelScrollContainer()
  if (main) main.scrollTop = 0
}

export function clearManuelTocReturn(): void {
  pendingTocReturn = null
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
