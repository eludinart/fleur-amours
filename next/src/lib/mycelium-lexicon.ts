/**
 * Lexique Mycelium : pétales archétypaux (A) vs dimensions professionnelles (B).
 * Source : public/api/data/science/lexicon_AB.json
 */
export type MyceliumLexiconEntry = { A: string; B: string }

export const MYCELIUM_LEXICON: MyceliumLexiconEntry[] = [
  { A: 'Agapè', B: 'Contribution / Sens' },
  { A: 'Éros', B: 'Expansion / Impact' },
  { A: 'Philia', B: 'Alliance / Coopération' },
  { A: 'Storgè', B: 'Sécurité / Appartenance' },
  { A: 'Pragma', B: 'Gouvernance / Contrat' },
  { A: 'Ludus', B: 'Exploration / Adaptabilité' },
  { A: 'Mania', B: 'Intensité / Risque' },
  { A: 'Philautia', B: 'Alignement / Intégrité' },
]

/** Correspondance id pétale → entrée lexique (ordre stable de l'app). */
export const PETAL_ID_TO_LEXICON: Record<string, MyceliumLexiconEntry> = {
  agape: MYCELIUM_LEXICON[0],
  eros: MYCELIUM_LEXICON[1],
  philia: MYCELIUM_LEXICON[2],
  storge: MYCELIUM_LEXICON[3],
  pragma: MYCELIUM_LEXICON[4],
  ludus: MYCELIUM_LEXICON[5],
  mania: MYCELIUM_LEXICON[6],
  philautia: MYCELIUM_LEXICON[7],
}

export const PETAL_IDS_ORDER = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

export function petalLabel(id: string, mode: 'A' | 'B' = 'B'): string {
  const entry = PETAL_ID_TO_LEXICON[id]
  if (!entry) return id
  return mode === 'A' ? entry.A : entry.B
}

/** Dimensions dont une baisse signale un risque RPS (seuil relatif). */
export const WATCH_PETALS = ['philautia', 'storge', 'agape'] as const

export function buildDimensionAlerts(
  current: Record<string, number> | null,
  previous: Record<string, number> | null,
  minDrop = 0.08
): Array<{ petalId: string; label: string; direction: 'down' | 'up'; delta: number; hint: string }> {
  if (!current) return []
  const alerts: Array<{ petalId: string; label: string; direction: 'down' | 'up'; delta: number; hint: string }> = []
  for (const id of PETAL_IDS_ORDER) {
    const cur = current[id] ?? 0
    const prev = previous?.[id] ?? cur
    const delta = Math.round((cur - prev) * 100) / 100
    if (Math.abs(delta) < minDrop) continue
    const label = petalLabel(id, 'B')
    if (delta < 0 && (WATCH_PETALS as readonly string[]).includes(id)) {
      const hints: Record<string, string> = {
        philautia: 'Signal précoce de surcharge ou de limites floues — piste : entretiens bien-être, audit de charge.',
        storge: 'Appartenance en recul — piste : rituels d’équipe, reconnaissance, accueil.',
        agape: 'Sens et contribution en baisse — piste : reconnecter le métier à la mission.',
      }
      alerts.push({ petalId: id, label, direction: 'down', delta, hint: hints[id] ?? 'Dimension à surveiller.' })
    }
  }
  return alerts.sort((a, b) => a.delta - b.delta).slice(0, 3)
}
