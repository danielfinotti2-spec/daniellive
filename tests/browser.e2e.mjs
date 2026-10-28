/**
 * Teste de ponta a ponta em navegador de verdade.
 *
 * Dois contextos do Chrome (anfitrião e espectador) conversam pelo servidor de
 * sinalização real e estabelecem uma conexão WebRTC real. O ponto central é
 * provar que a mídia atravessa: o espectador precisa receber quadros, não
 * apenas uma conexão "conectada".
 *
 * Como a captura de tela exige escolha humana, o Chrome é iniciado com
 * --auto-select-desktop-capture-source, que responde à janela de seleção
 * automaticamente. É o mesmo mecanismo que o Chrome oferece para testes.
 *
 * Requer: servidor de sinalização em SIGNAL_PORT e o site em APP_URL.
 * Executa com: node tests/browser.e2e.mjs
 */

import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { preparar } from "./idioma-dos-testes.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const resultados = [];
function registrar(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  const marca = ok ? "OK  " : "FALHA";
  console.log(`${marca} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

/** Um contexto com uma página, com o mínimo necessário para WebRTC funcionar. */
async function novoContexto(browser, { fakeUi = false, autoCapture = null } = {}) {
  const args = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    // Sem isso, o Chrome headless bloqueia autoplay e a verificação de vídeo
    // mediria a política de mídia em vez da transmissão.
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ];
  if (autoCapture) {
    // O nome da fonte tem de casar com o título da tela; "Entire screen" é o
    // rótulo padrão do Chrome em inglês. Em pt-BR o Chrome usa "Tela inteira",
    // então passamos os dois.
    args.push(`--auto-select-desktop-capture-source=${autoCapture}`);
  }
  return preparar(
    await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 1280, height: 800 },
      ...(fakeUi ? {} : {}),
    }),
  );
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      // Permite que a captura de tela aconteça sem diálogo em ambiente headless.
      "--auto-select-desktop-capture-source=Entire screen",
      "--auto-select-desktop-capture-source=Tela inteira",
      "--enable-usermedia-screen-capturing",
      "--allow-http-screen-capture",
    ],
  });

  const erros = [];

  try {
    // ================================================================ HOME
    const homeCtx = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
    const home = await homeCtx.newPage();
    home.on("pageerror", (e) => erros.push(`home: ${e.message}`));
    await home.goto(APP, { waitUntil: "domcontentloaded" });

    const titulo = await home.title();
    registrar("home carrega com título da marca", /DanielLive/i.test(titulo), titulo);

    const heading = await home.locator("h1").first().innerText();
    registrar("home mostra o título principal", /mostre sua tela/i.test(heading), heading.trim().slice(0, 40));

    const temBotaoCriar = await home.getByRole("link", { name: /criar transmissão/i }).first().isVisible();
    registrar("home oferece criar transmissão", temBotaoCriar);

    const campoCodigo = await home.locator("#room-code").isVisible();
    registrar("home oferece entrar por código/link", campoCodigo);

    // Código inválido deve avisar em vez de navegar.
    await home.locator("#room-code").fill("ABC");
    await home.getByRole("button", { name: /^assistir$/i }).click();
    const aviso = await home.locator("#room-code-erro").innerText().catch(() => "");
    registrar("código inválido é recusado com aviso", /inválido/i.test(aviso), aviso.trim());

    // URL completa deve ser aceita e normalizada.
    await home.locator("#room-code").fill(`${APP}/assistir/K7M2PQR4T`);
    await home.getByRole("button", { name: /^assistir$/i }).click();
    await home.waitForURL(/\/assistir\/K7M2PQR4T/, { timeout: 10_000 }).catch(() => {});
    const urlAposLink = home.url();
    registrar(
      "link colado leva à sala certa",
      urlAposLink.includes("/assistir/K7M2PQR4T"),
      urlAposLink.replace(APP, ""),
    );
    await homeCtx.close();

    // ============================================================== HOST
    const hostCtx = await preparar(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
    const host = await hostCtx.newPage();
    host.on("pageerror", (e) => erros.push(`host: ${e.message}`));
    await host.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });

    // Ao entrar na página, a sala é criada sozinha; o nome é pedido em paralelo
    // e só destrava o botão de compartilhar.
    await host.locator("#display-name").fill("Anfitrião Teste");

    // A sala é criada e o link aparece no campo somente-leitura. O seletor usa
    // o `data-campo`, e não o `aria-label`: o rótulo é traduzível, e testar por
    // ele amarraria o teste ao idioma em que o aplicativo abrir.
    await host.waitForSelector('[data-campo="link-transmissao"]', { timeout: 25_000 });
    const linkTexto = await host
      .locator('[data-campo="link-transmissao"]')
      .inputValue()
      .catch(() => "");
    const match = linkTexto.match(/\/assistir\/([A-Z0-9]{9})/);
    registrar("sala é criada com link real", Boolean(match), linkTexto.trim());
    if (!match) throw new Error("sem código de sala — não dá para seguir");
    const roomCode = match[1];

    // O servidor confirma: a sala existe.
    const health = await fetch("http://127.0.0.1:8787/health").then((r) => r.json());
    registrar("servidor registra a sala criada", health.rooms >= 1, `salas=${health.rooms}`);

    // ============================================================ VIEWER
    const viewerCtx = await preparar(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
    const viewer = await viewerCtx.newPage();
    viewer.on("pageerror", (e) => erros.push(`viewer: ${e.message}`));
    await viewer.goto(`${APP}/assistir/${roomCode}`, { waitUntil: "domcontentloaded" });

    // Enquanto o anfitrião não transmite, o espectador espera (e diz isso).
    const espera = await viewer
      .locator("text=/Esperando|Ao vivo|Aguardando|Conectando|Entrando|ainda não começou/i")
      .first()
      .innerText({ timeout: 15_000 })
      .catch(() => "");
    registrar("viewer mostra estado de espera", espera.length > 0, espera.trim().slice(0, 60));

    // O anfitrião vê o espectador entrar. Contamos os itens da lista: o texto
    // do selo de estado muda rápido demais para ser um sinal confiável.
    let listados = 0;
    for (let i = 0; i < 30; i += 1) {
      listados = await host.evaluate(() => {
        const hdr = [...document.querySelectorAll("h2")].find((x) =>
          /Quem está assistindo/i.test(x.textContent ?? ""),
        );
        if (!hdr) return 0;
        const secao = hdr.closest("div")?.parentElement?.parentElement;
        return secao?.querySelectorAll("ul li").length ?? 0;
      });
      if (listados >= 1) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    registrar("host vê o espectador na sala", listados >= 1, `${listados} listado(s)`);

    // ================================================== TRANSMISSÃO REAL
    const botaoCompartilhar = host.getByRole("button", { name: /compartilhar minha tela/i });
    await botaoCompartilhar.click();

    // A captura pode falhar em ambiente headless; verificamos o que aconteceu.
    let capturou = false;
    try {
      // O selo "Ao vivo" só aparece quando a captura está de fato ativa.
      await host.waitForSelector("text=/Ao vivo/i", { timeout: 25_000 });
      capturou = true;
    } catch {
      const erro = await host
        .locator("[role=alert]")
        .first()
        .innerText()
        .catch(() => "");
      registrar("captura de tela iniciou", false, erro.trim().slice(0, 120) || "sem alerta visível");
    }
    if (capturou) registrar("captura de tela iniciou", true, "estado ao vivo");

    // O espectador precisa receber QUADROS, não só "conectado".
    let quadros = 0;
    let largura = 0;
    let altura = 0;
    if (capturou) {
      const inicio = Date.now();
      while (Date.now() - inicio < 40_000) {
        const estado = await viewer.evaluate(() => {
          const v = document.querySelector("video");
          if (!v) return { existe: false };
          return {
            existe: true,
            w: v.videoWidth,
            h: v.videoHeight,
            tempo: v.currentTime,
            quadros: v.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
            pausado: v.paused,
            estadoConexao:
              document.body.innerText.match(/(Conexão direta estabelecida|Estabelecendo conexão|Conexão instável)/)?.[0] ??
              "",
          };
        });
        if (estado.existe) {
          quadros = Math.max(quadros, estado.quadros ?? 0);
          largura = Math.max(largura, estado.w ?? 0);
          altura = Math.max(altura, estado.h ?? 0);
          if (largura > 0 && (quadros > 3 || estado.tempo > 1)) break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    registrar(
      "viewer recebe vídeo com dimensões reais",
      largura > 0 && altura > 0,
      largura > 0 ? `${largura}x${altura}` : "sem dimensões",
    );
    registrar("viewer decodifica quadros de vídeo", quadros > 0, `${quadros} quadros`);

    // ================================================ ENCERRAR E LIMPAR
    if (capturou) {
      await host.getByRole("button", { name: /^encerrar$/i }).click();
      // O espectador deve voltar ao estado de espera sozinho.
      const voltou = await viewer
        .locator("text=/Aguardando|transmissão terminou|terminou|ainda não começou/i")
        .first()
        .innerText({ timeout: 15_000 })
        .catch(() => "");
      registrar("parar transmissão reflete no viewer", voltou.length > 0, voltou.trim().slice(0, 60));
    }

    // ============================================================ MOBILE
    const mob = await preparar(
      await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      }),
    );
    const mobPage = await mob.newPage();
    await mobPage.goto(APP, { waitUntil: "domcontentloaded" });
    const semScrollH = await mobPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    );
    registrar("home não estoura a largura no celular", semScrollH);

    const botaoVisivel = await mobPage
      .getByRole("link", { name: /criar transmissão|transmitir/i })
      .first()
      .isVisible();
    registrar("ação principal visível no celular", botaoVisivel);

    await mobPage.goto(`${APP}/assistir/${roomCode}`, { waitUntil: "domcontentloaded" });
    const mobSemScrollH = await mobPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    );
    registrar("sala não estoura a largura no celular", mobSemScrollH);
    await mob.close();

    // ======================================================== 404 DA SALA
    const ruim = await preparar(await browser.newContext());
    const pagRuim = await ruim.newPage();
    const resposta = await pagRuim.goto(`${APP}/assistir/CODIGOINVALIDO`, {
      waitUntil: "domcontentloaded",
    });
    registrar("código inválido devolve 404", resposta?.status() === 404, `status=${resposta?.status()}`);
    await ruim.close();

    // ============================================ SALA INEXISTENTE (VÁLIDA)
    const fantasma = await preparar(await browser.newContext());
    const pagFantasma = await fantasma.newPage();
    await pagFantasma.goto(`${APP}/assistir/ZZZZZZZZZ`, { waitUntil: "domcontentloaded" });
    // Espera o estado terminal aparecer: enquanto a conexão abre, a página
    // mostra "Entrando na sala…" — o que interessa é onde ela para.
    const textoFantasma = await pagFantasma
      .waitForFunction(
        () => {
          const t = document.body.innerText;
          if (/não existe/i.test(t)) return t;
          return false;
        },
        { timeout: 20_000 },
      )
      .then(() => pagFantasma.evaluate(() => document.body.innerText))
      .catch(() => "");
    registrar(
      "sala inexistente avisa o visitante",
      /não existe/i.test(textoFantasma),
      textoFantasma.replace(/\s+/g, " ").slice(0, 70) || "não saiu do estado de carregamento",
    );

    // E oferece um caminho de volta.
    const temVoltar = await pagFantasma
      .getByRole("link", { name: /voltar ao início/i })
      .first()
      .isVisible()
      .catch(() => false);
    registrar("sala inexistente oferece voltar ao início", temVoltar);
    await fantasma.close();

    await hostCtx.close();
    await viewerCtx.close();

    // ================================================ ERROS DE CONSOLE?
    const relevantes = erros.filter(
      (e) => !/favicon|net::ERR_|Failed to load resource/i.test(e),
    );
    registrar("nenhum erro de JavaScript nas páginas", relevantes.length === 0, relevantes.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }

  const falhas = resultados.filter((r) => !r.ok);
  console.log("\n============ RESUMO ============");
  console.log(`total: ${resultados.length}  ok: ${resultados.length - falhas.length}  falhas: ${falhas.length}`);
  if (falhas.length) {
    for (const f of falhas) console.log(`  FALHOU: ${f.nome} — ${f.detalhe}`);
    process.exitCode = 1;
  }
  return resultados;
}

main().catch((err) => {
  console.error("erro fatal no teste de navegador:", err);
  process.exitCode = 1;
});
