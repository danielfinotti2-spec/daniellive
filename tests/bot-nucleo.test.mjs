/**
 * Testes do núcleo do bot: chave, estado e regra de sessão.
 *
 * Nenhum teste aqui abre conexão com o Discord nem precisa de token. O núcleo
 * foi escrito com as operações de Discord injetadas justamente para isso: a
 * parte que erra na prática (quando fechar a sessão, quando reenviar o link,
 * o que fazer quando duas calls disputam a mesma chave) é testável de forma
 * determinística.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  gerarChave,
  gerarChaveLivre,
  chaveValida,
  montarLink,
  extrairChave,
  ESPACO,
  DIGITOS,
} from "../bot/chave.mjs";
import { EstadoDoBot, CONFIG_PADRAO } from "../bot/estado.mjs";
import { aoEntrarNaVoz, aoSairDaVoz, aoMudarDeVoz } from "../bot/sessao.mjs";

const ORIGEM = "https://daniellive.onrender.com";

/** Um "mundo" falso que registra o que o bot fez. */
function mundoFalso({
  pessoas = 0,
  ultimaMensagem = null,
  falharStatus = false,
  falharChat = false,
} = {}) {
  const registro = { links: [], status: [], limpouStatus: [], buscouUltima: 0 };
  return {
    registro,
    pessoas,
    async humanoNaVoz() {
      return this.pessoas;
    },
    async ultimaMensagemDoBot() {
      registro.buscouUltima += 1;
      return ultimaMensagem;
    },
    async publicarLink(_channelId, texto) {
      if (falharChat) throw new Error("sem permissão");
      registro.links.push(texto);
    },
    async definirStatus(_channelId, texto) {
      if (falharStatus) throw new Error("sem permissão");
      registro.status.push(texto);
    },
    async limparStatus(_channelId) {
      registro.limpouStatus.push(true);
    },
    montarLink: (chave) => montarLink(chave, { origem: ORIGEM }),
    extrairChave: (texto) => extrairChave(texto, { origem: ORIGEM }),
  };
}

const presencaDeEntrada = (channelId = "canal-1") => ({
  guildId: "servidor-1",
  channelId,
  membroEhBot: false,
});

describe("chave da sessão", () => {
  test("tem 5 dígitos, com zeros à esquerda preservados", () => {
    for (let i = 0; i < 500; i += 1) {
      const c = gerarChave();
      assert.equal(c.length, DIGITOS, c);
      assert.match(c, /^\d{5}$/);
    }
  });

  test("cobre o espaço inteiro, inclusive as pontas", () => {
    // Não dá para provar uniformidade com 500 amostras, mas dá para provar que
    // o intervalo usado não é enviesado por um módulo errado: as chaves
    // sorteadas precisam passar de 90 mil às vezes, num volume razoável.
    const vistas = new Set();
    for (let i = 0; i < 2000; i += 1) vistas.add(Number(gerarChave()));
    assert.ok(Math.max(...vistas) > 90_000, "nunca sorteou chave alta");
    assert.ok(Math.min(...vistas) < 10_000, "nunca sorteou chave baixa");
    assert.ok(vistas.size > 1500, `pouca variedade: ${vistas.size}`);
  });

  test("o espaço é o esperado", () => {
    assert.equal(ESPACO, 100_000);
  });

  test("validação aceita só o formato emitido", () => {
    assert.equal(chaveValida("00000"), true);
    assert.equal(chaveValida("47291"), true);
    for (const ruim of ["4729", "472911", "4729a", "", null, undefined, 47291, " 4729"]) {
      assert.equal(chaveValida(ruim), false, `aceitou ${JSON.stringify(ruim)}`);
    }
  });

  test("gerarChaveLivre evita chaves ocupadas", async () => {
    const ocupadas = new Set();
    // Ocupa 99% do espaço: o gerador tem que achar as poucas livres.
    for (let i = 0; i < 99_000; i += 1) ocupadas.add(String(i).padStart(5, "0"));
    const livre = await gerarChaveLivre((c) => ocupadas.has(c), { tentativas: 5000 });
    assert.equal(ocupadas.has(livre), false);
  });

  test("gerarChaveLivre desiste de forma explícita quando não há chave livre", async () => {
    await assert.rejects(
      () => gerarChaveLivre(() => true, { tentativas: 5 }),
      /não foi possível gerar uma chave/,
    );
  });

  test("gerarChaveLivre aceita função assíncrona de disponibilidade", async () => {
    const ocupada = gerarChave();
    const chave = await gerarChaveLivre(async (c) => c === ocupada, { tentativas: 500 });
    assert.notEqual(chave, ocupada);
  });
});

