/**
 * Teste do cliente de sinalização (lib/signaling.ts).
 *
 * O foco é a contagem de mensagens: um `join` enviado duas vezes é inofensivo
 * para o servidor, mas indica que o cliente está duplicando trabalho e suja o
 * diagnóstico. A regra é — exatamente um `join` por conexão.
 *
 * Executa com: node --experimental-strip-types --test tests/signaling-client.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// O módulo abre WebSocket de verdade ao conectar; aqui só exercitamos a lógica
// de fila e lastJoin, então um dublê simples basta e evita depender de rede.
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor() {
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  /** Simula a abertura do socket, como o navegador faria. */
  abrir() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  fechar() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: "" });
  }

  close() {
    this.fechar();
  }
}

globalThis.WebSocket = FakeWebSocket;

// O cliente recusa conectar fora do navegador (guarda de SSR em connect()).
// Um `window` mínimo satisfaz a guarda sem afetar o comportamento testado.
globalThis.window = { location: { protocol: "http:", hostname: "localhost", host: "localhost:3000" } };

const { SignalingClient } = await import("../lib/signaling.ts");

const tipos = (ws) => ws.sent.map((m) => m.type);
const quantos = (ws, tipo) => tipos(ws).filter((t) => t === tipo).length;

/**
 * Cria um cliente e garante a limpeza no fim do teste.
 *
 * Todo `connect()` bem-sucedido liga um temporizador de ping de 25 s. Sem
 * desconectar, o processo de teste ficaria vivo esperando por ele.
 */
function novoCliente(t) {
  FakeWebSocket.instances = [];
  const client = new SignalingClient("ws://teste.invalido");
  t?.after?.(() => client.disconnect());
  return client;
}

/** Espera o event loop girar algumas vezes (temporizadores de 0 ms). */
const respirar = () => new Promise((r) => setTimeout(r, 0));

describe("cliente de sinalização", () => {
  test("join antes de abrir o socket é enviado uma única vez", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);

    // Usuário entra na sala antes de o socket abrir.
    client.send({ type: "join", code: "K7M2PQR4T", name: "Bia" });
    assert.equal(ws.sent.length, 0, "nada sai antes de o socket abrir");

    ws.abrir();
    await respirar();
    assert.equal(quantos(ws, "join"), 1, "o join precisa sair exatamente uma vez");
    assert.equal(
      ws.sent.find((m) => m.type === "join").code,
      "K7M2PQR4T",
      "o código precisa sobreviver à espera",
    );
  });

  test("join com o socket aberto é enviado uma única vez", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);
    ws.abrir();

    client.send({ type: "join", code: "K7M2PQR4T", name: "Bia" });
    await respirar();
    assert.equal(quantos(ws, "join"), 1);
  });

  test("reconexão reenvia o join uma vez por conexão", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const primeiro = FakeWebSocket.instances.at(-1);
    primeiro.abrir();
    client.send({ type: "join", code: "K7M2PQR4T", name: "Bia" });
    assert.equal(quantos(primeiro, "join"), 1);

    // Cai a conexão e o cliente reconecta sozinho.
    primeiro.fechar();
    client.connect();
    const segundo = FakeWebSocket.instances.at(-1);
    segundo.abrir();
    await respirar();

    assert.equal(quantos(segundo, "join"), 1, "um join na conexão nova");
    assert.equal(
      segundo.sent.find((m) => m.type === "join").code,
      "K7M2PQR4T",
      "reenvia para a mesma sala",
    );
  });

  test("create antes de abrir é enviado na abertura, sem duplicar", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);

    client.send({ type: "hello", name: "Ana", version: 1 });
    client.send({ type: "create", name: "Ana" });
    assert.equal(ws.sent.length, 0);

    ws.abrir();
    await respirar();
    assert.equal(quantos(ws, "hello"), 1);
    assert.equal(quantos(ws, "create"), 1);
    assert.equal(quantos(ws, "join"), 0, "quem cria não entra como espectador");
  });

  test("mensagens efêmeras não são guardadas para depois", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);

    // Um candidato ICE sem socket aberto não serve para nada depois. O `sharing`
    // também é efêmero: descreve o agora, e reenviá-lo depois mentiria sobre o
    // estado atual da transmissão.
    client.send({ type: "signal", to: "abc", data: { candidate: { candidate: "x" } } });
    client.send({ type: "sharing", on: true });

    ws.abrir();
    await respirar();
    assert.equal(quantos(ws, "signal"), 0, "sinal velho não deve ser reenviado");
    assert.equal(quantos(ws, "sharing"), 0, "estado de compartilhamento não deve ser reenviado");
  });

  test("leave esquece o join, então a reconexão não reentra na sala", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const primeiro = FakeWebSocket.instances.at(-1);
    primeiro.abrir();

    client.send({ type: "join", code: "K7M2PQR4T", name: "Bia" });
    client.send({ type: "leave" });
    assert.equal(quantos(primeiro, "leave"), 1);

    // Mesmo que o socket caia, sair é uma decisão: não se volta sozinho.
    primeiro.fechar();
    client.connect();
    const segundo = FakeWebSocket.instances.at(-1);
    segundo.abrir();
    await respirar();

    assert.equal(quantos(segundo, "join"), 0, "não deve reentrar depois de sair");
  });

  test("mensagem inválida do servidor não quebra os ouvintes", async (t) => {
    const client = novoCliente(t);
    const recebidas = [];
    client.onMessage((m) => recebidas.push(m));
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);
    ws.abrir();

    ws.onmessage?.({ data: "{isto não é json" });
    assert.equal(recebidas.length, 0, "lixo não vira mensagem");

    ws.onmessage?.({ data: JSON.stringify({ type: "pong", t: 123 }) });
    assert.equal(recebidas.length, 1, "mensagem boa continua passando");
  });

  test("disconnect impede reconexão automática", async (t) => {
    const client = novoCliente(t);
    client.connect();
    const ws = FakeWebSocket.instances.at(-1);
    ws.abrir();

    const antes = FakeWebSocket.instances.length;
    client.disconnect();
    // Espera de verdade (devolvendo o controle ao event loop), além do
    // primeiro atraso de reconexão — 500 ms. Um laço ocupado aqui travaria o
    // próprio temporizador que o teste quer observar.
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(
      FakeWebSocket.instances.length,
      antes,
      "sair de propósito não deve abrir conexão nova",
    );
  });
});
