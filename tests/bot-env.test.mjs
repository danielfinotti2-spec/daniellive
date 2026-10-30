/**
 * Testes do carregamento do `.env`.
 *
 * O bot lê o `.env` da raiz porque é assim que quem usa o projeto espera que
 * funcione. A regra que precisa ser provada aqui é a precedência: no servidor
 * de hospedagem as variáveis vêm do painel, e um `.env` esquecido no
 * repositório **não pode** sobrescrever isso — senão um deploy acaba usando o
 * token de outra pessoa.
 *
 * Testa a função REAL (`carregarEnv`), não uma cópia dela: um teste que
 * reimplementa a lógica que deveria verificar sempre passa.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { carregarEnv } from "../bot/index.mjs";

/** Escreve um `.env` temporário, roda o carregador e limpa. */
function comArquivo(conteudo, ambiente = {}) {
  const dir = mkdtempSync(join(tmpdir(), "daniel-env-"));
  const arquivo = join(dir, ".env");
  writeFileSync(arquivo, conteudo, "utf8");
  try {
    const env = { ...ambiente };
    const aplicados = carregarEnv(arquivo, env);
    return { env, aplicados };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("carregamento do .env", () => {
  test("lê pares nome=valor", () => {
    const { env } = comArquivo("A=1\nB=2");
    assert.equal(env.A, "1");
    assert.equal(env.B, "2");
  });

  test("variável do ambiente GANHA do arquivo", () => {
    const { env, aplicados } = comArquivo("TOKEN=do-arquivo", { TOKEN: "do-painel" });
    assert.equal(env.TOKEN, "do-painel");
    assert.equal(aplicados.TOKEN, undefined, "não podia ter aplicado");
  });

  test("ignora comentários e linhas vazias", () => {
    const { env } = comArquivo("# comentário\n\n  \nA=1\n#B=2");
    assert.equal(env.A, "1");
    assert.equal(env.B, undefined);
  });

  test("remove aspas dupas e simples em volta do valor", () => {
    const { env } = comArquivo('A="com espaço"\nB=\'aspas simples\'');
    assert.equal(env.A, "com espaço");
    assert.equal(env.B, "aspas simples");
  });

  test("preserva = dentro do valor", () => {
    // Tokens e URLs de conexão têm '=' no meio.
    const { env } = comArquivo("URI=postgres://u:p@h/db?a=1&b=2");
    assert.equal(env.URI, "postgres://u:p@h/db?a=1&b=2");
  });

  test("ignora linha sem nome ou sem =", () => {
    const { env } = comArquivo("=valor\nsemigual\r\nA=1");
    assert.equal(env.A, "1");
    assert.equal(env[""], undefined);
  });

  test("valor vazio é lido (e depois reprovado na validação de obrigatórias)", () => {
    const { env } = comArquivo("A=");
    assert.equal(env.A, "");
  });

  test("entende fim de linha do Windows", () => {
    const { env } = comArquivo("A=1\r\nB=2\r\n");
    assert.equal(env.A, "1");
    assert.equal(env.B, "2");
  });

  test("arquivo inexistente não é erro", () => {
    const aplicados = carregarEnv(join(tmpdir(), "nao-existe-mesmo-12345", ".env"), {});
    assert.deepEqual(aplicados, {});
  });

  test("devolve só o que realmente aplicou", () => {
    const { aplicados } = comArquivo("A=1\nB=2", { B: "existe" });
    assert.deepEqual(aplicados, { A: "1" });
  });
});
