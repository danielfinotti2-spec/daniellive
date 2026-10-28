/**
 * Teste de integração do servidor de sinalização.
 *
 * Sobe o servidor de verdade em uma porta livre e conversa com ele por
 * WebSocket, como o navegador faria. Verifica o fluxo completo que a interface
 * depende: criar sala, entrar pelo link, anunciar transmissão, trocar sinais
 * WebRTC entre dois participantes e limpar a sala quando todos saem.
 *
 * Executa com: npm run test:signaling
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const PORT = 8899;
const URL = `ws://127.0.0.1:${PORT}`;

let server;

/** Espera o /health responder antes de começar. */
async function waitForServer(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("o servidor de sinalização não subiu a tempo");
}

/**
 * Cliente de teste: abre o socket e enfileira as mensagens recebidas, com um
 * `next(type)` que espera pela próxima de um tipo — é o que torna o teste
 * legível sem cair em corrida de tempo.
 */
class TestClient {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.waiters = [];
    this.closed = false;
    this.ws = null;
  }

  async connect() {
    this.ws = new WebSocket(URL, { headers: { origin: "http://localhost:3000" } });
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    this.ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      this.messages.push(message);
      // Acorda qualquer espera satisfeita por esta mensagem.
      for (const waiter of [...this.waiters]) {
        if (waiter.test(message)) {
          waiter.resolve(message);
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
        }
      }
    });
    this.ws.on("close", () => {
      this.closed = true;
    });
    return this;
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

  /** Espera por uma mensagem que satisfaça o teste (tipo, ou predicado). */
  async next(typeOrPredicate, timeoutMs = 5000) {
    const test =
      typeof typeOrPredicate === "function" ? typeOrPredicate : (m) => m.type === typeOrPredicate;
    const existing = this.messages.find(test);
    if (existing) return existing;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `[${this.name}] tempo esgotado esperando ${String(typeOrPredicate)}; ` +
              `recebidas: ${this.messages.map((m) => m.type).join(", ") || "nenhuma"}`,
          ),
        );
      }, timeoutMs);
      this.waiters.push({
        test,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  }

  /** Confirma que uma mensagem NÃO chega dentro da janela. */
  async expectNone(type, timeoutMs = 700) {
    const found = this.messages.find((m) => m.type === type);
    if (found) throw new Error(`[${this.name}] não deveria ter recebido ${type}`);
    await new Promise((r) => setTimeout(r, timeoutMs));
    const late = this.messages.find((m) => m.type === type);
    if (late) throw new Error(`[${this.name}] recebeu ${type} que não deveria`);
  }

  close() {
    this.ws?.close();
  }
}

before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      SIGNAL_PORT: String(PORT),
      SIGNAL_HOST: "127.0.0.1",
      // Origem explícita: exercita o caminho de verificação que roda em produção.
      ALLOWED_ORIGINS: "http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  await waitForServer();
});

after(() => {
  server?.kill("SIGTERM");
});

