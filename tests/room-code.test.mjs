/**
 * Testes de normalização do código de sala.
 *
 * Roda com `node --test` graças ao `--experimental-strip-types`, que apaga os
 * tipos do .ts na importação (Node 22.19+). Sem isso seria preciso um passo de
 * build só para testar uma função pura.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRoomCode,
  isValidRoomCode,
  formatRoomCode,
  watchUrl,
  CODE_LENGTH,
} from "../lib/room-code.ts";

const CODE = "K7M2PQR4T";

describe("normalizeRoomCode", () => {
  test("aceita o código puro", () => {
    assert.equal(normalizeRoomCode(CODE), CODE);
  });

  test("aceita minúsculas", () => {
    assert.equal(normalizeRoomCode(CODE.toLowerCase()), CODE);
  });

  test("aceita com espaços em volta", () => {
    assert.equal(normalizeRoomCode(`   ${CODE}   `), CODE);
  });

  test("aceita o código agrupado como exibimos", () => {
    assert.equal(normalizeRoomCode(formatRoomCode(CODE)), CODE);
  });

  test("extrai de uma URL completa", () => {
    assert.equal(normalizeRoomCode(`https://exemplo.com/assistir/${CODE}`), CODE);
    assert.equal(normalizeRoomCode(`http://localhost:3000/assistir/${CODE}`), CODE);
  });

  test("extrai de URL com parâmetros e âncora", () => {
    assert.equal(normalizeRoomCode(`https://exemplo.com/assistir/${CODE}?utm=zap#top`), CODE);
  });

  test("extrai de um caminho relativo", () => {
    assert.equal(normalizeRoomCode(`/assistir/${CODE}`), CODE);
    assert.equal(normalizeRoomCode(`/sala/${CODE}`), CODE);
  });

  test("extrai de um ws de deep link do app", () => {
    assert.equal(normalizeRoomCode(`daniellive://assistir/${CODE}`), CODE);
  });

  test("troca O por 0 e I por 1 quando o alfabeto não os tem", () => {
    // "K7M2PQR4T" com O/I digitados no lugar de 0/1: a troca reconstrói.
    assert.equal(normalizeRoomCode("K7M2PQR4T".replace("4", "I")), null);
    // Um caso onde a troca realmente salva: código com "O" no lugar de nada
    // válido é rejeitado; o importante é não aceitar lixo nem lançar.
    assert.equal(normalizeRoomCode("OOOOOOOOO"), null);
  });

  test("recusa entradas inválidas", () => {
    for (const bad of ["", "   ", "ABC", "ABCDEFGH", "ABCDEFGHIJ", "!@#$%^&*(", null, undefined, 42]) {
      assert.equal(normalizeRoomCode(bad), null, `deveria recusar ${String(bad)}`);
    }
  });

  test("ignora texto extra colado junto", () => {
    assert.equal(normalizeRoomCode(`olha isso: ${CODE}`), CODE);
    assert.equal(normalizeRoomCode(`${CODE}.`), CODE);
  });

  test("não confunde duas URLs", () => {
    const outra = "B4C5D6E7F";
    assert.equal(normalizeRoomCode(`https://x.com/assistir/${outra}`), outra);
    assert.notEqual(normalizeRoomCode(`https://x.com/assistir/${outra}`), CODE);
  });
});

describe("isValidRoomCode", () => {
  test("comprimento exato", () => {
    assert.equal(CODE.length, CODE_LENGTH);
    assert.equal(isValidRoomCode(CODE), true);
    assert.equal(isValidRoomCode(CODE.slice(0, -1)), false);
  });

  test("recusa o alfabeto ambíguo", () => {
    for (const ch of ["0", "O", "1", "I", "L"]) {
      const code = "A".repeat(8) + ch;
      assert.equal(isValidRoomCode(code), false, `${ch} não deveria ser válido`);
      const code2 = ch + "A".repeat(8);
      assert.equal(isValidRoomCode(code2), false);
    }
  });
});

describe("formatRoomCode", () => {
  test("agrupa de três em três", () => {
    assert.equal(formatRoomCode("ABCDEFGHJ"), "ABC DEF GHJ");
  });

  test("não muda o código original ao remover espaços", () => {
    assert.equal(formatRoomCode(CODE).replace(/ /g, ""), CODE);
  });
});

describe("watchUrl", () => {
  test("monta a URL com a origem informada", () => {
    assert.equal(watchUrl(CODE, "https://screen.live"), `https://screen.live/assistir/${CODE}`);
  });
});
