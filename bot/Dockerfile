# Bot do DanielLive para Discord.
#
# Imagem pequena de propósito. O bot NÃO usa o Next nem o resto do projeto:
# só discord.js. Por isso este build parte de bot/ (que tem o próprio
# package.json) e não da raiz — instalar a raiz aqui traria ~290 MB de Next
# para dentro de um processo que nunca o importa, e a hospedagem gratuita
# costuma ter 512 MB de disco.
#
# O contexto de build precisa ser a RAIZ do projeto (o .dockerignore da raiz
# já exclui node_modules e .next).

FROM node:22-alpine

WORKDIR /app

# Dependências antes do código, para aproveitar o cache de camada:
# mudar um .mjs não reinstala o discord.js.
COPY bot/package.json bot/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY bot/ ./

ENV NODE_ENV=production
# O bot não abre porta nenhuma: não há nada a expor. Quem reinicia em caso de
# queda é a hospedagem, e o bot sai com código 1 quando a configuração está
# errada — é isso que faz um token inválido aparecer nos logs em vez de ficar
# girando calado.
CMD ["node", "index.mjs"]
