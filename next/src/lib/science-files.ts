/**
 * Fichiers JSON du dossier science (lecture seule).
 */
import { readFile, readdir } from 'fs/promises'
import { join, basename } from 'path'

const SCIENCE_DIR = join(process.cwd(), 'public', 'api', 'data', 'science')

const LABELS: Record<string, string> = {
  axioms: 'Axiomes',
  theory: 'Théorie',
  interaction_matrix: 'Matrice d\'interactions',
  invariants_and_dynamics: 'Invariants & dynamiques',
  metrics: 'Métriques',
  diagnostic_example: 'Exemple diagnostic',
  petals: 'Pétales',
  levers_library: 'Bibliothèque de leviers',
  tensions_paradoxes: 'Tensions & paradoxes',
  philautia_operational: 'Philautia opérationnelle',
  pedagogy_and_syllabus: 'Pédagogie & syllabus',
  protocol_minimal: 'Protocole minimal',
  framework_bible: 'Framework bible',
  lexicon_AB: 'Lexique A/B',
  db_schema: 'Schéma DB',
}

function jsonToHtml(data: unknown, title: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<article><h1>${esc(title)}</h1><pre style="white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5">${esc(JSON.stringify(data, null, 2))}</pre></article>`
}

export async function listScienceFiles(): Promise<Array<{ filename: string; name: string }>> {
  const entries = await readdir(SCIENCE_DIR)
  return entries
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((filename) => ({
      filename,
      name: LABELS[filename.replace(/\.json$/, '')] ?? basename(filename, '.json'),
    }))
}

export async function viewScienceFile(filename: string): Promise<{ html: string }> {
  const safe = basename(filename)
  if (!safe.endsWith('.json')) throw new Error('Fichier non autorisé')
  const path = join(SCIENCE_DIR, safe)
  const raw = await readFile(path, 'utf8')
  const data = JSON.parse(raw)
  const title = LABELS[safe.replace(/\.json$/, '')] ?? safe
  return { html: jsonToHtml(data, title) }
}
