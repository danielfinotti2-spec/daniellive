/**
 * ScreenLive — servidor de sinalização.
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
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { RoomRegistry, isValidRoomCode } from "./rooms.mjs";
import { validateMessage, decode, encode, PROTOCOL_VERSION } from "./protocol.mjs";
import { RateLimiter, RoomCreationLimiter, costFor } from "./ratelimit.mjs";

const PORT = Number(process.env.SIGNAL_PORT ?? 8787);
const HOST = process.env.SIGNAL_HOST ?? "0.0.0.0";
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

const log = (...args) => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}]`, ...args);
};

const registry = new RoomRegistry();
const creationLimiter = new RoomCreationLimiter({ perAddress: 10, windowMs: 60_000 });

/** id do participante -> estado da conexão */
const connections = new Map();

const httpServer = createServer((req, res) => {
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
      `screenlive_rooms ${registry.size}`,
      `screenlive_connections ${connections.size}`,
    ];
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(lines.join("\n") + "\n");
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

const wss = new WebSocketServer({
  server: httpServer,
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
      const room = registry.create({ hostName: name });
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
      log("sala criada", room.code, "por", state.id.slice(0, 8));
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
      const result = registry.setSharing(code, state.id, message.on);
      if (!result.ok) {
        send(ws, { type: "error", code: result.error });
        return;
      }
      broadcast(code, { type: "sharing", id: state.id, on: message.on }, state.id);
      // O próprio anfitrião confirma o estado para a interface dele não
      // divergir do que o servidor considera verdade.
      send(ws, { type: "sharing-ok", on: message.on });
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

    case "chatsend": {
      const code = state.roomCode;
      if (!code) return;
      broadcast(code, {
        type: "chat",
        id: randomUUID().slice(0, 8),
        from: state.name || "Anônimo",
        fromId: state.id,
        text: message.text,
        at: Date.now(),
      });
      return;
    }

    case "ping": {
      send(ws, { type: "pong", t: Date.now() });
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
    httpServer.close(() => process.exit(0));
  });
  // Rede de segurança: se algo travar no fechamento, sai de qualquer forma.
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

httpServer.listen(PORT, HOST, () => {
  log(`sinalização ouvindo em ws://${HOST}:${PORT}`);
  log(`saúde em http://${HOST}:${PORT}/health`);
  if (ALLOWED_ORIGINS.length) log("origens permitidas:", ALLOWED_ORIGINS.join(", "));
  else log("ALLOWED_ORIGINS vazio: aceitando qualquer origem (use só em desenvolvimento)");
});

export { httpServer, wss, registry };
