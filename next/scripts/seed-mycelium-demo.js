#!/usr/bin/env node
/**
 * Jeu de données Mycelium — démo présentable (salariés + visibilité RH).
 *
 * Usage :
 *   cd next
 *   node scripts/seed-mycelium-demo.js
 *   node scripts/seed-mycelium-demo.js --reset
 *   node scripts/seed-mycelium-demo.js --admin-email=votre@email.com
 *
 * Prérequis : MariaDB accessible (docker-compose / tunnel VPS), variables dans
 * ../docker-compose.env ou ../.env (MARIADB_* / DB_*).
 *
 * Mot de passe des comptes démo : DemoMycelium2025!
 */
import { createPool } from 'mysql2/promise'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DEMO_ORG_NAME = 'Les Ateliers du Littoral'
const DEMO_EMAIL_DOMAIN = 'demo-littoral.eludein.art'
const DEMO_PASSWORD = 'DemoMycelium2025!'
const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

function loadEnv() {
  const paths = [
    resolve(ROOT, '../.env'),
    resolve(ROOT, '.env.local'),
    resolve(ROOT, '../docker-compose.env'),
    resolve(ROOT, '../sync-config.env'),
  ]
  const env = { ...process.env }
  for (const p of paths) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return env
}

function parseArgs(env) {
  const args = process.argv.slice(2)
  let adminEmail = env.MYCELIUM_DEMO_ADMIN_EMAIL || 'eludinart@gmail.com'
  let reset = false
  for (const a of args) {
    if (a === '--reset') reset = true
    else if (a.startsWith('--admin-email=')) adminEmail = a.slice('--admin-email='.length)
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/seed-mycelium-demo.js [--reset] [--admin-email=email]`)
      process.exit(0)
    }
  }
  return { adminEmail, reset }
}

function petalsToArray(petals) {
  return PETAL_IDS.map((id) => Number(petals[id]) || 0)
}

function clampPetals(base, delta = {}) {
  const out = {}
  for (const id of PETAL_IDS) {
    const v = (base[id] ?? 0.5) + (delta[id] ?? 0)
    out[id] = Math.round(Math.min(0.95, Math.max(0.15, v)) * 100) / 100
  }
  return out
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function fmtSqlDate(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/** Personas salariés — profils et notes cohérentes pour la démo. */
const TEAMS = [
  { name: 'Produit & Design', slug: 'produit' },
  { name: 'Relation client', slug: 'support' },
  { name: 'Opérations', slug: 'ops' },
]

const EMPLOYEES = [
  {
    firstName: 'Marie',
    lastName: 'Dupont',
    email: `marie.dupont@${DEMO_EMAIL_DOMAIN}`,
    role: 'rh',
    team: 'ops',
    title: 'RRH — pilote QVT',
    petals: { agape: 0.78, philautia: 0.72, mania: 0.35, storge: 0.8, pragma: 0.75, philia: 0.82, ludus: 0.55, eros: 0.6 },
    moodBase: 4,
    moodTrend: 0,
    notes: [
      'Bonne dynamique globale, quelques signaux de charge côté Produit à suivre.',
      'Campagne pulse bien accueillie — taux de réponse en hausse.',
      'Point avec les managers la semaine prochaine sur la reconnaissance.',
    ],
  },
  {
    firstName: 'Thomas',
    lastName: 'Leroy',
    email: `thomas.leroy@${DEMO_EMAIL_DOMAIN}`,
    role: 'manager',
    team: 'produit',
    title: 'Manager Produit',
    petals: { agape: 0.7, philautia: 0.58, mania: 0.55, storge: 0.68, pragma: 0.72, philia: 0.75, ludus: 0.7, eros: 0.65 },
    moodBase: 3,
    moodTrend: -0.15,
    notes: [
      'Sprint dense mais l’équipe tient le cap. Besoin de clarifier les priorités Q3.',
      'Un peu fatigué en fin de semaine — la charge est réelle sur le design system.',
      'Rétro équipe positive : on a enfin célébré les livraisons.',
      'Tension sur un deadline client — j’ai repriorisé avec Sophie.',
    ],
  },
  {
    firstName: 'Sophie',
    lastName: 'Martin',
    email: `sophie.martin@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'produit',
    title: 'Designer UX',
    petals: { agape: 0.72, philautia: 0.65, mania: 0.4, storge: 0.74, pragma: 0.6, philia: 0.78, ludus: 0.85, eros: 0.7 },
    moodBase: 4,
    moodTrend: 0.05,
    notes: [
      'Atelier co-design très stimulant avec le client — fière du résultat.',
      'J’aurais besoin de plages sans réunion pour avancer sur les maquettes.',
      'Belle entraide avec Lucas sur le prototype mobile.',
    ],
  },
  {
    firstName: 'Lucas',
    lastName: 'Bernard',
    email: `lucas.bernard@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'produit',
    title: 'Développeur',
    petals: { agape: 0.55, philautia: 0.42, mania: 0.62, storge: 0.58, pragma: 0.65, philia: 0.6, ludus: 0.5, eros: 0.55 },
    moodBase: 2,
    moodTrend: -0.2,
    notes: [
      'Charge élevée — je finis tard trois soirs de suite.',
      'Difficile de dire non aux urgences, je m’épuise un peu.',
      'Merci à Antoine pour le pair programming, ça m’a débloqué.',
      'Un peu mieux cette semaine après la réorganisation du backlog.',
    ],
  },
  {
    firstName: 'Emma',
    lastName: 'Petit',
    email: `emma.petit@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'produit',
    title: 'Product Owner',
    petals: { agape: 0.8, philautia: 0.68, mania: 0.45, storge: 0.72, pragma: 0.78, philia: 0.8, ludus: 0.62, eros: 0.68 },
    moodBase: 4,
    moodTrend: 0,
    notes: [
      'Roadmap clarifiée — l’équipe respire un peu.',
      'Bonne collaboration avec le support sur les retours clients.',
      'Pulse utile pour remonter les irritants sans réunion lourde.',
    ],
  },
  {
    firstName: 'Julie',
    lastName: 'Moreau',
    email: `julie.moreau@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'produit',
    title: 'Designer UI',
    petals: { agape: 0.68, philautia: 0.7, mania: 0.38, storge: 0.76, pragma: 0.58, philia: 0.82, ludus: 0.8, eros: 0.62 },
    moodBase: 4,
    moodTrend: 0.1,
    notes: [
      'Ambiance d’équipe au top — café du vendredi apprécié.',
      'Quelques allers-retours avec la prod, mais on s’écoute bien.',
    ],
  },
  {
    firstName: 'Antoine',
    lastName: 'Garcia',
    email: `antoine.garcia@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'produit',
    title: 'Dev senior',
    petals: { agape: 0.65, philautia: 0.75, mania: 0.35, storge: 0.7, pragma: 0.7, philia: 0.85, ludus: 0.55, eros: 0.6 },
    moodBase: 4,
    moodTrend: 0,
    notes: [
      'Content d’accompagner Lucas — le mentorat me motive.',
      'Documentation technique en progrès, moins de stress au déploiement.',
    ],
  },
  {
    firstName: 'Karim',
    lastName: 'Hassan',
    email: `karim.hassan@${DEMO_EMAIL_DOMAIN}`,
    role: 'manager',
    team: 'support',
    title: 'Manager relation client',
    petals: { agape: 0.6, philautia: 0.5, mania: 0.72, storge: 0.55, pragma: 0.68, philia: 0.65, ludus: 0.4, eros: 0.58 },
    moodBase: 3,
    moodTrend: -0.1,
    notes: [
      'Volume d’appels en hausse — l’équipe est solide mais tendue.',
      'On a instauré une pause collective à 11h, ça aide.',
      'Besoin de renfort sur le week-end prochain.',
    ],
  },
  {
    firstName: 'Claire',
    lastName: 'Rousseau',
    email: `claire.rousseau@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'support',
    title: 'Conseillère clientèle',
    petals: { agape: 0.62, philautia: 0.48, mania: 0.68, storge: 0.52, pragma: 0.55, philia: 0.7, ludus: 0.35, eros: 0.45 },
    moodBase: 3,
    moodTrend: -0.05,
    notes: [
      'Journées répétitives — je manque de variété dans les tâches.',
      'Un client difficile m’a épuisée hier, soutien de Fatima apprécié.',
      'La nouvelle base de connaissance commence à faire gagner du temps.',
    ],
  },
  {
    firstName: 'Nicolas',
    lastName: 'Blanc',
    email: `nicolas.blanc@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'support',
    title: 'Conseiller clientèle',
    petals: { agape: 0.58, philautia: 0.55, mania: 0.55, storge: 0.62, pragma: 0.6, philia: 0.72, ludus: 0.45, eros: 0.5 },
    moodBase: 3,
    moodTrend: 0.15,
    notes: [
      'Formation outils CRM — je me sens plus à l’aise.',
      'Meilleure semaine, objectifs atteints sans heure sup.',
    ],
  },
  {
    firstName: 'Fatima',
    lastName: 'El Amrani',
    email: `fatima.el-amrani@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'support',
    title: 'Conseillère senior',
    petals: { agape: 0.75, philautia: 0.52, mania: 0.6, storge: 0.68, pragma: 0.58, philia: 0.88, ludus: 0.42, eros: 0.55 },
    moodBase: 3,
    moodTrend: -0.05,
    notes: [
      'Beaucoup d’empathie demandée — je veille à mes limites.',
      'Fière d’avoir débloqué un dossier complexe pour une cliente.',
      'Karim a reconnu le travail de l’équipe en réunion, ça fait du bien.',
    ],
  },
  {
    firstName: 'Paul',
    lastName: 'Girard',
    email: `paul.girard@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'support',
    title: 'Conseiller junior',
    petals: { agape: 0.55, philautia: 0.62, mania: 0.48, storge: 0.78, pragma: 0.5, philia: 0.75, ludus: 0.55, eros: 0.48 },
    moodBase: 4,
    moodTrend: 0.1,
    notes: [
      'Premier mois terminé — je me sens accueilli.',
      'Encore un peu stressé au téléphone mais ça progresse.',
    ],
  },
  {
    firstName: 'Hélène',
    lastName: 'Marchand',
    email: `helene.marchand@${DEMO_EMAIL_DOMAIN}`,
    role: 'manager',
    team: 'ops',
    title: 'Responsable opérations',
    petals: { agape: 0.65, philautia: 0.7, mania: 0.4, storge: 0.72, pragma: 0.88, philia: 0.68, ludus: 0.45, eros: 0.55 },
    moodBase: 4,
    moodTrend: 0,
    notes: [
      'Processus logistique stabilisé après le pic de commandes.',
      'Bonne coordination avec Produit sur les délais de livraison.',
    ],
  },
  {
    firstName: 'David',
    lastName: 'Nguyen',
    email: `david.nguyen@${DEMO_EMAIL_DOMAIN}`,
    role: 'member',
    team: 'ops',
    title: 'Coordinateur logistique',
    petals: { agape: 0.6, philautia: 0.68, mania: 0.42, storge: 0.74, pragma: 0.8, philia: 0.65, ludus: 0.4, eros: 0.5 },
    moodBase: 4,
    moodTrend: 0,
    notes: [
      'Semaine fluide — stocks maîtrisés.',
      'Petit souci transporteur résolu rapidement en équipe.',
    ],
  },
]

