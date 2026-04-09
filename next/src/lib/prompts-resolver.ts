/**
 * Résolution des prompts IA : DB > fichier overrides > constantes.
 * Résolution des prompts IA : DB > fichier overrides > constantes.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getActiveContent, getPromptOverride } from './prompts-db'
import {
  TUTEUR_SYSTEM_PROMPT,
  THRESHOLD_SYSTEM_PROMPT,
  ANALYZE_MOOD_SYSTEM_PROMPT,
  COACH_SYSTEM_PROMPT,
} from './prompts'

const OVERRIDES_PATHS = [
  join(process.cwd(), 'public', 'api', 'data', 'prompts-overrides.json'),
]

async function readOverrides(): Promise<{
  tuteur?: string
  threshold?: string
  analyze_mood?: string
  coach?: string
} | null> {
  for (const p of OVERRIDES_PATHS) {
    try {
      const raw = await readFile(p, 'utf8')
      return JSON.parse(raw)
    } catch {
      continue
    }
  }
  return null
}

/** Prompt Tuteur : DB > overrides > constante */
export async function getTuteurPrompt(): Promise<string> {
  const { tuteur } = await getActiveContent()
  if (tuteur) return tuteur
  const overrides = await readOverrides()
  if (overrides?.tuteur) return overrides.tuteur
  return TUTEUR_SYSTEM_PROMPT
}

/** Prompt Seuil : DB > overrides > constante */
export async function getThresholdPrompt(): Promise<string> {
  const { threshold } = await getActiveContent()
  if (threshold) return threshold
  const overrides = await readOverrides()
  if (overrides?.threshold) return overrides.threshold
  return THRESHOLD_SYSTEM_PROMPT
}

/** Prompt Dreamscape : DB override > overrides file > constante */
export async function getAnalyzeMoodPrompt(): Promise<string> {
  const fromDb = await getPromptOverride('analyze_mood')
  if (fromDb && fromDb.trim()) return fromDb
  const overrides = await readOverrides()
  if (overrides?.analyze_mood) return overrides.analyze_mood
  return ANALYZE_MOOD_SYSTEM_PROMPT
}

/** Prompt Coach : DB > overrides > constante */
export async function getCoachPrompt(): Promise<string> {
  const { coach } = await getActiveContent()
  if (coach) return coach
  const overrides = await readOverrides()
  if (overrides?.coach) return overrides.coach
  return COACH_SYSTEM_PROMPT
}
