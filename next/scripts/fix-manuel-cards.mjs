// Nettoie les 65 fiches carte : pollution inter-cartes, pieds de page, numéros.
import fs from 'node:fs'
import path from 'node:path'

const dirs = [
  path.resolve('next/public/manuel'),
  path.resolve('docs/MANUEL'),
]

const CARD_FILES = [
  '21-agape.md','22-eros.md','23-philia.md','24-storge.md','25-pragma.md','26-ludus.md','27-mania.md','28-philautia.md',
  '30-les-racines.md','31-la-tige.md','32-les-feuilles.md','33-le-bouton.md','34-la-fleur.md','35-le-fruit.md',
  '36-le-pollen.md','37-le-nectar.md','38-la-graine-endormie.md','39-la-germination.md',
  '41-le-feu.md','42-l-ether.md','43-l-eau.md','44-l-air.md','45-la-terre.md',
  '47-le-mineral.md','48-l-argile.md','49-l-humus.md','50-le-cristal.md','51-la-roche-mere.md','52-la-cendre-fertile.md',
  '54-la-source-profonde.md','55-la-pluie.md','56-la-brume.md','57-la-vague.md','58-l-estuaire.md','59-l-ocean.md',
  '61-le-souffle.md','62-le-vent-solaire.md','63-l-echo.md','64-l-alize.md','65-le-verbe.md','66-le-messager.md',
  '68-les-braises.md','69-le-c-ur-du-feu.md','70-la-flamme.md','71-la-lumiere.md','72-le-soleil-interieur.md','73-le-volcan.md',
  '75-l-harmonie-des-cycles.md','76-l-invisible.md','77-le-mandala-cosmique.md','78-l-unite.md',
  '79-la-source-lumineuse.md','80-le-silence-etoile.md',
  '82-l-abeille.md','83-l-ame-du-monde.md','84-l-offrande.md','85-la-spirale-de-la-vie.md','86-la-danse-du-monde.md',
  '87-la-memoire-de-la-seve.md','88-la-naissance.md','89-la-transmission.md','90-la-conscience-collective.md',
  '91-la-presence.md','92-la-metamorphose.md','93-le-grand-passage.md',
]

function cleanBody(body) {
  let t = body

  // Tronquer après la Question Racine (pollution carte suivante).
  const qm = t.match(/Question\s+Racine\s*:[\s\S]*?(?:«[^»]+»|"[^"]+\?")/iu)
  if (qm) t = t.slice(0, qm.index + qm[0].length)

  // Pieds de page et labels papier.
  t = t.replace(/\s*La Fleur d[''´`]ÅmÔurs(?:\s+\d{1,3})?\s*/gi, ' ')
  const cycleLabels = [
    'Cycle du Végétal', 'Cycle de la Terre', "Cycle de l'Eau", "Cycle de l'Air",
    'Cycle du Feu', "Cycle de l'Éther", "Cycle de l'Ether", 'Cycle de la Vie', 'Les Éléments',
  ]
  for (const label of cycleLabels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`\\s+${esc}\\s+\\d{1,3}\\s+`, 'gi'), ' ')
    t = t.replace(new RegExp(`\\s+${esc}\\s*`, 'gi'), ' ')
  }

  // Numéro de page en tête du corps.
  t = t.replace(/^\s*\d{2,3}\s+(?=[A-ZÀ-ÖØ-Ýa-z«(])/u, '')

  // Numéros de page inline avant sections (coupure PDF).
  t = t.replace(/\s+\d{1,3}\s+(?=Mots-clés\s+(?:lumière|ombre)\s*:)/gi, ' ')
  t = t.replace(/([.!?…»])\s+\d{1,3}\s+(?=Description\s+étendue\b)/gi, '$1 ')

  return t.replace(/\s{2,}/g, ' ').trim()
}

let changed = 0
for (const dir of dirs) {
  for (const f of CARD_FILES) {
    const fp = path.join(dir, f)
    if (!fs.existsSync(fp)) continue
    const raw = fs.readFileSync(fp, 'utf8')
    const lines = raw.split('\n')
    const header = lines.slice(0, 4).join('\n')
    const body = lines.slice(4).join('\n')
    const cleaned = cleanBody(body)
    if (cleaned !== body.trim()) {
      fs.writeFileSync(fp, `${header}\n\n${cleaned}\n`, 'utf8')
      changed++
      console.log(`fixed: ${path.relative(process.cwd(), fp)}`)
    }
  }
}
console.log(`Fichiers modifiés : ${changed}`)
