# ---------------------------------------------------------------------------
# DanielLive — imagem de produção com site e WebSocket na mesma porta.
#
# As salas vivem em memória: manter uma única instância. O banco das contas
# fica em /app/dados, que precisa de volume ou pasta persistente no host.
# ---------------------------------------------------------------------------

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Variáveis públicas embutidas no build. A sinalização deduz o domínio quando vazia.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SIGNAL_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SIGNAL_URL=${NEXT_PUBLIC_SIGNAL_URL}
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# A sinalização é servida no mesmo host por padrão; o build não precisa dela.
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DANIELLIVE_DB=/app/dados/daniellive.db

# Só o necessário para rodar: código, build, dependências de produção.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/server ./server

# Usuário sem privilégio: o processo não precisa de root para nada.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && mkdir -p /app/dados \
    && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
VOLUME ["/app/dados"]

# Confere a mesma porta que serve o site e o WebSocket (/ws).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Não depende do concurrently, que só existe nas dependências de desenvolvimento.
CMD ["node", "server/publico.mjs"]
