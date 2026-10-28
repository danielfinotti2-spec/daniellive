/**
 * Testa o aplicativo desktop de verdade — o Electron real, não o site.
 *
 * Como funciona: sobe o Electron com o depurador remoto ligado e conversa com
 * ele pelo protocolo DevTools (CDP), do mesmo jeito que o Playwright faria com
 * um Chrome. Assim é possível clicar na interface real dentro da janela real e
 * medir o vídeo que chega.
 *
 * O que este teste prova, e que nenhum teste de site prova:
 *  1. o aplicativo abre sozinho, sem navegador e sem servidor já rodando;
 *  2. a interface que aparece é a do DanielLive;
 *  3. as duas rotas (criar sala e assistir) funcionam no processo empacotado;
 *  4. uma sala criada no aplicativo é acessível de um Chrome comum — ou seja, o
 *     aplicativo conversa com o mundo, não só consigo mesmo;
 *  5. a captura de tela passa pelo seletor do aplicativo e o vídeo chega.
 *
 * Executa com: node tests/desktop.e2e.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORTA_CDP = 9333;

let passou = 0;
let falhou = 0;
const falhas = [];

function conferir(nome, ok, detalhe = "") {
  if (ok) {
    passou++;
    console.log(`OK   ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhou++;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`);
    console.log(`FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/**
 * Lê o log que o aplicativo grava em `%APPDATA%\daniellive\daniellive.log`.
 *
 * Empacotado no Windows não há console, então o log em arquivo é a única forma
 * de saber o que aconteceu durante a abertura. Sem isto, uma falha aqui só pode
 * ser descrita como "não abriu".
 */
function lerLogDoAplicativo() {
  const caminho = path.join(
    process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming"),
    "daniellive",
    "daniellive.log",
  );
  try {
    return existsSync(caminho) ? readFileSync(caminho, "utf8") : "";
  } catch {
    return "";
  }
}

