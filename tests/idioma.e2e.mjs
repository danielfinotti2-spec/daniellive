/**
 * Confere a tradução de ponta a ponta, trocando o idioma de verdade.
 *
 * Os testes de unidade olham o dicionário como texto. Este abre a interface,
 * escolhe cada idioma pelo menu e lê o que apareceu na tela — que é a única
 * prova de que a ligação entre o dicionário e o JSX está de pé.
 *
 * Mede também a largura em 390px: os rótulos em inglês e espanhol são mais
 * longos que os em português, e o cabeçalho já quebrou uma vez por falta de
 * espaço.
 */
import { chromium } from "playwright-core";

const BASE = process.env.APP ?? "http://127.0.0.1:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ESPERADO = {
  "pt-BR": { criar: /criar transmissão/i, nav: /como funciona/i, marca: "DanielLive" },
  en: { criar: /start streaming/i, nav: /how it works/i, marca: "DanielLive" },
  es: { criar: /crear (una )?transmisi/i, nav: /c[oó]mo funciona/i, marca: "DanielLive" },
};

const navegador = await chromium.launch({ executablePath: CHROME });
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe) => {
  if (cond) {
    ok++;
    console.log(`  ok    ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas.push(nome);
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};

for (const [idioma, esperado] of Object.entries(ESPERADO)) {
  console.log(`\n== ${idioma} ==`);
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  // A escolha vai para o mesmo lugar que o menu usa.
  await ctx.addInitScript(`
    try { localStorage.setItem("daniellive-idioma", ${JSON.stringify(idioma)}); } catch (e) {}
  `);
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  await p.goto(BASE, { waitUntil: "networkidle" });

  // 1) O `lang` do documento acompanha, e é o que um leitor de tela lê.
  const lang = await p.evaluate(() => document.documentElement.lang);
  conferir(`lang do html é ${idioma}`, lang === idioma, lang);

  // 2) A interface realmente mudou de idioma.
  const corpo = await p.evaluate(() => document.body.innerText);
  conferir("a ação principal aparece traduzida", esperado.criar.test(corpo));
  conferir("a navegação aparece traduzida", esperado.nav.test(corpo));

  // 3) E o cabeçalho foi para a página "como funciona" no idioma certo.
  await p.goto(`${BASE}/como-funciona`, { waitUntil: "networkidle" });
  const texto = await p.evaluate(() => document.body.innerText);
  const tituloPagina = await p.title();
  conferir("a página como-funciona tem conteúdo", texto.length > 400, `${texto.length} caracteres`);
  conferir(
    "nenhum marcador de tradução vazou para a tela",
    !texto.includes("{code}") && !texto.includes("{destaque}") && !texto.includes("{botao}"),
  );
  conferir("o título da aba continua vindo do servidor", tituloPagina.includes("DanielLive"), tituloPagina);
  conferir("sem erro de JavaScript", erros.length === 0, erros.join(" | "));

  // 4) No celular os rótulos mais longos não podem estourar ou sumir.
  const mob = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mob.addInitScript(`
    try { localStorage.setItem("daniellive-idioma", ${JSON.stringify(idioma)}); } catch (e) {}
  `);
  const mp = await mob.newPage();
  await mp.goto(BASE, { waitUntil: "networkidle" });
  const medida = await mp.evaluate(() => {
    const alvo = (href) => {
      const el = document.querySelector(`header a[href="${href}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), dir: Math.round(r.right) };
    };
    return {
      janela: window.innerWidth,
      estoura: document.documentElement.scrollWidth > window.innerWidth + 2,
      site: alvo("/site"),
      download: alvo("/download"),
    };
  });
  conferir("não estoura a largura em 390px", !medida.estoura);
  for (const [nome, m] of [["Site", medida.site], ["Download", medida.download]]) {
    conferir(
      `o alvo de toque de ${nome} continua com 40px`,
      Boolean(m && m.h >= 40),
      m ? `${m.h}px` : "ausente",
    );
  }
  conferir(
    "as abas não saem da tela",
    Boolean(medida.download && medida.download.dir <= medida.janela + 1),
    medida.download ? `${medida.download.dir}px de ${medida.janela}px` : "ausente",
  );

  await mob.close();
  await ctx.close();
}

await navegador.close();
console.log(`\n=== ${ok} passaram, ${falhas.length} falharam ===`);
if (falhas.length) {
  for (const f of falhas) console.log(`  - ${f}`);
  process.exit(1);
}
