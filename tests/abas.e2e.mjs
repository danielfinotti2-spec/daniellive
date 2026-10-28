/**
 * Confere as mudanças de interface nas duas formas de usar o DanielLive.
 *
 * Cobre o que foi mudado de propósito — o bloco do mascote que saiu da home e as
 * abas Site e Download — e o que **não** podia mudar junto: o mascote continua no
 * cabeçalho, a criação de sala continua na dobra, e a barra do celular continua
 * cabendo em 390px.
 *
 * A checagem de transbordo horizontal existe porque o defeito já aconteceu: duas
 * abas de texto a mais na barra a empurraram para 510px numa tela de 390px, e a
 * página inteira ganhou rolagem lateral. Um teste que só olhasse a presença dos
 * links teria aprovado.
 *
 * Uso: node tests/abas.e2e.mjs [url]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, det) => {
  if (cond) {
    ok++;
    console.log("  ok    " + nome + (det ? " — " + det : ""));
  } else {
    falhas.push(nome);
    console.log("  FALHA " + nome + (det ? " — " + det : ""));
  }
};

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME });
  const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });

  console.log("== pagina inicial ==");
  await page.goto(BASE, { waitUntil: "networkidle" });
  const home = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      texto: txt,
      temPatoNoHeroi: !!document.querySelector("main img[alt*='Pato'], section img[alt*='Pato']"),
      titulo: document.querySelector("h1")?.innerText ?? "",
      imgs: [...document.querySelectorAll("main img, section img")].map((i) => i.alt),
    };
  });
  conferir("o bloco do mascote saiu do corpo", !home.temPatoNoHeroi);
  conferir(
    "o texto 'Compartilhamento de tela pelo navegador' saiu do corpo",
    !home.texto.includes("Compartilhamento de tela pelo navegador"),
  );
  conferir("o titulo principal continua", home.titulo.includes("Mostre sua tela"), JSON.stringify(home.titulo));
  conferir("a chamada para criar transmissao continua", home.texto.includes("Começar agora"));
  conferir("as abas aparecem", home.texto.includes("Site") && home.texto.includes("Download"));

  // O mascote deve continuar no cabecalho — so o bloco do corpo saiu.
  const cabecalho = await page.evaluate(() => {
    const h = document.querySelector("header");
    return {
      temMascote: !!h?.querySelector("img"),
      alt: h?.querySelector("img")?.alt ?? "",
      texto: h?.innerText ?? "",
    };
  });
  conferir("o mascote permanece no cabecalho", cabecalho.temMascote, cabecalho.alt);
  conferir("o cabecalho tem a aba Site", cabecalho.texto.includes("Site"));
  conferir("o cabecalho tem a aba Download", cabecalho.texto.includes("Download"));

  console.log("\n== pagina /site ==");
  const r1 = await page.goto(BASE + "/site", { waitUntil: "networkidle" });
  conferir("responde 200", r1.status() === 200, String(r1.status()));
  const site = await page.evaluate(() => document.body.innerText);
  conferir("explica a versao web", site.includes("pelo navegador"));
  conferir("mantem a criacao de sala", site.includes("Começar agora"));
  conferir("aponta para o download", site.includes("aplicativo para Windows"));
  conferir("as abas marcam Site como ativo", await page.evaluate(() =>
    document.querySelector('a[href="/site"]')?.getAttribute("aria-current") === "page"));

  console.log("\n== pagina /download ==");
  const r2 = await page.goto(BASE + "/download", { waitUntil: "networkidle" });
  conferir("responde 200", r2.status() === 200, String(r2.status()));
  const dl = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      texto: txt,
      temBotaoDesabilitado: !!document.querySelector("[aria-disabled]"),
      linksExternos: [...document.querySelectorAll("a[href^='http']")].map((a) => a.href),
      nomesArquivos: ["Setup", "Portatil", "msi"].filter((n) => txt.includes(n)),
    };
  });
  conferir("descreve o aplicativo", dl.texto.includes("Baixe o DanielLive"));
  conferir("lista os requisitos", dl.texto.includes("Windows 10 ou 11"));
  // Enquanto o endereco nao for confirmado, nao pode haver botao levando a lugar nenhum
  conferir("nao promete download inexistente", dl.temBotaoDesabilitado);
  conferir("mostra os tres arquivos previstos", dl.nomesArquivos.length === 3, dl.nomesArquivos.join(", "));
  conferir("oferece a versao web como alternativa", dl.texto.includes("versão web") || dl.texto.includes("versão web"));

  console.log("\n== navegacao entre abas ==");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('a[href="/download"]');
  await page.waitForURL("**/download");
  conferir("a aba Download navega", page.url().endsWith("/download"));
  await page.click('a[href="/site"]');
  await page.waitForURL("**/site");
  conferir("a aba Site navega", page.url().endsWith("/site"));
  await page.goBack();
  conferir("o botao voltar funciona", page.url().endsWith("/download"));

  console.log("\n== sem erros de console ==");
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  for (const p of ["/", "/site", "/download", "/como-funciona"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
  }
  conferir("nenhum erro de JavaScript", erros.length === 0, erros.join(" | "));

  /*
   * A barra do celular precisa caber.
   *
   * Estas duas abas novas são justamente do tipo de coisa que passa num teste de
   * presença e quebra na tela: com dois rótulos de texto a mais, a barra foi a
   * 510px numa tela de 390px e a página inteira ganhou rolagem lateral — a
   * primeira coisa que uma pessoa nota e a última que um teste de link pega.
   */
  console.log("\n== celular (390px) ==");
  const celular = await nav.newPage({ viewport: { width: 390, height: 844 } });
  for (const p of ["/", "/site", "/download"]) {
    await celular.goto(BASE + p, { waitUntil: "networkidle" });
    const medida = await celular.evaluate(() => ({
      janela: document.documentElement.clientWidth,
      conteudo: document.documentElement.scrollWidth,
    }));
    conferir(
      `sem rolagem horizontal em ${p}`,
      medida.conteudo <= medida.janela + 1,
      `${medida.conteudo}px de conteúdo em ${medida.janela}px`,
    );
  }
  // As abas continuam alcançáveis no celular, mesmo sem os rótulos completos.
  // Sendo as duas entradas principais, o alvo de toque precisa ser confortável:
  // 40px de altura, contra os 27px que o padding sozinho daria.
  await celular.goto(BASE, { waitUntil: "networkidle" });
  const alcancaveis = await celular.evaluate(() => {
    const achar = (href) => {
      const el = document.querySelector(`header a[href="${href}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), direita: Math.round(r.right) };
    };
    return {
      site: achar("/site"),
      download: achar("/download"),
      janela: window.innerWidth,
    };
  });
  for (const [nome, medida] of [
    ["Site", alcancaveis.site],
    ["Download", alcancaveis.download],
  ]) {
    conferir(`a aba ${nome} está visível no celular`, Boolean(medida && medida.w > 0 && medida.h > 0),
      medida ? `${medida.w}x${medida.h}` : "ausente");
    if (medida) {
      conferir(`o alvo de toque de ${nome} tem ao menos 40px`, medida.h >= 40, `${medida.h}px`);
      conferir(`a aba ${nome} não sai da tela`, medida.direita <= alcancaveis.janela + 1,
        `${medida.direita}px de ${alcancaveis.janela}px`);
    }
  }

  await nav.close();
  console.log("\n=== " + ok + " passaram, " + falhas.length + " falharam ===");
  for (const f of falhas) console.log("  - " + f);
  process.exit(falhas.length ? 1 : 0);
})();
