/**
 * Teste de integração das salas privadas e do anúncio do site.
 *
 * Sobe o servidor de sinalização de verdade e conversa por WebSocket e HTTP,
 * como o navegador e o operador fariam. Cobre o que os testes unitários não
 * alcançam: a distribuição do anúncio para conexões que já estavam abertas
 * (inclusive fora de sala), a chegada do anúncio no "welcome" de quem conecta
 * depois, e o fato de a sala privada não aparecer na lista.
 *
 * Executa com: npm run test:privadas
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const PORT = 8897;
const URL = `ws://127.0.0.1:${PORT}`;
const TOKEN = "token-de-teste-nao-usar-em-producao";

let server;

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

class TestClient {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.waiters = [];
    this.ws = null;
  }

  async connect() {
    this.ws = new WebSocket(URL, { headers: { origin: "http://localhost:3000" } });
    // O listener de mensagens é registrado ANTES de esperar o "open": o
    // servidor manda o "welcome" no instante em que a conexão sobe, então
    // registrar depois do open é perder a mensagem numa corrida.
    const primeira = new Promise((resolve) => {
      const receber = (raw) => {
        const message = JSON.parse(raw.toString());
        this.messages.push(message);
        for (const waiter of [...this.waiters]) {
          if (waiter.test(message)) {
            waiter.resolve(message);
            this.waiters.splice(this.waiters.indexOf(waiter), 1);
          }
        }
        resolve();
      };
      this.ws.on("message", receber);
    });
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    // Garante que o listener está instalado no laço antes do "welcome" cair.
    await Promise.race([primeira, new Promise((r) => setTimeout(r, 50))]);
    return this;
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

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

  close() {
    this.ws?.close();
  }
}

/** Publica (ou retira) o anúncio pela rota administrativa. */
async function admin(metodo, corpo, { token = TOKEN } = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/anuncio`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      SIGNAL_PORT: String(PORT),
      SIGNAL_HOST: "127.0.0.1",
      ALLOWED_ORIGINS: "http://localhost:3000",
      ANUNCIO_TOKEN: TOKEN,
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

describe("sala privada", () => {
  test("criada como privada, não aparece na lista mas é acessível pelo código", async () => {
    const host = await new TestClient("host").connect();
    await host.next("welcome");
    host.send({ type: "create", name: "Ana", privada: true });
    const created = await host.next("created");
    assert.equal(created.room.privada, true, "o anfitrião precisa saber que a sala é privada");

    const publica = await new TestClient("publica").connect();
    await publica.next("welcome");
    publica.send({ type: "create", name: "Pública" });
    await publica.next("created");

    const observador = await new TestClient("observador").connect();
    await observador.next("welcome");
    observador.send({ type: "salas:listar" });
    const lista = await observador.next("salas:lista");

    const codigos = lista.salas.map((s) => s.code);
    assert.ok(codigos.includes(publica.messages.find((m) => m.type === "created").code));
    assert.equal(
      codigos.includes(created.code),
      false,
      `a sala privada ${created.code} não deveria estar na lista`,
    );

    // Continuar entrando pelo código continua funcionando.
    const convidado = await new TestClient("convidado").connect();
    await convidado.next("welcome");
    convidado.send({ type: "join", code: created.code, name: "Convidado" });
    const joined = await convidado.next("joined");
    assert.equal(joined.code, created.code);
    assert.equal(joined.room.privada, true);

    host.close();
    publica.close();
    observador.close();
    convidado.close();
  });
});

describe("anúncio do site", () => {
  test("rota administrativa exige o token", async () => {
    const semToken = await admin("POST", { texto: "oi" }, { token: null });
    assert.equal(semToken.status, 401);

    const tokenErrado = await admin("POST", { texto: "oi" }, { token: "errado" });
    assert.equal(tokenErrado.status, 401);
  });

  test("anúncio inválido volta 422 com o motivo do campo", async () => {
    const res = await admin("POST", { texto: "clique", botao: { rotulo: "X", url: "javascript:alert(1)" } });
    assert.equal(res.status, 422);
    assert.equal(res.body.erro, "botao-url-invalida");
  });

  test("publicar entrega para quem já está conectado — inclusive fora de sala", async () => {
    const emSala = await new TestClient("em-sala").connect();
    await emSala.next("welcome");
    emSala.send({ type: "create", name: "Ana" });
    await emSala.next("created");

    // A tela de entrada não está em sala nenhuma e mesmo assim precisa do aviso.
    const naEntrada = await new TestClient("na-entrada").connect();
    await naEntrada.next("welcome");

    const res = await admin("POST", { texto: "Manutenção às 22h", cor: "vermelho" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.anuncio.texto, "Manutenção às 22h");

    const paraSi = await emSala.next("anuncio");
    assert.equal(paraSi.anuncio.texto, "Manutenção às 22h");
    assert.equal(paraSi.anuncio.cor, "vermelho");

    const paraEntrada = await naEntrada.next("anuncio");
    assert.equal(paraEntrada.anuncio.texto, "Manutenção às 22h");

    emSala.close();
    naEntrada.close();
  });

  test("quem conecta depois recebe o anúncio no welcome", async () => {
    const atrasado = await new TestClient("atrasado").connect();
    const welcome = await atrasado.next("welcome");
    assert.ok(welcome.anuncio, "o anúncio vigente deve vir junto do welcome");
    assert.equal(welcome.anuncio.texto, "Manutenção às 22h");
    atrasado.close();
  });

  test("a lista de salas também traz o anúncio", async () => {
    const cliente = await new TestClient("lista").connect();
    await cliente.next("welcome");
    cliente.send({ type: "salas:listar" });
    const lista = await cliente.next("salas:lista");
    assert.equal(lista.anuncio.texto, "Manutenção às 22h");
    cliente.close();
  });

  test("retirar avisa todo mundo que o anúncio sumiu", async () => {
    const cliente = await new TestClient("retirada").connect();
    await cliente.next("welcome");

    const res = await admin("DELETE");
    assert.equal(res.status, 200);
    assert.equal(res.body.anuncio, null);

    const aviso = await cliente.next((m) => m.type === "anuncio" && m.anuncio === null);
    assert.equal(aviso.anuncio, null);

    // E quem conecta depois não recebe mais nada.
    const depois = await new TestClient("depois").connect();
    const welcome = await depois.next("welcome");
    assert.equal(welcome.anuncio, null);

    cliente.close();
    depois.close();
  });

  test("DELETE é idempotente", async () => {
    const res = await admin("DELETE");
    assert.equal(res.status, 200);
    assert.equal(res.body.anuncio, null);
  });
});
