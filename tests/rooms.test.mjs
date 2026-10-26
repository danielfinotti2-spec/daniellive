/**
 * Testes do registro de salas.
 * Executa com: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  RoomRegistry,
  generateRoomCode,
  isValidRoomCode,
  HEARTBEAT_TIMEOUT_MS,
  ROOM_TTL_MS,
} from "../server/rooms.mjs";

describe("código de sala", () => {
  test("tem o formato esperado", () => {
    const code = generateRoomCode();
    assert.equal(code.length, 9);
    assert.ok(isValidRoomCode(code), `código gerado deveria ser válido: ${code}`);
  });

  test("não usa caracteres ambíguos", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      for (const bad of ["0", "O", "1", "I", "L"]) {
        assert.ok(!code.includes(bad), `código ${code} não deveria conter ${bad}`);
      }
    }
  });

  test("não repete em uma amostra grande", () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i += 1) seen.add(generateRoomCode());
    // Com 31^9 combinações, repetição em 5000 sorteios indicaria bug no gerador.
    assert.equal(seen.size, 5000);
  });

  test("recusa formatos inválidos", () => {
    assert.equal(isValidRoomCode(""), false);
    assert.equal(isValidRoomCode("ABC"), false);
    assert.equal(isValidRoomCode("ABCDEFGH0"), false, "0 não faz parte do alfabeto");
    assert.equal(isValidRoomCode("abcdefghj"), false, "minúsculas não são aceitas cruas");
    assert.equal(isValidRoomCode(null), false);
    assert.equal(isValidRoomCode(123456789), false);
  });

  test("distribui de forma uniforme o suficiente", () => {
    // O rejection sampling existe justamente para não enviesar o alfabeto:
    // esta checagem falharia se um byte só fosse usado no módulo.
    const counts = new Map();
    const amostras = 4000;
    for (let i = 0; i < amostras; i += 1) {
      for (const ch of generateRoomCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const total = amostras * 9;
    const esperado = total / 31;
    for (const [, n] of counts) {
      // Tolerância larga: o objetivo é pegar viés grosseiro, não ruído.
      assert.ok(
        n > esperado * 0.6 && n < esperado * 1.4,
        `contagem ${n} fora da faixa esperada em torno de ${esperado.toFixed(0)}`,
      );
    }
  });
});

describe("criação de sala", () => {
  test("primeiro a entrar vira anfitrião", () => {
    const reg = new RoomRegistry();
    const room = reg.create({ hostName: "Ana" });
    const res = reg.join(room.code, { id: "p1", name: "Ana" });
    assert.equal(res.ok, true);
    assert.equal(res.participant.role, "host");
    assert.equal(reg.get(room.code).hostId, "p1");
  });

  test("quem chega depois é espectador", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    reg.join(room.code, { id: "host", name: "Ana" });
    const res = reg.join(room.code, { id: "v1", name: "Bia" });
    assert.equal(res.participant.role, "viewer");
  });

  test("sala inexistente devolve erro específico", () => {
    const reg = new RoomRegistry();
    const res = reg.join("NAOEXISTE", { id: "x" });
    assert.equal(res.ok, false);
    assert.equal(res.error, "sala-nao-encontrada");
  });

  test("respeita o limite de espectadores", () => {
    const reg = new RoomRegistry({ maxViewers: 2 });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    assert.equal(reg.join(room.code, { id: "v1" }).ok, true);
    assert.equal(reg.join(room.code, { id: "v2" }).ok, true);
    const terceiro = reg.join(room.code, { id: "v3" });
    assert.equal(terceiro.ok, false);
    assert.equal(terceiro.error, "sala-cheia");
  });

  test("reingresso do mesmo id não duplica participante", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.join(room.code, { id: "v1", name: "Bia" });
    const again = reg.join(room.code, { id: "v1", name: "Bia" });
    assert.equal(again.rejoined, true);
    assert.equal(reg.get(room.code).participants.size, 2);
  });

  test("o código aceita minúsculas na consulta", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    assert.ok(reg.get(room.code.toLowerCase()));
  });
});

describe("compartilhamento", () => {
  test("só o anfitrião pode iniciar", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.join(room.code, { id: "v1" });
    assert.equal(reg.setSharing(room.code, "v1", true).error, "sem-permissao");
    assert.equal(reg.setSharing(room.code, "host", true).ok, true);
    assert.equal(reg.get(room.code).sharing, true);
  });

  test("sair derruba o estado de transmissão", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.setSharing(room.code, "host", true);
    const res = reg.leave(room.code, "host");
    assert.equal(res.hostLeft, true);
    assert.equal(reg.get(room.code).sharing, false);
    assert.equal(reg.get(room.code).hostId, null);
  });

  test("lista de espectadores exclui o anfitrião", () => {
    const reg = new RoomRegistry();
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.join(room.code, { id: "v1" });
    reg.join(room.code, { id: "v2" });
    const viewers = reg.viewers(room.code, "host");
    assert.equal(viewers.length, 2);
    assert.ok(!viewers.some((v) => v.id === "host"));
  });
});

describe("snapshot", () => {
  test("não vaza nada além do necessário", () => {
    const reg = new RoomRegistry();
    const room = reg.create({ hostName: "Ana" });
    reg.join(room.code, { id: "host", name: "Ana" });
    const snap = reg.snapshot(room.code);
    assert.deepEqual(Object.keys(snap).sort(), [
      "code",
      "hasHost",
      "hostId",
      "hostName",
      "participants",
      "sharing",
    ]);
    for (const p of snap.participants) {
      assert.deepEqual(Object.keys(p).sort(), ["id", "isSharing", "name", "role"]);
    }
  });

  test("sala inexistente devolve null", () => {
    const reg = new RoomRegistry();
    assert.equal(reg.snapshot("NAOEXISTE"), null);
  });
});

describe("limpeza", () => {
  test("derruba participante sem batimento", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    now += HEARTBEAT_TIMEOUT_MS + 1;
    const { dropped } = reg.sweep();
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0].id, "host");
    assert.equal(reg.get(room.code).participants.size, 0);
  });

  test("touch mantém a conexão viva", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    now += HEARTBEAT_TIMEOUT_MS - 1_000;
    reg.touch(room.code, "host");
    now += 1_000;
    const { dropped } = reg.sweep();
    assert.equal(dropped.length, 0);
  });

  test("remove sala vazia depois do TTL", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.leave(room.code, "host");
    now += ROOM_TTL_MS + 1;
    const { removedRooms } = reg.sweep();
    assert.ok(removedRooms.includes(room.code));
    assert.equal(reg.get(room.code), null);
  });

  test("não remove sala que acabou de ser criada", () => {
    const reg = new RoomRegistry();
    reg.create();
    const { removedRooms } = reg.sweep();
    assert.equal(removedRooms.length, 0);
  });

  test("sala com gente dentro não expira pelo relógio", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    // Muito tempo passa, mas o participante continua batendo: a sala tem de
    // sobreviver, porque expirar uma transmissão em andamento seria o pior
    // erro possível deste componente.
    for (let i = 0; i < 10; i += 1) {
      now += ROOM_TTL_MS;
      reg.touch(room.code, "host");
      const { removedRooms } = reg.sweep();
      assert.equal(removedRooms.length, 0, `sala removida na rodada ${i}`);
      assert.ok(reg.get(room.code), "a sala deveria continuar existindo");
    }
  });

  test("sala esvaziada expira uma vez, e só depois do TTL", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    reg.join(room.code, { id: "host" });
    reg.leave(room.code, "host");
    assert.ok(reg.get(room.code), "sala recém-esvaziada ainda deve existir");

    // Logo antes do TTL: ainda está de pé.
    now += ROOM_TTL_MS - 1_000;
    reg.sweep();
    assert.ok(reg.get(room.code), "sala não deveria expirar antes do TTL");

    // Depois do TTL: some.
    now += 2_000;
    const { removedRooms } = reg.sweep();
    assert.ok(removedRooms.includes(room.code));
    assert.equal(reg.get(room.code), null);
  });

  test("sala nunca usada também expira", () => {
    let now = 1_000_000;
    const reg = new RoomRegistry({ now: () => now });
    const room = reg.create();
    now += ROOM_TTL_MS + 1;
    const { removedRooms } = reg.sweep();
    assert.ok(removedRooms.includes(room.code));
  });
});
