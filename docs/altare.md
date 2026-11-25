# DanielLive na Altare

## O que será hospedado

- **Site e sinalização:** Next.js e WebSocket no processo `server/publico.mjs`,
  usando uma porta HTTP. A plataforma publica HTTPS e `/ws` recebe os upgrades.
- **Contas, sessões e amizades:** SQLite, configurado por `DANIELLIVE_DB`.
  As tabelas e migrações são aplicadas na primeira abertura do banco.
- **Salas e chat:** memória do processo; não são gravados no SQLite.

O link `https://console.altare.gg/storage` é o painel dos serviços de dados,
não um endereço de conexão. PostgreSQL e MySQL gerenciados usam host, porta,
usuário, senha e TLS. O código atual importa `node:sqlite` e **não usa
`DATABASE_URL` nem `MYSQL_URL`**. Para escolher um desses serviços é necessário
adaptar a camada de dados e autenticação; apenas clicar em Connect não basta.

## Opção 1: App Hosting pelo GitHub

1. No console, entre em **Apps → New app → GitHub repository**.
2. Selecione ou cole `https://github.com/danielfinotti2-spec/daniellive`.
3. Configure **Build and run**:

   | Campo | Valor |
   |---|---|
   | Runtime | Node.js 24 |
   | Branch | `main` |
   | Root directory | raiz do repositório |
   | Install command | `npm ci --ignore-scripts` |
   | Build command | `npm run build` |
   | Start command | `node server/publico.mjs` |

   O `Procfile` também declara o comando de início. `--ignore-scripts` evita
   baixar o Electron, que não é usado no servidor web.

4. Em **Deployments → Settings**, configure:

   ```env
   NODE_ENV=production
   HOST=0.0.0.0
   DANIELLIVE_DB=./dados/daniellive.db
   ```

   Deixe `PORT` a cargo da plataforma. Ela também fornece `ALTARE_URL`; quando
   `ALLOWED_ORIGINS` está ausente, essa URL autoriza a origem do WebSocket.
   Para domínio próprio ou mais de um domínio, preencha a lista explicitamente:

   ```env
   ALLOWED_ORIGINS=https://SEU_APP.go.altare.global,https://SEU_DOMINIO
   ```

5. Em **Health and caching**, configure o health check como `/health`.
6. Use o endereço HTTPS exibido em **Network**. O WebSocket fica em
   `wss://SEU_DOMINIO/ws`, na mesma origem do site.

**Persistência:** confirme que a pasta `dados/` é mantida entre deploys no tipo
exato de app escolhido. Se o armazenamento do app for efêmero, esta opção não
preserva contas. Para SQLite com pasta persistente documentada pela Altare,
use o Docker App abaixo.

App Hosting publica o commit no GitHub, não mudanças locais. As alterações
preparadas neste checkout precisam ser enviadas ao repositório antes do deploy.

## Opção 2: Docker App com SQLite persistente

1. Em uma máquina com Docker, gere uma imagem Linux amd64 e publique-a no seu
   registry. Exemplo de nome de imagem, ainda não publicada por este guia:

   ```bash
   docker build --platform linux/amd64 \
     -t ghcr.io/danielfinotti2-spec/daniellive:altare .
   docker push ghcr.io/danielfinotti2-spec/daniellive:altare
   ```

   O envio pressupõe login autorizado no registry. Se usar Google OAuth,
   informe o domínio final ao compilar:
   `--build-arg NEXT_PUBLIC_SITE_URL=https://SEU_DOMINIO`.

2. No console, abra **Apps → New app → Docker image** e informe a imagem
   publicada. Para imagem privada, configure **Private registry**.
3. Preencha:

   | Campo | Valor |
   |---|---|
   | Port | `3000` |
   | Data folder | `/app/dados` |
   | Start command | padrão da imagem: `node server/publico.mjs` |
   | `NODE_ENV` | `production` (já definido na imagem) |
   | `DANIELLIVE_DB` | `/app/dados/daniellive.db` (já definido na imagem) |

4. Use `ALTARE_URL` para a origem automática, ou configure `ALLOWED_ORIGINS`
   com os domínios HTTPS do app. Configure saúde em `/health`, se disponível.
5. Mantenha uma única instância: as salas não são compartilhadas entre processos.

**Data folder é necessário:** a declaração `VOLUME` na imagem não substitui a
configuração de persistência no painel. A pasta inteira mantém o arquivo SQLite
junto de seus arquivos WAL/SHM. O processo roda com UID 1001; a pasta precisa
ser gravável por esse usuário.

## Validação antes de publicar

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run test:public
npm run typecheck
npm run lint
npm audit --omit=dev
```

A preparação foi validada com Node.js 24 e Next.js 16.4.6: **299 testes
unitários e 4 testes do servidor público**, build, tipos e lint aprovados.
A auditoria de dependências de produção retornou zero vulnerabilidades.
Os 4 testes públicos também passaram numa cópia com `npm ci --omit=dev
--ignore-scripts`, sem `concurrently` nem TypeScript instalados.

Isso valida o runtime Node, não uma imagem Docker Linux em execução nem um
deploy na conta da Altare. O teste de persistência reinicia o servidor mantendo
a mesma pasta; a configuração de Data folder na hospedagem ainda precisa ser
conferida depois de publicar.

## Conferência após publicar

1. `GET https://SEU_DOMINIO/health` deve responder 200 com `ok: true`.
2. Crie uma conta, saia e entre novamente.
3. Crie uma transmissão e entre como espectador em outro navegador.
4. Confirme o WebSocket em `/ws`, o chat e o compartilhamento da tela.
5. Reinicie ou redeploye o app e entre com a mesma conta. Isso verifica que o
   banco está na pasta persistente, não apenas que o site iniciou.

Um clone novo não contém as contas existentes no aplicativo desktop. Se houver
um banco anterior para importar, ele deve ser migrado explicitamente antes de
abrir o serviço para novos cadastros.

## Acesso necessário para executar o deploy por API

- Token da equipe em **Team → Settings → API tokens**, configurado localmente
  na variável `ALTARE_TOKEN`, com permissões para esse app e a operação desejada.
- Link ou ID do app de destino na Altare e o domínio final, se já existir.
- Escolha de banco: SQLite persistente ou PostgreSQL/MySQL de Storage.
- Para Docker, acesso ao registry onde a imagem será publicada.

Esses dados não ficam no repositório nem na imagem.

## Referências oficiais

- [App Hosting](https://docs.altare.gg/apps)
- [Docker Apps e Data folder](https://docs.altare.gg/apps/docker)
- [Conexões, HTTPS e WebSockets](https://docs.altare.gg/platform/connecting)
- [API e tokens](https://docs.altare.gg/altare-api)
- [Postgres](https://docs.altare.gg/databases/postgres)
- [MySQL](https://docs.altare.gg/databases/mysql)
