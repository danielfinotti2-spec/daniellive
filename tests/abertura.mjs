/**
 * Confere a tela de abertura do aplicativo: o que ela mostra e como se move.
 *
 * A abertura vive fora do Next — é uma janela própria, com HTML e CSS que não
 * passam pelo resto do projeto. Isso a deixa fora do alcance de qualquer teste
 * de interface existente, e é justamente a primeira coisa que o usuário vê.
 *
 * Aqui ela é carregada direto no Chromium, com a mesma ponte que o preload
 * (`desktop/preload-splash.cjs`) exporia no Electron. O que se mede é o DOM
 * depois de cada mensagem, não o CSS escrito: uma regra pode ser sobreposta, e
 * ler a folha de estilo não provaria nada sobre a tela.
 *
 * Uso: node tests/abertura.mjs
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ARQUIVO = pathToFileURL(path.resolve("desktop/splash.html")).href;
const ARTE = readFileSync("public/branding/pato.png").toString("base64");

let passou = 0;
let falhou = 0;
const falhas = [];

function conferir(nome, condicao, detalhe) {
  if (condicao) {
    passou++;
    console.log(`  ok    ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhou++;
    falhas.push(nome);
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Instala a ponte que o preload do splash criaria dentro do Electron. */
const ponte = () => {
  const cbs = { estado: [], arte: [], versao: [] };
  window.__ponte = cbs;
  window.splash = {
    aoAtualizar: (cb) => cbs.estado.push(cb),
    aoReceberArte: (cb) => cbs.arte.push(cb),
    aoReceberVersao: (cb) => cbs.versao.push(cb),
  };
};

/** Os mesmos passos e valores que `desktop/main.cjs` envia, em ordem. */
const PASSOS = [
  { texto: "Preparando os servidores locais…", valor: 6 },
  { texto: "Abrindo o servidor de sinalização…", valor: 14 },
  { texto: "Carregando a interface…", valor: 30 },
  { texto: "Preparando a interface…", valor: 48.9 },
  { texto: "Conectando…", valor: 74 },
  { texto: "Ajustando os últimos detalhes…", valor: 86 },
  { texto: "Organizando a tela inicial…", valor: 91 },
  { texto: "Preparando a janela…", valor: 96 },
  { texto: "Abrindo a janela…", valor: 99 },
  { texto: "Pronto.", valor: 100 },
];

let navegador = null;

