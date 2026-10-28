/**
 * Testes do banco e das contas (db.ts + auth.ts).
 * Executa com: npm test
 *
 * O banco de teste é em memória: `process.env.DANIELLIVE_DB` é lida na primeira
 * chamada de `banco()`, e este arquivo define a variável antes de importar os
 * módulos — só assim, porque o cache do Node guardaria um banco anterior de
 * disco se o import viesse na linha de cima do arquivo.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

process.env.DANIELLIVE_DB = ":memory:";

const { banco, fecharBancoParaTeste } = await import("../lib/db.ts");
const {
  criarUsuario,
  autenticar,
  criarSessao,
  donoDaSessao,
  encerrarSessao,
  renovarSessao,
  buscarOuCriarExterno,
  enviarPedido,
  aceitarPedido,
  desfazer,
  listarAmigos,
  pedidosRecebidos,
  SENHA_MINIMA,
} = await import("../lib/auth.ts");

after(() => fecharBancoParaTeste());

function cadastro(nome, email = `${nome.toLowerCase()}@exemplo.com`) {
  const r = criarUsuario(email, "senha-segura-123", nome);
  assert.equal(r.ok, true, `cadastro de ${email} deveria funcionar: ${JSON.stringify(r)}`);
  return r.valor;
}

describe("banco", () => {
  test("abre, migra para a versão 1 e disponibiliza as tabelas", () => {
    const db = banco();
    const versao = db.prepare("PRAGMA user_version").get().user_version;
    assert.equal(versao, 1);
    for (const tabela of ["usuarios", "sessoes", "amizades"]) {
      const linha = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tabela);
      assert.ok(linha, `tabela ${tabela} deveria existir`);
    }
  });
});

describe("cadastro", () => {
  test("aceita e normaliza e-mail", () => {
    const ana = cadastro("Ana", "  ANA@Exemplo.COM  ");
    assert.equal(ana.email, "ana@exemplo.com");
  });

  test("recusa e-mail inválido, senha curta e nome curto", () => {
    assert.deepEqual(criarUsuario("vazio", "senha-segura-123", "Ana"), { ok: false, erro: "email_invalido" });
    assert.deepEqual(criarUsuario("curta@x.com", "123", "Ana"), { ok: false, erro: "senha_curta" });
    assert.deepEqual(criarUsuario("nome@x.com", "senha-segura-123", "A"), { ok: false, erro: "nome_curto" });
    assert.equal(SENHA_MINIMA, 8);
  });

  test("recusa e-mail duplicado", () => {
    cadastro("Beto", "beto@exemplo.com");
    assert.deepEqual(criarUsuario("beto@exemplo.com", "outra-senha-1", "Beto Dois"), {
      ok: false,
      erro: "email_em_uso",
    });
  });
});

describe("entrada", () => {
  test("senha certa entra, senha errada não", () => {
    cadastro("Cida", "cida@exemplo.com");
    assert.equal(autenticar("cida@exemplo.com", "senha-segura-123").ok, true);
    assert.deepEqual(autenticar("cida@exemplo.com", "senha-errada-1"), { ok: false, erro: "credenciais" });
    assert.deepEqual(autenticar("fantasma@exemplo.com", "senha-segura-123"), { ok: false, erro: "credenciais" });
  });

  test("conta externa não entra com senha", () => {
    const r = buscarOuCriarExterno("google@exemplo.com", "Google User", "google");
    assert.equal(r.ok, true);
    // Mesmo e-mail por dentro: a conta é a mesma, não uma gêmea.
    const r2 = buscarOuCriarExterno("google@exemplo.com", "Google Again", "google");
    assert.equal(r2.valor.id, r.valor.id);
    assert.equal(autenticar("google@exemplo.com", "qualquer-coisa-1").ok, false);
  });
});

describe("sessões", () => {
  test("cria, reconhece o dono, renova e encerra", () => {
    const dario = cadastro("Dario");
    const token = criarSessao(dario.id);
    assert.equal(donoDaSessao(token)?.id, dario.id);
    renovarSessao(token);
    assert.equal(donoDaSessao(token)?.id, dario.id);
    encerrarSessao(token);
    assert.equal(donoDaSessao(token), null);
    assert.equal(donoDaSessao("token-inventado"), null);
    assert.equal(donoDaSessao(null), null);
  });

  test("o banco guarda o hash do token, nunca o token", () => {
    const elias = cadastro("Elias");
    const token = criarSessao(elias.id);
    const linhas = banco().prepare("SELECT token_hash FROM sessoes").all();
    for (const l of linhas) {
      assert.notEqual(l.token_hash, token, "o cookie não pode estar no banco em claro");
    }
  });
});

describe("amizades", () => {
  test("pedido, aceitação e remoção nas duas direções", () => {
    const fer = cadastro("Fer");
    const guga = cadastro("Guga");

    assert.equal(enviarPedido(fer.id, "guga@exemplo.com").ok, true);
    // Pedido duplo não passa.
    assert.deepEqual(enviarPedido(fer.id, "guga@exemplo.com"), { ok: false, erro: "pedido_existente" });

    const pendentes = pedidosRecebidos(guga.id);
    assert.equal(pendentes.length, 1);
    assert.equal(pendentes[0].nome, "Fer");
    assert.equal(listarAmigos(fer.id).length, 0, "pendente ainda não é amizade");

    assert.equal(aceitarPedido(guga.id, pendentes[0].id).ok, true);
    assert.equal(listarAmigos(fer.id).length, 1);
    assert.equal(listarAmigos(guga.id).length, 1);
    assert.equal(listarAmigos(guga.id)[0].email, "fer@exemplo.com");

    // Só os envolvidos podem desfazer.
    assert.deepEqual(desfazer(fer.id, 9999), { ok: false, erro: "nao_encontrado" });
    const relacao = banco()
      .prepare("SELECT id FROM amizades WHERE de_id = ? AND para_id = ?")
      .get(fer.id, guga.id);
    assert.equal(desfazer(fer.id, relacao.id).ok, true);
    assert.equal(listarAmigos(guga.id).length, 0);
  });

  test("pedido no sentido inverso aceita na hora", () => {
    const hugo = cadastro("Hugo");
    const iris = cadastro("Iris");
    enviarPedido(hugo.id, "iris@exemplo.com");
    // Íris chama Hugo: as duas vontades existem, viram amizade direto.
    enviarPedido(iris.id, "hugo@exemplo.com");
    assert.equal(listarAmigos(hugo.id).length, 1);
    assert.equal(pedidosRecebidos(iris.id).length, 0, "o pedido original foi consumido pela aceitação");
  });

  test("não existe pedido para si mesmo nem para e-mail inexistente", () => {
    const joao = cadastro("Joao");
    assert.deepEqual(enviarPedido(joao.id, "joao@exemplo.com"), { ok: false, erro: "voce_mesmo" });
    assert.deepEqual(enviarPedido(joao.id, "ninguem@exemplo.com"), { ok: false, erro: "nao_encontrado" });
  });
});
