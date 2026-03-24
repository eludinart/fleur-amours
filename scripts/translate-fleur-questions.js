#!/usr/bin/env node
/**
 * Lance la traduction des questions QCM Fleur en anglais et espagnol.
 * Appelle l'API Next.js /api/fleur/translate-questions (MariaDB + OpenRouter).
 *
 * Usage:
 *   npm run dev:next   # démarrer Next.js dans un terminal
 *   npm run translate-fleur-questions   # dans un autre terminal
 *
 *   node scripts/translate-fleur-questions.js --dry-run
 *   node scripts/translate-fleur-questions.js --force
 *   node scripts/translate-fleur-questions.js --slug=fleur-amour-individuel
 *
 * Variables : NEXT_PUBLIC_APP_URL (ex. http://localhost:3000), OPENROUTER_API_KEY
 */
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const apiUrl = `${baseUrl.replace(/\/$/, '')}/jardin/api/fleur/translate-questions`

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  const slugArg = process.argv.find((a) => a.startsWith('--slug='))
  const slug = slugArg ? slugArg.split('=')[1] : 'fleur-amour-individuel'

  console.log(`\n🌍 Traduction des questions QCM Fleur (slug: ${slug})${dryRun ? ' [DRY-RUN]' : ''}${force ? ' [FORCE]' : ''}\n`)

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, dry_run: dryRun, force }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Erreur API ${res.status}:`, text)
    process.exit(1)
  }

  const data = await res.json()

  if (data.error) {
    console.error('Erreur:', data.error)
    process.exit(1)
  }

  if (data.status === 'already_done') {
    console.log('✅ Toutes les questions sont déjà traduites.')
    return
  }

  console.log(`✅ Statut: ${data.status} | ${data.count ?? 0} éléments traités\n`)
  if (data.log?.length) {
    console.log('Détails:')
    data.log.forEach((line) => console.log(`  ${line}`))
  }
  console.log('')
}

main().catch((e) => {
  console.error('Erreur:', e.message)
  process.exit(1)
})
