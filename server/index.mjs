/**
 * DanielLive — servidor de sinalização.
 *
 * Papel: manter as salas e encaminhar os sinais WebRTC entre o anfitrião e os
 * espectadores. A mídia nunca passa por aqui — o vídeo vai direto de um
 * navegador para o outro (mesh). Este processo só responde "quem está na sala"
 * e "leve esta oferta/candidato para aquele participante".
 *
 * Por que mesh e não SFU: o caso de uso é uma pessoa apresentando para um
 * grupo pequeno. Em mesh o custo de upload cresce com o número de
 * espectadores, o que é aceitável até algumas dezenas; a alternativa (um SFU)
 * exigiria um serviço de mídia à parte, com custo de banda no servidor. O teto
 * de espectadores por sala em rooms.mjs é o que mantém essa escolha honesta.
 *
 * Execução: `node server/index.mjs` (porta em SIGNAL_PORT, padrão 8787).
 *
 * Também exporta `criarSinal()`, a fábrica que `server/publico.mjs` usa para
 * pendurar o WebSocket no MESMO processo do Next (hospedagem com uma porta
 * só, como Render/Railway). Executado direto o comportamento é o de sempre:
 * sobe sozinho na porta dele, como o aplicativo desktop e os testes esperam.
 */

import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { RoomRegistry, isValidRoomCode } from "./rooms.mjs";
import { validateMessage, decode, encode, PROTOCOL_VERSION } from "./protocol.mjs";
import { RateLimiter, RoomCreationLimiter, costFor } from "./ratelimit.mjs";
import { QuadroDeAnuncios, validarAnuncio } from "./anuncio.mjs";

/**
 * Cria o servidor e DEVOLVE as peças; quem escuta e encerra é o chamador.
 *
 * Dois modos:
 *  - `{ httpServer }` omitido: cria um servidor HTTP próprio com /health e
 *    /metrics e pendura o WebSocket em todos os upgrades dele (clássico).
 *  - `{ httpServer }` dado: NÃO cria servidor; atende apenas upgrades cujo
 *    caminho é `caminhoWs` ("/ws" por padrão) e deixa o resto ser tratado
 *    pelo dono do servidor HTTP (o Next, no modo público).
 */