const CHARTER = `Bienvenue dans l’espace Mycelium des Ateliers du Littoral.

Nous utilisons ces pulses anonymisés pour améliorer la qualité de vie au travail — pas pour évaluer individuellement. Vos réponses agrégées (seuil de confidentialité : 5 personnes minimum) alimentent un dialogue avec les managers et les RH.

Merci de partager avec sincérité et bienveillance.`

const PULSE_CAMPAIGN = {
  title: 'Pulse de la semaine — été 2026',
  message:
    'Prenez deux minutes pour dire comment vous vous sentez au travail cette semaine. Vos réponses restent anonymes dans les tableaux de bord.',
  question: 'Qu’est-ce qui vous a le plus nourri — ou le plus pesé — cette semaine ?',
  startedAt: new Date().toISOString(),
  active: true,
}

const DEMO_SYNTHESIS = {
  summary:
    "Sur les 30 derniers jours, l'humeur moyenne se situe autour de 3,4/5 avec une participation d'environ 75 % des membres. L'équipe Produit montre des signaux de charge (alignement / intégrité en léger recul) tandis que le Support fait face à une intensité soutenue. Les Opérations restent stables. La reconnaissance managériale et les pauses collectives sont perçues positivement.",
  actions: [
    'Organiser un point charge & priorités avec Produit & Design sous quinzaine.',
    'Renforcer les rituels de reconnaissance côté Relation client (volume en hausse).',
    'Poursuivre la campagne pulse hebdomadaire — le taux de réponse progresse.',
  ],
  cached_at: new Date().toISOString(),
  provider: 'demo',
}

