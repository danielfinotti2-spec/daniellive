/**
 * Testes de cenários que a suíte principal não cobre: vários espectadores ao
 * mesmo tempo, permissão negada e encerramento pelo navegador.
 *
 * Executa com: node tests/scenarios.e2e.mjs
 */

import { chromium } from "playwright-core";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const resultados = [];
function registrar(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream",
    "--auto-select-desktop-capture-source=Entire screen",
    "--auto-select-desktop-capture-source=Tela inteira",
    "--enable-usermedia-screen-capturing",
    "--allow-http-screen-capture",
  ],
});

try {
  // ============================================ VÁRIOS ESPECTADORES (MESH)
  const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await hostCtx.newPage();
  await host.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await host.locator("#display-name").fill("Ana");
  await host.getByRole("button", { name: /criar a sala/i }).click();
  await host.waitForSelector("text=/Código da sala/i", { timeout: 20_000 });
  const link = await host.locator("p.font-mono").first().innerText();
  const code = link.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];
  registrar("sala criada para o teste de vários espectadores", Boolean(code), code);

  // Três espectadores em contextos separados.
  const viewers = [];
  for (let i = 1; i <= 3; i += 1) {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/assistir/${code}`, { waitUntil: "domcontentloaded" });
    viewers.push({ ctx, page });
  }

  // O anfitrião lista os três.
  let listados = 0;
  for (let i = 0; i < 30; i += 1) {
    const texto = await host.locator("aside").first().innerText().catch(() => "");
    const m = texto.match(/Quem está assistindo\s*\((\d+)\)/);
    listados = m ? Number(m[1]) : 0;
    if (listados >= 3) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  registrar("anfitrião vê os 3 espectadores", listados === 3, `${listados} listado(s)`);

  // Inicia a transmissão.
  await host.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await host.waitForSelector("text=/AO VIVO/i", { timeout: 30_000 });

  // Todos os três precisam receber vídeo de verdade.
  const receberam = [];
  for (const [indice, v] of viewers.entries()) {
    let largura = 0;
    let quadros = 0;
    const inicio = Date.now();
    while (Date.now() - inicio < 45_000) {
      const estado = await v.page.evaluate(() => {
        const video = document.querySelector("video");
        if (!video) return { w: 0, q: 0 };
        return {
          w: video.videoWidth,
          q: video.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
        };
      });
      largura = Math.max(largura, estado.w ?? 0);
      quadros = Math.max(quadros, estado.q ?? 0);
      if (largura > 0 && (quadros > 2 || largura > 0)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    receberam.push({ indice: indice + 1, largura, quadros });
  }

  for (const r of receberam) {
    registrar(
      `espectador ${r.indice} recebe vídeo`,
      r.largura > 0,
      r.largura > 0 ? `${r.largura}px, ${r.quadros} quadros` : "sem vídeo",
    );
  }

  const todosReceberam = receberam.every((r) => r.largura > 0);
  registrar(
    "mesh entrega para todos ao mesmo tempo",
    todosReceberam,
    receberam.map((r) => `#${r.indice}=${r.largura}px`).join(" "),
  );

  // Um espectador sai; os outros continuam.
  await viewers[1].ctx.close();
  await new Promise((r) => setTimeout(r, 3000));

  const aindaRecebem = await viewers[0].page.evaluate(() => {
    const video = document.querySelector("video");
    return video ? video.videoWidth : 0;
  });
  registrar(
    "saída de um espectador não afeta os outros",
    aindaRecebem > 0,
    aindaRecebem > 0 ? `ainda ${aindaRecebem}px` : "perdeu o vídeo",
  );

  // Encerra pelo botão do anfitrião.
  await host.getByRole("button", { name: /parar compartilhamento/i }).click();
  const encerrou = await viewers[0].page
    .waitForFunction(() => /terminou|Esperando/i.test(document.body.innerText), { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  registrar("todos voltam ao estado de espera ao parar", encerrou);

  await hostCtx.close();
  for (const v of viewers) await v.ctx.close().catch(() => {});

  // ==================================================== PERMISSÃO NEGADA
  const negCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const neg = await negCtx.newPage();
  // Sobrescreve getDisplayMedia para simular o usuário cancelando a escolha —
  // é exatamente o NotAllowedError que o navegador lança nesse caso.
  await neg.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    };
  });
  await neg.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await neg.locator("#display-name").fill("Teste");
  await neg.getByRole("button", { name: /criar a sala/i }).click();
  await neg.waitForSelector("text=/Código da sala/i", { timeout: 20_000 });
  await neg.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await new Promise((r) => setTimeout(r, 1500));

  const textoNegado = await neg.evaluate(() => document.body.innerText);
  registrar(
    "permissão negada é avisada com clareza",
    /cancelou a seleção|não autorizado|cancelado/i.test(textoNegado),
    textoNegado.match(/[^\n]*(cancelou|autoriz)[^\n]*/i)?.[0]?.slice(0, 80) ?? "sem aviso",
  );
  registrar(
    "permissão negada não deixa a interface 'ao vivo'",
    !/AO VIVO/.test(textoNegado),
    /AO VIVO/.test(textoNegado) ? "mostrou AO VIVO indevidamente" : "estado correto",
  );
  await negCtx.close();

  // ============================================ NAVEGADOR SEM SUPORTE
  const oldCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const old = await oldCtx.newPage();
  await old.addInitScript(() => {
    // Remove a API para simular um navegador antigo ou contexto não seguro.
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });
  });
  await old.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await old.locator("#display-name").fill("Teste");
  await old.getByRole("button", { name: /criar a sala/i }).click();
  await old.waitForSelector("text=/Código da sala/i", { timeout: 20_000 });
  const textoOld = await old.evaluate(() => document.body.innerText);
  registrar(
    "navegador sem suporte é avisado antes de tentar",
    /não permite capturar a tela|não permite compartilhar/i.test(textoOld),
    textoOld.match(/[^\n]*não permite[^\n]*/i)?.[0]?.slice(0, 90) ?? "sem aviso",
  );
  const botaoDesabilitado = await old
    .getByRole("button", { name: /compartilhar minha tela/i })
    .isDisabled()
    .catch(() => false);
  registrar("botão de compartilhar fica desabilitado sem suporte", botaoDesabilitado);

  await oldCtx.close();

  // ==================================================== RECONEXÃO DO VIEWER
  const rCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const rHost = await rCtx.newPage();
  await rHost.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await rHost.locator("#display-name").fill("Ana");
  await rHost.getByRole("button", { name: /criar a sala/i }).click();
  await rHost.waitForSelector("text=/Código da sala/i", { timeout: 20_000 });
  const link2 = await rHost.locator("p.font-mono").first().innerText();
  const code2 = link2.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];

  const wCtx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const w = await wCtx.newPage();
  await w.goto(`${APP}/assistir/${code2}`, { waitUntil: "domcontentloaded" });
  await rHost.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await rHost.waitForSelector("text=/AO VIVO/i", { timeout: 30_000 });

  // Espera o vídeo chegar.
  let chegou = 0;
  for (let i = 0; i < 60; i += 1) {
    chegou = await w.evaluate(() => document.querySelector("video")?.videoWidth ?? 0);
    if (chegou > 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  registrar("recarga: vídeo chega antes do teste", chegou > 0, `${chegou}px`);

  // Recarrega a página do espectador: precisa reconectar sozinho.
  await w.reload({ waitUntil: "domcontentloaded" });
  let apos = 0;
  for (let i = 0; i < 80; i += 1) {
    apos = await w.evaluate(() => document.querySelector("video")?.videoWidth ?? 0);
    if (apos > 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  registrar(
    "espectador reconecta sozinho depois de recarregar",
    apos > 0,
    apos > 0 ? `${apos}px` : "não reconectou em 40 s",
  );

  await rCtx.close();
  await wCtx.close();
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok);
console.log("\n============ RESUMO ============");
console.log(`total: ${resultados.length}  ok: ${resultados.length - falhas.length}  falhas: ${falhas.length}`);
for (const f of falhas) console.log(`  FALHOU: ${f.nome} — ${f.detalhe}`);
if (falhas.length) process.exitCode = 1;
