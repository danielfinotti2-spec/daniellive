/**
 * Audita a geometria da interface renderizada.
 *
 * Não lê o CSS: mede o que o navegador de fato posicionou. É o único jeito de
 * provar afirmações como "o cabeçalho tem 56px", "o palco é 16:9" ou "as
 * colunas somam a largura da tela" sem olhar a imagem.
 *
 * Uso: node tests/geometria.mjs [url]
 */
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let passou = 0;
let falhou = 0;
const falhas = [];

function conferir(nome, ok, detalhe) {
  if (ok) {
    passou++;
    console.log(`  ok  ${nome} — ${detalhe}`);
  } else {
    falhou++;
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`  FALHOU  ${nome} — ${detalhe}`);
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
  const ctx = await preparar(await navegador.newContext({ viewport: { width: 1440, height: 950 } }));
  const page = await ctx.newPage();

  // ------------------------------------------------------------ página inicial
  console.log("\n== Página inicial (1440px) ==");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const cabecalho = await page.evaluate(() => {
    const el = document.querySelector("header");
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      altura: Math.round(r.height),
      posicao: s.position,
      topo: Math.round(r.top),
      fundo: s.backgroundColor,
      desfoque: s.backdropFilter,
      zIndex: s.zIndex,
    };
  });
  // A referência usa exatamente h-14 = 56px.
  conferir("cabeçalho tem 56px de altura", Math.abs(cabecalho.altura - 56) <= 1, `${cabecalho.altura}px`);
  conferir("cabeçalho fixa no topo", cabecalho.posicao === "sticky" && cabecalho.topo === 0, `${cabecalho.posicao}@${cabecalho.topo}`);
  conferir("cabeçalho desfoca o fundo", /blur/.test(cabecalho.desfoque), cabecalho.desfoque);
  conferir("cabeçalho fica acima do conteúdo", Number(cabecalho.zIndex) >= 30, `z=${cabecalho.zIndex}`);

  // Largura útil: o conteúdo precisa estar centralizado com folga nas laterais.
  const larguraUtil = await page.evaluate(() => {
    const el = document.querySelector("header > div");
    const r = el.getBoundingClientRect();
    return { largura: Math.round(r.width), esquerda: Math.round(r.left), direita: Math.round(window.innerWidth - r.right) };
  });
  conferir("o conteúdo do cabeçalho é simétrico", Math.abs(larguraUtil.esquerda - larguraUtil.direita) <= 1, `esq=${larguraUtil.esquerda} dir=${larguraUtil.direita}`);

  // Escala de raio: cartões de página usam 16px (rounded-2xl).
  const raioCartao = await page.evaluate(() => {
    const el = document.querySelector("main#conteudo .rounded-2xl, main#conteudo [class*='rounded-2xl']");
    return el ? getComputedStyle(el).borderTopLeftRadius : "";
  });
  conferir("cartões de página usam rounded-2xl (16px)", raioCartao === "16px", raioCartao || "não encontrado");

  // O h1 precisa dominar a hierarquia tipográfica.
  const tamanhoH1 = await page.evaluate(() => {
    const el = document.querySelector("h1");
    return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
  });
  conferir("o h1 é grande o bastante para ser o título", tamanhoH1 >= 28, `${tamanhoH1}px`);

  // Foco visível: navegar por teclado precisa mostrar onde se está.
  await page.keyboard.press("Tab");
  const foco = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return { tag: el.tagName, outline: s.outlineWidth, estilo: s.outlineStyle };
  });
  conferir(
    "o primeiro Tab mostra um indicador de foco",
    Boolean(foco && foco.estilo !== "none" && parseFloat(foco.outline) > 0),
    foco ? `${foco.tag} outline=${foco.outline} ${foco.estilo}` : "nada focável",
  );

  // ------------------------------------------------------------ link do convite
  console.log("\n== Página de transmissão ==");
  await page.goto(`${BASE}/transmitir`, { waitUntil: "networkidle" });
  await page.locator("#display-name").fill("Ana");
  await page.waitForSelector('[data-campo="link-transmissao"]', { timeout: 25_000 });
  await page.waitForTimeout(600);

  // O palco é 16:9: é o formato de qualquer tela de computador. Antes de
  // compartilhar não há `<video>` (o estado vazio ocupa o lugar), então a
  // medida é feita no contêiner que define a proporção.
  const palco = await page.evaluate(() => {
    const el = document.querySelector(".aspect-video");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (palco) {
    const proporcao = palco.w / palco.h;
    conferir("o palco mantém 16:9", Math.abs(proporcao - 16 / 9) < 0.06, `${palco.w}x${palco.h} = ${proporcao.toFixed(3)}`);
  } else {
    conferir("o palco existe", false, "não encontrado");
  }

  // Os controles do anfitrião precisam estar visíveis e clicáveis.
  const controles = await page.evaluate(() => {
    const botao = [...document.querySelectorAll("button")].find((b) =>
      /compartilhar minha tela|transmitir de novo/i.test(b.textContent ?? ""),
    );
    if (!botao) return null;
    const r = botao.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), desabilitado: botao.disabled };
  });
  if (controles) {
    conferir("o botão de compartilhar é grande o bastante", controles.w >= 150 && controles.h >= 36, `${controles.w}x${controles.h}`);
    conferir("o botão de compartilhar está ativo com nome preenchido", !controles.desabilitado, controles.desabilitado ? "desabilitado" : "ativo");
  } else {
    conferir("o botão de compartilhar existe", false, "não encontrado");
  }

  // As duas colunas precisam caber sem estourar.
  const colunas = await page.evaluate(() => {
    const grade = document.querySelector("[class*='lg:grid-cols']");
    if (!grade) return null;
    const r = grade.getBoundingClientRect();
    return { largura: Math.round(r.width), direita: Math.round(r.right), janela: window.innerWidth };
  });
  if (colunas) {
    conferir("a grade de duas colunas cabe na janela", colunas.direita <= colunas.janela + 1, `dir=${colunas.direita} janela=${colunas.janela}`);
  }

  // --------------------------------------------------------------- diálogo
  console.log("\n== Diálogo ==");
  await page.click('[aria-haspopup="menu"]');
  await page.waitForTimeout(200);
  const itensMenu = await page.$$('[role="menuitem"]');
  if (itensMenu.length) {
    // Abre o diálogo pelo item "Mais detalhes…".
    await page.getByRole("menuitem", { name: /mais detalhes/i }).click();
    await page.waitForTimeout(400);

    const dialogo = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        ariaModal: el.getAttribute("aria-modal"),
        rotulado: Boolean(el.getAttribute("aria-labelledby")),
        animacao: s.animationName,
        corpo: document.body.style.overflow,
      };
    });
    if (dialogo) {
      conferir("o diálogo aparece com papel e aria-modal", dialogo.ariaModal === "true", `aria-modal=${dialogo.ariaModal}`);
      conferir("o diálogo é rotulado por um título", dialogo.rotulado, `aria-labelledby=${dialogo.rotulado}`);
      conferir("o diálogo anima na entrada", dialogo.animacao !== "none", dialogo.animacao);
      // O corpo precisa travar: rolar o fundo com um modal aberto é desorientador.
      conferir("o fundo não rola com o diálogo aberto", dialogo.corpo === "hidden", `overflow=${dialogo.corpo || "visível"}`);
      conferir("o diálogo cabe na janela", dialogo.h <= 950, `${dialogo.w}x${dialogo.h}`);
    } else {
      conferir("o diálogo abre", false, "não encontrado");
    }

    // Esc fecha e o foco volta para onde estava.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const fechou = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    conferir("Esc fecha o diálogo", fechou, fechou ? "fechado" : "continua aberto");
  }

  // --------------------------------------------------------------- responsivo
  console.log("\n== Geometria responsiva ==");
  await ctx.close();

  for (const [rotulo, largura, altura] of [
    ["celular", 390, 844],
    ["tablet", 768, 1024],
    ["desktop estreito", 1024, 800],
    ["desktop", 1440, 950],
  ]) {
    const c = await preparar(await navegador.newContext({ viewport: { width: largura, height: altura } }));
    const p = await c.newPage();
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);

    const m = await p.evaluate(() => ({
      transbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      abaVisivel: (() => {
        const n = document.querySelector("nav[aria-label='Navegação principal']");
        return n ? n.getBoundingClientRect().height > 0 : false;
      })(),
      // Nada pode ter largura zero ou ultrapassar a janela.
      foraDaTela: [...document.querySelectorAll("main#conteudo *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 2;
        })
        .map((el) => el.className?.toString?.().slice(0, 40))
        .slice(0, 3),
    }));

    conferir(`${rotulo}: sem transbordo horizontal`, m.transbordo <= 1, `${m.transbordo}px`);
    conferir(
      `${rotulo}: nada posicionado fora da janela`,
      m.foraDaTela.length === 0,
      m.foraDaTela.length ? m.foraDaTela.join(" | ") : "tudo dentro",
    );
    // A barra inferior é o padrão abaixo de lg (1024px).
    conferir(
      `${rotulo}: barra inferior ${largura < 1024 ? "presente" : "ausente"}`,
      m.abaVisivel === largura < 1024,
      `visível=${m.abaVisivel}`,
    );
    await c.close();
  }
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
} finally {
  await navegador.close();
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
for (const f of falhas) console.log(`  - ${f}`);
process.exit(falhou === 0 ? 0 : 1);