describe("fluxo completo de sinalização", () => {
  test("saúde e métricas respondem", async () => {
    const health = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(typeof health.rooms, "number");

    const metrics = await fetch(`http://127.0.0.1:${PORT}/metrics`).then((r) => r.text());
    assert.match(metrics, /daniellive_rooms \d+/);
  });

  test("cria sala, entra pelo código e troca sinais", async () => {
    // --- anfitrião cria -----------------------------------------------------
    const host = await new TestClient("host").connect();
    host.send({ type: "hello", name: "Ana", version: 1 });
    const welcome = await host.next("welcome");
    assert.ok(welcome.id, "o servidor deve atribuir um id");

    host.send({ type: "create", name: "Ana" });
    const created = await host.next("created");
    assert.equal(created.code.length, 9);
    assert.equal(created.you.role, "host");
    assert.equal(created.room.participants.length, 1);
    assert.equal(created.room.sharing, false);

    // --- espectador entra pelo código --------------------------------------
    const viewer = await new TestClient("viewer").connect();
    viewer.send({ type: "hello", name: "Bia" });
    await viewer.next("welcome");
    viewer.send({ type: "join", code: created.code, name: "Bia" });

    const joined = await viewer.next("joined");
    assert.equal(joined.code, created.code);
    assert.equal(joined.you.role, "viewer");
    assert.equal(joined.hostId, created.you.id, "o espectador precisa saber quem é o anfitrião");
    assert.equal(joined.sharing, false);

    // O anfitrião é avisado do recém-chegado, com o papel certo.
    const peerJoined = await host.next("peer-joined");
    assert.equal(peerJoined.id, joined.you.id);
    assert.equal(peerJoined.role, "viewer");

    // --- anfitrião começa a transmitir -------------------------------------
    host.send({ type: "sharing", on: true });
    const sharingOk = await host.next("sharing-ok");
    assert.equal(sharingOk.on, true);

    const viewers = await host.next("viewers");
    assert.equal(viewers.viewers.length, 1);
    assert.equal(viewers.viewers[0].id, joined.you.id);

    const sharingEvent = await viewer.next("sharing");
    assert.equal(sharingEvent.on, true);

    // --- espectador pede a oferta ------------------------------------------
    viewer.send({ type: "requestStream" });
    const pedido = await host.next("stream-requested");
    assert.equal(pedido.from, joined.you.id);

    // --- oferta SDP do anfitrião para o espectador --------------------------
    const oferta = { type: "offer", sdp: "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n" };
    host.send({ type: "signal", to: joined.you.id, data: { description: oferta } });
    const recebida = await viewer.next("signal");
    assert.equal(recebida.from, created.you.id);
    assert.equal(recebida.data.description.type, "offer");
    assert.equal(recebida.data.description.sdp, oferta.sdp);

    // --- resposta SDP do espectador para o anfitrião ------------------------
    const resposta = { type: "answer", sdp: "v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n" };
    viewer.send({ type: "signal", to: created.you.id, data: { description: resposta } });
    const respostaRecebida = await host.next(
      (m) => m.type === "signal" && m.data?.description?.type === "answer",
    );
    assert.equal(respostaRecebida.from, joined.you.id);

    // --- candidatos ICE nos dois sentidos ----------------------------------
    host.send({
      type: "signal",
      to: joined.you.id,
      data: { candidate: { candidate: "candidate:1 1 udp 1 127.0.0.1 5000 typ host", sdpMid: "0" } },
    });
    const iceViewer = await viewer.next(
      (m) => m.type === "signal" && Boolean(m.data?.candidate?.candidate),
    );
    assert.match(iceViewer.data.candidate.candidate, /udp/);

    viewer.send({
      type: "signal",
      to: created.you.id,
      data: { candidate: { candidate: "candidate:2 1 udp 1 127.0.0.1 5001 typ host" } },
    });
    const iceHost = await host.next(
      (m) => m.type === "signal" && Boolean(m.data?.candidate?.candidate),
    );
    assert.match(iceHost.data.candidate.candidate, /5001/);

    // --- pausa é propagada a todos ------------------------------------------
    // Quem transmite recebe `sharing-ok` (confirmação do próprio pedido); os
    // demais recebem `sharing` com o campo `paused`.
    host.send({ type: "sharing", on: true, paused: true });
    const pausaViewer = await viewer.next((m) => m.type === "sharing" && m.paused === true);
    assert.equal(pausaViewer.on, true, "pausar não encerra o compartilhamento");
    const pausaOk = await host.next((m) => m.type === "sharing-ok" && m.paused === true);
    assert.equal(pausaOk.on, true);

    // Retomar também chega, e com `paused: false`.
    host.send({ type: "sharing", on: true, paused: false });
    const retomou = await viewer.next((m) => m.type === "sharing" && m.paused === false);
    assert.equal(retomou.on, true, "retomar mantém a transmissão ativa");

    // --- espectador sai -----------------------------------------------------
    viewer.send({ type: "leave" });
    const saiu = await host.next("peer-left");
    assert.equal(saiu.id, joined.you.id);

    // O anfitrião continua na sala.
    host.send({ type: "ping" });
    const pong = await host.next("pong");
    assert.ok(typeof pong.t === "number");

    host.close();
    viewer.close();
  });

  test("recusa sala inexistente com erro específico", async () => {
    const client = await new TestClient("sozinho").connect();
    client.send({ type: "join", code: "ZZZZZZZZZ" });
    const erro = await client.next("join-error");
    assert.equal(erro.code, "sala-nao-encontrada");
    client.close();
  });

  test("recusa mensagem malformada sem derrubar a conexão", async () => {
    const client = await new TestClient("malformado").connect();
    client.ws.send("{isso nao e json");
    const erro = await client.next("error");
    assert.equal(erro.code, "mensagem-invalida");

    // A conexão continua utilizável depois do erro — importante para não
    // punir um cliente que teve um bug pontual.
    client.send({ type: "ping" });
    await client.next("pong");
    client.close();
  });

  test("recusa tipo desconhecido", async () => {
    const client = await new TestClient("tipo-ruim").connect();
    client.send({ type: "drop-database", table: "rooms" });
    const erro = await client.next("error");
    assert.equal(erro.code, "mensagem-invalida");
    client.close();
  });

  test("não entrega sinal para quem não está na mesma sala", async () => {
    const a = await new TestClient("a").connect();
    a.send({ type: "create", name: "Sala A" });
    const salaA = await a.next("created");

    const b = await new TestClient("b").connect();
    b.send({ type: "create", name: "Sala B" });
    const salaB = await b.next("created");
    assert.notEqual(salaA.code, salaB.code);

    // 'a' tenta injetar um sinal no participante da sala B.
    a.send({ type: "signal", to: salaB.you.id, data: { candidate: { candidate: "x" } } });

    // O servidor recusa e o alvo não recebe nada.
    const erro = await a.next("error");
    assert.equal(erro.code, "destino-invalido");
    await b.expectNone("signal");

    a.close();
    b.close();
  });

  test("espectador não consegue anunciar transmissão", async () => {
    const host = await new TestClient("host2").connect();
    host.send({ type: "create", name: "Dono" });
    const sala = await host.next("created");

    const viewer = await new TestClient("viewer2").connect();
    viewer.send({ type: "join", code: sala.code });
    await viewer.next("joined");

    viewer.send({ type: "sharing", on: true });
    const erro = await viewer.next("error");
    assert.equal(erro.code, "sem-permissao");

    // O anfitrião não recebeu nenhum anúncio falso.
    await host.expectNone("sharing");

    // E o estado da sala continua "fora do ar" para quem entrar depois.
    const terceiro = await new TestClient("viewer3").connect();
    terceiro.send({ type: "join", code: sala.code });
    const joined = await terceiro.next("joined");
    assert.equal(joined.sharing, false);

    host.close();
    viewer.close();
    terceiro.close();
  });

  test("anfitrião que sai encerra a transmissão para todos", async () => {
    const host = await new TestClient("host3").connect();
    host.send({ type: "create", name: "Ana" });
    const sala = await host.next("created");

    const viewer = await new TestClient("viewer4").connect();
    viewer.send({ type: "join", code: sala.code });
    await viewer.next("joined");

    host.send({ type: "sharing", on: true });
    await viewer.next("sharing");

    host.close();

    const saiu = await viewer.next("host-left");
    assert.equal(saiu.code, sala.code);
    viewer.close();
  });

  test("segundo participante do mesmo link também é espectador", async () => {
    const host = await new TestClient("host4").connect();
    host.send({ type: "create", name: "Ana" });
    const sala = await host.next("created");

    const v1 = await new TestClient("v1").connect();
    v1.send({ type: "join", code: sala.code, name: "Bia" });
    const j1 = await v1.next("joined");
    assert.equal(j1.you.role, "viewer");

    const v2 = await new TestClient("v2").connect();
    v2.send({ type: "join", code: sala.code, name: "Caio" });
    const j2 = await v2.next("joined");
    assert.equal(j2.you.role, "viewer", "o link não promove ninguém a anfitrião");

    // O anfitrião recebe os dois.
    assert.equal(j1.code, j2.code);
    host.close();
    v1.close();
    v2.close();
  });

  test("reconexão com o mesmo nome entra de novo na mesma sala", async () => {
    const host = await new TestClient("host5").connect();
    host.send({ type: "create", name: "Ana" });
    const sala = await host.next("created");

    const viewer = await new TestClient("v5").connect();
    viewer.send({ type: "join", code: sala.code, name: "Bia" });
    await viewer.next("joined");
    viewer.close();

    await host.next("peer-left");

    // Nova conexão (id novo, como acontece numa recarga de página).
    const viewer2 = await new TestClient("v5b").connect();
    viewer2.send({ type: "join", code: sala.code, name: "Bia" });
    const reentrou = await viewer2.next("joined");
    assert.equal(reentrou.code, sala.code);
    assert.equal(reentrou.you.role, "viewer");

    host.close();
    viewer2.close();
  });

  test("código em minúsculas é recusado pelo servidor", async () => {
    const client = await new TestClient("minusculo").connect();
    client.send({ type: "join", code: "k7m2pqr4t" });
    const erro = await client.next("error");
    assert.equal(erro.code, "mensagem-invalida");
    client.close();
  });

  test("mensagens grandes demais são recusadas", async () => {
    const client = await new TestClient("grande").connect();
    client.ws.send(JSON.stringify({ type: "signal", to: "abc", data: { pad: "x".repeat(300 * 1024) } }));
    // O servidor pode fechar a conexão (maxPayload) ou responder erro; os dois
    // são aceitáveis, o que não pode é processar a mensagem.
    const resultado = await Promise.race([
      client.next("error", 3000).catch(() => null),
      new Promise((r) =>
        client.ws.once("close", () => r({ type: "close" })),
      ),
    ]);
    assert.ok(resultado, "deveria recusar ou fechar");
    client.close();
  });
});