describe("montagem do link", () => {
  test("monta com o caminho padrão do DanielLive", () => {
    assert.equal(
      montarLink("47291", { origem: ORIGEM }),
      "https://daniellive.onrender.com/assistir/47291",
    );
  });

  test("respeita origem com barra no fim e caminho alternativo", () => {
    assert.equal(
      montarLink("00042", { origem: "https://exemplo.com/", caminho: "/w/priv" }),
      "https://exemplo.com/w/priv/00042",
    );
    assert.equal(montarLink("00042", { origem: ORIGEM, caminho: "sala" }), `${ORIGEM}/sala/00042`);
  });

  test("chave inválida é erro, não link torto", () => {
    assert.throws(() => montarLink("12", { origem: ORIGEM }), /chave inválida/);
    assert.throws(() => montarLink("", { origem: ORIGEM }), /chave inválida/);
  });

  test("origem ausente é erro de configuração", () => {
    assert.throws(() => montarLink("12345", { origem: "" }), /origem pública não configurada/);
    assert.throws(() => montarLink("12345", {}), /origem pública não configurada/);
  });

  test("extrai a chave de uma mensagem do bot", () => {
    const texto = `Transmita sua tela por aqui: ${ORIGEM}/assistir/47291`;
    assert.equal(extrairChave(texto, { origem: ORIGEM }), "47291");
  });

  test("não confunde horário nem número solto com chave", () => {
    assert.equal(extrairChave("a reunião é 12:30 e o número é 47291", { origem: ORIGEM }), null);
    assert.equal(extrairChave("outro site: https://outro.com/assistir/47291", { origem: ORIGEM }), null);
    assert.equal(extrairChave("", { origem: ORIGEM }), null);
    assert.equal(extrairChave(null, { origem: ORIGEM }), null);
  });

  test("o link gerado volta pelo extrator", () => {
    const link = montarLink("00007", { origem: ORIGEM });
    assert.equal(extrairChave(link, { origem: ORIGEM }), "00007");
  });
});

describe("estado do bot", () => {
  test("abre e encerra sessão, liberando a chave", () => {
    const estado = new EstadoDoBot();
    const s = estado.abrirSessao("g1", "c1", "12345");
    assert.equal(s.chave, "12345");
    assert.equal(estado.sessaoDe("g1", "c1").chave, "12345");
    assert.equal(estado.chaveEmUso("12345"), true);

    const encerrada = estado.encerrarSessao("g1", "c1");
    assert.equal(encerrada.chave, "12345");
    assert.equal(estado.sessaoDe("g1", "c1"), null);
    assert.equal(estado.chaveEmUso("12345"), false, "a chave precisa voltar ao bolo");
  });

  test("abrir duas vezes a mesma call não substitui a sessão", () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("g1", "c1", "11111");
    assert.equal(estado.abrirSessao("g1", "c1", "22222"), null);
    assert.equal(estado.sessaoDe("g1", "c1").chave, "11111");
  });

  test("recusa chave já usada por outra call", () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("g1", "c1", "12345");
    assert.throws(() => estado.abrirSessao("g1", "c2", "12345"), /já está em uso/);
  });

  test("a mesma chave pode ser reusada depois de encerrada", () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("g1", "c1", "12345");
    estado.encerrarSessao("g1", "c1");
    assert.doesNotThrow(() => estado.abrirSessao("g1", "c2", "12345"));
  });

  test("servidores e canais diferentes não colidem", () => {
    const estado = new EstadoDoBot();
    estado.abrirSessao("g1", "c1", "11111");
    estado.abrirSessao("g2", "c1", "22222");
    estado.abrirSessao("g1", "c2", "33333");
    assert.equal(estado.totalDeSessoes, 3);
  });

  test("encerrar sessão inexistente devolve null", () => {
    const estado = new EstadoDoBot();
    assert.equal(estado.encerrarSessao("g1", "nada"), null);
  });

  test("configuração começa nos padrões", () => {
    const estado = new EstadoDoBot();
    assert.deepEqual(estado.configDe("g1"), { chat: true, status: true });
    assert.deepEqual(estado.configDe("g1"), CONFIG_PADRAO);
  });

  test("mudar configuração afeta só aquele servidor", () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("g1", "chat", false);
    assert.equal(estado.configDe("g1").chat, false);
    assert.equal(estado.configDe("g2").chat, true);
  });

  test("configuração aceita só campos conhecidos", () => {
    const estado = new EstadoDoBot();
    assert.throws(() => estado.definirConfig("g1", "qualquerCoisa", true), /desconhecido/);
  });

  test("valor diferente de true vira false", () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("g1", "status", "sim");
    assert.equal(estado.configDe("g1").status, false);
  });
});

