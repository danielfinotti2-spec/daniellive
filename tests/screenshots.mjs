/**
 * Captura imagens das telas para a documentação.
 *
 * Sobe um anfitrião real, entra um espectador e fotografa cada estado. As
 * imagens vão para docs/ e são referenciadas pelo README.
 *
 * Executa com: node tests/screenshots.mjs
 */

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { preparar } from "./idioma-dos-testes.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = "docs";

mkdirSync(OUT, { recursive: true });

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

const escuro = { colorScheme: "dark" };

/**
 * Fixa o tema pelo `localStorage`.
 *
 * Escrever só o atributo `data-theme` não basta: o botão de tema lê a
 * preferência guardada e a reaplica no efeito de montagem, desfazendo a
 * escolha. Guardar a preferência é o que a mantém estável durante a captura.
 */
async function fixarTema(page, tema) {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("screenlive-theme", t);
    } catch {
      /* modo privado: o atributo abaixo ainda resolve */
    }
  }, tema);
}

try {
  // ------------------------------------------------------------------ home
  const homeCtx = await preparar(
    await browser.newContext({
    viewport: { width: 1440, height: 950 },
    ...escuro,
    }),
  );
  const home = await homeCtx.newPage();
  await fixarTema(home, "escuro");
  await home.goto(APP, { waitUntil: "networkidle" });
  await home.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await home.waitForTimeout(500);
  await home.screenshot({ path: `${OUT}/tela-inicial.png` });
  console.log("docs/tela-inicial.png");

  // A mesma tela no tema claro: as duas precisam estar documentadas porque a
  // escala de cinzas é diferente em cada uma.
  await home.evaluate(() => {
    localStorage.setItem("screenlive-theme", "claro");
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  });
  await home.waitForTimeout(500);
  await home.screenshot({ path: `${OUT}/tela-inicial-claro.png` });
  console.log("docs/tela-inicial-claro.png");

  // -------------------------------------------------------------- como funciona
  await home.evaluate(() => {
    localStorage.setItem("screenlive-theme", "escuro");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
  });
  await home.goto(`${APP}/como-funciona`, { waitUntil: "networkidle" });
  await home.waitForTimeout(500);
  await home.screenshot({ path: `${OUT}/como-funciona.png`, fullPage: true });
  console.log("docs/como-funciona.png");
  await homeCtx.close();

  // ---------------------------------------------------------------- anfitrião
  const hostCtx = await preparar(
    await browser.newContext({
    viewport: { width: 1440, height: 950 },
    ...escuro,
    }),
  );
  const host = await hostCtx.newPage();
  await host.goto(`${APP}/transmitir`, { waitUntil: "networkidle" });
  await host.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await host.screenshot({ path: `${OUT}/preparar-transmissao.png` });
  console.log("docs/preparar-transmissao.png");

  await host.locator("#display-name").fill("Ana");
  // A sala já foi criada ao abrir a página; o campo do link está pronto.
  await host.waitForSelector('[data-campo="link-transmissao"]', { timeout: 25_000 });
  const linkTexto = await host.locator('[data-campo="link-transmissao"]').inputValue();
  const code = linkTexto.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];
  console.log("sala de exemplo:", code);

  // ------------------------------------------------------------ espectador entra
  const viewerCtx = await preparar(
    await browser.newContext({
    viewport: { width: 1280, height: 820 },
    ...escuro,
    }),
  );
  const viewer = await viewerCtx.newPage();
  await viewer.goto(`${APP}/assistir/${code}`, { waitUntil: "networkidle" });
  await viewer.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await viewer.waitForTimeout(1500);
  await viewer.screenshot({ path: `${OUT}/espectador-esperando.png` });
  console.log("docs/espectador-esperando.png");

  // --------------------------------------------------------------- ao vivo
  await host.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await host.waitForSelector("text=/Ao vivo/i", { timeout: 30_000 });
  await host.waitForTimeout(3000);
  await host.screenshot({ path: `${OUT}/anfitriao-ao-vivo.png` });
  console.log("docs/anfitriao-ao-vivo.png");

  await viewer.waitForTimeout(4000);
  await viewer.screenshot({ path: `${OUT}/espectador-assistindo.png` });
  console.log("docs/espectador-assistindo.png");

  // ------------------------------------------------------------- celular
  const mobCtx = await preparar(
    await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ...escuro,
    }),
  );
  const mob = await mobCtx.newPage();
  await mob.goto(APP, { waitUntil: "networkidle" });
  await mob.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await mob.screenshot({ path: `${OUT}/celular-inicial.png` });
  console.log("docs/celular-inicial.png");

  await mob.goto(`${APP}/assistir/${code}`, { waitUntil: "networkidle" });
  await mob.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await mob.waitForTimeout(4000);
  await mob.screenshot({ path: `${OUT}/celular-assistindo.png` });
  console.log("docs/celular-assistindo.png");

  await mobCtx.close();
  await hostCtx.close();
  await viewerCtx.close();
} finally {
  await browser.close();
}

console.log("\nimagens geradas em docs/");