async function ensureUser(pool, prefix, email, displayName, passwordHash) {
  const usersTbl = `${prefix}users`
  const metaTbl = `${prefix}usermeta`
  const [rows] = await pool.execute(`SELECT ID FROM ${usersTbl} WHERE user_email = ? LIMIT 1`, [email])
  if (rows.length) return Number(rows[0].ID)

  const baseLogin = email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').slice(0, 40)
  let userLogin = baseLogin
  let n = 0
  while (true) {
    const [dup] = await pool.execute(`SELECT 1 FROM ${usersTbl} WHERE user_login = ? LIMIT 1`, [userLogin])
    if (!dup.length) break
    userLogin = `${baseLogin}${++n}`
  }
  const now = fmtSqlDate(new Date())
  const [ins] = await pool.execute(
    `INSERT INTO ${usersTbl} (user_login, user_pass, user_nicename, user_email, user_registered, user_status, display_name)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [userLogin, passwordHash, displayName.replace(/[^a-z0-9\s\-_]/gi, '').slice(0, 50), email, now, displayName]
  )
  const userId = Number(ins.insertId)
  await pool.execute(`INSERT INTO ${metaTbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
    userId,
    `${prefix}capabilities`,
    `a:1:{s:10:"subscriber";i:1;}`,
  ])
  await pool.execute(`INSERT INTO ${metaTbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
    userId,
    `${prefix}user_level`,
    '0',
  ])
  await pool.execute(`INSERT INTO ${metaTbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
    userId,
    'fleur_profile_public',
    '1',
  ])
  return userId
}

