/**
 * Testes do anúncio do site (server/anuncio.mjs).
 *
 * O anúncio aparece por cima de TODA sala, então o que se testa aqui é o que
 * pode dar errado nesse tipo de recurso: texto gigante, URL perigosa, prazo que
 * nunca chega (anúncio esquecido) ou que já nasceu vencido.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

const {
  validarAnuncio,
  QuadroDeAnuncios,
  urlSegura,
  MAX_TEXTO,
  MAX_ROTULO_BOTAO,
  DURACAO_MAXIMA_MS,
} = await import("../server/anuncio.mjs");

const AGORA = 1_800_000_000_000; // data fixa: o relógio real não pode decidir o teste

function valido(extra = {}) {
  return validarAnuncio({ texto: "Manutenção hoje às 22h" }, { agora: AGORA });
}

describe("validação do anúncio", () => {
  test("aceita o caso simples e aplica os padrões", () => {
    const r = valido();
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.anuncio.texto, "Manutenção hoje às 22h");
    assert.equal(r.anuncio.cor, "azul");
    assert.equal(r.anuncio.dispensavel, true);
    assert.equal(r.anuncio.botao, null);
    assert.equal(r.anuncio.expiraEm, null);
    assert.equal(r.anuncio.criadoEm, AGORA);
  });

  test("recusa texto vazio, só espaços e texto longo", () => {
    assert.deepEqual(validarAnuncio({ texto: "" }, { agora: AGORA }), { ok: false, erro: "texto-vazio" });
    assert.deepEqual(validarAnuncio({ texto: "   " }, { agora: AGORA }), { ok: false, erro: "texto-vazio" });
    assert.deepEqual(validarAnuncio({ texto: 42 }, { agora: AGORA }), { ok: false, erro: "texto-vazio" });
    const gigante = "a".repeat(MAX_TEXTO + 1);
    assert.deepEqual(validarAnuncio({ texto: gigante }, { agora: AGORA }), { ok: false, erro: "texto-longo" });
  });

  test("aceita exatamente o tamanho máximo", () => {
    const noLimite = "a".repeat(MAX_TEXTO);
    assert.equal(validarAnuncio({ texto: noLimite }, { agora: AGORA }).ok, true);
  });

  test("permite quebra de linha no texto, mas nenhum outro caractere de controle", () => {
    assert.equal(validarAnuncio({ texto: "linha 1\nlinha 2" }, { agora: AGORA }).ok, true);
    assert.deepEqual(
      validarAnuncio({ texto: "com\u0000nulo" }, { agora: AGORA }),
      { ok: false, erro: "texto-com-controle" },
    );
    assert.deepEqual(
      validarAnuncio({ texto: "com\u001bescape" }, { agora: AGORA }),
      { ok: false, erro: "texto-com-controle" },
    );
  });

  test("recusa cor fora da lista", () => {
    assert.deepEqual(
      validarAnuncio({ texto: "oi", cor: "roxo" }, { agora: AGORA }),
      { ok: false, erro: "cor-invalida" },
    );
    for (const cor of ["verde", "vermelho", "azul"]) {
      assert.equal(validarAnuncio({ texto: "oi", cor }, { agora: AGORA }).ok, true, cor);
    }
  });

  test("recusa corpo que não é objeto", () => {
    for (const lixo of [null, undefined, 42, "texto", [], true]) {
      assert.deepEqual(validarAnuncio(lixo, { agora: AGORA }), { ok: false, erro: "corpo-invalido" });
    }
  });
});

describe("botão do anúncio", () => {
  test("aceita botão completo com ação de abrir aba", () => {
    const r = validarAnuncio(
      { texto: "Saiu a versão 1.0.3", botao: { rotulo: "Baixar", url: "https://github.com/x/y" } },
      { agora: AGORA },
    );
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.anuncio.botao.rotulo, "Baixar");
    assert.equal(r.anuncio.botao.acao, "abrir-nova-aba");
    assert.equal(r.anuncio.botao.url, "https://github.com/x/y");
  });

  test("exige rótulo", () => {
    assert.deepEqual(
      validarAnuncio({ texto: "oi", botao: { url: "https://x.com" } }, { agora: AGORA }),
      { ok: false, erro: "botao-sem-rotulo" },
    );
    assert.deepEqual(
      validarAnuncio({ texto: "oi", botao: { rotulo: "  ", url: "https://x.com" } }, { agora: AGORA }),
      { ok: false, erro: "botao-sem-rotulo" },
    );
  });

  test("recusa rótulo longo demais", () => {
    const r = validarAnuncio(
      { texto: "oi", botao: { rotulo: "a".repeat(MAX_ROTULO_BOTAO + 1), url: "https://x.com" } },
      { agora: AGORA },
    );
    assert.deepEqual(r, { ok: false, erro: "botao-rotulo-longo" });
  });

  test("recusa ação desconhecida", () => {
    const r = validarAnuncio(
      { texto: "oi", botao: { rotulo: "ok", acao: "explodir" } },
      { agora: AGORA },
    );
    assert.deepEqual(r, { ok: false, erro: "botao-acao-invalida" });
  });

  test("'recarregar' não exige URL", () => {
    const r = validarAnuncio(
      { texto: "Nova versão disponível", botao: { rotulo: "Recarregar", acao: "recarregar" } },
      { agora: AGORA },
    );
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.anuncio.botao.url, null);
  });

  test("recusa javascript:, data: e outros esquemas no link", () => {
    for (const url of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///C:/Windows/System32/calc.exe",
      "ftp://servidor/arquivo",
      "não é uma url",
      "",
    ]) {
      const r = validarAnuncio({ texto: "oi", botao: { rotulo: "Clique", url } }, { agora: AGORA });
      assert.deepEqual(r, { ok: false, erro: "botao-url-invalida" }, `aceitou ${url}`);
    }
  });
});

describe("urlSegura", () => {
  test("aceita http e https", () => {
    assert.equal(urlSegura("https://daniellive.onrender.com"), "https://daniellive.onrender.com/");
    assert.equal(urlSegura("http://localhost:3000/x"), "http://localhost:3000/x");
  });

  test("devolve null para entrada que não é string", () => {
    for (const lixo of [null, undefined, 42, {}, []]) assert.equal(urlSegura(lixo), null);
  });
});

describe("prazo do anúncio", () => {
  test("aceita prazo futuro dentro do limite", () => {
    const r = validarAnuncio({ texto: "oi", expiraEm: AGORA + 60_000 }, { agora: AGORA });
    assert.equal(r.ok, true);
    assert.equal(r.anuncio.expiraEm, AGORA + 60_000);
  });

  test("recusa prazo no passado — anúncio que nasce morto", () => {
    assert.deepEqual(
      validarAnuncio({ texto: "oi", expiraEm: AGORA - 1 }, { agora: AGORA }),
      { ok: false, erro: "prazo-no-passado" },
    );
  });

  test("recusa prazo absurdamente longo (anúncio esquecido)", () => {
    assert.deepEqual(
      validarAnuncio({ texto: "oi", expiraEm: AGORA + DURACAO_MAXIMA_MS + 1 }, { agora: AGORA }),
      { ok: false, erro: "prazo-longo" },
    );
  });

  test("recusa prazo que não é número", () => {
    assert.deepEqual(
      validarAnuncio({ texto: "oi", expiraEm: "amanhã" }, { agora: AGORA }),
      { ok: false, erro: "prazo-invalido" },
    );
  });
});

describe("quadro de anúncios", () => {
  test("começa vazio", () => {
    const q = new QuadroDeAnuncios({ now: () => AGORA });
    assert.equal(q.ativo(), null);
    assert.equal(q.ultimo(), null);
  });

  test("define e devolve o anúncio vigente", () => {
    const q = new QuadroDeAnuncios({ now: () => AGORA });
    const { anuncio } = valido();
    const vigente = q.definir(anuncio);
    assert.deepEqual(vigente, anuncio);
    assert.deepEqual(q.ativo(), anuncio);
  });

  test("expira sozinho, sem apagar o registro (o painel ainda mostra)", () => {
    let relogio = AGORA;
    const q = new QuadroDeAnuncios({ now: () => relogio });
    const { anuncio } = validarAnuncio({ texto: "só hoje", expiraEm: AGORA + 1_000 }, { agora: AGORA });
    q.definir(anuncio);
    assert.ok(q.ativo(), "deveria estar ativo antes do prazo");

    relogio = AGORA + 1_001;
    assert.equal(q.ativo(), null, "deveria ter expirado");
    assert.deepEqual(q.ultimo(), anuncio, "o último publicado continua visível para o painel");
  });

  test("limpar tira do ar e é idempotente", () => {
    const q = new QuadroDeAnuncios({ now: () => AGORA });
    q.definir(valido().anuncio);
    q.limpar();
    assert.equal(q.ativo(), null);
    q.limpar(); // segunda vez não pode explodir
    assert.equal(q.ativo(), null);
  });

  test("definir de novo substitui o anterior — nunca acumula", () => {
    const q = new QuadroDeAnuncios({ now: () => AGORA });
    q.definir(validarAnuncio({ texto: "primeiro" }, { agora: AGORA }).anuncio);
    q.definir(validarAnuncio({ texto: "segundo" }, { agora: AGORA }).anuncio);
    assert.equal(q.ativo().texto, "segundo");
  });
});
