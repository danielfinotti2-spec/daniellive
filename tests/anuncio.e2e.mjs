/**
 * Teste de navegador do anúncio e da sala privada.
 *
 * Prova as duas coisas pelo caminho que a pessoa realmente usa:
 *
 *  1. O anúncio publica pela rota administrativa e a faixa APARECE na tela,
 *     em qualquer página, sem recarregar — e some quando é retirado.
 *  2. O checkbox "Sala privada" existe na tela de transmissão e a escolha
 *     sobrevive à recarga (fica guardada), que é o que faz a sala nascer
 *     oculta desde o primeiro instante.
 *
 * Sobe servidor próprio numa porta livre, para não depender de `npm run start`
 * estar rodando nem de qual build está no ar.
 *
 * Uso: node tests/anuncio.e2e.mjs
 */

import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const PORTA = 3411;
const BASE = `http://127.0.0.1:${PORTA}`;
const TOKEN = "token-do-teste-de-anuncio";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let falhas = 0;
function conferir(nome, ok, extra = "") {
  if (ok) console.log(`  ok    ${nome}${extra ? ` — ${extra}` : ""}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${nome}${extra ? ` — ${extra}` : ""}`);
  }
}

async function esperarServidor(timeoutMs = 120_000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("o servidor público não subiu a tempo");
}

async function publicar(corpo) {
  const r = await fetch(`${BASE}/admin/anuncio`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, body: await r.json() };
}

async function retirar() {
  const r = await fetch(`${BASE}/admin/anuncio`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  return { status: r.status, body: await r.json() };
}

/**
 * O teste roda como a produção: site e WebSocket na MESMA porta, no caminho
 * `/ws` (o navegador é apontado para lá por `__DANIELLIVE_SIGNAL_URL__`).
 */
const servidor = spawn(process.execPath, ["server/publico.mjs"], {
  env: {
    ...process.env,
    PORT: String(PORTA),
    ALLOWED_ORIGINS: BASE,
    ANUNCIO_TOKEN: TOKEN,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
servidor.stdout.on("data", () => {});
servidor.stderr.on("data", (d) => {
  const texto = String(d);
  if (!/ALLOWED_ORIGINS não foi definido/.test(texto)) process.stderr.write(`[servidor] ${texto}`);
});

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  await esperarServidor();
  // `preparar` fixa o idioma no contexto (antes de qualquer script da página),
  // para os seletores por texto em português não dependerem do idioma do Chrome.
  const contexto = await preparar(await browser.newContext());
  /**
   * Aponta o cliente para a porta do teste.
   *
   * `signalingUrl()` (lib/signaling.ts) trata `localhost`/`127.0.0.1` como
   * desenvolvimento de duas portas e vai para a 8787 — decisão certa para o
   * `npm run dev`, errada aqui, onde site e WebSocket estão na mesma porta
   * (a topologia de produção no Render). A variável de execução
   * `__DANIELLIVE_SIGNAL_URL__` é exatamente o gancho que o aplicativo desktop
   * usa para dizer "o endereço é este", e é o que este teste define.
   */
  await contexto.addInitScript(
    `window.__DANIELLIVE_SIGNAL_URL__ = ${JSON.stringify(`ws://127.0.0.1:${PORTA}/ws`)};`,
  );
  const page = await contexto.newPage();

  console.log("\n== admin do anúncio ==");
  const semToken = await fetch(`${BASE}/admin/anuncio`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto: "oi" }),
  });
  conferir("sem token responde 401", semToken.status === 401, String(semToken.status));

  const invalido = await publicar({ texto: "clique", botao: { rotulo: "X", url: "javascript:alert(1)" } });
  conferir("link javascript: é recusado", invalido.status === 422, invalido.body.erro);

  console.log("\n== a faixa aparece sem recarregar ==");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // Espere o React montar (o cabeçalho é renderizado no servidor; a faixa só
  // existe no cliente, então ela é a prova de que a hidratação aconteceu).
  await page.waitForSelector("header nav", { timeout: 20_000 });

  const antesVisivel = await page.locator('[role="status"]').count();
  conferir("sem anúncio, nenhuma faixa na tela", antesVisivel === 0, `${antesVisivel}`);

  const publicado = await publicar({
    texto: "Manutenção hoje às 22h",
    cor: "vermelho",
    botao: { rotulo: "Ver detalhes", url: "https://example.com/status" },
  });
  conferir("publicação responde 200", publicado.status === 200, JSON.stringify(publicado.body.erro ?? ""));

  // Sem recarregar a página: o WebSocket entrega e a faixa entra.
  const faixa = page.locator('[role="status"]');
  await faixa.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const textoFaixa = (await faixa.count()) ? (await faixa.first().innerText()) : "";
  conferir("a faixa aparece sozinha", textoFaixa.includes("Manutenção hoje às 22h"), textoFaixa.slice(0, 60));
  conferir("o botão do anúncio aparece", textoFaixa.includes("Ver detalhes"));
  conferir("é anunciada como status para leitor de tela",
    (await faixa.first().getAttribute("role")) === "status");

  console.log("\n== a faixa é do site inteiro ==");
  await page.goto(`${BASE}/download`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav", { timeout: 20_000 });
  const naOutraPagina = page.locator('[role="status"]');
  await naOutraPagina.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  conferir("aparece também em /download", (await naOutraPagina.count()) > 0);

  console.log("\n== fechar o aviso ==");
  // O botão de fechar da faixa é o único com este rótulo na página; buscar
  // dentro do `role=status` evita casar com qualquer outro "×" da interface.
  const fechar = page.locator('[role="status"]').getByRole("button", { name: "Fechar aviso" });
  await fechar.click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  conferir("fecha", (await page.locator('[role="status"]').count()) === 0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  conferir("não volta depois de recarregar", (await page.locator('[role="status"]').count()) === 0);

  console.log("\n== retirar o anúncio ==");
  const retirado = await retirar();
  conferir("retirada responde 200", retirado.status === 200);
  await page.evaluate(() => window.localStorage.removeItem("screenlive-anuncio-dispensado"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav", { timeout: 20_000 });
  await page.waitForTimeout(2000);
  conferir("retirado, não aparece mais nem para quem limpou o silêncio",
    (await page.locator('[role="status"]').count()) === 0);

  console.log("\n== sala privada ==");
  await page.goto(`${BASE}/transmitir`, { waitUntil: "domcontentloaded" });
  const checkbox = page.getByRole("checkbox", { name: /Sala privada/ });
  await checkbox.waitFor({ timeout: 20_000 }).catch(() => {});
  conferir("o checkbox aparece na tela de transmissão", await checkbox.count() > 0);
  conferir("vem desmarcado por padrão", (await checkbox.isChecked()) === false);

  await checkbox.check();
  await page.waitForTimeout(300);
  // Recarrega: a escolha é lida de forma síncrona na criação da sala, então
  // depois desta recarga a sala nasce privada.
  await page.reload({ waitUntil: "domcontentloaded" });
  const aposRecarga = page.getByRole("checkbox", { name: /Sala privada/ });
  await aposRecarga.waitFor({ timeout: 20_000 }).catch(() => {});
  conferir("a escolha sobrevive à recarga", (await aposRecarga.isChecked()) === true);

  await page.close();
} finally {
  await browser.close();
  servidor.kill("SIGTERM");
}

console.log(`\n=== ${falhas === 0 ? "tudo certo" : `${falhas} falharam`} ===`);
process.exit(falhas === 0 ? 0 : 1);