async function cleanupDemo(pool, prefix) {
  const orgTbl = `${prefix}fleur_organisations`
  const [orgs] = await pool.execute(`SELECT id FROM ${orgTbl} WHERE name = ? LIMIT 1`, [DEMO_ORG_NAME])
  if (orgs.length) {
    const orgId = Number(orgs[0].id)
    const tables = [
      `${prefix}fleur_timeline_events`,
      `${prefix}fleur_mycelium_checkins`,
      `${prefix}fleur_mycelium_profiles`,
      `${prefix}fleur_mycelium_synthesis`,
      `${prefix}fleur_org_invites`,
      `${prefix}fleur_memberships`,
      `${prefix}fleur_teams`,
      `${prefix}fleur_org_seats`,
    ]
    for (const tbl of tables) {
      try {
        if (tbl.includes('timeline') || tbl.includes('checkins') || tbl.includes('profiles') || tbl.includes('synthesis')) {
          await pool.execute(`DELETE FROM ${tbl} WHERE org_id = ?`, [orgId])
        } else if (tbl.includes('invites') || tbl.includes('memberships') || tbl.includes('teams') || tbl.includes('seats')) {
          await pool.execute(`DELETE FROM ${tbl} WHERE org_id = ?`, [orgId])
        }
      } catch {
        /* table absente */
      }
    }
    await pool.execute(`DELETE FROM ${orgTbl} WHERE id = ?`, [orgId])
    console.log(`✓ Organisation démo supprimée (id=${orgId})`)
  }

  const usersTbl = `${prefix}users`
  const [demoUsers] = await pool.execute(`SELECT ID FROM ${usersTbl} WHERE user_email LIKE ?`, [`%@${DEMO_EMAIL_DOMAIN}`])
  for (const u of demoUsers) {
    const uid = Number(u.ID)
    await pool.execute(`DELETE FROM ${prefix}fleur_memberships WHERE user_id = ?`, [uid]).catch(() => {})
    await pool.execute(`DELETE FROM ${prefix}usermeta WHERE user_id = ?`, [uid]).catch(() => {})
    await pool.execute(`DELETE FROM ${usersTbl} WHERE ID = ?`, [uid])
  }
  if (demoUsers.length) console.log(`✓ ${demoUsers.length} comptes démo supprimés`)
}

