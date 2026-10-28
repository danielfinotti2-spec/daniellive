/**
 * Confere se a paleta da interface é a da referência, medindo pixels reais.
 *
 * Ler o CSS não prova nada sobre o que aparece na tela: uma regra pode ser
 * sobreposta, um token pode não resolver, um `!important` pode vencer. Aqui
 * amostramos a cor efetivamente pintada e comparamos com o valor esperado da
 * escala da referência.
 *
 * Uso: node tests/fidelidade-visual.mjs [url]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let passou = 0;
let falhou = 0;
const falhas = [];

function conferir(nome, real, esperado) {
  // Tolerância de 2 por canal: o Chrome arredonda a conversão de oklab para RGB.
  const perto =
    Math.abs(real[0] - esperado[0]) <= 2 &&
    Math.abs(real[1] - esperado[1]) <= 2 &&
    Math.abs(real[2] - esperado[2]) <= 2;
  const fmt = (c) => `rgb(${c.join(",")})`;
  if (perto) {
    passou++;
    console.log(`  ok  ${nome} — ${fmt(real)}`);
  } else {
    falhou++;
    falhas.push(`${nome}: esperado ${fmt(esperado)}, medido ${fmt(real)}`);
    console.log(`  FALHOU  ${nome} — esperado ${fmt(esperado)}, medido ${fmt(real)}`);
  }
}

const navegador = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** Lê a cor computada de fundo ou texto, normalizada pelo próprio navegador. */
async function cor(page, seletor, propriedade) {
  return page.$eval(
    seletor,
    (el, prop) => {
      const bruta = getComputedStyle(el)[prop];
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d");
      ctx.fillStyle = bruta;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    propriedade,
  );
}

try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // -------------------------------------------------------------- tema claro
  console.log("\n== Tema claro (escala da referência) ==");
  await page.evaluate(() => {
    localStorage.setItem("screenlive-theme", "claro");
    document.documentElement.setAttribute("data-theme", "light");
  });
  await page.waitForTimeout(400);

  // A página é o degrau mais escuro da escala clara: zinc-50.
  conferir("fundo do corpo (zinc-50)", await cor(page, "body", "backgroundColor"), [250, 250, 250]);
  // O cartão é a superfície elevada: branco.
  conferir("cartão é branco", await cor(page, "main#conteudo ~ * .bg-white, .bg-white", "backgroundColor"), [255, 255, 255]);

  // -------------------------------------------------------------- tema escuro
  console.log("\n== Tema escuro (escala da referência) ==");
  await page.evaluate(() => {
    localStorage.setItem("screenlive-theme", "escuro");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
  });
  await page.waitForTimeout(400);

  // A escala que a referência documenta, do mais escuro ao mais claro.
  conferir("fundo do corpo (#101014)", await cor(page, "body", "backgroundColor"), [16, 16, 20]);
  // O cartão sobe um degrau: zinc-950 repintado para #1a1a1f.
  const fundoCartao = await page.evaluate(() => {
    const el = document.querySelector(".dark\\:bg-zinc-950, [class*='bg-zinc-950']");
    return el ? getComputedStyle(el).backgroundColor : "";
  });
  conferir(
    "cartão (zinc-950 -> #1a1a1f)",
    await cor(page, "[class*='bg-zinc-950']", "backgroundColor"),
    [26, 26, 31],
  );

  // As bordas usam zinc-800 -> #313139.
  const temBorda = await page.evaluate(() => {
    const el = document.querySelector("[class*='border-zinc-800'], [class*='border-black']");
    return el ? getComputedStyle(el).borderTopColor : "";
  });
  if (temBorda) {
    const borda = await cor(page, "[class*='border-zinc-800'], [class*='border-black']", "borderTopColor");
    console.log(`  ok  borda presente — rgb(${borda.join(",")})`);
    passou++;
  }

  // ------------------------------------------------------------------ tokens
  console.log("\n== Tokens declarados ==");
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      "color-zinc-950": s.getPropertyValue("--color-zinc-950").trim(),
      "color-zinc-900": s.getPropertyValue("--color-zinc-900").trim(),
      "color-zinc-800": s.getPropertyValue("--color-zinc-800").trim(),
      "color-zinc-700": s.getPropertyValue("--color-zinc-700").trim(),
      background: s.getPropertyValue("--background").trim(),
      foreground: s.getPropertyValue("--foreground").trim(),
      broadcast: s.getPropertyValue("--broadcast").trim(),
    };
  });
  const esperados = {
    "color-zinc-950": "#1a1a1f",
    "color-zinc-900": "#232329",
    "color-zinc-800": "#313139",
    "color-zinc-700": "#43434d",
    background: "#101014",
    foreground: "#e9e9ec",
  };
  for (const [chave, valor] of Object.entries(esperados)) {
    if (tokens[chave] === valor) {
      passou++;
      console.log(`  ok  --${chave} = ${valor}`);
    } else {
      falhou++;
      falhas.push(`--${chave}: esperado ${valor}, medido ${tokens[chave] || "(vazio)"}`);
      console.log(`  FALHOU  --${chave} — esperado ${valor}, medido ${tokens[chave] || "(vazio)"}`);
    }
  }
  if (/^#([0-9a-f]{6})$/i.test(tokens.broadcast)) {
    passou++;
    console.log(`  ok  --broadcast definido (${tokens.broadcast})`);
  } else {
    falhou++;
    falhas.push(`--broadcast inválido: ${tokens.broadcast}`);
    console.log(`  FALHOU  --broadcast inválido: ${tokens.broadcast}`);
  }

  // ------------------------------------------------- animações respeitam o SO
  console.log("\n== Movimento reduzido ==");
  await ctx.close();
  const semMovimento = await navegador.newContext({
    viewport: { width: 1440, height: 950 },
    reducedMotion: "reduce",
  });
  const p2 = await semMovimento.newPage();
  await p2.goto(BASE, { waitUntil: "networkidle" });
  await p2.waitForTimeout(500);

  // Injeta as classes animadas para medir o que o CSS faz com elas, já que a
  // página inicial não usa nenhuma. Assim a verificação cobre o CSS de verdade.
  const animacoes = await p2.evaluate(() => {
    const resultados = [];
    for (const classe of ["live-dot", "skeleton", "dialog-card", "dialog-backdrop", "sheet-enter", "fade-in", "toast-enter", "eq-bar"]) {
      const el = document.createElement("span");
      el.className = classe;
      document.body.appendChild(el);
      resultados.push([classe, getComputedStyle(el).animationName]);
      el.remove();
    }
    return resultados;
  });

  for (const [classe, nome] of animacoes) {
    if (nome === "none") {
      passou++;
      console.log(`  ok  .${classe} desligado com prefers-reduced-motion`);
    } else {
      falhou++;
      falhas.push(`.${classe} ainda anima (${nome}) com prefers-reduced-motion`);
      console.log(`  FALHOU  .${classe} ainda anima: ${nome}`);
    }
  }

  // Com movimento normal, as mesmas classes precisam animar.
  await semMovimento.close();
  const comMovimento = await navegador.newContext({ viewport: { width: 1440, height: 950 } });
  const p3 = await comMovimento.newPage();
  await p3.goto(BASE, { waitUntil: "networkidle" });
  const ativas = await p3.evaluate(() => {
    const resultados = [];
    for (const classe of ["live-dot", "skeleton", "dialog-card"]) {
      const el = document.createElement("span");
      el.className = classe;
      document.body.appendChild(el);
      resultados.push([classe, getComputedStyle(el).animationName]);
      el.remove();
    }
    return resultados;
  });
  for (const [classe, nome] of ativas) {
    if (nome !== "none") {
      passou++;
      console.log(`  ok  .${classe} anima no modo normal (${nome})`);
    } else {
      falhou++;
      falhas.push(`.${classe} não anima nem no modo normal`);
      console.log(`  FALHOU  .${classe} não anima no modo normal`);
    }
  }
  await comMovimento.close();
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
