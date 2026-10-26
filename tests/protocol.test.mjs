/**
 * Testes de validação de mensagens.
 *
 * Este é o módulo que separa "bytes vindos da rede" de "ação no servidor",
 * então cada campo aceito e cada campo recusado tem um teste.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateMessage, decode, encode, MAX_MESSAGE_BYTES } from "../server/protocol.mjs";

const VALID_CODE = "K7M2PQR4T";

describe("validateMessage", () => {
  test("recusa o que não é objeto", () => {
    for (const bad of [null, undefined, 42, "texto", [], true]) {
      assert.equal(validateMessage(bad).ok, false);
    }
  });

  test("recusa mensagem sem tipo", () => {
    assert.equal(validateMessage({}).ok, false);
    assert.equal(validateMessage({ type: 123 }).ok, false);
    assert.equal(validateMessage({ type: "" }).ok, false);
  });

  test("recusa tipo desconhecido", () => {
    const res = validateMessage({ type: "executar-comando" });
    assert.equal(res.ok, false);
    assert.match(res.reason, /tipo-desconhecido/);
  });

  test("aceita hello sem nome", () => {
    const res = validateMessage({ type: "hello" });
    assert.equal(res.ok, true);
    assert.equal(res.message.name, null);
  });

  test("corta campos extras de hello", () => {
    const res = validateMessage({ type: "hello", name: "Ana", admin: true, room: "X" });
    assert.equal(res.ok, true);
    assert.deepEqual(Object.keys(res.message).sort(), ["name", "type", "version"]);
    assert.equal(res.message.admin, undefined);
  });

  test("rejeita nome longo demais", () => {
    const res = validateMessage({ type: "hello", name: "x".repeat(49) });
    assert.equal(res.ok, true, "mensagem é válida, mas o nome é ignorado");
    assert.equal(res.message.name, null);
  });

  test("aceita nome no limite", () => {
    const nome = "x".repeat(48);
    const res = validateMessage({ type: "hello", name: nome });
    assert.equal(res.message.name, nome);
  });

  test("apara espaços do nome", () => {
    const res = validateMessage({ type: "hello", name: "  Ana  " });
    assert.equal(res.message.name, "Ana");
  });
});

describe("join", () => {
  test("aceita código válido", () => {
    const res = validateMessage({ type: "join", code: VALID_CODE, name: "Bia" });
    assert.equal(res.ok, true);
    assert.equal(res.message.code, VALID_CODE);
  });

  test("recusa código com formato errado", () => {
    for (const bad of ["ABC", "", "ABCDEFGH0", null, 12345, "K7M2PQR4TX"]) {
      const res = validateMessage({ type: "join", code: bad });
      assert.equal(res.ok, false, `deveria recusar ${JSON.stringify(bad)}`);
    }
  });

  test("recusa código em minúsculas (a normalização é do cliente)", () => {
    assert.equal(validateMessage({ type: "join", code: VALID_CODE.toLowerCase() }).ok, false);
  });
});

describe("sharing", () => {
  test("exige booleano", () => {
    assert.equal(validateMessage({ type: "sharing", on: true }).ok, true);
    assert.equal(validateMessage({ type: "sharing", on: false }).ok, true);
    assert.equal(validateMessage({ type: "sharing", on: "true" }).ok, false);
    assert.equal(validateMessage({ type: "sharing" }).ok, false);
  });
});

describe("signal", () => {
  test("aceita descrição de oferta", () => {
    const res = validateMessage({
      type: "signal",
      to: "abc",
      data: { description: { type: "offer", sdp: "v=0..." } },
    });
    assert.equal(res.ok, true);
  });

  test("aceita candidato ICE", () => {
    const res = validateMessage({
      type: "signal",
      to: "abc",
      data: { candidate: { candidate: "candidate:1 1 UDP...", sdpMid: "0", sdpMLineIndex: 0 } },
    });
    assert.equal(res.ok, true);
  });

  test("aceita candidato vazio (fim da coleta)", () => {
    const res = validateMessage({ type: "signal", to: "abc", data: { candidate: {} } });
    assert.equal(res.ok, true);
  });

  test("recusa payload sem descrição nem candidato", () => {
    assert.equal(validateMessage({ type: "signal", to: "abc", data: {} }).ok, false);
    assert.equal(validateMessage({ type: "signal", to: "abc", data: { lixo: 1 } }).ok, false);
  });

  test("recusa tipo de descrição inventado", () => {
    const res = validateMessage({
      type: "signal",
      to: "abc",
      data: { description: { type: "ataque", sdp: "x" } },
    });
    assert.equal(res.ok, false);
  });

  test("recusa destino vazio ou não textual", () => {
    assert.equal(
      validateMessage({ type: "signal", to: "", data: { candidate: {} } }).ok,
      false,
    );
    assert.equal(
      validateMessage({ type: "signal", to: { $ne: null }, data: { candidate: {} } }).ok,
      false,
    );
  });

  test("recusa sdp não textual", () => {
    const res = validateMessage({
      type: "signal",
      to: "abc",
      data: { description: { type: "offer", sdp: { toString: "hack" } } },
    });
    assert.equal(res.ok, false);
  });
});

describe("decode", () => {
  test("aceita JSON válido", () => {
    const res = decode('{"type":"ping"}');
    assert.equal(res.ok, true);
    assert.equal(res.value.type, "ping");
  });

  test("recusa JSON inválido sem lançar", () => {
    const res = decode("{nao e json");
    assert.equal(res.ok, false);
    assert.equal(res.reason, "json-invalido");
  });

  test("recusa binário", () => {
    assert.equal(decode(Buffer.from("x"), true).ok, false);
  });

  test("recusa acima do teto de tamanho", () => {
    const grande = JSON.stringify({ type: "chat", text: "x".repeat(MAX_MESSAGE_BYTES) });
    const res = decode(grande);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "mensagem-grande");
  });

  test("aceita logo abaixo do limite", () => {
    // Monta o JSON e confere o tamanho real em vez de estimar: o objetivo é
    // testar a fronteira do decode, não a aritmética do teste.
    const base = JSON.stringify({ type: "ping", pad: "" });
    const tamanho = MAX_MESSAGE_BYTES - 1;
    const texto = JSON.stringify({ type: "ping", pad: "x".repeat(tamanho - base.length) });
    assert.ok(texto.length <= MAX_MESSAGE_BYTES, `json com ${texto.length} bytes`);
    assert.equal(decode(texto).ok, true);
  });

  test("encode e decode são inversos", () => {
    const msg = { type: "chat", from: "Ana", text: "olá ç ã é" };
    assert.deepEqual(decode(encode(msg)).value, msg);
  });
});

describe("chatsend", () => {
  test("recusa texto vazio ou enorme", () => {
    assert.equal(validateMessage({ type: "chatsend", text: "" }).ok, false);
    assert.equal(validateMessage({ type: "chatsend", text: "x".repeat(501) }).ok, false);
    assert.equal(validateMessage({ type: "chatsend" }).ok, false);
  });

  test("aceita e apara texto normal", () => {
    const res = validateMessage({ type: "chatsend", text: "  oi  " });
    assert.equal(res.ok, true);
    assert.equal(res.message.text, "oi");
  });
});
