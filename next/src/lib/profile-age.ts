/**
 * Date de naissance → âge affiché (profil public).
 * Stockage : fleur_birth_date en YYYY-MM-DD (usermeta).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseBirthDateStored(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).trim().slice(0, 10)
  if (!ISO_DATE.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return s
}

/** Âge révolu à la date de référence (défaut : aujourd'hui). */
export function ageFromBirthDate(birthDate: string, refDate: Date = new Date()): number | null {
  const parsed = parseBirthDateStored(birthDate)
  if (!parsed) return null
  const [y, m, d] = parsed.split('-').map(Number)
  const refY = refDate.getFullYear()
  const refM = refDate.getMonth()
  const refD = refDate.getDate()
  let age = refY - y
  if (refM < m - 1 || (refM === m - 1 && refD < d)) age -= 1
  return age
}

export function isValidProfileAge(age: number): boolean {
  return Number.isFinite(age) && age >= 16 && age <= 120
}

export function isValidBirthDate(birthDate: string, refDate: Date = new Date()): boolean {
  const age = ageFromBirthDate(birthDate, refDate)
  return age != null && isValidProfileAge(age)
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Bornes pour `<input type="date">` : 16–120 ans révolus. */
export function birthDateInputBounds(refDate: Date = new Date()): { min: string; max: string } {
  const max = new Date(refDate.getFullYear() - 16, refDate.getMonth(), refDate.getDate())
  const min = new Date(refDate.getFullYear() - 120, refDate.getMonth(), refDate.getDate())
  return { min: formatIsoDate(min), max: formatIsoDate(max) }
}

export function resolveProfileAge(params: {
  birthDate?: string | null
  legacyAge?: string | null
}): { age: number | null; birthDate: string | null } {
  const birthDate = parseBirthDateStored(params.birthDate)
  if (birthDate) {
    const age = ageFromBirthDate(birthDate)
    return {
      birthDate,
      age: age != null && isValidProfileAge(age) ? age : null,
    }
  }
  const ageRaw = parseInt(String(params.legacyAge ?? ''), 10)
  const age = !Number.isNaN(ageRaw) && isValidProfileAge(ageRaw) ? ageRaw : null
  return { age, birthDate: null }
}