describe("entrada na call", () => {
  test("primeira pessoa gera chave, publica no chat e põe no status", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(r.acao, "aberta");
    assert.match(r.chave, /^\d{5}$/);
    assert.equal(r.enviouMensagem, true);
    assert.deepEqual(mundo.registro.links, [r.link]);
    assert.deepEqual(mundo.registro.status, [r.link]);
    assert.equal(r.link, `${ORIGEM}/assistir/${r.chave}`);
  });

  test("segunda pessoa não reenvia nem troca a chave", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const primeira = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    const segunda = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(segunda.acao, "reaproveitada");
    assert.equal(segunda.chave, primeira.chave);
    assert.equal(mundo.registro.links.length, 1, "o chat não pode receber o link duas vezes");
  });

  test("bot entrando na call é ignorado", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const r = await aoEntrarNaVoz({
      presenca: { ...presencaDeEntrada(), membroEhBot: true },
      estado,
      mundo,
    });
    assert.equal(r.acao, "ignorado");
    assert.equal(estado.totalDeSessoes, 0);
  });

  test("reaproveita a chave publicada antes (call que esvaziou e voltou)", async () => {
    const estado = new EstadoDoBot();
    const chaveAntiga = "54321";
    const mundo = mundoFalso({
      ultimaMensagem: `Transmita sua tela por aqui: ${ORIGEM}/assistir/${chaveAntiga}`,
    });
    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    assert.equal(r.chave, chaveAntiga);
    assert.equal(r.reaproveitada, true);
    assert.equal(r.enviouMensagem, false, "a mensagem antiga já está no chat");
  });

  test("reaproveitar repõe o status mesmo assim", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso({ ultimaMensagem: `${ORIGEM}/assistir/54321` });
    await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    assert.equal(mundo.registro.status.length, 1, "o status do canal some com o fim da call");
  });

  test("não reaproveita chave que outra call tomou no meio-tempo", async () => {
    const estado = new EstadoDoBot();
    const chaveDeOutra = "99999";
    estado.abrirSessao("g-outro", "c-outro", chaveDeOutra);
    const mundo = mundoFalso({ ultimaMensagem: `${ORIGEM}/assistir/${chaveDeOutra}` });

    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    assert.notEqual(r.chave, chaveDeOutra, "duas calls não podem cair no mesmo link");
    assert.equal(r.reaproveitada, false);
  });

  test("configuração desliga o chat", async () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("servidor-1", "chat", false);
    const mundo = mundoFalso();
    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(r.acao, "aberta");
    assert.equal(r.enviouMensagem, false);
    assert.deepEqual(mundo.registro.links, []);
    assert.equal(mundo.registro.status.length, 1, "o status continua valendo");
  });

  test("configuração desliga o status", async () => {
    const estado = new EstadoDoBot();
    estado.definirConfig("servidor-1", "status", false);
    const mundo = mundoFalso();
    await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.deepEqual(mundo.registro.status, []);
    assert.equal(mundo.registro.links.length, 1);
  });

  test("falta de permissão num canal não impede a sessão de existir", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso({ falharChat: true, falharStatus: true });
    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(r.acao, "aberta");
    assert.equal(estado.totalDeSessoes, 1, "a sessão vale mesmo sem conseguir avisar");
  });

  test("falha ao ler a última mensagem não derruba a entrada", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    mundo.ultimaMensagemDoBot = async () => {
      throw new Error("sem permissão de leitura");
    };
    const r = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    assert.equal(r.acao, "aberta");
    assert.match(r.chave, /^\d{5}$/);
  });
});

