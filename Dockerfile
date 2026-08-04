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

# Nota geral (nao usada agora, mas vale lembrar pra qualquer var NEXT_PUBLIC_* futura): elas sao
# inlinadas no bundle client durante `next build`, que roda AQUI dentro do build da imagem — nao em
# runtime. Setar so no `environment:` do compose (sem passar por ARG/ENV antes deste RUN) deixa a
# var sempre vazia no bundle publicado, sem erro nenhum. A chave publica de licenca especificamente
# NAO usa mais esse mecanismo — o cliente busca ela em runtime via /api/license/public-key, sem
# depender de build arg (ver src/client/license/verify-capability-token.ts).
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
