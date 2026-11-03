# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ─── Development (hot reload via ts-node-dev) ─────────────────────────────────
FROM base AS development
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]

# ─── Builder (compila TypeScript) ─────────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
ENV NODE_ENV=production
CMD ["node", "dist/src/server.js"]