describe("saída da call", () => {
  test("sair com gente ainda na call mantém a sessão", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const r1 = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    mundo.pessoas = 2;
    const r2 = await aoSairDaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(r2.acao, "mantida");
    assert.equal(r2.restantes, 2);
    assert.equal(estado.sessaoDe("servidor-1", "canal-1").chave, r1.chave);
    assert.deepEqual(mundo.registro.limpouStatus, []);
  });

  test("última pessoa a sair encerra a sessão e limpa o status", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    mundo.pessoas = 0;
    const r = await aoSairDaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    assert.equal(r.acao, "encerrada");
    assert.equal(estado.totalDeSessoes, 0);
    assert.equal(estado.chaveEmUso(r.chave), false);
    assert.deepEqual(mundo.registro.limpouStatus, [true]);
  });

  test("sair de um canal sem sessão é ignorado", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso({ pessoas: 0 });
    const r = await aoSairDaVoz({ presenca: presencaDeEntrada("canal-sem-sessao"), estado, mundo });
    assert.equal(r.acao, "ignorado");
    assert.equal(r.motivo, "sem-sessao");
  });

  test("bot saindo não encerra a sessão de ninguém", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    mundo.pessoas = 0;
    const r = await aoSairDaVoz({
      presenca: { ...presencaDeEntrada(), membroEhBot: true },
      estado,
      mundo,
    });
    assert.equal(r.acao, "ignorado");
    assert.equal(estado.totalDeSessoes, 1);
  });

  test("o ciclo entrar → esvaziar → entrar volta com a MESMA chave", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const primeira = await aoEntrarNaVoz({ presenca: presencaDeEntrada(), estado, mundo });
    const linkPublicado = mundo.registro.links[0];

    mundo.pessoas = 0;
    await aoSairDaVoz({ presenca: presencaDeEntrada(), estado, mundo });

    // A mensagem anterior continua no chat.
    mundo.pessoas = 1;
    mundo
    const segunda = await aoEntrarNaVoz({
      presenca: presencaDeEntrada(),
      estado,
      mundo: { ...mundo, ultimaMensagemDoBot: async () => linkPublicado },
    });

    assert.equal(segunda.chave, primeira.chave, "quem guardou o link continua entrando");
    assert.equal(segunda.reaproveitada, true);
  });
});

describe("troca de canal", () => {
  test("mudar de canal encerra a sessão do antigo e abre no novo", async () => {
    const estado = new EstadoDoBot();
    const mundo = mundoFalso();
    const entrada = await aoEntrarNaVoz({ presenca: presencaDeEntrada("canal-a"), estado, mundo });

    // Ele saiu de A (que ficou vazio) e entrou em B.
    mundo.pessoas = 0;
    const r = await aoMudarDeVoz({
      de: presencaDeEntrada("canal-a"),
      para: presencaDeEntrada("canal-b"),
      estado,
      mundo,
    });

    assert.equal(r.saida.acao, "encerrada");
    assert.equal(r.entrada.acao, "aberta");
    assert.equal(estado.sessaoDe("servidor-1", "canal-a"), null);
    assert.ok(estado.sessaoDe("servidor-1", "canal-b"));
    // A chave do canal A foi liberada e a do canal B é outra.
    assert.notEqual(r.entrada.chave, entrada.chave);
  });
});
