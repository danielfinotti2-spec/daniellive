/**
 * Testes dos comandos e da configuração do bot.
 *
 * Os comandos são testados com uma "interação" falsa: um objeto que registra o
 * que foi respondido. É o suficiente para provar as regras que importam —
 * quem pode usar `/config`, o que acontece fora de uma call, e que a resposta é
 * sempre efêmera (ninguém quer o `status` do bot poluindo o canal a cada uso).
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { definicoesDeComandos, textoDeStatus } from "../bot/comandos.mjs";
import { EstadoDoBot } from "../bot/estado.mjs";
import { lerConfiguracao } from "../bot/index.mjs";

const ORIGEM = "https://daniellive.onrender.com";

/** Interação falsa que registra as respostas. */
function interacaoFalsa({
  comando,
  emServidor = true,
  permissoes = true,
  canalDeVoz = null,
  opcoes = {},
} = {}) {
  const respostas = [];
  return {
    respostas,
    commandName: comando,
    guildId: "servidor-1",
    replied: false,
    deferred: false,
    member: { voice: { channelId: canalDeVoz } },
    memberPermissions: { has: () => permissoes },
    inGuild: () => emServidor,
    isChatInputCommand: () => true,
    options: {
      getString: (nome) => opcoes[nome],
      getBoolean: (nome) => opcoes[nome],
    },
    async reply(r) {
      this.replied = true;
      respostas.push(r);
    },
    async followUp(r) {
      respostas.push(r);
    },
  };
}

/**
 * Executa o handler de comandos sem um client de verdade: o `ligarComandos`
 * só registra o listener, então basta capturá-lo e chamar.
 */
async function executar(interacao, estado) {
  const { ligarComandos } = await import("../bot/comandos.mjs");
  let handler = null;
  ligarComandos({ on: (_evento, fn) => (handler = fn) }, estado, { origem: ORIGEM });
  assert.ok(handler, "o handler de interações deveria ter sido registrado");
  await handler(interacao);
  return interacao.respostas;
}

describe("definição dos comandos", () => {
  test("são exatamente os três comandos previstos", () => {
    assert.deepEqual(
      definicoesDeComandos().map((c) => c.name),
      ["status", "link", "config"],
    );
  });

  test("/config exige Gerenciar Servidor", () => {
    const config = definicoesDeComandos().find((c) => c.name === "config");
    // MANAGE_GUILD = 1 << 5 = 32
    assert.equal(config.default_member_permissions, "32");
  });

  test("/status e /link são livres", () => {
    for (const nome of ["status", "link"]) {
      const c = definicoesDeComandos().find((x) => x.name === nome);
      assert.equal(c.default_member_permissions, undefined);
    }
  });

  test("/config tem as duas opções e as duas escolhas", () => {
    const config = definicoesDeComandos().find((c) => c.name === "config");
    assert.deepEqual(config.options.map((o) => o.name), ["opcao", "ligado"]);
    assert.deepEqual(
      config.options[0].choices.map((c) => c.value),
      ["chat", "status"],
    );
  });
});

describe("comando /status", () => {
  test("responde de forma efêmera e mostra a configuração", async () => {
    const estado = new EstadoDoBot();
    const interacao = interacaoFalsa({ comando: "status" });
    const respostas = await executar(interacao, estado);

    assert.equal(respostas.length, 1);
    assert.equal(respostas[0].ephemeral, true);
    assert.match(respostas[0].content, /Aviso no chat da call: \*\*ligado\*\*/);
    assert.match(respostas[0].content, /Aviso no status da call: \*\*ligado\*\*/);
    assert.match(respostas[0].content, /Nenhuma call com link/);
  });

  test("lista as calls com chave", async () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("servidor-1", "canal-a", "11111");
    estado.abrirSessao("servidor-1", "canal-b", "22222");
    // De outro servidor: não pode aparecer.
    estado.abrirSessao("servidor-2", "canal-x", "33333");

    const respostas = await executar(interacaoFalsa({ comando: "status" }), estado);
    const texto = respostas[0].content;
    assert.match(texto, /\*\*2\*\* call\(s\) com link/);
    assert.match(texto, /canal-a/);
    assert.match(texto, /11111/);
    assert.equal(texto.includes("33333"), false, "sala de outro servidor vazou");
  });

  test("reflete configuração desligada", async () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("servidor-1", "chat", false);
    const respostas = await executar(interacaoFalsa({ comando: "status" }), estado);
    assert.match(respostas[0].content, /Aviso no chat da call: \*\*desligado\*\*/);
  });
});

