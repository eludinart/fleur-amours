# Configuration du paiement (Stripe)

## 1. Variables d'environnement

Dans `.env` ou Coolify :

- `STRIPE_SECRET_KEY` : clé secrète (sk_test_… ou sk_live_…)
- `STRIPE_WEBHOOK_SECRET` : secret du webhook (whsec_…)
- `STRIPE_PRICE_MONTHLY` : Price ID de l'abonnement mensuel
- `STRIPE_PRICE_YEARLY` : Price ID de l'abonnement annuel
- `STRIPE_PRICE_CREDITS_100` : Price ID du pack 100 crédits

## 2. Base de données

Les tables billing sont créées automatiquement au premier appel (Next.js API).

## 3. Produits

Les produits sont définis dans `next/src/data/billing-products.json`. Les Price ID sont lus depuis les variables d'environnement (voir `price_id_env` dans le JSON).

## 4. Webhook Stripe

Dans le [Dashboard Stripe](https://dashboard.stripe.com) :
- Configurer le webhook : `https://votre-domaine.com/jardin/api/billing/webhook` (ou équivalent)
- Événements : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
