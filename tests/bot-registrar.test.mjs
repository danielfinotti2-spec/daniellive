/**
 * Testes do registro de comandos.
 *
 * O `fetch` é injetado, então nada aqui toca a rede: o que se prova é o que o
 * bot MANDA para a API (rota certa, verbo certo, cabeçalho certo, corpo igual
 * ao que está no código) e o que ele faz com uma resposta ruim.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { lerEnvDeRegistro, registrarComandos } from "../bot/registrar.mjs";
import { definicoesDeComandos } from "../bot/comandos.mjs";

const ENV = { DISCORD_TOKEN: "tok", DISCORD_CLIENT_ID: "12345" };

/**
 * `registrarComandos` espera o objeto já normalizado por `lerEnvDeRegistro`
 * (`clientId`, não `DISCORD_CLIENT_ID`) — ler o ambiente é responsabilidade
 * daquele passo, e não desta função.
 */
const PRONTO = { token: "tok", clientId: "12345", guildId: null };

/** `fetch` falso que registra a chamada e responde o que for pedido. */
function fetchFalso({ ok = true, status = 200, corpo = "[]" } = {}) {
  const chamadas = [];
  const fn = async (url, opcoes) => {
    chamadas.push({ url, ...opcoes });
    return { ok, status, text: async () => corpo };
  };
  fn.chamadas = chamadas;
  return fn;
}

describe("ambiente de registro", () => {
  test("aceita token e client id, sem servidor", () => {
    assert.deepEqual(lerEnvDeRegistro(ENV), { token: "tok", clientId: "12345", guildId: null });
  });

  test("com servidor, registra no escopo dele", () => {
    const env = lerEnvDeRegistro({ ...ENV, DISCORD_GUILD_ID: "999" });
    assert.equal(env.guildId, "999");
  });

  test("lista as duas variáveis que faltam de uma vez", () => {
    assert.throws(() => lerEnvDeRegistro({}), /DISCORD_TOKEN, DISCORD_CLIENT_ID/);
  });

  test("aponta onde achar o client id", () => {
    assert.throws(() => lerEnvDeRegistro({ DISCORD_TOKEN: "t" }), /Application ID/);
  });

  test("valor em branco conta como faltando", () => {
    assert.throws(() => lerEnvDeRegistro({ ...ENV, DISCORD_TOKEN: "  " }), /DISCORD_TOKEN/);
  });
});

describe("registro dos comandos", () => {
  test("registra no escopo global quando não há servidor", async () => {
    const fetch = fetchFalso({ corpo: '[{"name":"status"},{"name":"link"},{"name":"config"}]' });
    const r = await registrarComandos(PRONTO, { fetch });

    assert.equal(fetch.chamadas[0].url, "https://discord.com/api/v10/applications/12345/commands");
    assert.equal(fetch.chamadas[0].method, "PUT");
    assert.equal(fetch.chamadas[0].headers.authorization, "Bot tok");
    assert.deepEqual(r.comandos, ["status", "link", "config"]);
    assert.equal(r.escopo, "global");
  });

  test("registra no escopo do servidor quando informado", async () => {
    const fetch = fetchFalso({ corpo: "[]" });
    const r = await registrarComandos({ ...PRONTO, guildId: "999" }, { fetch });

    assert.equal(
      fetch.chamadas[0].url,
      "https://discord.com/api/v10/applications/12345/guilds/999/commands",
    );
    assert.match(r.escopo, /servidor 999/);
  });

  test("usa PUT, que substitui o conjunto inteiro", async () => {
    // POST deixaria comandos antigos para trás; PUT garante que o Discord
    // tenha exatamente o que está no código.
    const fetch = fetchFalso();
    await registrarComandos(PRONTO, { fetch });
    assert.equal(fetch.chamadas[0].method, "PUT");
  });

  test("mandar o corpo igual à definição do código", async () => {
    const fetch = fetchFalso();
    await registrarComandos(ENV, { fetch });
    const enviado = JSON.parse(fetch.chamadas[0].body);
    assert.deepEqual(enviado, JSON.parse(JSON.stringify(definicoesDeComandos())));
  });

  test("erro do Discord vira mensagem com o status e o motivo", async () => {
    const fetch = fetchFalso({ ok: false, status: 401, corpo: "401: Unauthorized" });
    await assert.rejects(
      () => registrarComandos(PRONTO, { fetch }),
      /HTTP 401\).*401: Unauthorized/,
    );
  });

  test("resposta que não é JSON vira erro claro", async () => {
    const fetch = fetchFalso({ ok: true, corpo: "<html>erro</html>" });
    await assert.rejects(() => registrarComandos(ENV, { fetch }), /resposta inesperada/);
  });

  test("resposta JSON que não é lista vira erro", async () => {
    const fetch = fetchFalso({ ok: true, corpo: '{"erro":"nao"}' });
    await assert.rejects(() => registrarComandos(ENV, { fetch }), /lista de comandos/);
  });
});