async function main() {
  const env = loadEnv()
  const { adminEmail, reset } = parseArgs(env)
  const prefix = env.DB_PREFIX || 'wp_'
  const DB_HOST = env.MARIADB_HOST || (env.TUNNEL_LOCAL_PORT ? '127.0.0.1' : env.DB_HOST) || 'localhost'
  const DB_PORT = parseInt(env.MARIADB_PORT || env.TUNNEL_LOCAL_PORT || env.DB_PORT || '3307', 10)
  const DB_NAME = env.MARIADB_DATABASE || env.DB_NAME || env.LOCAL_DB || 'default'
  const DB_USER = env.MARIADB_USER || env.DB_USER || env.LOCAL_USER || 'mariadb'
  const DB_PASSWORD = env.MARIADB_PASSWORD || env.LOCAL_PASS || env.DB_PASS || ''

  if (!DB_PASSWORD) {
    console.error('❌ Mot de passe DB manquant (docker-compose.env / .env)')
    process.exit(1)
  }

  const pool = createPool({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD })

  if (reset) {
    await cleanupDemo(pool, prefix)
    console.log('Reset terminé.')
    await pool.end()
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  // Tables minimales (alignées sur db-organisations / db-mycelium)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_organisations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      owner_user_id INT NOT NULL,
      charter TEXT DEFAULT NULL,
      pulse_campaign_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  for (const col of ['charter TEXT DEFAULT NULL', 'pulse_campaign_json TEXT DEFAULT NULL']) {
    await pool.execute(`ALTER TABLE ${prefix}fleur_organisations ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {})
  }
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_teams (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id INT NOT NULL, name VARCHAR(160) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_memberships (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id INT NOT NULL, team_id INT DEFAULT NULL,
      user_id INT NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_org_user (org_id, user_id), INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_org_seats (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id INT NOT NULL, seats INT NOT NULL DEFAULT 0,
      stripe_subscription_id VARCHAR(80) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_org_invites (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id INT NOT NULL, email VARCHAR(190) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'member', team_id INT DEFAULT NULL,
      token VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_token (token), INDEX idx_org_status (org_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_mycelium_checkins (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, org_id INT NOT NULL,
      team_id INT DEFAULT NULL, mood TINYINT NOT NULL DEFAULT 3, note VARCHAR(500) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_org_created (org_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_mycelium_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, org_id INT NOT NULL,
      petals_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_org (user_id, org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_timeline_events (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, source VARCHAR(24) NOT NULL,
      ref_id INT DEFAULT NULL, title VARCHAR(255) NOT NULL DEFAULT '', summary TEXT DEFAULT NULL,
      petals_json TEXT DEFAULT NULL, mood TINYINT DEFAULT NULL,
      org_id INT DEFAULT NULL, team_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_user_source_ref (user_id, source, ref_id),
      INDEX idx_org_team (org_id, team_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_mycelium_synthesis (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id INT NOT NULL, team_id INT DEFAULT NULL,
      window_days INT NOT NULL DEFAULT 30, signature VARCHAR(64) NOT NULL,
      synthesis_json TEXT NOT NULL, cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_cache (org_id, team_id, window_days, signature)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const [existingOrg] = await pool.execute(`SELECT id FROM ${prefix}fleur_organisations WHERE name = ? LIMIT 1`, [
    DEMO_ORG_NAME,
  ])
  if (existingOrg.length) {
    console.error(`❌ L'organisation « ${DEMO_ORG_NAME} » existe déjà. Relancez avec --reset pour regénérer.`)
    process.exit(1)
  }

  // Admin existant = owner (retire autre membership éventuelle pour la démo)
  const [adminRows] = await pool.execute(`SELECT ID, display_name FROM ${prefix}users WHERE user_email = ? LIMIT 1`, [
    adminEmail,
  ])
  if (!adminRows.length) {
    console.error(`❌ Compte admin introuvable : ${adminEmail}`)
    process.exit(1)
  }
  const adminId = Number(adminRows[0].ID)
  await pool.execute(`DELETE FROM ${prefix}fleur_memberships WHERE user_id = ?`, [adminId])
  console.log(`✓ Owner : ${adminEmail} (id=${adminId})`)

  const [orgIns] = await pool.execute(
    `INSERT INTO ${prefix}fleur_organisations (name, owner_user_id, charter, pulse_campaign_json) VALUES (?, ?, ?, ?)`,
    [DEMO_ORG_NAME, adminId, CHARTER, JSON.stringify(PULSE_CAMPAIGN)]
  )
  const orgId = Number(orgIns.insertId)

  await pool.execute(
    `INSERT INTO ${prefix}fleur_memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`,
    [orgId, adminId]
  )
  await pool.execute(
    `INSERT INTO ${prefix}fleur_org_seats (org_id, seats) VALUES (?, ?) ON DUPLICATE KEY UPDATE seats = VALUES(seats)`,
    [orgId, 25]
  )

  const teamIds = {}
  for (const t of TEAMS) {
    const [r] = await pool.execute(`INSERT INTO ${prefix}fleur_teams (org_id, name) VALUES (?, ?)`, [orgId, t.name])
    teamIds[t.slug] = Number(r.insertId)
  }

  const userIds = {}
  for (const emp of EMPLOYEES) {
    const displayName = `${emp.firstName} ${emp.lastName}`
    const uid = await ensureUser(pool, prefix, emp.email, displayName, passwordHash)
    userIds[emp.email] = uid
    const teamId = teamIds[emp.team]
    await pool.execute(
      `INSERT INTO ${prefix}fleur_memberships (org_id, team_id, user_id, role) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), role = VALUES(role)`,
      [orgId, teamId, uid, emp.role]
    )
    await pool.execute(
      `INSERT INTO ${prefix}fleur_mycelium_profiles (user_id, org_id, petals_json) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE petals_json = VALUES(petals_json)`,
      [uid, orgId, JSON.stringify(emp.petals)]
    )
    await pool.execute(
      `INSERT INTO ${prefix}fleur_timeline_events (user_id, source, ref_id, title, summary, petals_json, mood, org_id, team_id, created_at)
       VALUES (?, 'onboarding', ?, ?, ?, ?, NULL, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [
        uid,
        orgId,
        'Profil au travail',
        `${emp.title} — cartographie enregistrée.`,
        JSON.stringify(petalsToArray(emp.petals)),
        orgId,
        teamId,
        fmtSqlDate(addDays(new Date(), -75)),
      ]
    )
  }

  // Invitations en attente (vue admin)
  const pendingInvites = [
    { email: 'nouveau.collegue@example.com', role: 'member', team: 'produit' },
    { email: 'stagiaire.support@example.com', role: 'member', team: 'support' },
  ]
  for (const inv of pendingInvites) {
    const token = randomBytes(24).toString('hex')
    await pool.execute(
      `INSERT INTO ${prefix}fleur_org_invites (org_id, email, role, team_id, token, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [orgId, inv.email, inv.role, teamIds[inv.team], token]
    )
  }

  const today = new Date()
  let checkinCount = 0
  let timelineCount = 0

  /** Prochain mardi (ou jour ouvré) à partir d'une date — évite que tout tombe un week-end. */
  function toWeekday(d) {
    const x = new Date(d)
    while (x.getDay() === 0 || x.getDay() === 6) {
      x.setDate(x.getDate() + 1)
    }
    return x
  }

  for (const emp of EMPLOYEES) {
    const uid = userIds[emp.email]
    const teamId = teamIds[emp.team]
    const weeksBack = emp.role === 'rh' ? 8 : 12

    for (let w = 0; w < weeksBack; w++) {
      const d = toWeekday(addDays(today, -(w * 7 + 3)))
      const dayOffset = Math.round((d.getTime() - today.getTime()) / 86400000)
      const periodFactor = dayOffset > -30 ? emp.moodTrend : -emp.moodTrend * 0.5
      const wave = Math.sin(w * 0.9 + emp.firstName.length) * 0.35
      let mood = Math.round(emp.moodBase + periodFactor + wave)
      mood = Math.min(5, Math.max(1, mood))

      const note = emp.notes[w % emp.notes.length]
      const petalShift =
        dayOffset > -30
          ? { philautia: emp.moodTrend < 0 ? -0.06 : 0, storge: emp.moodTrend < 0 ? -0.04 : 0, agape: -0.02 }
          : { philautia: 0.05, storge: 0.03, agape: 0.02 }
      const pulsePetals = clampPetals(emp.petals, petalShift)

      const [cIns] = await pool.execute(
        `INSERT INTO ${prefix}fleur_mycelium_checkins (user_id, org_id, team_id, mood, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [uid, orgId, teamId, mood, note, fmtSqlDate(d)]
      )
      const checkinId = Number(cIns.insertId)
      checkinCount++

      await pool.execute(
        `INSERT INTO ${prefix}fleur_timeline_events (user_id, source, ref_id, title, summary, petals_json, mood, org_id, team_id, created_at)
         VALUES (?, 'checkin', ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mood = VALUES(mood)`,
        [
          uid,
          checkinId,
          'Pulse bien-être pro',
          note,
          JSON.stringify(petalsToArray(pulsePetals)),
          mood,
          orgId,
          teamId,
          fmtSqlDate(d),
        ]
      )
      timelineCount++
    }
  }

  // Synthèse RH pré-calculée (évite l'appel IA en démo)
  await pool.execute(
    `INSERT INTO ${prefix}fleur_mycelium_synthesis (org_id, team_id, window_days, signature, synthesis_json)
     VALUES (?, NULL, 30, ?, ?)
     ON DUPLICATE KEY UPDATE synthesis_json = VALUES(synthesis_json)`,
    [orgId, 'demo_v1', JSON.stringify(DEMO_SYNTHESIS)]
  )

  console.log('\n✅ Jeu de données Mycelium créé\n')
  console.log(`Organisation : ${DEMO_ORG_NAME} (id=${orgId})`)
  console.log(`Membres      : ${EMPLOYEES.length} (+ owner admin)`)
  console.log(`Équipes      : ${TEAMS.map((t) => t.name).join(', ')}`)
  console.log(`Pulses       : ${checkinCount} check-ins / ${timelineCount} événements timeline`)
  console.log(`Invitations  : ${pendingInvites.length} en attente`)
  console.log(`\n── Connexion RH / admin (tableau de bord) ──`)
  console.log(`  ${adminEmail}  →  votre compte (owner + admin app)`)
  console.log(`\n── Connexion salariés (Mon jardin pro) ──`)
  console.log(`  Mot de passe commun : ${DEMO_PASSWORD}`)
  for (const emp of EMPLOYEES.slice(0, 5)) {
    console.log(`  ${emp.email}  (${emp.title})`)
  }
  console.log(`  … et ${EMPLOYEES.length - 5} autres comptes @${DEMO_EMAIL_DOMAIN}`)
  console.log(`\nURLs : /jardin/mycelium/dashboard · /jardin/mycelium/espace · /jardin/mycelium/admin`)
  console.log(`Reset : node scripts/seed-mycelium-demo.js --reset\n`)

  await pool.end()
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
