# Configuration du paiement (Stripe) et SAP

## 1. Variables d'environnement

Dans `.env` ou Coolify :

- `STRIPE_SECRET_KEY` : clé secrète (sk_test_… ou sk_live_…)
- `STRIPE_WEBHOOK_SECRET` : secret du webhook (whsec_…), **obligatoire** pour créditer le wallet SAP après paiement
- `STRIPE_PRICE_MONTHLY` : Price ID de l'abonnement mensuel
- `STRIPE_PRICE_YEARLY` : Price ID de l'abonnement annuel
- `STRIPE_PRICE_CREDITS_100` : Price ID du pack 100 crédits
- `STRIPE_PRICE_SAP_10`, `STRIPE_PRICE_SAP_50`, `STRIPE_PRICE_SAP_100` : Price ID des packs SAP (boutique)
- `SAP_BONUS_COACH_MAX_PER_HOUR` (optionnel, défaut `120`) : plafond de bonus SAP manuels par coach et par heure

## 2. Base de données

Les tables billing et SAP sont créées au premier appel (API Next.js). Pour une migration manuelle, voir `next/sql/fleur-sap-migration.sql`.

## 3. Produits

Les produits sont définis dans `next/src/data/billing-products.json`. Les Price ID sont lus depuis les variables d'environnement (`price_id_env`).

## 4. Webhook Stripe

Dans le [Dashboard Stripe](https://dashboard.stripe.com) :

- **URL** (avec basePath Jardin) : `https://votre-domaine.com/jardin/api/billing/stripe-webhook`
- **Événements** :
  - `checkout.session.completed` — crédite le wallet SAP (métadonnées `user_id`, `sap_units` ou `product_id` = `sap_10` / `sap_50` / `sap_100`)
  - `charge.refunded` — retire du SAP au prorata du montant remboursé (métadonnées sur le PaymentIntent)

L’idempotence est assurée par la table `wp_fleur_stripe_webhook_events` (un traitement par `event.id`).

## 5. Cohérence Sablier / Cristal / SAP

Le crédit admin (**Créditer la Sève** dans l’admin utilisateurs) met à jour `fleur_users_access` **et** ajoute la même quantité au wallet SAP unifié (y compris le +20 Sablier bonus lors du passage des 200 Cristal cumulés). En cas d’échec SAP seul, la réponse JSON peut contenir `sap_wallet_sync_error`.
