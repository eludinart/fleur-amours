/**
 * Libellés et motifs de sections des fiches carte du manuel, par locale UI.
 */
import type { ManuelAiLocale } from './manuel-ai-i18n'

export type ManuelCardSectionKey =
  | 'description'
  | 'light'
  | 'shadow'
  | 'ombre'
  | 'integration'
  | 'resonance'
  | 'energy'
  | 'question'
  | 'exercise'

export type ManuelCardSectionDef = {
  key: ManuelCardSectionKey
  label: string
  pattern: RegExp
}

export type ManuelEnergyFieldDef = {
  label: string
  pattern: RegExp
}

type LocaleSectionStrings = Record<ManuelCardSectionKey, string>

const SECTION_LABELS: Record<ManuelAiLocale, LocaleSectionStrings> = {
  fr: {
    description: 'Description étendue',
    light: 'Mots-clés lumière',
    shadow: 'Mots-clés ombre',
    ombre: 'Ombre',
    integration: "Chemins d'intégration",
    resonance: "Résonance de l'Âme",
    energy: 'Correspondances énergétiques',
    question: 'Question Racine',
    exercise: 'Exercice / Méditation',
  },
  en: {
    description: 'Extended description',
    light: 'Light keywords',
    shadow: 'Shadow keywords',
    ombre: 'Shadow',
    integration: 'Integration paths',
    resonance: 'Soul resonance',
    energy: 'Energy correspondences',
    question: 'Root question',
    exercise: 'Exercise / Meditation',
  },
  es: {
    description: 'Descripción ampliada',
    light: 'Palabras clave de luz',
    shadow: 'Palabras clave de sombra',
    ombre: 'Sombra',
    integration: 'Caminos de integración',
    resonance: 'Resonancia del alma',
    energy: 'Correspondencias energéticas',
    question: 'Pregunta raíz',
    exercise: 'Ejercicio / Meditación',
  },
  it: {
    description: 'Descrizione estesa',
    light: 'Parole chiave di luce',
    shadow: 'Parole chiave d’ombra',
    ombre: 'Ombra',
    integration: 'Percorsi di integrazione',
    resonance: "Risonanza dell'anima",
    energy: 'Corrispondenze energetiche',
    question: 'Domanda radice',
    exercise: 'Esercizio / Meditazione',
  },
  de: {
    description: 'Erweiterte Beschreibung',
    light: 'Licht-Schlüsselwörter',
    shadow: 'Schatten-Schlüsselwörter',
    ombre: 'Schatten',
    integration: 'Integrationswege',
    resonance: 'Seelenresonanz',
    energy: 'Energetische Entsprechungen',
    question: 'Wurzelfrage',
    exercise: 'Übung / Meditation',
  },
}

const ENERGY_FIELD_LABELS: Record<
  ManuelAiLocale,
  Array<{ key: string; label: string }>
> = {
  fr: [
    { key: 'element', label: 'Élément' },
    { key: 'polarity', label: 'Polarité' },
    { key: 'symbols', label: 'Correspondances symboliques' },
    { key: 'resonance', label: 'En résonance' },
  ],
  en: [
    { key: 'element', label: 'Element' },
    { key: 'polarity', label: 'Polarity' },
    { key: 'symbols', label: 'Symbolic correspondences' },
    { key: 'resonance', label: 'In resonance' },
  ],
  es: [
    { key: 'element', label: 'Elemento' },
    { key: 'polarity', label: 'Polaridad' },
    { key: 'symbols', label: 'Correspondencias simbólicas' },
    { key: 'resonance', label: 'En resonancia' },
  ],
  it: [
    { key: 'element', label: 'Elemento' },
    { key: 'polarity', label: 'Polarità' },
    { key: 'symbols', label: 'Corrispondenze simboliche' },
    { key: 'resonance', label: 'In risonanza' },
  ],
  de: [
    { key: 'element', label: 'Element' },
    { key: 'polarity', label: 'Polarität' },
    { key: 'symbols', label: 'Symbolische Entsprechungen' },
    { key: 'resonance', label: 'In Resonanz' },
  ],
}

function labelPattern(label: string): RegExp {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")
  return new RegExp(`${esc}\\s*:`, 'gi')
}

export function getManuelCardSectionDefs(locale: ManuelAiLocale): ManuelCardSectionDef[] {
  const labels = SECTION_LABELS[locale]
  return [
    { key: 'description', label: labels.description, pattern: labelPattern(labels.description) },
    { key: 'light', label: labels.light, pattern: labelPattern(labels.light) },
    { key: 'shadow', label: labels.shadow, pattern: labelPattern(labels.shadow) },
    {
      key: 'ombre',
      label: labels.ombre,
      pattern: locale === 'fr' ? /Ombre\s*:/g : labelPattern(labels.ombre),
    },
    { key: 'integration', label: labels.integration, pattern: labelPattern(labels.integration) },
    { key: 'resonance', label: labels.resonance, pattern: labelPattern(labels.resonance) },
    { key: 'energy', label: labels.energy, pattern: labelPattern(labels.energy) },
    { key: 'question', label: labels.question, pattern: labelPattern(labels.question) },
    { key: 'exercise', label: labels.exercise, pattern: labelPattern(labels.exercise) },
  ]
}

export function getManuelEnergyFieldDefs(locale: ManuelAiLocale): ManuelEnergyFieldDef[] {
  return ENERGY_FIELD_LABELS[locale].map((f) => ({
    label: f.label,
    pattern: labelPattern(f.label),
  }))
}

/** Glossary for translation scripts — canonical section headers per locale. */
export function manuelSectionGlossary(locale: ManuelAiLocale): string[] {
  const labels = SECTION_LABELS[locale]
  const energy = ENERGY_FIELD_LABELS[locale]
  return [
    `${labels.description}:`,
    `${labels.light}:`,
    `${labels.shadow}:`,
    `${labels.ombre}:`,
    `${labels.integration}:`,
    `${labels.resonance}:`,
    `${labels.energy}:`,
    `${labels.question}:`,
    `${labels.exercise}:`,
    ...energy.map((e) => `${e.label}:`),
  ]
}