try {
  navegador = await chromium.launch({ executablePath: CHROME });

  // ------------------------------------------------ estado inicial
  {
    console.log("\n== antes de qualquer progresso ==");
    const ctx = await navegador.newContext({ viewport: { width: 440, height: 400 } });
    await ctx.addInitScript(ponte);
    const page = await ctx.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => m.type() === "error" && erros.push(m.text()));

    await page.goto(ARQUIVO);
    await page.waitForTimeout(300);

    const inicial = await page.evaluate(() => {
      const barra = document.getElementById("barra");
      return {
        indeterminada: barra.classList.contains("indeterminada"),
        porcento: document.getElementById("porcento").textContent,
        passo: document.getElementById("passo").textContent,
        semRolagem: document.documentElement.scrollHeight <= window.innerHeight + 1,
      };
    });
    conferir("a barra começa indeterminada", inicial.indeterminada);
    conferir("nenhuma porcentagem inventada no início", inicial.porcento === "", JSON.stringify(inicial.porcento));
    conferir("há uma mensagem desde o primeiro quadro", inicial.passo.length > 0, inicial.passo);
    conferir("a abertura não rola", inicial.semRolagem);

    // A arte chega como data URL — o splash não tem servidor nem protocolo.
    await page.evaluate((a) => {
      window.__ponte.arte.forEach((cb) => cb("data:image/png;base64," + a));
      window.__ponte.versao.forEach((cb) => cb("Versão 1.0.0"));
    }, ARTE);
    await page.waitForTimeout(400);

    const marca = await page.evaluate(() => {
      const img = document.getElementById("pato");
      const r = img.getBoundingClientRect();
      return {
        visivel: !img.hidden && img.src.startsWith("data:image/png"),
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        largura: Math.round(r.width),
        altura: Math.round(r.height),
        ajuste: getComputedStyle(img).objectFit,
        glifoEscondido: document.getElementById("glifo").hidden,
        nome: document.querySelector(".nome").textContent,
        versao: document.getElementById("versao").textContent,
      };
    });
    conferir("o mascote aparece com a arte recebida", marca.visivel);
    conferir("a arte é a original do projeto", marca.natural === "1254x1254", marca.natural);
    conferir(
      "o mascote é quadrado, sem deformar",
      marca.largura === 108 && marca.altura === 108,
      `${marca.largura}x${marca.altura}`,
    );
    conferir("a imagem não estica", marca.ajuste === "contain", marca.ajuste);
    conferir("o glifo de reserva sai de cena", marca.glifoEscondido);
    conferir("a marca se chama DanielLive", marca.nome === "DanielLive", marca.nome);
    conferir("a versão aparece", marca.versao === "Versão 1.0.0", marca.versao);

    // ------------------------------------------------ progresso
    console.log("\n== progresso relatado pelo processo principal ==");
    let ultimo = -1;
    let monotono = true;
    for (const passo of PASSOS) {
      await page.evaluate((p) => window.__ponte.estado.forEach((cb) => cb(p)), passo);
      await page.waitForTimeout(240);
      const lido = await page.evaluate(() => ({
        largura: parseFloat(document.getElementById("barra").style.width) || 0,
        texto: document.getElementById("porcento").textContent,
      }));
      if (lido.largura < ultimo - 0.01) monotono = false;
      ultimo = lido.largura;
    }
    conferir("a barra nunca anda para trás", monotono);

    const fim = await page.evaluate(() => ({
      largura: document.getElementById("barra").style.width,
      texto: document.getElementById("porcento").textContent,
      passo: document.getElementById("passo").textContent,
      indeterminada: document.getElementById("barra").classList.contains("indeterminada"),
    }));
    conferir("termina em 100%", fim.largura === "100%" && fim.texto === "100%", `${fim.largura} / ${fim.texto}`);
    conferir("sai do estado indeterminado", !fim.indeterminada);
    conferir("a última mensagem é 'Pronto.'", fim.passo === "Pronto.", JSON.stringify(fim.passo));
    conferir("nenhum erro de JavaScript", erros.length === 0, erros.join(" | "));

    // ------------------------------------------------ saída
    console.log("\n== transição de saída ==");
    await page.evaluate(() => document.body.classList.add("saindo"));
    await page.waitForTimeout(90);
    const saida = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".marca"));
      return {
        opacidadeMarca: cs.opacity,
        opacidadeCorpo: getComputedStyle(document.body).opacity,
        transicao: cs.transitionProperty,
      };
    });
    conferir(
      "a saída é animada, não um corte",
      saida.opacidadeMarca !== "1" || saida.opacidadeCorpo !== "1",
      `corpo=${saida.opacidadeCorpo} marca=${saida.opacidadeMarca}`,
    );
    conferir("a marca declara transição", /opacity/.test(saida.transicao), saida.transicao);

    await ctx.close();
  }

  // ------------------------------------------------ menos movimento
  {
    console.log("\n== com prefers-reduced-motion: reduce ==");
    const ctx = await navegador.newContext({
      viewport: { width: 440, height: 400 },
      reducedMotion: "reduce",
    });
    await ctx.addInitScript(ponte);
    const page = await ctx.newPage();
    await page.goto(ARQUIVO);
    await page.waitForTimeout(300);

    const parado = await page.evaluate(() => ({
      pato: getComputedStyle(document.getElementById("pato")).animationName,
      halo: getComputedStyle(document.querySelector(".halo")).animationName,
      barra: getComputedStyle(document.getElementById("barra")).transitionDuration,
      brilho: getComputedStyle(document.getElementById("barra"), "::after").display,
    }));
    conferir("o mascote não flutua", parado.pato === "none", parado.pato);
    conferir("o halo não pulsa", parado.halo === "none", parado.halo);
    conferir("a barra não anima largura", parado.barra === "0s", parado.barra);
    conferir("o brilho da barra sai", parado.brilho === "none", parado.brilho);

    await ctx.close();
  }
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
} finally {
  await navegador?.close();
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
for (const f of falhas) console.log(`  - ${f}`);
process.exit(falhou === 0 ? 0 : 1);
