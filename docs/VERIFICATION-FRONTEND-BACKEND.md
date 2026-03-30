# Vérification Frontend ↔ Backend — Fleur d'AmOurs

**Stack** : Next.js + MariaDB (Node uniquement)

---

## Routes API Next.js

| Route | Description |
|-------|-------------|
| `POST /api/auth/login` | Connexion MariaDB (schéma/auth hérités WordPress-like) |
| `POST /api/auth/refresh` | Rafraîchissement JWT |
| `GET /api/auth/me` | Utilisateur courant |
| `GET /api/ai/status` | Statut OpenRouter |
| `POST /api/ai/threshold` | Seuil de porte |
| `POST /api/ai/tuteur` | Dialogue Tuteur |
| `POST /api/sessions/save` | Sauvegarde session |
| `GET /api/sessions/my` | Sessions utilisateur |
| … | Voir `next/src/app/api/` |

---

## Données

- **Cartes** : `next/public/api/data/all_cards.json`
- **Prompts** : `next/public/api/data/prompts-overrides.json` ou DB
- **Produits Stripe** : `next/src/data/billing-products.json`

---

## Checklist production

- [ ] Variables `MARIADB_*`, `JWT_SECRET`, `OPENROUTER_API_KEY`
- [ ] `next/public/api/data/all_cards.json` présent
- [ ] Stripe : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Price IDs
