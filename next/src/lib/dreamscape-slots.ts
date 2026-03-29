/**
 * Slots rosace Dreamscape — partagé entre live canvas et régénération d'aperçu.
 */
export const PETAL_POSITIONS = ['Agapè', 'Philautia', 'Mania', 'Storgè', 'Pragma', 'Philia', 'Ludus', 'Éros']

export function initSlots() {
  return PETAL_POSITIONS.map((position, i) => ({
    position,
    card: position,
    faceDown: true,
    angleDeg: i * 45,
    revealOrder: 0,
  }))
}

type SavedSlot = {
  position?: string
  card?: string
  faceDown?: boolean
  angleDeg?: number
  revealOrder?: number
  halo?: string | null
}

export function buildSlotsFromSaved(savedSlots: unknown[] | null | undefined) {
  const list = (Array.isArray(savedSlots) ? savedSlots : []) as SavedSlot[]
  let revCounter = 0
  return PETAL_POSITIONS.map((position, i) => {
    const saved = list.find((s) => s?.position === position)
    if (saved) {
      const faceDown = saved.faceDown !== false
      const revealOrder = saved.revealOrder ?? (faceDown ? 0 : ++revCounter)
      return {
        position,
        card: saved.card || position,
        faceDown,
        angleDeg: saved.angleDeg ?? i * 45,
        revealOrder,
        halo: saved.halo ?? null,
      }
    }
    return { position, card: position, faceDown: true, angleDeg: i * 45, revealOrder: 0, halo: null }
  })
}
