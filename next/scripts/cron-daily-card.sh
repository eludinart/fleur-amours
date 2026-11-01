#!/bin/sh
# Cron Coolify — carte du jour (matin Paris, fenêtre 7–11h côté API)
set -eu
echo "[cron-daily-card] CRON_SECRET=${CRON_SECRET:+ok}${CRON_SECRET:-MANQUANT}"
if [ ! -f /app/cron-daily-card.mjs ]; then
  echo "[cron-daily-card] ERREUR: /app/cron-daily-card.mjs introuvable — redéployer sans cache"
  exit 1
fi
node /app/cron-daily-card.mjs "$@"
