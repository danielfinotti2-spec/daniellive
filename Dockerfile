# ---------------------------------------------------------------------------
# ScreenLive — imagem de produção.
#
# Um único contêiner roda as duas partes (site e sinalização) sob o mesmo
# processo pai, porque a sinalização é stateful em memória: uma réplica dela
# isolada perderia as salas. Escalar horizontalmente exige um adaptador de
# pub/sub (ver "Limitações conhecidas" no README).
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# A sinalização é servida no mesmo host por padrão; o build não precisa dela.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Só o necessário para rodar: código, build, dependências de produção.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/server ./server

# Usuário sem privilégio: o processo não precisa de root para nada.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000 8787

# O healthcheck bate no endpoint da sinalização, que é o processo que costuma
# morrer primeiro (dependência de porta e de rede).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `npm start` usa concurrently para subir site e sinalização juntos.
CMD ["npm", "start"]