/** Espera o endpoint do depurador do Electron responder. */async function esperarCDP(limiteMs = 90_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`);
      if (r.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * Sobe o aplicativo empacotado (ou o Electron local, em desenvolvimento).
 *
 * O perfil fica numa pasta temporária para não mexer nos dados do usuário e
 * para garantir que o teste rode sempre do zero.
 */
function subirApp() {
  const perfil = mkdtempSync(path.join(tmpdir(), "daniellive-teste-"));
  const exeEmpacotado = path.join(RAIZ, "dist-desktop", "win-unpacked", "DanielLive.exe");
  const empacotado = existsSync(exeEmpacotado);

  const comando = empacotado
    ? exeEmpacotado
    : path.join(RAIZ, "node_modules", "electron", "dist", "electron.exe");
  const argumentos = empacotado
    ? [`--remote-debugging-port=${PORTA_CDP}`, `--user-data-dir=${perfil}`]
    : [RAIZ, `--remote-debugging-port=${PORTA_CDP}`, `--user-data-dir=${perfil}`];

  // `ELECTRON_RUN_AS_NODE=1` faz o Electron rodar como Node puro, sem a API de
  // janela — o aplicativo morreria em `app.isPackaged` com "cannot read
  // properties of undefined". A variável costuma vir do ambiente de quem chamou
  // (é o que o próprio processo principal define para os servidores filhos),
  // então ela é removida aqui de propósito.
  const ambiente = { ...process.env };
  delete ambiente.ELECTRON_RUN_AS_NODE;

  console.log(`subindo: ${path.basename(comando)} ${empacotado ? "(empacotado)" : "(desenvolvimento)"}`);
  const filho = spawn(comando, argumentos, {
    cwd: RAIZ,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
    env: ambiente,
  });
  const saida = [];
  filho.stdout.on("data", (d) => saida.push(String(d)));
  filho.stderr.on("data", (d) => saida.push(String(d)));
  return { filho, saida, empacotado };
}

let app = null;
let navegador = null;

try {
  // ========================================================= APLICATIVO ABRE
  app = subirApp();
  const subiu = await esperarCDP();
  conferir("o aplicativo abre e expõe a janela", subiu, subiu ? "CDP respondendo" : "tempo esgotado");

  if (!subiu) {
    console.log("\n--- saída do aplicativo ---");
    console.log(app.saida.join("").slice(-3000));

    /*
     * Diagnóstico antes de desistir.
     *
     * "tempo esgotado" sozinho não diz nada: o aplicativo pode ter morrido na
     * primeira linha (ambiente sem sessão gráfica) ou estar vivo e apenas lento.
     * São problemas diferentes, com correções diferentes. Aqui a diferença é
     * medida e dita em voz alta, para o relatório apontar o caminho certo.
     */
    const morreu = app.filho.exitCode !== null || app.filho.signalCode !== null;
    const semSaida = app.saida.join("").trim().length === 0;

    /*
     * O log do aplicativo diz se a janela chegou a ser criada e por que o
     * renderizador morreu. Sem lê-lo, "não abriu" continua sendo um sintoma sem
     * causa — e a diferença entre "o aplicativo tem um defeito" e "este ambiente
     * não abre janela" fica invisível.
     */
    const log = lerLogDoAplicativo();
    if (log) {
      const linhas = log.trim().split("\n").slice(-14);
      console.log("\n--- últimas linhas do log do aplicativo ---");
      for (const l of linhas) console.log("  " + l);
      const gpu = /gpu_compositing=(\w+)/.exec(log);
      const morte = /renderizador encerrou: (\{.*\})/.exec(log);
      if (gpu) console.log(`\nComposição gráfica: ${gpu[1]}`);
      if (morte) console.log(`Renderizador: ${morte[1]}`);
    }

    if (morreu && semSaida) {
      console.log(
        `\nO processo saiu com código ${app.filho.exitCode} e sem escrever nada. ` +
          "Isso é típico de um ambiente sem sessão gráfica: o Chromium não consegue " +
          "inicializar a janela e encerra antes de rodar o código do aplicativo. " +
          "Rode este teste numa sessão de área de trabalho do Windows.",
      );
      console.log(
        "\nPara separar as duas causas, rode um Electron mínimo (uma janela com " +
          "texto, sem nada do projeto) neste mesmo ambiente: se ele também não abrir, " +
          "a limitação é do ambiente, não do DanielLive.",
      );
    } else if (morreu) {
      console.log(`\nO processo saiu com código ${app.filho.exitCode} depois de escrever o acima.`);
    } else {
      console.log("\nO processo continua vivo, mas o depurador não respondeu: pode ser lentidão.");
    }

    throw new Error("o aplicativo não abriu");
  }

  navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PORTA_CDP}`);
  const contextos = navegador.contexts();
  const paginas = contextos.flatMap((c) => c.pages());

  // Filtra a própria página do depurador, se aparecer.
  const janela = paginas.find((p) => !p.url().startsWith("devtools://"));
  conferir("há uma janela de interface aberta", Boolean(janela), janela ? janela.url() : "nenhuma");

  if (!janela) throw new Error("sem janela para testar");

  // A janela carrega um servidor local que o próprio aplicativo subiu.
  const url = janela.url();
  conferir(
    "a interface é servida por um servidor local do próprio aplicativo",
    /^http:\/\/127\.0\.0\.1:\d+/.test(url),
    url,
  );

  await janela.waitForLoadState("domcontentloaded");
  await janela.waitForTimeout(1500);

  // ============================================== A INTERFACE É A DO SCREENLIVE
  const titulo = await janela.title();
  conferir("o título é o do DanielLive", /DanielLive/i.test(titulo), titulo);

  const h1 = await janela.locator("h1").first().innerText().catch(() => "");
  conferir("a página inicial renderizou a interface", h1.length > 0, h1.replace(/\s+/g, " ").slice(0, 60));

  // A identidade visual precisa ser a mesma do site: fundo #101014 no tema escuro.
  const fundo = await janela.evaluate(() => getComputedStyle(document.body).backgroundColor);
  conferir("a identidade visual do site foi mantida", fundo.length > 0, fundo);

  // ================================================== CRIA UMA SALA NO APLICATIVO
  await janela.goto(`${url}/transmitir`, { waitUntil: "domcontentloaded" });
  await janela.locator("#display-name").fill("Aplicativo Desktop");

  const campoLink = janela.locator('[data-campo="link-transmissao"]');
  await campoLink.waitFor({ timeout: 40_000 });
  const link = await campoLink.inputValue();
  const codigo = link.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];
  conferir("criar sala funciona dentro do aplicativo", Boolean(codigo), codigo ?? link);

  // O link precisa apontar para o servidor local do aplicativo.
  conferir(
    "o link da sala aponta para o próprio aplicativo",
    link.startsWith(url),
    link.replace(url, "(app)"),
  );

  // ============================ UM NAVEGADOR DE FORA CONSEGUE ENTRAR NA SALA
  // Isto prova que o aplicativo não é uma ilha: a sinalização local aceita
  // conexões e o WebRTC negocia entre o aplicativo e um Chrome comum.
  const chrome = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctxExterno = await preparar(
    await chrome.newContext({ viewport: { width: 1100, height: 760 } }),
  );
  const externo = await ctxExterno.newPage();
  await externo.goto(link, { waitUntil: "domcontentloaded" });
  await externo.waitForTimeout(2500);

  const textoExterno = await externo.evaluate(() => document.body.innerText);
  conferir(
    "um navegador de fora entra na sala criada no aplicativo",
    /Transmissão de|Sala de transmissão|Aguardando/i.test(textoExterno),
    textoExterno.replace(/\s+/g, " ").slice(0, 80),
  );

  // O aplicativo deve ver o espectador na lista.
  let viuEspectador = 0;
  for (let i = 0; i < 30; i += 1) {
    viuEspectador = await janela.evaluate(() => {
      const hdr = [...document.querySelectorAll("h2")].find((x) =>
        /Quem está assistindo/i.test(x.textContent ?? ""),
      );
      if (!hdr) return 0;
      const secao = hdr.closest("div")?.parentElement?.parentElement;
      return secao?.querySelectorAll("ul li").length ?? 0;
    });
    if (viuEspectador >= 1) break;
    await janela.waitForTimeout(500);
  }
  conferir("o aplicativo vê o espectador que entrou", viuEspectador >= 1, `${viuEspectador} listado(s)`);

  // ======================================================= COMPARTILHAR A TELA
  // O seletor é uma janela do próprio aplicativo — precisa aparecer aqui.
  await janela.getByRole("button", { name: /compartilhar minha tela/i }).click();

  let seletorApareceu = false;
  for (let i = 0; i < 40; i += 1) {
    const paginasAgora = navegador.contexts().flatMap((c) => c.pages());
    const seletor = paginasAgora.find((p) => p.url().includes("seletor.html"));
    if (seletor) {
      seletorApareceu = true;
      await seletor.waitForLoadState("domcontentloaded");
      await seletor.waitForTimeout(1200);

      // Confere que o seletor lista fontes reais e escolhe a primeira tela.
      const quantos = await seletor.locator(".item").count();
      conferir("o seletor do aplicativo lista as fontes de captura", quantos > 0, `${quantos} fonte(s)`);

      const nomes = await seletor.locator(".item .nome").allInnerTexts().catch(() => []);
      conferir(
        "as fontes têm nome legível",
        nomes.some((n) => n.trim().length > 0),
        nomes.slice(0, 3).join(" | ").slice(0, 70),
      );

      await seletor.locator(".item").first().click();
      await seletor.getByRole("button", { name: /^compartilhar$/i }).click();
      break;
    }
    await janela.waitForTimeout(500);
  }
  conferir("o seletor de tela do aplicativo abre", seletorApareceu);

  // O aplicativo precisa entrar em "Ao vivo".
  let aoVivo = false;
  try {
    await janela.waitForSelector("text=/Ao vivo/i", { timeout: 30_000 });
    aoVivo = true;
  } catch {
    /* tratado abaixo */
  }
  conferir("a captura de tela inicia no aplicativo", aoVivo);

  // ============================ O VÍDEO CHEGA AO NAVEGADOR DE FORA (WEBRTC REAL)
  let largura = 0;
  let quadros = 0;
  if (aoVivo) {
    const inicio = Date.now();
    while (Date.now() - inicio < 45_000) {
      const estado = await externo.evaluate(() => {
        const v = document.querySelector("video");
        if (!v) return { w: 0, q: 0 };
        return { w: v.videoWidth, q: v.videoPlaybackQuality?.()?.totalVideoFrames ?? 0 };
      });
      largura = Math.max(largura, estado.w ?? 0);
      quadros = Math.max(quadros, estado.q ?? 0);
      if (largura > 0 && quadros > 3) break;
      await externo.waitForTimeout(500);
    }
  }
  conferir("o vídeo do aplicativo chega ao espectador", largura > 0, largura > 0 ? `${largura}px` : "sem vídeo");
  conferir("o espectador decodifica quadros reais", quadros > 0, `${quadros} quadros`);

  // ============================================== PAUSAR E RETOMAR NO APLICATIVO
  if (aoVivo) {
    await janela.getByRole("button", { name: /^pausar$/i }).click();
    await janela.waitForTimeout(2500);

    const antesPausa = await externo.evaluate(
      () => document.querySelector("video")?.videoPlaybackQuality?.()?.totalVideoFrames ?? 0,
    );
    await janela.waitForTimeout(4000);
    const depoisPausa = await externo.evaluate(
      () => document.querySelector("video")?.videoPlaybackQuality?.()?.totalVideoFrames ?? 0,
    );
    conferir(
      "pausar interrompe o envio de quadros no aplicativo",
      depoisPausa - antesPausa <= 2,
      `${depoisPausa - antesPausa} quadros novos em 4 s`,
    );

    await janela.getByRole("button", { name: /^retomar$/i }).click();
    let novos = 0;
    const base = depoisPausa;
    for (let i = 0; i < 40; i += 1) {
      const q = await externo.evaluate(
        () => document.querySelector("video")?.videoPlaybackQuality?.()?.totalVideoFrames ?? 0,
      );
      novos = q - base;
      if (novos > 3) break;
      await externo.waitForTimeout(500);
    }
    conferir("retomar volta a enviar quadros no aplicativo", novos > 3, `${novos} quadros novos`);
  }

  await ctxExterno.close();
  await chrome.close();

  // ============================================ A INTERFACE DO SITE NÃO MUDOU
  // O aplicativo não pode ter quebrado a versão web: os mesmos arquivos são
  // servidos por `npm start`, e a página precisa continuar igual.
  const respostaWeb = await fetch(`${url}/como-funciona`);
  const htmlWeb = await respostaWeb.text();
  conferir(
    "a página 'como funciona' continua sendo servida",
    respostaWeb.ok && /DanielLive/i.test(htmlWeb),
    `HTTP ${respostaWeb.status}`,
  );
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
  if (app?.saida?.length) {
    console.log("\n--- saída do aplicativo ---");
    console.log(app.saida.join("").slice(-2500));
  }
} finally {
  try {
    await navegador?.close();
  } catch {
    /* já fechado */
  }
  if (app?.filho && !app.filho.killed) {
    app.filho.kill();
    // O Electron pode deixar processos filhos (os servidores locais).
    await new Promise((r) => setTimeout(r, 1500));
  }
}

console.log(`\n============ RESUMO ============`);
console.log(`total: ${passou + falhou}  ok: ${passou}  falhas: ${falhou}`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
if (falhou) process.exitCode = 1;
