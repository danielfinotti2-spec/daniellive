/**
 * Valida o servidor público compilado: HTTP, /ws e SQLite após reiniciar.
 * Não precisa de Chrome nem de conta na hospedagem.
 * DANIELLIVE_TEST_APP_DIR pode apontar para uma cópia só com dependências de produção.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const appDir = process.env.DANIELLIVE_TEST_APP_DIR || fileURLToPath(new URL("../", import.meta.url));
let servidor;
let pasta;
let origem;
let porta;
let logs = "";

async function portaLivre() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const numero = listener.address().port;
  await new Promise((resolve, reject) => listener.close((erro) => erro ? reject(erro) : resolve()));
  return numero;
}

async function iniciar() {
  logs = "";
  servidor = spawn(process.execPath, ["server/publico.mjs"], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      HOST: "127.0.0.1",
      PORT: String(porta),
      ALLOWED_ORIGINS: "",
      ALTARE_URL: origem,
      DANIELLIVE_DB: path.join(pasta, "daniellive.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidor.stdout.on("data", (dados) => { logs += dados; });
  servidor.stderr.on("data", (dados) => { logs += dados; });
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    if (servidor.exitCode !== null) throw new Error(`Servidor encerrou antes de iniciar:\n${logs}`);
    try {
      const resposta = await fetch(`${origem}/health`, { signal: AbortSignal.timeout(1000) });
      if (resposta.ok) return;
    } catch { /* ainda preparando o Next */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou:\n${logs}`);
}

async function parar() {
  if (!servidor || servidor.exitCode !== null) return;
  const encerrado = once(servidor, "exit");
  servidor.kill("SIGTERM");
  await encerrado;
}

async function cliente(t) {
  const ws = new WebSocket(`${origem.replace("http:", "ws:")}/ws`, { origin: origem });
  t.after(() => ws.terminate());
  const mensagens = [];
  ws.on("message", (dados) => mensagens.push(JSON.parse(dados.toString())));
  await once(ws, "open");
  return {
    enviar: (mensagem) => ws.send(JSON.stringify(mensagem)),
    async receber(tipo) {
      const limite = Date.now() + 5000;
      while (Date.now() < limite) {
        const indice = mensagens.findIndex((mensagem) => mensagem.type === tipo);
        if (indice !== -1) return mensagens.splice(indice, 1)[0];
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Mensagem ${tipo} não chegou; recebidas: ${JSON.stringify(mensagens)}`);
    },
  };
}

function decodificarAtributo(valor) {
  return valor.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function dadosDoCadastro(html) {
  const formularios = html.match(/<form\b[\s\S]*?<\/form>/gi) || [];
  const formulario = formularios.find((item) => item.includes('name="nascimento"'));
  assert.ok(formulario, "o HTML precisa conter o formulário de cadastro");
  const dados = new FormData();
  for (const entrada of formulario.match(/<input\b[^>]*>/gi) || []) {
    const nome = entrada.match(/\bname="([^"]*)"/)?.[1];
    const valor = entrada.match(/\bvalue="([^"]*)"/)?.[1] || "";
    if (nome?.startsWith("$ACTION_")) dados.append(decodificarAtributo(nome), decodificarAtributo(valor));
  }
  assert.ok([...dados.keys()].some((nome) => nome.startsWith("$ACTION_")), "a ação do cadastro deve existir");
  dados.set("nome", "Conta de teste do deploy");
  dados.set("apelido", "Teste do deploy");
  dados.set("nascimento", "2000-01-01");
  dados.set("email", "deploy-publico@example.test");
  dados.set("senha", "senha-exclusiva-do-teste-123");
  return dados;
}

before(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), "daniellive-publico-"));
  porta = await portaLivre();
  origem = `http://127.0.0.1:${porta}`;
  await iniciar();
});

after(async () => {
  await parar();
  if (pasta) await rm(pasta, { recursive: true, force: true });
});

describe("servidor público de produção", () => {
  test("saúde e site respondem na mesma porta", async () => {
    const saude = await fetch(`${origem}/health`);
    assert.equal(saude.status, 200);
    assert.equal((await saude.json()).ok, true);
    const site = await fetch(origem);
    assert.equal(site.status, 200);
    assert.match(await site.text(), /DanielLive/);
  });

  test("cria sala e recebe espectador pelo caminho /ws", async (t) => {
    const host = await cliente(t);
    await host.receber("welcome");
    host.enviar({ type: "create", name: "Anfitrião do teste" });
    const sala = await host.receber("created");
    const viewer = await cliente(t);
    await viewer.receber("welcome");
    viewer.enviar({ type: "join", code: sala.code, name: "Espectador do teste" });
    assert.equal((await viewer.receber("joined")).code, sala.code);
  });

  test("recusa origem que não corresponde à ALTARE_URL", async () => {
    const ws = new WebSocket(`${origem.replace("http:", "ws:")}/ws`, { origin: "https://origem-nao-autorizada.example" });
    await assert.rejects(once(ws, "open"), /403/);
  });

  test("cadastro e sessão sobrevivem ao reinício usando o mesmo SQLite", async () => {
    const pagina = await fetch(`${origem}/conta`);
    assert.equal(pagina.status, 200);
    const resposta = await fetch(`${origem}/conta`, {
      method: "POST",
      headers: { origin: origem },
      body: dadosDoCadastro(await pagina.text()),
      redirect: "manual",
    });
    assert.equal(resposta.status, 303, "o cadastro deve redirecionar para a conta");
    const cookie = resposta.headers.getSetCookie().find((item) => item.startsWith("daniellive-sessao="))?.split(";")[0];
    assert.ok(cookie, "o cadastro deve abrir uma sessão");
    assert.ok((await stat(path.join(pasta, "daniellive.db"))).size > 0);

    const perfil = await fetch(`${origem}/conta`, { headers: { cookie } });
    assert.match(await perfil.text(), /deploy-publico@example\.test/);
    await parar();
    await iniciar();
    const perfilDepois = await fetch(`${origem}/conta`, { headers: { cookie } });
    assert.equal(perfilDepois.status, 200);
    assert.match(await perfilDepois.text(), /deploy-publico@example\.test/);
  });
});
