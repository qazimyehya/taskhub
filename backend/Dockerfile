# ── build ────────────────────────────────────────────────
FROM node:20-slim AS build

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build
# keep only runtime dependencies (prisma CLI stays: it runs the migrations at startup)
RUN npm prune --omit=dev

# ── runtime ──────────────────────────────────────────────
FROM node:20-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts ./scripts

# don't run as root
USER node

EXPOSE 3001

# migrate (as the DB owner), set the app role's password, then start the API
CMD ["sh", "-c", "npm run db:migrate && node dist/server.js"]