describe("comando /link", () => {
  test("fora de canal de voz, explica em vez de falhar", async () => {
    const estado = new EstadoDoBot();
    const respostas = await executar(interacaoFalsa({ comando: "link", canalDeVoz: null }), estado);
    assert.equal(respostas.length, 1);
    assert.match(respostas[0].content, /Entre num canal de voz/);
    assert.equal(respostas[0].ephemeral, true);
  });

  test("numa call sem sessão, explica", async () => {
    const estado = new EstadoDoBot();
    const respostas = await executar(
      interacaoFalsa({ comando: "link", canalDeVoz: "canal-vazio" }),
      estado,
    );
    assert.match(respostas[0].content, /ainda não tem link/);
  });

  test("republica o link da call onde a pessoa está", async () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("servidor-1", "canal-a", "47291");
    const respostas = await executar(
      interacaoFalsa({ comando: "link", canalDeVoz: "canal-a" }),
      estado,
    );
    assert.equal(respostas[0].content, `${ORIGEM}/assistir/47291`);
    // Aqui a resposta é pública de propósito: a pessoa pediu o link para usar.
    assert.equal(respostas[0].ephemeral, undefined);
  });
});

describe("comando /config", () => {
  test("sem permissão, recusa", async () => {
    const estado = new EstadoDoBot();
    const respostas = await executar(
      interacaoFalsa({ comando: "config", permissoes: false, opcoes: { opcao: "chat", ligado: false } }),
      estado,
    );
    assert.match(respostas[0].content, /Gerenciar Servidor/);
    assert.equal(estado.configDe("servidor-1").chat, true, "não podia ter mudado nada");
  });

  test("com permissão, desliga o chat", async () => {
    const estado = new EstadoDoBot();
    const respostas = await executar(
      interacaoFalsa({ comando: "config", opcoes: { opcao: "chat", ligado: false } }),
      estado,
    );
    assert.match(respostas[0].content, /\*\*DESLIGADO\*\*/);
    assert.equal(estado.configDe("servidor-1").chat, false);
  });

  test("com permissão, liga de volta", async () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("servidor-1", "status", false);
    const respostas = await executar(
      interacaoFalsa({ comando: "config", opcoes: { opcao: "status", ligado: true } }),
      estado,
    );
    assert.match(respostas[0].content, /\*\*LIGADO\*\*/);
    assert.equal(estado.configDe("servidor-1").status, true);
  });

  test("afeta só o servidor de quem chamou", async () => {
    const estado = new EstadoDoBot();
    await executar(interacaoFalsa({ comando: "config", opcoes: { opcao: "chat", ligado: false } }), estado);
    assert.equal(estado.configDe("servidor-1").chat, false);
    assert.equal(estado.configDe("servidor-2").chat, true);
  });
});

describe("fora de servidor", () => {
  test("nenhum comando funciona na DM", async () => {
    const estado = new EstadoDoBot();
    for (const comando of ["status", "link", "config"]) {
      const respostas = await executar(
        interacaoFalsa({ comando, emServidor: false }),
        estado,
      );
      assert.match(respostas[0].content, /dentro de um servidor/, comando);
    }
  });
});

describe("textoDeStatus", () => {
  test("mostra os padrões de um servidor novo", () => {
    const t = textoDeStatus(new EstadoDoBot(), "servidor-novo");
    assert.match(t, /chat da call: \*\*ligado\*\*/);
    assert.match(t, /Nenhuma call/);
  });
});

describe("configuração do ambiente", () => {
  const valido = { DISCORD_TOKEN: "abc.def.ghi", DANIELLIVE_ORIGIN: ORIGEM };

  test("aceita uma configuração completa", () => {
    const c = lerConfiguracao(valido);
    assert.equal(c.token, "abc.def.ghi");
    assert.equal(c.origem, ORIGEM);
    assert.equal(c.caminho, "/assistir");
  });

  test("remove barra do fim da origem", () => {
    assert.equal(lerConfiguracao({ ...valido, DANIELLIVE_ORIGIN: `${ORIGEM}///` }).origem, ORIGEM);
  });

  test("lista TODAS as variáveis que faltam de uma vez", () => {
    assert.throws(() => lerConfiguracao({}), /DISCORD_TOKEN, DANIELLIVE_ORIGIN/);
  });

  test("token em branco conta como faltando", () => {
    assert.throws(() => lerConfiguracao({ ...valido, DISCORD_TOKEN: "   " }), /DISCORD_TOKEN/);
  });

  test("origem inválida é recusada", () => {
    assert.throws(() => lerConfiguracao({ ...valido, DANIELLIVE_ORIGIN: "nao é url" }), /não é uma URL válida/);
  });

  test("http fora de localhost é recusado", () => {
    assert.throws(
      () => lerConfiguracao({ ...valido, DANIELLIVE_ORIGIN: "http://exemplo.com" }),
      /precisa ser https/,
    );
  });

  test("http em localhost é aceito para desenvolvimento", () => {
    const c = lerConfiguracao({ ...valido, DANIELLIVE_ORIGIN: "http://localhost:3000" });
    assert.equal(c.origem, "http://localhost:3000");
  });

  test("caminho alternativo é respeitado", () => {
    assert.equal(lerConfiguracao({ ...valido, DANIELLIVE_PATH: "/w/priv" }).caminho, "/w/priv");
  });
});
