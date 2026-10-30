# Bot do DanielLive para Discord

O bot olha os canais de voz de um servidor e, quando alguém entra numa call,
publica o link de uma sala do DanielLive no chat daquele canal e no status dele.
Quando a última pessoa sai, o link some.

```
alguém entra na call  →  bot cria a chave  →  publica https://daniellive.onrender.com/assistir/47291
última pessoa sai     →  bot encerra a sessão e limpa o status
```

## O que ele faz e o que não faz

Faz:

- **Um link por call.** A chave é de 5 dígitos, fácil de ditar em voz alta.
- **Não repete mensagem.** A segunda pessoa que entra não recebe o link de novo
  no chat — só aparece no status do canal.
- **Reaproveita a chave.** Se a call esvaziar e voltar, o link continua o mesmo:
  quem guardou o endereço não descobre que ele mudou.
- **Encerra quando esvazia.** A sessão fecha quando não sobra ninguém na call.
- **Lê a contagem real de pessoas**, não "quantos entraram": quem entra pelo
  celular e sai pelo desktop não bagunça a conta.
- **Recusa link quebrado no boot.** Sem `DANIELLIVE_ORIGIN` válido (https, fora
  de localhost) o bot não sobe, em vez de publicar links errados no chat.

Não faz:

- **Não cria salas no DanielLive.** Ele publica o endereço; a sala nasce quando
  o primeiro abre. O DanielLive não tem API de sala, e inventar uma que
  ninguém usa seria pior.
- **Não guarda nada em disco.** Sessões e configurações vivem em memória (veja
  [Persistência](#persistência)).
- **Não grava, não escuta, não vê o conteúdo da transmissão.** Ele só lê a
  lista de quem está no canal de voz.

## Como rodar

### 1. Criar o bot no Discord

1. Abra o [Discord Developer Portal](https://discord.com/developers/applications)
   e crie uma aplicação.
2. Em **Bot**, clique em **Reset Token** e copie o valor — é o `DISCORD_TOKEN`.
3. Ainda em **Bot → Privileged Gateway Intents**, ligue
   **MESSAGE CONTENT INTENT**. Sem isso o bot não consegue ler as próprias
   mensagens para reaproveitar o link.
4. Em **General Information**, copie o **Application ID** — é o
   `DISCORD_CLIENT_ID`.

### 2. Convidar o bot

Em **OAuth2 → URL Generator**, marque os escopos `bot` e
`applications.commands`, e as permissões:

- Ver canais
- Enviar mensagens
- Ler histórico de mensagens
- Usar comandos de aplicação

O link gerado adiciona o bot ao seu servidor.

### 3. Configurar

```bash
cp bot/env.example .env
```

Preencha `DISCORD_TOKEN` e `DANIELLIVE_ORIGIN`. Para registrar os comandos,
preencha também `DISCORD_CLIENT_ID`.

### 4. Registrar os comandos (uma vez)

```bash
npm run bot:registrar
```

Com `DISCORD_GUILD_ID` preenchido, os comandos aparecem na hora no servidor.
Sem ele, são globais e podem levar até uma hora.

### 5. Ligar

```bash
npm run bot
```

## Comandos

| Comando | Quem pode | O que faz |
|---|---|---|
| `/status` | qualquer membro | Mostra o que está ligado no servidor e as calls com link agora |
| `/link` | qualquer membro | Republica o link da call em que você está (resposta pública) |
| `/config` | **Gerenciar Servidor** | Liga/desliga o aviso no chat e no status |

## Configuração

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | sim | Token do bot. É um segredo: quem tem isso controla o bot |
| `DANIELLIVE_ORIGIN` | sim | Onde o site está publicado. Precisa ser `https` (só `localhost` aceita `http`) |
| `DANIELLIVE_PATH` | não | Prefixo da sala. Padrão `/assistir` |
| `DISCORD_CLIENT_ID` | só para registrar | Application ID |
| `DISCORD_GUILD_ID` | não | Registra os comandos só neste servidor, na hora |

## Persistência

Sessões e configurações ficam em memória. Não há banco, e isso é uma escolha:

- **Sessão de call é efêmera por natureza** — existe enquanto existe a call.
  Se o bot reiniciar, a próxima pessoa que entrar recria a sessão, e ela ainda
  reaproveita a chave da última mensagem, então **o link não muda**.
- **Configuração de servidor não se regenera.** Um `/config chat false` volta
  ao padrão (`ligado`) depois de um reinício. É o preço aceito por não depender
  de um serviço externo; se um dia incomodar, é a única coisa aqui que precisa
  de disco.

## Onde hospedar de graça

Bot do Discord precisa de um processo **sempre ligado**: ele mantém um WebSocket
com o Discord e não recebe requisições HTTP. Isso elimina várias hospedagens
gratuitas conhecidas:

| Serviço | Grátis 24h? | Por quê |
|---|---|---|
| **Bot-Hosting.net** | ✅ | Feito para bot. 256 MB, sem cartão. **Exige renovação manual a cada 4 dias** |
| Render (free) | ❌ | Dorme após 15 min sem tráfego HTTP/WebSocket externo |
| Fly.io | ❌ | Sem plano grátis; o menor sempre-ligado custa ~US$ 2,19/mês |
| Koyeb | ❌ | Sem plano grátis permanente |
| Railway | ❌ | Sem plano grátis (só US$ 1 de crédito) |

Para o Bot-Hosting: crie o serviço do tipo **Node.js**, aponte para este
repositório, defina `DANIELLIVE_PATH`/`DANIELLIVE_ORIGIN`/`DISCORD_TOKEN` nas
variáveis de ambiente e use `node bot/index.mjs` como comando de início (ou o
`bot/Dockerfile`, com contexto na raiz do projeto).

> A renovação a cada 4 dias é o detalhe que faz gente perder o bot: quando
> expira, o processo para. Vale marcar um lembrete.

Rodar no seu próprio PC (`npm run bot`) é grátis e funciona bem — desde que a
máquina esteja ligada quando você for usar a call.

## Testes

```bash
npm run test:bot
```

76 testes, **sem token e sem conexão com o Discord**. O núcleo
(`bot/sessao.mjs`, `bot/estado.mjs`, `bot/chave.mjs`) recebe as operações de
Discord por injeção, então as regras que erram na prática — quando fechar a
sessão, quando não reenviar o link, o que fazer quando duas calls disputam a
mesma chave — rodam de forma determinística numa máquina sem rede.

O que fica **de fora** dos testes, e não escondo: a conversa de verdade com o
Discord. Nenhum teste aqui prova que a API aceita o corpo do `/config` ou que o
endpoint de status responde. Isso só se comprova com um token real num servidor
de teste.

## Arquitetura

```
bot/
  chave.mjs      chave de 5 dígitos, unicidade, montagem e leitura do link
  estado.mjs     sessões e configuração, em memória (sem discord.js)
  sessao.mjs     a regra: entrar, sair, trocar de canal (sem discord.js)
  comandos.mjs   /status, /link, /config
  registrar.mjs  registra os comandos slash no Discord
  discord.mjs    adaptador: eventos do discord.js ↔ núcleo
  index.mjs      ponto de entrada, validação do ambiente, saída limpa
```

Os três primeiros arquivos não importam `discord.js` em momento algum — é o que
torna os testes possíveis sem token. `discord.mjs` é a única camada que fala com
a biblioteca.
