# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* sao inlinados no bundle client durante `next build`, que roda
# AQUI dentro do build da imagem — nao em runtime. Se uma var NEXT_PUBLIC_*
# for setada so no `environment:` do compose (sem passar por ARG/ENV antes
# deste RUN), ela fica sempre vazia no bundle publicado, sem erro nenhum.
ARG NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY
ENV NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY=${NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY}

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /data/meshes && chown -R nextjs:nodejs /data/meshes

USER nextjs

ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node", "server.js"]
