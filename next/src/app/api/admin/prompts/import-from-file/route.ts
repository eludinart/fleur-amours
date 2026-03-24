/**
 * POST /api/admin/prompts/import-from-file
 * Lit prompts-overrides.json si présent, sinon utilise les constantes par défaut.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { importContent } from '@/lib/prompts-db'
import { TUTEUR_SYSTEM_PROMPT, THRESHOLD_SYSTEM_PROMPT } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const OVERRIDES_PATHS = [
  join(process.cwd(), 'public', 'api', 'data', 'prompts-overrides.json'),
]

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    let tuteur = TUTEUR_SYSTEM_PROMPT
    let threshold = THRESHOLD_SYSTEM_PROMPT
    let fromFile = false
    for (const p of OVERRIDES_PATHS) {
      try {
        const raw = await readFile(p, 'utf8')
        const j = JSON.parse(raw) as { tuteur?: string; threshold?: string }
        if (j.tuteur) {
          tuteur = j.tuteur
          fromFile = true
        }
        if (j.threshold) {
          threshold = j.threshold
          fromFile = true
        }
        break
      } catch {
        continue
      }
    }
    const nameTuteur = fromFile ? 'Importé depuis overrides (Tuteur)' : 'Par défaut (Tuteur)'
    const nameThreshold = fromFile ? 'Importé depuis overrides (Seuil)' : 'Par défaut (Seuil)'
    const ids = await importContent(tuteur, threshold, nameTuteur, nameThreshold)
    return NextResponse.json({ saved: true, ids, from_file: fromFile })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
