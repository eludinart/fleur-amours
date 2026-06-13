/** Indique si l'utilisateur doit encore compléter le micro-parcours profil. */
export function needsProfileOnboarding(user: Record<string, unknown> | null | undefined): boolean {
  if (!user?.id) return false
  if (user.profile_onboarding_done === true) return false
  const pseudo = String(user.pseudo ?? '').trim()
  return !pseudo
}

export function isValidPseudo(pseudo: string): boolean {
  return /^[a-z0-9_-]{3,30}$/.test(pseudo)
}

export function isValidAge(age: number): boolean {
  return Number.isFinite(age) && age >= 16 && age <= 120
}