export function criarSinal({ httpServer = null, caminhoWs = "/ws" } = {}) {

const SWEEP_INTERVAL_MS = 15_000;
/**
 * Origens autorizadas a abrir WebSocket. A lista é o que impede que um site
 * de terceiros embuta o cliente e use este servidor como transporte gratuito.
 * `*` só é aceitável atrás de um proxy que faça essa checagem.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Em produção, uma lista vazia é uma falha de configuração, não um padrão.
 *
 * Sem ela, qualquer site pode abrir um WebSocket aqui e usar este servidor como
 * transporte de graça — e o operador nunca descobre, porque nada avisa. Recusar
 * a subir é melhor do que subir inseguro e silencioso. Em desenvolvimento a
 * lista vazia continua valendo, para não atrapalhar quem está testando.
 */
const PRODUCAO = process.env.NODE_ENV === "production";
if (PRODUCAO && ALLOWED_ORIGINS.length === 0) {
  console.error(
    "[daniellive] ALLOWED_ORIGINS não foi definido e NODE_ENV=production.\n" +
      "             Defina a lista de origens autorizadas, separadas por vírgula:\n" +
      "             ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com\n" +
      "             Para permitir qualquer origem (só atrás de um proxy que já valide), use ALLOWED_ORIGINS=*.",
  );
  process.exit(1);
}

const log = (...args) => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}]`, ...args);
};

const registry = new RoomRegistry();
const creationLimiter = new RoomCreationLimiter({ perAddress: 10, windowMs: 60_000 });
/**
 * O anúncio do site. Vive aqui (e não em `server/publico.mjs`) porque tanto o
 * servidor público quanto o aplicativo desktop e os testes sobem por este
 * arquivo — o aviso precisa existir onde houver sinalização.
 *
 * Quem PUBLICA é o operador, por HTTP administrativo (ver `anunciar` abaixo);
 * o WebSocket só distribui. Isso mantém a única porta de escrita do anúncio
 * fora do caminho que qualquer navegador pode abrir.
 */
const anuncios = new QuadroDeAnuncios();

/** id do participante -> estado da conexão */
const connections = new Map();

/**
 * Entrega uma mensagem a toda conexão aberta, de qualquer sala.
 *
 * É o único canal "site-wide" do servidor. Usado hoje pelo anúncio; a diferença
 * em relação a `broadcast` é justamente não depender de sala — o aviso precisa
 * chegar a quem está na tela de entrada sem estar em transmissão nenhuma.
 */
function paraTodos(message) {
  const payload = encode(message);
  for (const state of connections.values()) {
    const socket = state.ws;
    if (socket && socket.readyState === socket.OPEN) socket.send(payload);
  }
}

/**
 * Publica um anúncio para todo mundo AGORA e passa a devolvê-lo a quem conectar
 * depois. Devolve `{ ok, anuncio }` ou `{ ok: false, erro }`.
 *
 * Fica aqui (e não na rota HTTP) para que o servidor autônomo, o modo público e
 * os testes usem exatamente a mesma regra de validação e de distribuição.
 */
function publicarAnuncio(bruto) {
  const resultado = validarAnuncio(bruto);
  if (!resultado.ok) return resultado;
  const vigente = anuncios.definir(resultado.anuncio);
  paraTodos({ type: "anuncio", anuncio: vigente });
  log("anúncio publicado");
  return { ok: true, anuncio: vigente };
}

/** Tira o anúncio do ar e avisa quem está conectado. */
function retirarAnuncio() {
  anuncios.limpar();
  paraTodos({ type: "anuncio", anuncio: null });
  log("anúncio retirado");
  return { ok: true, anuncio: null };
}

/**
 * Trata as rotas administrativas do anúncio. Devolve `true` se respondeu.
 *
 * Autenticação: `ANUNCIO_TOKEN` no cabeçalho `authorization: Bearer …`. Sem a
 * variável definida, as rotas ficam desligadas (404) — um servidor que ninguém
 * configurou para administrar não deve nem anunciar que existe uma porta de
 * administração.
 */
async function rotaAdmin(req, res) {
  const token = process.env.ANUNCIO_TOKEN ?? "";
  if (!token) return false;
  const caminho = (req.url ?? "").split("?")[0];
  if (caminho !== "/admin/anuncio") return false;

  const recebido = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  // Comparação de tamanho fixo: medir o tempo de resposta não pode revelar
  // quantos caracteres do token estavam certos.
  const a = Buffer.from(recebido);
  const b = Buffer.from(token);
  const autorizado = a.length === b.length && timingSafeEqual(a, b);
  if (!autorizado) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "nao_autorizado" }));
    return true;
  }

  if (req.method === "DELETE") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(retirarAnuncio()));
    return true;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json", allow: "POST, DELETE" });
    res.end(JSON.stringify({ error: "metodo_nao_permitido" }));
    return true;
  }

  // Corpo limitado: um anúncio tem teto de 280 caracteres, então 8 KB é
  // generosidade que ainda impede qualquer um de empurrar um arquivo inteiro.
  const MAX_CORPO = 8 * 1024;
  let bruto = "";
  let excedeu = false;
  for await (const pedaco of req) {
    bruto += pedaco;
    if (bruto.length > MAX_CORPO) {
      excedeu = true;
      break;
    }
  }
  if (excedeu) {
    res.writeHead(413, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "corpo_longo" }));
    return true;
  }

  let corpo;
  try {
    corpo = JSON.parse(bruto || "{}");
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "json_invalido" }));
    return true;
  }

  const resultado = publicarAnuncio(corpo);
  res.writeHead(resultado.ok ? 200 : 422, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(resultado));
  return true;
}

const EMBUTIDO = httpServer !== null;

let proprio = null;
if (!EMBUTIDO) {
  proprio = createServer(async (req, res) => {
    // A rota administrativa vem antes de tudo: ela responde por si e devolve
    // `true` quando tratou o pedido.
    if (await rotaAdmin(req, res)) return;

    // Endpoint de saúde: usado pelo Docker/orquestrador para saber se o processo
    // está de pé, e por `npm run test:e2e` para esperar o servidor subir.
    if (req.url === "/health" || req.url === "/healthz") {
      const body = JSON.stringify({
        ok: true,
        rooms: registry.size,
        connections: connections.size,
        uptime: Math.round(process.uptime()),
      });
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(body);
      return;
    }
    if (req.url === "/metrics") {
      // Formato de texto simples, sem dependência: é o que um `curl` mostra.
      const lines = [
        `daniellive_rooms ${registry.size}`,
        `daniellive_connections ${connections.size}`,
      ];
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(lines.join("\n") + "\n");
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
}

const wss = new WebSocketServer({
  // Com um servidor emprestado, o roteamento do upgrade é decidido abaixo —
  // só /ws sobe para WebSocket; o resto (HMR do Next etc.) pertence ao Next.
  ...(EMBUTIDO ? { noServer: true } : { server: proprio }),
  maxPayload: 256 * 1024,
  // Sem compressão: o payload (SDP/ICE) já é pequeno e compactar abriria
  // espaço para ataques de amplificação em conexão não autenticada.
  perMessageDeflate: false,
  verifyClient: ({ origin, req }, done) => {
    const remote = req.socket.remoteAddress ?? "";
    if (ALLOWED_ORIGINS.length > 0) {
      const ok = ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
      if (!ok) {
        log("origem recusada", origin, remote);
        done(false, 403, "origin_not_allowed");
        return;
      }
    }
    done(true);
  },
});

if (EMBUTIDO) {
  httpServer.on("upgrade", (req, socket, head) => {
    let caminho;
    try {
      caminho = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (caminho !== caminhoWs) return; // upgrade alheio (Next, HMR): deixa quieto
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}

function send(ws, message) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(encode(message));
}

function broadcast(code, message, exceptId = null) {
  const room = registry.get(code);
  if (!room) return;
  const payload = encode(message);
  for (const id of room.participants.keys()) {
    if (id === exceptId) continue;
    const peer = connections.get(id);
    if (peer && peer.ws.readyState === peer.ws.OPEN) peer.ws.send(payload);
  }
}

function peerList(code, exceptId = null) {
  return registry.viewers(code, exceptId).map((p) => ({ id: p.id, name: p.name }));
}

wss.on("connection", (ws, req) => {
  const id = randomUUID();
  const address = (req.headers["x-forwarded-for"]?.split(",")[0] ?? req.socket.remoteAddress ?? "").trim();
  const state = {
    id,
    ws,
    address,
    roomCode: null,
    name: null,
    limiter: new RateLimiter({ capacity: 80, refillPerSecond: 25 }),
    alive: true,
  };
  connections.set(id, state);

  send(ws, {
    type: "welcome",
    id,
    version: PROTOCOL_VERSION,
    limits: { maxViewersPerRoom: 32 },
    // O anúncio viaja junto do "bem-vindo" para quem conecta no meio de um
    // aviso não perder o começo dele. `null` quando não há nada em vigor.
    anuncio: anuncios.ativo(),
  });
  log("conexão", id.slice(0, 8), address);

  ws.on("pong", () => {
    state.alive = true;
  });

  ws.on("message", (raw, isBinary) => {
    const decoded = decode(raw, isBinary);
    if (!decoded.ok) {
      send(ws, { type: "error", code: "mensagem-invalida" });
      return;
    }
    const validated = validateMessage(decoded.value);
    if (!validated.ok) {
      // O motivo detalhado fica no log do servidor; o cliente recebe um código
      // curto para não revelar a forma interna dos dados.
      log("mensagem recusada", state.id.slice(0, 8), validated.reason);
      send(ws, { type: "error", code: "mensagem-invalida" });
      return;
    }
    const message = validated.message;

    if (!state.limiter.take(costFor(message.type))) {
      send(ws, { type: "error", code: "muitas-mensagens" });
      return;
    }

    handleMessage(ws, state, message);
  });

  ws.on("close", () => {
    const code = state.roomCode;
    if (code) {
      const result = registry.leave(code, state.id);
      if (result) {
        broadcast(code, { type: "peer-left", id: state.id, name: result.participant.name });
        if (result.hostLeft) {
          broadcast(code, { type: "host-left", code });
        }
      }
    }
    connections.delete(id);
    log("desconexão", id.slice(0, 8), code ?? "-");
  });

  ws.on("error", (err) => {
    log("erro de socket", id.slice(0, 8), err.message);
  });
});

function handleMessage(ws, state, message) {
  switch (message.type) {
    case "hello": {
      // Só anota o nome nesta etapa; a entrada na sala vem em `join`.
      if (message.name) state.name = message.name;
      send(ws, { type: "hello-ok", id: state.id });
      return;
    }

    case "create": {
      if (!creationLimiter.allow(state.address)) {
        send(ws, { type: "error", code: "limite-de-salas" });
        return;
      }
      if (state.roomCode) registry.leave(state.roomCode, state.id);
      const name = message.name || state.name || "Anfitrião";
      const room = registry.create({ hostName: name, privada: message.privada });
      const joined = registry.join(room.code, { id: state.id, name, asHost: true });
      if (!joined.ok) {
        send(ws, { type: "error", code: joined.error });
        return;
      }
      state.roomCode = room.code;
      state.name = name;
      send(ws, {
        type: "created",
        code: room.code,
        you: { id: state.id, name, role: "host" },
        room: registry.snapshot(room.code),
      });
      log("sala criada", room.code, "por", state.id.slice(0, 8), message.privada ? "(privada)" : "");
      return;
    }

    case "join": {
      if (state.roomCode && state.roomCode !== message.code) {
        registry.leave(state.roomCode, state.id);
      }
      const name = message.name || state.name || "Espectador";
      const joined = registry.join(message.code, { id: state.id, name });
      if (!joined.ok) {
        // Erro de entrada é específico o bastante para o cliente distinguir
        // "sala não existe" de "sala cheia" — os dois exigem telas diferentes.
        send(ws, { type: "join-error", code: joined.error, room: message.code });
        return;
      }
      state.roomCode = message.code;
      state.name = name;
      const snapshot = registry.snapshot(message.code);

      send(ws, {
        type: "joined",
        code: message.code,
        you: { id: state.id, name, role: joined.participant.role },
        room: snapshot,
        // Quem entra precisa saber de quem esperar oferta. O anfitrião é
        // identificado explicitamente para o espectador não depender da ordem
        // em que os eventos chegaram.
        hostId: snapshot?.hostId ?? null,
        sharing: snapshot?.sharing ?? false,
        // A conversa que já rolava: sem isto, entrar tarde era cair num chat
        // mudo mesmo quando a conversa estava quente.
        chat: registry.chatHistory(message.code),
      });

      // Quem já estava é avisado do recém-chegado. O anfitrião usa isto para
      // abrir uma conexão nova só para ele.
      broadcast(
        message.code,
        { type: "peer-joined", id: state.id, name, role: joined.participant.role },
        state.id,
      );
      if (joined.participant.role === "host") {
        broadcast(message.code, { type: "host-changed", hostId: state.id, hostName: name }, state.id);
      }
      log("entrou", state.id.slice(0, 8), "em", message.code, "como", joined.participant.role);
      return;
    }

    case "leave": {
      if (!state.roomCode) return;
      const code = state.roomCode;
      const result = registry.leave(code, state.id);
      state.roomCode = null;
      if (result) {
        broadcast(code, { type: "peer-left", id: state.id, name: result.participant.name });
        if (result.hostLeft) broadcast(code, { type: "host-left", code });
      }
      return;
    }

    case "sharing": {
      const code = state.roomCode;
      if (!code) return;
      const pausado = message.paused === true;
      const result = registry.setSharing(code, state.id, message.on);
      if (!result.ok) {
        send(ws, { type: "error", code: result.error });
        return;
      }
      // `paused` faz parte do estado observável da transmissão: quem assiste
      // precisa saber distinguir "pausado" de "travou", então o campo não pode
      // ficar só no cliente de quem transmite.
      broadcast(code, { type: "sharing", id: state.id, on: message.on, paused: pausado }, state.id);
      // O próprio anfitrião confirma o estado para a interface dele não
      // divergir do que o servidor considera verdade.
      send(ws, { type: "sharing-ok", on: message.on, paused: pausado });
      if (message.on) {
        // O anfitrião recebe a lista de quem precisa de oferta AGORA, sem
        // esperar o próximo `peer-joined`.
        send(ws, { type: "viewers", viewers: peerList(code, state.id) });
      }
      return;
    }

    case "signal": {
      const code = state.roomCode;
      if (!code) return;
      const room = registry.get(code);
      if (!room) return;
      const target = room.participants.get(message.to);
      // Só participante da mesma sala recebe sinal: isto é o que impede que
      // uma conexão use o servidor para injetar SDP em sala alheia.
      if (!target) {
        send(ws, { type: "error", code: "destino-invalido" });
        return;
      }
      const peer = connections.get(message.to);
      if (!peer) return;
      send(peer.ws, { type: "signal", from: state.id, data: message.data });
      return;
    }

    case "requestStream": {
      const code = state.roomCode;
      if (!code) return;
      const room = registry.get(code);
      if (!room || !room.hostId) {
        send(ws, { type: "no-host", code });
        return;
      }
      const host = connections.get(room.hostId);
      if (host) {
        send(host.ws, { type: "stream-requested", from: state.id, name: state.name });
      }
      return;
    }

    case "ping": {
      send(ws, { type: "pong", t: Date.now() });
      return;
    }

    /**
     * Lista as salas públicas (ver `listarPublicas` em rooms.mjs).
     *
     * Não exige estar em sala: é a tela de entrada pedindo "quem está ao vivo
     * agora". A resposta inclui o anúncio vigente porque as duas coisas são
     * perguntadas juntas por quem monta a página, e uma ida a menos ao servidor
     * é uma chance a menos de a tela abrir pela metade.
     */
    case "salas:listar": {
      send(ws, {
        type: "salas:lista",
        salas: registry.listarPublicas(),
        anuncio: anuncios.ativo(),
      });
      return;
    }

    /** Só o anúncio vigente — para quem já está na página e quer atualizar. */
    case "anuncio:atual": {
      send(ws, { type: "anuncio", anuncio: anuncios.ativo() });
      return;
    }

    case "chat": {
      const code = state.roomCode;
      if (!code) {
        // Falar para sala nenhuma não faz sentido — nem histórico daria.
        send(ws, { type: "error", code: "sem-sala" });
        return;
      }
      const resultado = registry.appendChat(code, state.id, message.texto);
      if (!resultado.ok) {
        send(ws, { type: "error", code: resultado.error });
        return;
      }
      // Vai para todos, inclusive para quem enviou: a confirmação é a própria
      // mensagem de volta, numerada — o cliente de quem mandou descobre assim
      // a ordem oficial, e nenhum caso especial precisa existir.
      broadcast(code, { type: "chat", msg: resultado.mensagem });
      return;
    }

    default:
      return;
  }
}

/** Batimento: derruba conexão que parou de responder (rede caiu sem FIN). */
const heartbeat = setInterval(() => {
  for (const [id, state] of connections) {
    const socket = state.ws;
    if (!socket || socket.readyState !== socket.OPEN) {
      connections.delete(id);
      continue;
    }
    if (!state.alive) {
      // Duas rodadas sem pong: a conexão está morta mas o socket não fechou
      // (típico de cabo desconectado ou suspensão da máquina).
      log("batimento perdido, encerrando", id.slice(0, 8));
      socket.terminate();
      continue;
    }
    state.alive = false;
    try {
      socket.ping();
    } catch {
      /* socket já morto */
    }
  }
}, 20_000);

/** Limpeza periódica de salas vazias e de conexões mortas. */
const sweeper = setInterval(() => {
  const { removedRooms, dropped } = registry.sweep();
  for (const d of dropped) {
    broadcast(d.code, { type: "peer-left", id: d.id, name: d.name, timeout: true });
  }
  for (const code of removedRooms) {
    log("sala removida por inatividade", code);
  }
  creationLimiter.sweep();
}, SWEEP_INTERVAL_MS);

function shutdown(signal) {
  log(`encerrando (${signal})`);
  clearInterval(heartbeat);
  clearInterval(sweeper);
  for (const state of connections.values()) {
    const socket = state.ws;
    if (!socket) continue;
    try {
      send(socket, { type: "server-shutdown" });
      socket.close(1001, "server shutting down");
    } catch {
      /* já fechado */
    }
  }
  wss.close(() => {
    if (proprio) proprio.close(() => process.exit(0));
    else process.exit(0);
  });
  // Rede de segurança: se algo travar no fechamento, sai de qualquer forma.
  setTimeout(() => process.exit(0), 3000).unref();
}

return {
  httpServer: proprio,
  wss,
  registry,
  connections,
  /**
   * As rotas administrativas do anúncio, para quem emprestou o servidor HTTP.
   *
   * No modo embutido (servidor público: Next + WebSocket na mesma porta) este
   * módulo não é dono do servidor e não pode instalar handler próprio. Quem é
   * dono (server/publico.mjs) chama `await rotaAdmin(req, res)` antes de
   * delegar ao Next — é o mesmo código do modo autônomo, não uma segunda
   * implementação que poderia divergir.
   */
  rotaAdmin,
  /** Publica um anúncio para todo mundo (usado por testes e pelo modo público). */
  publicarAnuncio,
  /** Retira o anúncio do ar. */
  retirarAnuncio,
  /** O quadro de anúncios, para inspeção em teste. */
  anuncios,
  /** Conveniência autônoma: instala handlers de sinal e escuta. */
  ouvir(porta, hospedeiro) {
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    if (!proprio) throw new Error("modo embutido não escuta porta própria");
    proprio.listen(porta, hospedeiro, () => {
      log(`sinalização ouvindo em ws://${hospedeiro}:${porta}`);
      log(`saúde em http://${hospedeiro}:${porta}/health`);
      if (ALLOWED_ORIGINS.length) log("origens permitidas:", ALLOWED_ORIGINS.join(", "));
      else log("ALLOWED_ORIGINS vazio: aceitando qualquer origem (só é aceitável fora de produção)");
    });
  },
};

}

/**
 * Chamado como `node server/index.mjs`: sobe sozinho, como sempre fez.
 * Importado de outro módulo (server/publico.mjs, testes), fica quieto —
 * quem importa decide o que criar.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { httpServer: _sinalHttp, wss: _sinalWss, ouvir } = criarSinal();
  void _sinalHttp;
  void _sinalWss;
  ouvir(Number(process.env.SIGNAL_PORT ?? 8787), process.env.SIGNAL_HOST ?? "0.0.0.0");
}