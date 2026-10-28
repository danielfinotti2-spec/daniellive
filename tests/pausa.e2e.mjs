/**
 * Prova que a pausa funciona de ponta a ponta, com duas telas reais.
 *
 * O que este teste precisa demonstrar, e não apenas afirmar:
 *  1. pausar NÃO encerra a transmissão (o vídeo continua conectado);
 *  2. o espectador fica sabendo da pausa, em vez de achar que travou;
 *  3. o envio de quadros realmente para — sem isso, "pausa" seria só um rótulo;
 *  4. retomar volta a entregar quadros, sem pedir a tela de novo nem reconectar.
 *
 * Uso: node tests/pausa.e2e.mjs
 */
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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

const navegador = await chromium.launch({
  executablePath: CHROME,
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
  const hostCtx = await preparar(await navegador.newContext({ viewport: { width: 1440, height: 900 } }));
  const host = await hostCtx.newPage();
  await host.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await host.locator("#display-name").fill("Ana");
  await host.waitForSelector('[data-campo="link-transmissao"]', { timeout: 25_000 });
  const code = (await host.locator('[data-campo="link-transmissao"]').inputValue()).match(
    /\/assistir\/([A-Z0-9]{9})/,
  )?.[1];
  conferir("sala criada para o teste de pausa", Boolean(code), code);

  const viewerCtx = await preparar(await navegador.newContext({ viewport: { width: 1280, height: 800 } }));
  const viewer = await viewerCtx.newPage();
  await viewer.goto(`${APP}/assistir/${code}`, { waitUntil: "domcontentloaded" });

  // ------------------------------------------------------------- começa ao vivo
  await host.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await host.waitForSelector("text=/Ao vivo/i", { timeout: 30_000 });

  // Espera quadros chegando de verdade antes de pausar — pausar algo que nunca
  // começou não prova nada.
  let quadrosAntes = 0;
  for (let i = 0; i < 60; i += 1) {
    quadrosAntes = await viewer.evaluate(
      () => document.querySelector("video")?.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
    );
    if (quadrosAntes > 3) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  conferir("o espectador recebe quadros antes da pausa", quadrosAntes > 3, `${quadrosAntes} quadros`);

  // ------------------------------------------------------------------- pausa
  await host.getByRole("button", { name: /^pausar$/i }).click();
  await new Promise((r) => setTimeout(r, 1000));

  // O anfitrião precisa mostrar que está pausado.
  const textoHost = await host.evaluate(() => document.body.innerText);
  conferir("o anfitrião mostra o estado pausado", /pausad/i.test(textoHost), extrair(textoHost, /pausad\w*/i));

  // A transmissão NÃO pode ter encerrado: o botão de retomar deve existir.
  const temRetomar = await host.getByRole("button", { name: /^retomar$/i }).count();
  conferir("pausar não encerra a transmissão (há 'Retomar')", temRetomar > 0, `${temRetomar} botão(ões)`);

  // O espectador precisa ser avisado, e não parecer que travou.
  let avisouViewer = false;
  for (let i = 0; i < 20; i += 1) {
    const t = await viewer.evaluate(() => document.body.innerText);
    if (/pausad/i.test(t)) {
      avisouViewer = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  conferir(
    "o espectador sabe que foi pausado",
    avisouViewer,
    avisouViewer ? extrair(await viewer.evaluate(() => document.body.innerText), /[^\n]*pausad[^\n]*/i) : "sem aviso",
  );

  // O ponto central: os quadros precisam PARAR de chegar. Sem isso a pausa
  // seria apenas um rótulo na tela enquanto a banda continua sendo gasta.
  const antesDaEspera = await viewer.evaluate(
    () => document.querySelector("video")?.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
  );
  await new Promise((r) => setTimeout(r, 5000));
  const depoisDaEspera = await viewer.evaluate(
    () => document.querySelector("video")?.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
  );
  const novos = depoisDaEspera - antesDaEspera;
  conferir(
    "o envio de quadros realmente para durante a pausa",
    novos <= 2,
    `${novos} quadros novos em 5 s`,
  );

  // A conexão continua de pé: pausar não é desconectar. Os selos do espectador
  // mantêm "Ao vivo" e a sinalização "Conectado"; se tivesse caído, apareceria
  // "Conexão instável" ou a tela voltaria para a espera.
  const estadoViewer = await viewer.evaluate(() => {
    // `innerText` devolve o texto como aparece, e os selos usam maiúsculas
    // pequenas via CSS — por isso a comparação ignora a caixa.
    const texto = document.body.innerText;
    return {
      aoVivo: /ao vivo/i.test(texto),
      conectado: /conectado/i.test(texto),
      caiu: /Conexão instável|Conexão ruim|Caiu|Fora do ar/i.test(texto),
      esperando: /Aguardando a transmissão|ainda não começou/i.test(texto),
    };
  });
  conferir(
    "a conexão continua de pé durante a pausa",
    estadoViewer.aoVivo && estadoViewer.conectado && !estadoViewer.caiu && !estadoViewer.esperando,
    JSON.stringify(estadoViewer),
  );

  // ------------------------------------------------------------------ retomar
  await host.getByRole("button", { name: /^retomar$/i }).click();

  let voltou = 0;
  const base = depoisDaEspera;
  for (let i = 0; i < 40; i += 1) {
    const q = await viewer.evaluate(
      () => document.querySelector("video")?.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
    );
    voltou = q - base;
    if (voltou > 3) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  conferir("retomar volta a entregar quadros", voltou > 3, `${voltou} quadros novos`);

  const textoViewerDepois = await viewer.evaluate(() => document.body.innerText);
  conferir("o aviso de pausa some ao retomar", !/pausad/i.test(textoViewerDepois));

  // Retomar não pode ter exigido uma nova captura: se tivesse, o Chrome teria
  // aberto o seletor de tela de novo e a transmissão apareceria como nova.
  const linkFinal = await host.locator('[data-campo="link-transmissao"]').inputValue();
  conferir("a sala é a mesma depois de pausar e retomar", linkFinal.includes(code), code);

  // ------------------------------------------------------ encerrar normalmente
  await host.getByRole("button", { name: /^encerrar$/i }).click();
  const encerrou = await viewer
    .waitForFunction(() => /Aguardando|terminou|ainda não começou/i.test(document.body.innerText), {
      timeout: 20_000,
    })
    .then(() => true)
    .catch(() => false);
  conferir("encerrar depois de retomar volta o espectador à espera", encerrou);

  await hostCtx.close();
  await viewerCtx.close();
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
} finally {
  await navegador.close();
}

function extrair(texto, re) {
  return texto.match(re)?.[0]?.replace(/\s+/g, " ").slice(0, 70) ?? "";
}

console.log(`\n============ RESUMO ============`);
console.log(`total: ${passou + falhou}  ok: ${passou}  falhas: ${falhou}`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
if (falhou) process.exitCode = 1;
