/**
 * Pile de navigation pour « retour à l’écran précédent » (hors parcours immersifs).
 * Persistance sessionStorage pour survivre aux rechargements partiels.
 */

const STORAGE_KEY = 'fleur_form_back_nav_v1'

export type FormBackStored = {
  stack: string[]
  /** Dernier segment hors-parcours avant d’entrer dans un parcours (dreamscape, session, etc.) */
  suspended: string | null
}

const MAX_STACK = 40

export function pathWithoutBase(pathname: string | null | undefined, basePath: string): string {
  if (!pathname) return ''
  const b = basePath.replace(/\/$/, '') || ''
  let p = pathname
  if (b && p.startsWith(b)) p = p.slice(b.length)
  return p.replace(/^\/+|\/+$/g, '')
}

/** Parcours où le retour global ne doit pas s’afficher (Promenade onirique, Explorer ma Fleur, Tirages, Ma Fleur, Duo). */
export function isImmersiveParcoursPath(pathWithoutBaseSeg: string): boolean {
  const p = pathWithoutBaseSeg.replace(/^\/+|\/+$/g, '')
  if (!p) return false
  const roots = [
    'dreamscape',
    'session',
    'tirage',
    'fleur',
    'fleur-beta',
    'duo',
  ]
  for (const r of roots) {
    if (p === r || p.startsWith(`${r}/`)) return true
  }
  return false
}

function read(): FormBackStored {
  if (typeof window === 'undefined') return { stack: [], suspended: null }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { stack: [], suspended: null }
    const o = JSON.parse(raw) as Partial<FormBackStored>
    return {
      stack: Array.isArray(o.stack) ? o.stack.filter((x) => typeof x === 'string') : [],
      suspended: typeof o.suspended === 'string' ? o.suspended : null,
    }
  } catch {
    return { stack: [], suspended: null }
  }
}

function write(s: FormBackStored) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stack: s.stack.slice(-MAX_STACK),
        suspended: s.suspended,
      })
    )
  } catch {
    /* ignore */
  }
}

/**
 * À appeler à chaque changement de pathname (segments sans basePath, ex. `account`, `` pour l’accueil).
 */
export function recordFormNavigationStep(
  fromSeg: string | null,
  toSeg: string,
  opts?: { emit?: () => void }
): void {
  if (typeof window === 'undefined') return

  const from = fromSeg ?? ''
  const to = toSeg

  const s = read()

  if (isImmersiveParcoursPath(to)) {
    if (!isImmersiveParcoursPath(from) && from !== to) {
      s.suspended = from
    }
    write(s)
    opts?.emit?.()
    return
  }

  if (isImmersiveParcoursPath(from)) {
    const anchor = s.suspended
    s.suspended = null
    if (anchor !== null && anchor !== undefined && anchor !== to) {
      s.stack.push(anchor)
    }
    write(s)
    opts?.emit?.()
    return
  }

  if (from !== to) {
    s.stack.push(from)
  }
  write(s)
  opts?.emit?.()
}

export function getFormBackStackDepth(): number {
  return read().stack.length
}

export function popFormBackTarget(): string | null {
  const s = read()
  const target = s.stack.pop()
  write(s)
  return target === undefined ? null : target
}
