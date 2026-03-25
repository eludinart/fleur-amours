# ============================================================
# Fleur d'AmOurs — Stack Node.js (VPS = source unique)
# Next.js + MariaDB — pas de PHP
# ============================================================

# Stage 1: Build Next.js
FROM node:20-slim AS next-build
WORKDIR /app

ARG NEXT_PUBLIC_APP_URL=https://app-fleurdamours.eludein.art/jardin
ARG NEXT_PUBLIC_API_URL=
ARG GIT_COMMIT=unknown
ARG SOURCE_COMMIT=unknown
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# Vide = même origine (VPS app-fleurdamours) — n'appelle plus www.eludein.art
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV USE_NODE_API=true

# Ne pas utiliser l'export statique (on garde les routes API Next.js)
ENV CAPACITOR_BUILD=

# Install dependencies
COPY next/package*.json ./next/
RUN cd next && npm ci

# Copy source
COPY next/ ./next/

# Copier les cartes et données dans public (servies par Next.js)
COPY ["FRAMEWORK DOCS/CARTES/", "./next/public/cartes/"]
COPY ["RESULTAT/all_cards.json", "./next/public/api/data/"]
COPY ["FRAMEWORK SCIENCE/SCIENCE/", "./next/public/api/data/science/"]

# Version : version.json (incrément manuel) + commit Git (legacy)
RUN COMMIT=$SOURCE_COMMIT; [ "$COMMIT" = "unknown" ] && COMMIT=$GIT_COMMIT; \
    VER=$(node -e "try{console.log(require('./next/public/version.json').version)}catch(e){console.log('0.1.0')}"); \
    echo "{\"version\":\"$VER\",\"commit\":\"$COMMIT\"}" > ./next/public/build-info.json

RUN cd next && npm run build

# Stage 2: Runtime
FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

# Copier le build standalone Next.js
COPY --from=next-build /app/next/.next/standalone ./
COPY --from=next-build /app/next/.next/static ./.next/static
COPY --from=next-build /app/next/public ./public

# Variables d'environnement runtime (override dans Coolify / docker-compose)
ENV USE_NODE_API=true
ENV JWT_SECRET=
ENV JWT_EXPIRE_HOURS=720

# DB (MariaDB)
ENV DB_HOST=mariadb
ENV DB_NAME=default
ENV DB_USER=mariadb
ENV DB_PASSWORD=
ENV DB_PREFIX=wp_

# IA, Stripe, etc.
ENV OPENROUTER_API_KEY=
ENV OPENROUTER_MODEL=
ENV STRIPE_SECRET_KEY=
ENV STRIPE_WEBHOOK_SECRET=

EXPOSE 3000

CMD ["node", "server.js"]
