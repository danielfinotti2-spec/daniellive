/**
 * Verificação visual e comportamental contra o servidor real.
 *
 * Não usa mocks: sobe o Chrome do sistema, navega pelo site de verdade e mede o
 * que está na tela. O objetivo é provar que a interface funciona — não que o
 * HTML foi produzido.
 *
 * Uso: node --experimental-strip-types tests/smoke-ui.mjs [url]
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (!existsSync(CHROME)) {
  console.error(`Chrome não encontrado em ${CHROME}`);
  process.exit(2);
}

let passou = 0;
let falhou = 0;
const falhas = [];

function verificar(nome, condicao, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ok  ${nome}`);
  } else {
    falhou++;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`);
    console.log(`  FALHOU  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/**
 * Lê a cor de fundo computada.
 *
 * O Tailwind v4 emite cores em `oklab`/`lab` quando há `color-mix` ou opacidade
 * envolvida, então comparar com `rgb()` dá falso negativo. Normalizamos tudo
 * para RGB usando o próprio navegador.
 */
async function corDeFundo(page, seletor) {
  return page.$eval(seletor, (el) => {
    const bruta = getComputedStyle(el).backgroundColor;
    // Um canvas de 1x1 converte qualquer notação de cor para RGBA.
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bruta;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})${a === 255 ? "" : ` / ${(a / 255).toFixed(2)}`}`;
  });
}

const navegador = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  // ---------------------------------------------------------------- página inicial
  console.log("\n== Página inicial ==");
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await contexto.newPage();
  const errosConsole = [];
  page.on("console", (m) => {
    if (m.type() === "error") errosConsole.push(m.text());
  });
  page.on("pageerror", (e) => errosConsole.push(`pageerror: ${e.message}`));

  const resposta = await page.goto(BASE, { waitUntil: "networkidle" });
  verificar("a página inicial responde 200", resposta?.status() === 200, `status ${resposta?.status()}`);

  const titulo = await page.title();
  verificar("o título traz o nome do produto", titulo.includes("DanielLive"), titulo);

  const h1 = await page.textContent("h1");
  verificar("há um h1 visível", Boolean(h1 && h1.trim().length > 5), JSON.stringify(h1));

  // Cabeçalho: precisa estar fixo e translúcido.
  const cabecalho = await page.$("header");
  verificar("o cabeçalho existe", cabecalho !== null);
  const posicaoCabecalho = await page.$eval("header", (el) => getComputedStyle(el).position);
  verificar("o cabeçalho é fixo (sticky)", posicaoCabecalho === "sticky", posicaoCabecalho);

  // Tema claro por padrão.
  const temaInicial = await page.getAttribute("html", "data-theme");
  verificar("o tema é declarado no <html>", temaInicial === "light" || temaInicial === "dark", String(temaInicial));
  const fundoPagina = await corDeFundo(page, "body");
  verificar(
    "o fundo do corpo segue o tema claro",
    temaInicial !== "light" || fundoPagina === "rgb(250, 250, 250)",
    fundoPagina,
  );

  // ------------------------------------------------ alternância de tema (2 cliques)
  console.log("\n== Tema ==");
  const botaoTema = await page.$('button[title*="Tema"]');
  verificar("o botão de tema existe", botaoTema !== null);
  if (botaoTema) {
    const antes = await page.getAttribute("html", "data-theme");
    await botaoTema.click();
    await page.waitForTimeout(250);
    const depois1 = await page.getAttribute("html", "data-theme");
    verificar("o primeiro clique muda o tema", antes !== depois1, `${antes} -> ${depois1}`);

    // Em tema escuro, o token de página precisa ser o escuro da referência.
    if (depois1 === "dark") {
      const fundoEscuro = await corDeFundo(page, "body");
      verificar("o fundo escuro é #101014", fundoEscuro === "rgb(16, 16, 20)", fundoEscuro);
      const corToken = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--color-zinc-950").trim(),
      );
      verificar("o token zinc-950 escuro é #1a1a1f", corToken === "#1a1a1f", corToken);
    }

    await botaoTema.click();
    await page.waitForTimeout(250);
    const depois2 = await page.getAttribute("html", "data-theme");
    // O ciclo tem três estados: partindo de "sistema" ele vai para o oposto do
    // que está na tela, e o clique seguinte volta para "sistema".
    const voltouParaSistema = depois2 === "sistema" || depois2 !== depois1;
    verificar("o ciclo de tema continua avançando", voltouParaSistema, `${depois1} -> ${depois2}`);
    // Volta para claro para o resto do teste.
    await page.evaluate(() => localStorage.removeItem("screenlive-theme"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
  }

  // ------------------------------------------------------ validação do formulário
  console.log("\n== Entrada por código ==");
  const campoCodigo = await page.$("#room-code");
  verificar("o campo de código existe", campoCodigo !== null);
  if (campoCodigo) {
    await campoCodigo.fill("abc");
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(300);
    const erro = await page.textContent("#room-code-erro");
    verificar("um código curto é recusado com explicação", Boolean(erro?.includes("inválido")), String(erro));
    const urlDepoisDeErro = page.url();
    verificar("não navega com código inválido", !urlDepoisDeErro.includes("/assistir/"), urlDepoisDeErro);

    // Um link completo colado também precisa funcionar.
    await campoCodigo.fill(`${BASE}/assistir/k7m2pqr4t`);
    await page.click('form button[type="submit"]');
    await page.waitForURL("**/assistir/**", { timeout: 8000 }).catch(() => {});
    verificar(
      "um link colado é normalizado e navega para a sala",
      page.url().includes("/assistir/K7M2PQR4T"),
      page.url(),
    );
  }

  // A sala com código válido deve mostrar o estado de espera, não um erro.
  console.log("\n== Sala de quem assiste ==");
  await page.waitForTimeout(1200);
  const textoPagina = await page.textContent("body");
  verificar(
    "a sala válida mostra um estado de espera",
    /aguardando|entrando|conectando|apresentador/i.test(textoPagina ?? ""),
    (textoPagina ?? "").slice(0, 160),
  );
  verificar(
    "a sala não mostra erro de código inválido",
    !/não parece válido/i.test(textoPagina ?? ""),
  );

  // Código inexistente precisa dizer que a sala não existe.
  console.log("\n== Sala inexistente ==");
  await page.goto(`${BASE}/assistir/ZZZZZZZZZ`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const textoInexistente = await page.textContent("body");
  verificar(
    "uma sala inexistente explica o que houve",
    /não existe|não encontrada|terminou/i.test(textoInexistente ?? ""),
    (textoInexistente ?? "").slice(0, 200),
  );

  // ------------------------------------------------------------ página de transmitir
  console.log("\n== Página de transmitir ==");
  await page.goto(`${BASE}/transmitir`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const textoT = await page.textContent("body");
  verificar("mostra o cabeçalho da própria transmissão", /Sua transmissão/i.test(textoT ?? ""));
  verificar("mostra o link para convidar", /Link para convidar/i.test(textoT ?? ""));
  verificar("mostra a lista de quem assiste", /Quem está assistindo/i.test(textoT ?? ""));

  const linkConvite = await page.$('[data-campo="link-transmissao"]');
  verificar("o campo do link de convite existe", linkConvite !== null);
  if (linkConvite) {
    const valor = await linkConvite.inputValue();
    verificar("o link aponta para /assistir/ com 9 caracteres", /\/assistir\/[A-Z0-9]{9}$/.test(valor), valor);
  }

  const botaoCompartilhar = await page.$('button:has-text("Compartilhar minha tela")');
  verificar("o botão de compartilhar existe", botaoCompartilhar !== null);

  // O menu de qualidade é um menu de verdade, com itens de papel correto.
  console.log("\n== Menu de qualidade ==");
  const gatilhoMenu = await page.$('[aria-haspopup="menu"]');
  verificar("há um gatilho de menu", gatilhoMenu !== null);
  if (gatilhoMenu) {
    const expandidoAntes = await gatilhoMenu.getAttribute("aria-expanded");
    verificar("o menu começa fechado", expandidoAntes === "false", String(expandidoAntes));
    await gatilhoMenu.click();
    await page.waitForTimeout(250);
    const expandidoDepois = await gatilhoMenu.getAttribute("aria-expanded");
    verificar("o clique abre o menu", expandidoDepois === "true", String(expandidoDepois));

    const itens = await page.$$('[role="menuitem"]');
    verificar("o menu tem itens de verdade", itens.length >= 4, `${itens.length} itens`);

    const textoMenu = await page.textContent('[role="menu"]');
    verificar("o menu oferece as qualidades", /1080p/.test(textoMenu ?? "") && /720p/.test(textoMenu ?? ""), (textoMenu ?? "").slice(0, 120));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const fechado = await gatilhoMenu.getAttribute("aria-expanded");
    verificar("Esc fecha o menu", fechado === "false", String(fechado));
  }

  // ------------------------------------------------------------ página como funciona
  console.log("\n== Como funciona ==");
  await page.goto(`${BASE}/como-funciona`, { waitUntil: "networkidle" });
  const textoCF = await page.textContent("body");
  verificar("explica o funcionamento", /Como funciona/i.test(textoCF ?? ""));
  verificar("menciona a exigência de HTTPS", /https/i.test(textoCF ?? ""));
  verificar("menciona a limitação de TURN", /TURN/i.test(textoCF ?? ""));
  const tabela = await page.$("table");
  verificar("traz a tabela de navegadores", tabela !== null);

  // ----------------------------------------------------------------- navegação por link
  console.log("\n== Navegação ==");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('header a[href="/como-funciona"]');
  await page.waitForURL("**/como-funciona", { timeout: 8000 });
  verificar("o link do cabeçalho navega para Como funciona", page.url().endsWith("/como-funciona"), page.url());

  await page.click('header a[href="/transmitir"]');
  await page.waitForURL("**/transmitir", { timeout: 8000 });
  verificar("o link do cabeçalho navega para Transmitir", page.url().endsWith("/transmitir"), page.url());

  // ---------------------------------------------------------------- responsivo
  console.log("\n== Responsivo ==");
  await page.goto(BASE, { waitUntil: "networkidle" });
  for (const [rotulo, largura, altura] of [
    ["celular", 390, 844],
    ["tablet", 768, 1024],
    ["desktop", 1440, 900],
  ]) {
    await page.setViewportSize({ width: largura, height: altura });
    await page.waitForTimeout(350);
    // Rolagem horizontal é o defeito mais comum e o mais fácil de não notar.
    const transbordo = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    verificar(`sem rolagem horizontal em ${rotulo} (${largura}px)`, transbordo <= 1, `excesso de ${transbordo}px`);

    const barra = await page.$("nav[aria-label='Navegação principal']");
    const visivel = barra ? await barra.isVisible() : false;
    if (largura < 1024) {
      verificar(`a barra inferior aparece em ${rotulo}`, visivel);
    } else {
      verificar(`a barra inferior some em ${rotulo}`, !visivel);
    }
  }

  // Alvos de toque no cabeçalho e na barra inferior. Links de texto do rodapé
  // ficam de fora: ali o alvo é a linha, não o texto, e o polegar não navega
  // pelo rodapé.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const pequenos = await page.evaluate(() => {
    // Cabeçalho e a barra inferior de navegação — não o rodapé, onde os links
    // são texto corrido e o alvo é a própria linha de leitura.
    const raiz = document.querySelector("body");
    const cabecalho = raiz?.querySelector("header");
    const abas = raiz?.querySelector("nav[aria-label='Navegação principal']");
    const alvos = [
      ...(cabecalho?.querySelectorAll("a, button") ?? []),
      ...(abas?.querySelectorAll("a, button") ?? []),
    ];
    return alvos
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // Só o que está de fato visível na largura atual.
        return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
      })
      .map((el) => `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 18)}`);
  });
  verificar("nenhum alvo de toque minúsculo no celular", pequenos.length === 0, pequenos.join(", "));

  // Altura confortável para a barra inferior, que é onde o polegar toca.
  const alturaAbas = await page.evaluate(() => {
    const a = document.querySelector("nav[aria-label='Navegação principal'] a");
    return a ? Math.round(a.getBoundingClientRect().height) : 0;
  });
  verificar("as abas inferiores têm ao menos 44px de altura", alturaAbas >= 44, `${alturaAbas}px`);

  // ------------------------------------------------------------- consoles limpos
  console.log("\n== Console ==");
  // Ruído esperado: o WebSocket de sinalização recusado em salas inexistentes.
  const relevantes = errosConsole.filter(
    (e) => !/favicon|WebSocket|ws:\/\/|Failed to load resource/i.test(e),
  );
  verificar("nenhum erro de JavaScript na navegação", relevantes.length === 0, relevantes.slice(0, 3).join(" | "));

  await contexto.close();
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("\nExceção durante o teste:", erro);
} finally {
  await navegador.close();
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
if (falhas.length) {
  console.log("Falhas:");
  for (const f of falhas) console.log(`  - ${f}`);
}
process.exit(falhou === 0 ? 0 : 1);
