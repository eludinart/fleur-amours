---
name: fleur-damours
description: Domaine Fleur d'AmOurs — tarot / cartographie systémique, app Jardin Next.js, Capacitor Android, MariaDB Coolify, pages WordPress eludein.art. Repo github.com/eludinart/fleur-amours.
icon: beaker
color: magenta
---

# Fleur d'AmOurs

Système de **cartographie systémique** (pas un oracle prédictif). Objectif : rendre lisibles les dynamiques relationnelles / de projet via cartes, tirages et visualisations.

Charger aussi `ecosysteme-elude` (carte studio) et `hermes-vps` (ops / SQL readonly Hermes).

## Repo & chemins

| | |
| --- | --- |
| **GitHub** | https://github.com/eludinart/fleur-amours |
| **Clone** | `https://github.com/eludinart/fleur-amours.git` |
| **Workspace local typique** | `c:\workspace` |
| **Dev** | `npm run dev.vps` → http://localhost:3001 |
| **Prod app** | https://app-fleurdamours.eludein.art/jardin |
| **Site / parcours** | https://eludein.art/le-tarot-fleur-damours/ |

## Stack

- **Next.js** (dossier `next/`) + scripts racine
- **MariaDB** Coolify (tables `wp_fleur_*`, `wp_users`) — tunnel SSH pour le dev
- **WordPress** eludein.art pour marketing, boutique, tirages, espace pro
- **Capacitor** Android (APK / push)
- Auth liée WP possible (`auth-wordpress.ts`)
- Déploiement : **Coolify** sur VPS `187.124.42.135`

Références : [references/modele-metier.md](references/modele-metier.md), [references/surfaces.md](references/surfaces.md).

## Principes produit

1. **Pas de prédiction** — boussole / cartographie / clarté structurelle.
2. Vocabulaire : jardin, fleur, portes, cycles, circulation, sève.
3. Modes : choix conscient **ou** tirage.
4. Multi-contextes : individu, couple, facilitation, orgs — sans juger la forme.
5. Orthographes produit (*Fleur d'AmOurs* / *ÅmÔurs* / *Amours*) : **préserver celle de la surface éditée**.

## Modèle (résumé)

- **8 formes d'amour** : Philautia, Storge, Philia, Eros, Ludus, Pragma, Agape, Mania.
- Tirages : 1 carte · 4 Portes · fleur individuelle · fleur relationnelle.
- Détail : `references/modele-metier.md`.

## Instructions agent

1. Travailler dans **eludinart/fleur-amours** ; ne pas regenerer l'app dans le repo skills.
2. Identifier la surface (Jardin Next vs WP vs Woo vs Capacitor) avant de coder.
3. Secrets (`sync-config.env`, `.env.local`) hors git.
4. Hermes lit la DB Fleur en **readonly** (`fleur-sql.sh`) — ne pas faire écrire Hermes dans le métier.
5. Ports : Fleur tunnel/dev **3001** — ne pas mélanger avec Mandala **3002** / Korymb **3000**.

## Hors scope

Korymb, Mandala, OpenPlotter — sauf rattachement explicite.
