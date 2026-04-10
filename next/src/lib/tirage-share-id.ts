/**
 * ID utilisable pour /tirage/partage/[id] et l’API publique (MariaDB).
 * Les tirages uniquement en local (UUID) n’ont pas de page publique serveur.
 */
export function getTirageShareableId(
  reading: Record<string, unknown> | null | undefined
): string | null {
  if (!reading) return null
  const raw = reading.id ?? (reading as { reading_id?: unknown }).reading_id
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || s === 'undefined' || s === 'null') return null
  if (!/^\d+$/.test(s)) return null
  return s
}
