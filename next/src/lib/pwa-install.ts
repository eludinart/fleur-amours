/**
 * Helpers PWA — détection install / plateforme pour la bannière d’installation.
 */

export const PWA_INSTALL_DISMISS_KEY = 'pwa_install_banner_dismissed'

/** App déjà ouverte en mode installé (PWA ou iOS « Sur l’écran d’accueil »). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  )
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/** Safari iOS (pas Chrome iOS qui utilise WebKit mais gère l’install différemment). */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  if (!isIosDevice()) return false
  const ua = navigator.userAgent
  const isOtherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
  return !isOtherBrowser
}

export function wasInstallBannerDismissed(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === '1'
}

export function dismissInstallBanner(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PWA_INSTALL_DISMISS_KEY, '1')
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
