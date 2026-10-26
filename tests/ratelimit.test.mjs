/** Testes do limitador de requisições. */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, RoomCreationLimiter, costFor } from "../server/ratelimit.mjs";

describe("RateLimiter", () => {
  test("permite a rajada inicial até a capacidade", () => {
    const rl = new RateLimiter({ capacity: 5, refillPerSecond: 1 });
    for (let i = 0; i < 5; i += 1) {
      assert.equal(rl.take(), true, `mensagem ${i + 1} deveria passar`);
    }
    assert.equal(rl.take(), false, "a sexta deveria ser recusada");
  });

  test("recarrega com o tempo", () => {
    let now = 0;
    const rl = new RateLimiter({ capacity: 2, refillPerSecond: 10, now: () => now });
    assert.equal(rl.take(), true);
    assert.equal(rl.take(), true);
    assert.equal(rl.take(), false);
    now += 100; // 0,1 s * 10/s = 1 token
    assert.equal(rl.take(), true);
  });

  test("nunca passa da capacidade mesmo com muito tempo parado", () => {
    let now = 0;
    const rl = new RateLimiter({ capacity: 3, refillPerSecond: 100, now: () => now });
    now += 60_000;
    for (let i = 0; i < 3; i += 1) assert.equal(rl.take(), true);
    assert.equal(rl.take(), false, "o balde não deve acumular além da capacidade");
  });

  test("conta os excessos", () => {
    const rl = new RateLimiter({ capacity: 1, refillPerSecond: 0 });
    rl.take();
    rl.take();
    rl.take();
    assert.equal(rl.hits, 2);
  });

  test("custo maior consome mais", () => {
    const rl = new RateLimiter({ capacity: 10, refillPerSecond: 0 });
    assert.equal(rl.take(6), true);
    assert.equal(rl.take(6), false, "sobrou menos que o custo pedido");
    assert.equal(rl.take(4), true);
  });

  test("ping custa menos que criar sala", () => {
    assert.ok(costFor("ping") < costFor("create"));
    assert.equal(costFor("tipo-inexistente"), 1, "custo padrão é 1");
  });
});

describe("RoomCreationLimiter", () => {
  test("permite até o teto por endereço", () => {
    const rl = new RoomCreationLimiter({ perAddress: 3, windowMs: 1000 });
    assert.equal(rl.allow("1.2.3.4"), true);
    assert.equal(rl.allow("1.2.3.4"), true);
    assert.equal(rl.allow("1.2.3.4"), true);
    assert.equal(rl.allow("1.2.3.4"), false);
  });

  test("cada endereço tem cota própria", () => {
    const rl = new RoomCreationLimiter({ perAddress: 1, windowMs: 1000 });
    assert.equal(rl.allow("1.1.1.1"), true);
    assert.equal(rl.allow("1.1.1.1"), false);
    assert.equal(rl.allow("2.2.2.2"), true, "outro endereço não é afetado");
  });

  test("libera depois da janela", () => {
    let now = 0;
    const rl = new RoomCreationLimiter({ perAddress: 1, windowMs: 1000, now: () => now });
    assert.equal(rl.allow("a"), true);
    assert.equal(rl.allow("a"), false);
    now += 1001;
    assert.equal(rl.allow("a"), true);
  });

  test("endereço ausente não quebra", () => {
    const rl = new RoomCreationLimiter({ perAddress: 1, windowMs: 1000 });
    assert.equal(rl.allow(undefined), true);
    assert.equal(rl.allow(null), false, "todos os anônimos compartilham a cota");
  });

  test("sweep limpa entradas velhas", () => {
    let now = 0;
    const rl = new RoomCreationLimiter({ perAddress: 5, windowMs: 1000, now: () => now });
    rl.allow("1.1.1.1");
    rl.allow("2.2.2.2");
    now += 2000;
    rl.sweep();
    assert.equal(rl.log.size, 0);
  });
});
