/**
 * Teste de ambiente: o menu muda dentro do aplicativo e não muda no site.
 *
 * O mesmo código serve site e programa instalado, mas duas abas deixam de fazer
 * sentido quando a pessoa já está DENTRO do app:
 *
 *  - "Site" não pode ser uma aba interna (levaria à mesma interface que ela já
 *    vê) — vira link externo para o endereço público;
 *  - "Baixar" sai do menu: o programa já está instalado e aberto.
 *
 * O navegador recebe `__DANIELLIVE_DESKTOP__` injetado antes do JS da página,
 * exatamente como o preload do Electron faz. Sem isso o teste só provaria o
 * caminho do site.
 *
 * Uso: node tests/ambiente.e2e.mjs   (com `npm run start` rodando)
 */

import path from "node:path";
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
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

/** Lê o que o menu oferece, como um visitante veria. */
async function menu(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav", { timeout: 20_000 });
  return page.evaluate(() => {
    const cab = document.querySelector("header");
    const links = [...cab.querySelectorAll("a")];
    return {
      internoSite: links.filter((a) => a.getAttribute("href") === "/site").length,
      internoDownload: links.filter((a) => a.getAttribute("href") === "/download").length,
      externoSite: links
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => /^https?:\/\//.test(h) && h.includes("daniellive")),
      externoComTarget: links.filter((a) => a.target === "_blank").length,
    };
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

try {
  // ============================================================ NO NAVEGADOR
  console.log("\n== no navegador ==");
  const ctxWeb = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  const web = await ctxWeb.newPage();
  const noSite = await menu(web);

  conferir("o site tem a aba Site interna", noSite.internoSite === 1, `${noSite.internoSite} link(s)`);
  conferir("o site tem a aba de download", noSite.internoDownload === 1, `${noSite.internoDownload} link(s)`);
  conferir("nenhum link externo de site aparece no navegador", noSite.externoSite.length === 0, noSite.externoSite.join(", "));

  // =========================================================== NO APLICATIVO
  console.log("\n== dentro do aplicativo ==");
  const ctxApp = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  // É o que o preload do Electron faz antes de qualquer script da página.
  await ctxApp.addInitScript(() => {
    window.__DANIELLIVE_DESKTOP__ = true;
  });
  const app = await ctxApp.newPage();
  const noApp = await menu(app);

  conferir("a aba Site interna sumiu do aplicativo", noApp.internoSite === 0, `${noApp.internoSite} link(s)`);
  conferir(
    "Site virou link externo para o endereço público",
    noApp.externoSite.length === 1,
    noApp.externoSite[0] ?? "nenhum",
  );
  conferir("o link externo abre em outra janela", noApp.externoComTarget >= 1, `${noApp.externoComTarget} com target=_blank`);
  conferir("a aba de download sumiu do aplicativo", noApp.internoDownload === 0, `${noApp.internoDownload} link(s)`);

  // A aba Conta continua nos dois: é o que a pessoa veio usar.
  const contaApp = await app.locator('header a[href="/conta"]').count();
  const contaWeb = await web.locator('header a[href="/conta"]').count();
  conferir("a Conta continua no menu nos dois", contaApp >= 1 && contaWeb >= 1, `app:${contaApp} site:${contaWeb}`);
} finally {
  await browser.close();
}

console.log(`\n=== ${falhas === 0 ? "passou" : `${falhas} falha(s)`} ===`);
process.exit(falhas === 0 ? 0 : 1);
