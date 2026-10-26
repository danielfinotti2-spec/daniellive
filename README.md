# ScreenLive

Compartilhamento de tela pelo navegador em quatro passos: **criar a transmissão → copiar o
link → começar a compartilhar → a outra pessoa abre o link e assiste**. Sem instalar
programa, sem criar conta, sem configuração técnica.

A interface reaproveita a identidade visual do projeto de referência (tema escuro em
camadas, cabeçalho enxuto, cartões arredondados), mas **todo o código é original**: o
backend, a sinalização, o cliente WebRTC e as páginas foram escritos do zero neste
repositório. Ver [Licenças e origem](#licenças-e-origem).

![Tela inicial](docs/tela-inicial.png)

---

## Índice

- [O que a aplicação faz](#o-que-a-aplicação-faz)
- [Como executar](#como-executar)
- [Arquitetura](#arquitetura)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Configuração de STUN e TURN](#configuração-de-stun-e-turn)
- [Implantação](#implantação)
- [Testes](#testes)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Limitações conhecidas](#limitações-conhecidas)
- [Licenças e origem](#licenças-e-origem)

---

## O que a aplicação faz

| Recurso | Estado |
|---|---|
| Criar sala com link único e difícil de adivinhar | ✅ |
| Copiar link (com alternativa para contexto não seguro) | ✅ |
| Captura de tela real via `getDisplayMedia` | ✅ |
| Escolha entre tela, janela ou aba (do navegador) | ✅ |
| Áudio da aba/sistema, quando o navegador oferece | ✅ |
| Transmissão para vários espectadores (mesh) | ✅ |
| Espectador entra pelo link sem conta | ✅ |
| Detecção de encerramento pelo navegador | ✅ |
| Reconexão automática e recuperação de ICE | ✅ |
| Estados de erro explícitos (permissão negada, sem suporte, sala inexistente, sala cheia) | ✅ |
| Responsivo (desktop, tablet, celular) | ✅ |
| Tema claro/escuro/sistema | ✅ |
| Recado de texto rápido entre os participantes | ✅ |
| Gravação da transmissão | ❌ fora do escopo |
| Câmera e microfone | ❌ fora do escopo |
| SFU (salas muito grandes) | ❌ ver [Limitações](#limitações-conhecidas) |

### Telas

| Preparar transmissão | Anfitrião ao vivo |
|---|---|
| ![Preparar](docs/preparar-transmissao.png) | ![Ao vivo](docs/anfitriao-ao-vivo.png) |

| Espectador esperando | Espectador assistindo |
|---|---|
| ![Esperando](docs/espectador-esperando.png) | ![Assistindo](docs/espectador-assistindo.png) |

| Celular — início | Celular — assistindo |
|---|---|
| ![Celular início](docs/celular-inicial.png) | ![Celular assistindo](docs/celular-assistindo.png) |

---

## Como executar

### Requisitos

- **Node.js 22.19 ou superior** (os testes usam `--experimental-strip-types`, disponível a
  partir do 22.6, e `node --test` com glob, estável no 22).
- npm 10 ou superior.
- Para transmitir: um navegador com `getDisplayMedia` — Chrome, Edge, Firefox ou Safari
  atuais.

### Instalação

```bash
npm install
cp .env.example .env.local   # opcional em desenvolvimento
```

### Desenvolvimento

```bash
npm run dev
```

Sobe as duas partes ao mesmo tempo:

- **site** em http://localhost:3000
- **sinalização** em ws://localhost:8787 (saúde em http://localhost:8787/health)

Separadamente, se preferir:

```bash
npm run dev:web      # só o site
npm run dev:signal   # só a sinalização
```

### Produção

```bash
npm run build
npm start
```

> **Importante sobre `getDisplayMedia`:** os navegadores só permitem captura de tela em
> **contexto seguro** — `https://` ou `localhost`. Para testar de outro dispositivo da rede
> por IP (`http://192.168.x.x:3000`), a captura será bloqueada. Use um túnel HTTPS
> (`cloudflared tunnel`, `ngrok`) ou sirva atrás de um proxy com TLS.

---

## Arquitetura

```
┌────────────────────┐        WebSocket (JSON)        ┌──────────────────────┐
│  Navegador A       │◄──────────────────────────────►│  Servidor de         │
│  (anfitrião)       │        só sinalização          │  sinalização         │
│                    │                                │  Node + ws           │
│  getDisplayMedia   │                                │  salas em memória    │
└─────────┬──────────┘                                └──────────┬───────────┘
          │                                                      │
          │            WebRTC (SRTP, ponta a ponta)              │
          │            a mídia NÃO passa pelo servidor           │
          ▼                                                      ▼
┌────────────────────┐                                ┌──────────────────────┐
│  Navegador B       │◄───────────────────────────────│  Navegador C         │
│  (espectador)      │        uma conexão por par     │  (espectador)        │
└────────────────────┘                                └──────────────────────┘
```

### Decisões e por quê

**Mesh, não SFU.** O anfitrião abre uma `RTCPeerConnection` por espectador. É a topologia
mais simples que funciona sem infraestrutura de mídia, e a mídia nunca toca o servidor —
o que mantém o custo de banda do servidor perto de zero e a privacidade alta. O custo é
que a banda de **upload do anfitrião** cresce com o público; por isso há um teto de 32
espectadores por sala. Salas maiores pedem um SFU (ver limitações).

**Estado em memória, sem banco.** O estado de uma transmissão ao vivo é efêmero: se o
processo reinicia, as conexões WebRTC morreram junto e um registro em banco só viraria
lixo. Salas vivem em um `Map` com expiração automática. A consequência é que a
sinalização **não escala horizontalmente** sozinha.

**O código da sala é a credencial.** Não há login: quem tem o link, entra. Por isso o
identificador tem 9 caracteres de um alfabeto de 31 (~2,6 × 10¹³ combinações), gerado com
`crypto.randomBytes` e amostragem por rejeição para não enviesar o alfabeto. Também não
usa `0/O/1/I/L`, para poder ser ditado em voz alta.

**Um único formato de mensagem, validado em um só lugar.** Toda mensagem que entra pelo
WebSocket passa por `server/protocol.mjs` antes de virar ação. Campos desconhecidos são
descartados na normalização, e o erro devolvido ao cliente é sempre um código curto — o
motivo detalhado fica no log do servidor.

### Estrutura de arquivos

```
app/
  page.tsx                      página inicial
  como-funciona/page.tsx        explicação e dúvidas comuns
  transmitir/page.tsx           tela de quem apresenta
  assistir/[code]/
    page.tsx                    valida o código no servidor (404 antes do WebSocket)
    WatchRoom.tsx               tela de quem assiste
  layout.tsx                    cabeçalho, rodapé, tema
  globals.css                   identidade visual (tema escuro em camadas)

lib/
  rooms-code.ts                 leitura/normalização/escrita do código
  protocol.ts                   tipos das mensagens + textos de erro
  signaling.ts                  cliente WebSocket com reconexão
  webrtc.ts                     captura de tela + HostPeer/ViewerPeer
  ice.ts                        montagem da configuração STUN/TURN
  useHost.ts                    toda a lógica de quem apresenta
  useViewer.ts                  toda a lógica de quem assiste

server/
  index.mjs                     servidor WebSocket, roteamento das mensagens
  rooms.mjs                     registro de salas (puro, testável)
  protocol.mjs                  validação de mensagens
  ratelimit.mjs                 limite por conexão e por endereço

components/                     cabeçalho, rodapé, tema, botões, superfície de vídeo
tests/                          unidade, integração de sinalização, navegador real
docs/                           imagens usadas neste README
```

### Fluxo de uma transmissão

1. **Criar** — o navegador manda `create`; o servidor aloca um código e registra o
   anfitrião. A resposta traz o código, o papel e o retrato da sala.
2. **Convidar** — o link `/assistir/<código>` é montado a partir da origem atual.
3. **Entrar** — o espectador manda `join`; o servidor o registra como `viewer` e avisa o
   anfitrião com `peer-joined`.
4. **Compartilhar** — `getDisplayMedia` abre a escolha do navegador. Com a faixa em mãos,
   o anfitrião manda `sharing: true`.
5. **Negociar** — o espectador pede a oferta (`requestStream`); o anfitrião cria uma
   `HostPeer`, manda a oferta SDP e depois os candidatos ICE. O espectador responde com
   `ViewerPeer.acceptOffer`. Candidatos que chegam antes da descrição remota ficam em
   fila em vez de causar erro.
6. **Assistir** — a faixa de vídeo chega por `ontrack` e é ligada ao `<video>`. A página
   passa a "recebendo".
7. **Encerrar** — pelo botão, pela barra do navegador (`ended` na faixa) ou fechando a
   aba. Em qualquer caso o estado vai para `sharing: false` e os espectadores voltam a
   "aguardando" — sem mentir "ao vivo".

---

## Variáveis de ambiente

Todas são opcionais em desenvolvimento. Copie `.env.example` para `.env.local`.

| Variável | Padrão | Para que serve |
|---|---|---|
| `NEXT_PUBLIC_SIGNAL_URL` | derivado da origem, porta 8787 | Endereço público do WebSocket de sinalização |
| `NEXT_PUBLIC_SIGNAL_PORT` | `8787` | Porta usada quando o endereço é derivado |
| `SIGNAL_PORT` | `8787` | Porta em que o servidor de sinalização escuta |
| `SIGNAL_HOST` | `0.0.0.0` | Interface de escuta |
| `ALLOWED_ORIGINS` | vazio (aceita tudo) | **Defina em produção.** Origens autorizadas a abrir o WebSocket |
| `NEXT_PUBLIC_STUN_URLS` | STUN do Google | Servidores STUN, separados por vírgula |
| `NEXT_PUBLIC_TURN_URL` | — | URL do TURN (`turn:` ou `turns:`) |
| `NEXT_PUBLIC_TURN_USERNAME` | — | Usuário do TURN |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | — | Credencial do TURN |

> As variáveis `NEXT_PUBLIC_*` são **embutidas no bundle do cliente** por definição — é
> inevitável, o navegador precisa delas para montar o ICE. Use credenciais **efêmeras**
> para o TURN, nunca uma credencial de longa duração com banda aberta.

---

## Configuração de STUN e TURN

**STUN** (já configurado) resolve a maioria das redes domésticas: descobre o endereço
externo e permite a conexão direta. Nada a fazer.

**TURN** é necessário quando as duas pontas não conseguem se alcançar — NAT simétrico,
rede corporativa com firewall que bloqueia UDP, VPN restritiva. Sem TURN, essas redes
simplesmente não conectam, e a aplicação mostra uma mensagem explicando exatamente isso.

### Opção 1 — coturn próprio

```bash
# Debian/Ubuntu
sudo apt install coturn
```

`/etc/turnserver.conf` mínimo:

```ini
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
realm=seudominio.com
# Autenticação com segredo compartilhado (credenciais efêmeras por REST API)
use-auth-secret
static-auth-secret=TROQUE_POR_UM_SEGREDO_LONGO
total-quota=100
stale-nonce=600
```

Abra as portas **3478/tcp, 3478/udp, 5349/tcp, 5349/udp** e a faixa de relay
(`min-port`/`max-port`, por exemplo 49152–65535).

Com `use-auth-secret`, o usuário é um timestamp de expiração e a credencial é o
HMAC-SHA1 desse timestamp com o segredo — assim a credencial vence sozinha. Depois:

```env
NEXT_PUBLIC_TURN_URL=turn:turn.seudominio.com:3478
NEXT_PUBLIC_TURN_USERNAME=1700000000:meuusuario
NEXT_PUBLIC_TURN_CREDENTIAL=<hmac-sha1-base64-do-timestamp>
```

### Opção 2 — provedor gerenciado

Cloudflare Calls, Twilio Network Traversal ou Metered Caucus entregam credenciais
efêmeras por API. Configure as três variáveis com o que o provedor devolver. Vantagem: sem
servidor para manter e sem banda de relay no seu host.

---

## Implantação

### Docker

O `Dockerfile` produz uma imagem que roda site e sinalização sob o mesmo processo pai:

```bash
docker build -t screenlive .
docker run -p 3000:3000 -p 8787:8787 \
  -e ALLOWED_ORIGINS=https://screenlive.exemplo.com \
  screenlive
```

### Atrás de proxy reverso

O ponto delicado é o WebSocket. Em Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name screenlive.exemplo.com;

  ssl_certificate     /etc/letsencrypt/live/screenlive.exemplo.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/screenlive.exemplo.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # A sinalização precisa de upgrade e de timeout longo: uma sala pode ficar
  # horas aberta, e o padrão de 60 s do Nginx derrubaria a conexão no meio.
  location /ws {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

Para servir os dois sob o mesmo domínio, aponte o cliente para o caminho do proxy:

```env
NEXT_PUBLIC_SIGNAL_URL=wss://screenlive.exemplo.com/ws
ALLOWED_ORIGINS=https://screenlive.exemplo.com
```

> Configure `ALLOWED_ORIGINS` **sempre** em produção. Sem a lista, qualquer site pode
> embutir o cliente e usar o seu servidor como transporte de sinalização.

---

## Testes

Quatro camadas, todas executáveis localmente:

```bash
npm test                  # 86 testes de unidade (salas, protocolo, rate limit, código, cliente)
node --test tests/signaling.e2e.mjs   # 12 testes de integração com o servidor real
node tests/browser.e2e.mjs            # 21 verificações em navegador real
node tests/scenarios.e2e.mjs          # 14 cenários avançados em navegador real
node tests/screenshots.mjs            # regenera as imagens do README
```

Os três últimos exigem os serviços no ar (`npm run dev`) e um Chrome instalado
(`CHROME_PATH` sobrescreve o caminho padrão). O teste de navegador usa
`--auto-select-desktop-capture-source`, que é o mecanismo do próprio Chrome para
automatizar a escolha de tela.

> **Antes de rodar os testes de navegador, confirme que só existe um servidor em
> cada porta.** Um `next start` órfão segurando a porta 3000 serve artefatos
> misturados (chunks de produção com referências de HMR) e o React não hidrata —
> os sintomas aparecem como botões que não habilitam e erros 403, que parecem
> bug de aplicação mas não são. Verifique com:
>
> ```powershell
> Get-NetTCPConnection -LocalPort 3000,8787 -State Listen |
>   Select-Object LocalPort, OwningProcess
> ```
>
> Cada porta deve apontar para um único processo. Se houver dúvida, encerre os
> processos `node` que segurem as portas antes de subir os serviços de novo.

### O que cada camada cobre

| Camada | Cobre |
|---|---|
| `tests/rooms.test.mjs` | Formato e unicidade do código, viés do alfabeto, papéis, limite de espectadores, expiração, limpeza |
| `tests/protocol.test.mjs` | Cada campo aceito e recusado, mensagens malformadas, teto de tamanho, descarte de campos extras |
| `tests/ratelimit.test.mjs` | Rajada, recarga, teto, cota por endereço, janela deslizante |
| `tests/room-code.test.mjs` | Normalização de código, extração de URL, tolerância a caracteres ambíguos |
| `tests/signaling-client.test.mjs` | Fila de mensagens do cliente: exatamente um `join` por conexão, reenvio após reconexão, descarte de mensagens efêmeras |
| `tests/signaling.e2e.mjs` | Fluxo completo com servidor real: criar, entrar, sharing, SDP, ICE, chat, saída, e as recusas de segurança |
| `tests/browser.e2e.mjs` | Páginas reais em Chrome: captura, **mídia chegando ao espectador** (dimensões e quadros decodificados), estados, mobile, 404 |
| `tests/scenarios.e2e.mjs` | Três espectadores ao mesmo tempo, saída sem afetar os outros, permissão negada, navegador sem suporte, reconexão após recarga |

### Resultado da última execução

```
unidade ......................... 86/86
integração (sinalização) ........ 12/12
navegador real .................. 21/21
cenários avançados .............. 14/14
```

Destaques verificados de fato, não por suposição:

- **mídia chega ao espectador** com dimensões reais (1366×768) e quadros
  decodificados — não apenas uma conexão marcada como "conectada";
- **três espectadores simultâneos** recebem vídeo ao mesmo tempo (mesh);
- a saída de um espectador **não interrompe** os demais;
- recarregar a página do espectador **reconecta sozinho**;
- permissão negada mostra aviso e **não** deixa a interface em "ao vivo";
- navegador sem `getDisplayMedia` avisa **antes** da tentativa e desabilita o botão.

---

## Segurança e privacidade

O que já está implementado:

- **IDs imprevisíveis** — `crypto.randomBytes` com amostragem por rejeição; o código é a
  credencial, então precisa ser difícil de adivinhar.
- **Validação centralizada** — nenhuma mensagem chega ao manipulador de sala sem passar
  pelo validador, que também descarta campos não previstos (impede poluição de objeto).
- **Sinal só dentro da sala** — o servidor recusa `signal` para um id que não esteja na
  mesma sala; sem isso, uma conexão poderia injetar SDP em sala alheia.
- **Só o anfitrião transmite** — `sharing` de um espectador é recusado com
  `sem-permissao`.
- **Limite de requisições** — token bucket por conexão (rajada 80, 25/s sustentado) e cota
  de criação de salas por endereço (10/minuto).
- **Teto de tamanho** — 256 KB por mensagem, verificado antes do `JSON.parse`; mensagens
  binárias são recusadas.
- **Batimento** — conexão que para de responder é encerrada, o que evita salas fantasma.
- **Erros sem vazamento** — o cliente recebe códigos curtos; o detalhe fica no log.
- **`ALLOWED_ORIGINS`** — barra o uso do servidor por sites de terceiros.
- **`Permissions-Policy`** — o cabeçalho libera `display-capture`, `microphone` e `camera`
  apenas para a própria origem.
- **Cabeçalhos de segurança** — `X-Content-Type-Options: nosniff` e `Referrer-Policy`.

Sobre privacidade: **a mídia não passa pelo servidor.** A imagem viaja em SRTP entre os
navegadores, pela conexão WebRTC. O servidor vê apenas metadados de sinalização (quem está
em qual sala, quando alguém começou a transmitir). Nada é gravado em disco.

### Pendências de segurança para produção

- [ ] **TLS obrigatório.** Sem HTTPS o navegador nem permite a captura, e o WebSocket
      ficaria em `ws://` (texto claro).
- [ ] **`ALLOWED_ORIGINS` definido.** O padrão aceita qualquer origem.
- [ ] **Autenticação de sala, se necessário.** Hoje quem tem o link entra. Para salas
      restritas seria preciso um token de entrada com validade curta.
- [ ] **TURN com credenciais efêmeras.** Não use usuário/senha fixos com banda aberta.

---

## Limitações conhecidas

Registradas aqui de forma explícita, sem maquiagem:

1. **Sinalização não escala horizontalmente.** As salas vivem em memória de um processo.
   Duas instâncias atrás de um balanceador não se enxergam: um espectador que caia na
   instância B não encontra a sala criada na instância A. Para escalar seria preciso um
   adaptador de pub/sub (Redis, NATS) entre as instâncias, ou sticky session por código de
   sala. **Não implementado.**
2. **Estado perdido no reinício.** O servidor reiniciar encerra todas as salas. Os clientes
   recebem `server-shutdown` e a interface pede para recarregar. Não há persistência.
3. **Mesh tem custo no anfitrião.** Com N espectadores, o upload do anfitrião é ~N vezes o
   bitrate da tela. Com 32 espectadores a 2 Mbps, são ~64 Mbps de upload. Acima disso é
   necessário um SFU (mediasoup, Janus, LiveKit) — **não implementado**.
4. **Áudio do sistema depende do navegador.** Chrome e Edge capturam áudio de aba/tela;
   Firefox e Safari não capturam áudio do sistema. A interface avisa quando nenhuma faixa
   de áudio foi capturada.
5. **Transmitir do celular é limitado.** O Chrome no Android permite capturar a tela; o
   Safari no iOS não permite capturar outros aplicativos. Assistir funciona em ambos.
6. **Sem gravação.** Não há como salvar a transmissão. O `MediaRecorder` resolveria, mas
   está fora do escopo definido.
7. **Sem autenticação.** Qualquer pessoa com o link entra. É uma escolha de simplicidade —
   o link é a chave — mas significa que vazar o link é vazar o acesso.
8. **Sem chat persistente nem moderação.** O recado rápido é volátil e não há como expulsar
   alguém de uma sala.
9. **`--experimental-strip-types` nos testes.** O teste de `lib/room-code.ts` importa
   TypeScript direto; a flag some quando o Node 24 for o mínimo. Não afeta o build de
   produção.
10. **Sem testes em Firefox/Safari.** A automação foi feita no Chrome. O código usa
    caminhos padrão do WebRTC (`getDisplayMedia`, `RTCPeerConnection`), mas a verificação
    real de mídia nesses navegadores **não foi executada**.

---

## Licenças e origem

### Este projeto

Código original, licenciado sob **MIT** — ver [LICENSE](LICENSE).

### Projeto de referência

A interface foi inspirada no **GoLive / group-sharescreen** (NemTudo), distribuído sob a
**FARSL 1.0** (Fork Attribution and Revenue Sharing License). Essa licença:

- permite uso, cópia, estudo, modificação e distribuição **para fins não comerciais**;
- **exige** a preservação do selo de identificação do projeto original;
- **exige licença comercial separada** para qualquer uso comercial, com royalties.

**Nenhum arquivo do projeto de referência foi copiado para este repositório.** Não há
código, CSS, JavaScript, imagem, fonte ou texto trazido de lá. O que foi reaproveitado é a
**decisão de design** — paleta de cores, ideia de cabeçalho enxuto e formato de cartão —
que não é objeto de proteção autoral, e a leitura do protocolo de sinalização (nomes de
eventos e conceitos do WebRTC, que são padrão da tecnologia).

Todo o código aqui foi escrito do zero: servidor de sinalização, protocolo, validação,
limites, cliente WebRTC, páginas e testes.

### Aviso sobre marcas

"ScreenLive" é o nome deste projeto. **Não há qualquer afiliação com o GoLive, com a
NemTudo ou com qualquer outro produto.** O nome e a marca do projeto de referência não são
usados aqui de forma que sugira vínculo oficial.

### Dependências

| Pacote | Licença | Uso |
|---|---|---|
| Next.js | MIT | framework web |
| React / React DOM | MIT | interface |
| ws | MIT | servidor WebSocket |
| Tailwind CSS | MIT | estilos |
| TypeScript | Apache-2.0 | tipagem |
| concurrently | MIT | rodar os dois processos em dev |
| playwright-core | Apache-2.0 | testes de navegador (dev) |

Nenhuma dependência de runtime é copyleft forte. As licenças e atribuições originais são
preservadas em `node_modules/`.

---

## Contribuindo

1. `npm install && npm run dev`
2. Rode os testes antes de enviar: `npm test && npm run typecheck && npm run lint`
3. Mudanças de protocolo exigem atualizar `server/protocol.mjs` **e** `lib/protocol.ts` —
   os testes de unidade cobrem as duas pontas.

## Suporte a navegadores

| Navegador | Transmitir | Assistir | Áudio do sistema |
|---|---|---|---|
| Chrome / Edge (desktop) | ✅ | ✅ | ✅ |
| Firefox (desktop) | ✅ | ✅ | ❌ |
| Safari (macOS) | ✅ | ✅ | ❌ |
| Chrome (Android) | ✅ | ✅ | ❌ |
| Safari (iOS) | ❌ | ✅ | ❌ |
| Firefox (Android) | ❌ | ✅ | ❌ |
