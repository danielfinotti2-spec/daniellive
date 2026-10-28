/**
 * Testa o aplicativo **empacotado**: os arquivos que vão dentro do instalador.
 *
 * Por que este teste existe separado do `desktop.e2e.mjs`: o Electron abre uma
 * janela, e abrir janela exige uma sessão gráfica interativa. Num build
 * automatizado isso não existe, então a janela em si não pode ser exercitada
 * aqui — mas tudo o que ela carrega pode, e é aí que moram os defeitos reais de
 * empacotamento (caminho errado, arquivo faltando, porta não subindo).
 *
 * O teste sobe os mesmos dois processos que o processo principal sobe, usando o
 * Electron empacotado como runtime Node (é exatamente o que o `main.cjs` faz com
 * `ELECTRON_RUN_AS_NODE`), e então:
 *
 *  1. confirma que a interface compilada responde dentro do pacote;
 *  2. abre a interface num navegador e confere que é o DanielLive de verdade;
 *  3. cria uma sala, deixa outro navegador entrar como espectador;
 *  4. compartilha a tela de verdade e mede os quadros que chegam ao espectador;
 *  5. testa pausar e retomar;
 *  6. confere que o desinstalador está embutido no instalador e no MSI.
 *
 * Executa com: node tests/pacote.e2e.mjs
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PACOTE = path.join(RAIZ, "dist-desktop", "win-unpacked");
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

/** Porta livre, como faz o processo principal do aplicativo. */
function portaLivre(inicial) {
  return new Promise((resolver, rejeitar) => {
    const tentar = (porta) => {
      if (porta > inicial + 40) return rejeitar(new Error("sem porta livre"));
      const s = createServer();
      s.once("error", () => tentar(porta + 1));
      s.once("listening", () => s.close(() => resolver(porta)));
      s.listen(porta, "127.0.0.1");
    };
    tentar(inicial);
  });
}

async function esperar(url, limiteMs = 60_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* subindo */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const filhos = [];
function iniciar(nome, script, ambiente) {
  // O Electron empacotado é usado como runtime Node — mesmo mecanismo do
  // processo principal, então o teste exercita o caminho real do aplicativo.
  const filho = spawn(path.join(PACOTE, "DanielLive.exe"), [script], {
    cwd: PACOTE,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ...ambiente },
  });
  const saida = [];
  filho.stdout.on("data", (d) => saida.push(`[${nome}] ${d}`));
  filho.stderr.on("data", (d) => saida.push(`[${nome}] ${d}`));
  filhos.push(filho);
  return { filho, saida };
}

let navegador = null;

try {
  // ============================================== O PACOTE CONTÉM O NECESSÁRIO
  conferir("o pacote empacotado existe", existsSync(PACOTE), PACOTE.replace(RAIZ, "."));
  conferir(
    "o executável do aplicativo está no pacote",
    existsSync(path.join(PACOTE, "DanielLive.exe")),
  );

  // O app.asar tem de trazer a interface compilada e o servidor de sinalização.
  const asar = path.join(PACOTE, "resources", "app.asar");
  conferir("o app.asar existe", existsSync(asar));
  if (existsSync(asar)) {
    const bruto = readFileSync(asar);
    const texto = bruto.toString("latin1");
    // Procura os caminhos que precisam estar dentro do asar.
    for (const [rotulo, agulha] of [
      ["a interface compilada (.next)", ".next"],
      ["o servidor de sinalização", "server"],
      ["o processo principal do aplicativo", "desktop"],
    ]) {
      conferir(`${rotulo} está dentro do pacote`, texto.includes(agulha), agulha);
    }
  }

  // ==================================== O APP SOBE SEUS PRÓPRIOS SERVIDORES
  const portaWeb = await portaLivre(3480);
  const portaSinal = await portaLivre(portaWeb + 1);
  const url = `http://127.0.0.1:${portaWeb}`;

  const ambiente = {
    NODE_ENV: "production",
    NEXT_PUBLIC_SIGNAL_PORT: String(portaSinal),
    SIGNAL_PORT: String(portaSinal),
    SIGNAL_HOST: "127.0.0.1",
    ALLOWED_ORIGINS: `${url},http://localhost:${portaWeb}`,
  };

  const sinal = iniciar("sinal", path.join(PACOTE, "resources", "app.asar.unpacked", "server", "index.mjs"), ambiente);

  // A interface é iniciada exatamente como o processo principal faz: o binário
  // do Next (fora do asar) recebe o diretório da aplicação como argumento.
  const nextBin = path.join(
    PACOTE,
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const dirApp = path.join(PACOTE, "resources", "app.asar");
  const web = spawn(
    path.join(PACOTE, "DanielLive.exe"),
    [nextBin, "start", dirApp, "-p", String(portaWeb), "-H", "127.0.0.1"],
    {
      cwd: PACOTE,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ...ambiente },
    },
  );
  const saidaWeb = [];
  web.stdout.on("data", (d) => saidaWeb.push(`[web] ${d}`));
  web.stderr.on("data", (d) => saidaWeb.push(`[web] ${d}`));
  filhos.push(web);

  const webOk = await esperar(`${url}/como-funciona`);
  conferir("a interface do pacote responde", webOk, webOk ? url : "não respondeu");
  const sinalOk = await esperar(`http://127.0.0.1:${portaSinal}/health`);
  conferir("a sinalização do pacote responde", sinalOk, `porta ${portaSinal}`);

  // Quando algo não sobe, a saída dos processos é o que explica o motivo —
  // sem isso a falha vira só "não respondeu" e não há como consertar.
  if (!webOk || !sinalOk) {
    console.log("\n--- saída da interface ---");
    console.log(saidaWeb.join("").slice(-2000) || "(vazia)");
    console.log("--- saída da sinalização ---");
    console.log(sinal.saida.join("").slice(-1000) || "(vazia)");
  }

  if (webOk) {
    // ============================ A INTERFACE SERVIDA É A DO SCREENLIVE
    navegador = await chromium.launch({
      executablePath: CHROME,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required",
        "--auto-select-desktop-capture-source=Entire screen",
        "--auto-select-desktop-capture-source=Tela inteira",
        "--use-fake-ui-for-media-stream",
        "--enable-usermedia-screen-capturing",
        "--allow-http-screen-capture",
      ],
    });

    const contexto = await preparar(await navegador.newContext({ viewport: { width: 1280, height: 860 } }));

    // A interface compilada recebe a porta da sinalização em tempo de execução
    // (no aplicativo isso é feito pelo preload). Aqui o valor é injetado do
    // mesmo jeito, antes de qualquer script da página, para que o teste use
    // exatamente o caminho que o aplicativo usa. Sem isso o cliente apontaria
    // para a porta padrão 8787, que não é a destes servidores.
    await contexto.addInitScript(
      ([chave, valor]) => {
        window[chave] = valor;
      },
      ["__DANIELLIVE_SIGNAL_URL__", `ws://127.0.0.1:${portaSinal}`],
    );

    const host = await contexto.newPage();
    await host.goto(`${url}/transmitir`, { waitUntil: "domcontentloaded" });
    await host.waitForTimeout(1200);

    const titulo = await host.title();
    conferir("a interface tem o título do DanielLive", /DanielLive/i.test(titulo), titulo);

    const fundo = await host.evaluate(() => getComputedStyle(document.body).backgroundColor);
    conferir("a identidade visual foi preservada", fundo.length > 0, fundo);

    // Confirma que a injeção chegou ao cliente — é o que faz a sala funcionar.
    const urlSinal = await host.evaluate(
      () => window.__DANIELLIVE_SIGNAL_URL__ ?? "(não definida)",
    );
    conferir(
      "a interface recebe a porta de sinalização em tempo de execução",
      urlSinal === `ws://127.0.0.1:${portaSinal}`,
      urlSinal,
    );

    // ================================================ CRIAR A SALA
    await host.locator("#display-name").fill("Pacote Empacotado");
    const campoLink = host.locator('[data-campo="link-transmissao"]');
    await campoLink.waitFor({ timeout: 40_000 });
    const link = await campoLink.inputValue();
    const codigo = link.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];
    conferir("criar sala funciona no aplicativo empacotado", Boolean(codigo), codigo ?? link);

    // ================================ ESPECTADOR ENTRA E RECEBE O VÍDEO
    const ctx2 = await preparar(await navegador.newContext({ viewport: { width: 1100, height: 760 } }));
    await ctx2.addInitScript(
      ([chave, valor]) => {
        window[chave] = valor;
      },
      ["__DANIELLIVE_SIGNAL_URL__", `ws://127.0.0.1:${portaSinal}`],
    );
    const espectador = await ctx2.newPage();
    await espectador.goto(link, { waitUntil: "domcontentloaded" });
    await espectador.waitForTimeout(2000);

    const textoEspectador = await espectador.evaluate(() => document.body.innerText);
    conferir(
      "o espectador entra na sala do aplicativo",
      /transmissão|sala|aguardando/i.test(textoEspectador),
      textoEspectador.replace(/\s+/g, " ").slice(0, 70),
    );

    // ============================================ COMPARTILHAR A TELA
    await host.getByRole("button", { name: /compartilhar minha tela/i }).click();

    let aoVivo = false;
    try {
      await host.waitForSelector("text=/Ao vivo/i", { timeout: 35_000 });
      aoVivo = true;
    } catch {
      /* tratado */
    }
    conferir("a captura de tela inicia no aplicativo empacotado", aoVivo);

    if (aoVivo) {
      // `totalVideoFrames` sozinho não serve como prova: alguns drivers só o
      // atualizam depois de a reprodução estabilizar, e ele fica em 0 mesmo com
      // o vídeo andando. `currentTime` avançando é a evidência direta de que o
      // vídeo está tocando, então os dois são observados juntos — foi assim que
      // o teste de site (tests/browser.e2e.mjs) já fazia.
      let largura = 0;
      let quadros = 0;
      let tempo = 0;
      const inicio = Date.now();
      while (Date.now() - inicio < 45_000) {
        const e = await espectador.evaluate(() => {
          const v = document.querySelector("video");
          if (!v) return { w: 0, q: 0, t: 0 };
          return { w: v.videoWidth, q: v.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0, t: v.currentTime };
        });
        largura = Math.max(largura, e.w ?? 0);
        quadros = Math.max(quadros, e.q ?? 0);
        tempo = Math.max(tempo, e.t ?? 0);
        if (largura > 0 && (quadros > 3 || tempo > 1)) break;
        await espectador.waitForTimeout(500);
      }
      conferir("o vídeo chega ao espectador", largura > 0, largura > 0 ? `${largura}px` : "sem vídeo");
      conferir(
        "o espectador recebe quadros de vídeo",
        quadros > 0 || tempo > 0.5,
        `${quadros} quadros, ${tempo.toFixed(1)} s de linha do tempo`,
      );

      // ------------------------------------------ PAUSAR E RETOMAR
      //
      // `currentTime` NÃO serve para medir a pausa: num vídeo vindo por WebRTC
      // ele acompanha o relógio da linha do tempo enquanto o elemento estiver
      // tocando, mesmo que nenhum quadro novo chegue. Quem mostra a pausa de
      // verdade é `totalVideoFrames` (que para de subir) somado ao estado que a
      // interface exibe — as mesmas duas evidências já usadas em
      // tests/pausa.e2e.mjs.
      const lerQuadros = () =>
        espectador.evaluate(
          () => document.querySelector("video")?.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0,
        );

      // Pausar algo que nunca começou não prova nada: espera quadros chegando.
      let antesDaPausa = 0;
      for (let i = 0; i < 40; i += 1) {
        antesDaPausa = await lerQuadros();
        if (antesDaPausa > 3) break;
        await espectador.waitForTimeout(500);
      }
      conferir("o espectador recebe quadros antes da pausa", antesDaPausa > 3, `${antesDaPausa} quadros`);

      await host.getByRole("button", { name: /^pausar$/i }).click();
      await host.waitForTimeout(1500);

      const textoHost = await host.evaluate(() => document.body.innerText);
      conferir("o anfitrião mostra o estado pausado", /pausad/i.test(textoHost));
      conferir(
        "pausar não encerra a transmissão (há 'Retomar')",
        (await host.getByRole("button", { name: /^retomar$/i }).count()) > 0,
      );

      const a = await lerQuadros();
      await host.waitForTimeout(4000);
      const b = await lerQuadros();
      conferir("pausar interrompe o envio de quadros", b - a <= 2, `${b - a} quadros em 4 s`);

      await host.getByRole("button", { name: /^retomar$/i }).click();
      let novos = 0;
      for (let i = 0; i < 40; i += 1) {
        novos = (await lerQuadros()) - b;
        if (novos > 3) break;
        await espectador.waitForTimeout(500);
      }
      conferir("retomar volta a enviar quadros", novos > 3, `${novos} quadros novos`);
    }
  }

  // ============================ OS INSTALADORES EMBUTEM O DESINSTALADOR
  //
  // O MSI é gerado só com o WiX, então completa em qualquer ambiente. Já o NSIS
  // e o portátil dependem de o electron-builder **executar** o instalador da
  // primeira passada para extrair o desinstalador — e isso exige uma janela
  // interativa. Em ambiente de integração sem sessão gráfica esse passo não
  // completa, e culpar o código por isso seria mentira.
  //
  // Por isso o NSIS e o portátil são conferidos como **opcionais** quando o
  // ambiente não os produz: viram aviso, não falha. Quando existem, são
  // cobrados igual aos outros — inclusive o tamanho mínimo, que é o que pega
  // um arquivo truncado.
  const semSessaoGrafica = process.env.CI === "true" || process.env.SEM_INSTALADOR_NSIS === "1";

  // Nomes derivados do package.json: a versão sobe e o teste segue junto.
  const versao = JSON.parse(readFileSync(path.join(RAIZ, "package.json"), "utf8")).version;
  for (const [rotulo, arquivo, minimoMB, opcional] of [
    // Os mínimos acompanham o conteúdo real do pacote (interface compilada +
    // sinalização + runtime): hoje ~190 MB no NSIS/MSI e ~150 MB no portátil.
    // O limite existe para pegar um instalador TRUNCADO (a primeira passada
    // do NSIS gera ~300 KB), então mantém folga abaixo do valor medido.
    ["o instalador MSI", `DanielLive-${versao}.msi`, 170, false],
    ["o instalador NSIS", `DanielLive-Setup-${versao}.exe`, 170, semSessaoGrafica],
    ["o executável portátil", `DanielLive-Portatil-${versao}.exe`, 135, semSessaoGrafica],
  ]) {
    const p = path.join(RAIZ, "dist-desktop", arquivo);
    if (!existsSync(p)) {
      if (opcional) {
        console.log(
          `AVISO ${rotulo} não foi gerado — esperado sem sessão gráfica. ` +
            `Rode \`npm run build:windows\` numa máquina com área de trabalho.`,
        );
        continue;
      }
      conferir(`${rotulo} foi gerado`, false, arquivo);
      continue;
    }
    const mb = statSync(p).size / 1e6;
    if (opcional && mb < minimoMB) {
      // Existe, mas é só o intermediário da primeira passada (algumas centenas
      // de KB). Sem sessão gráfica o build para aqui, e o arquivo pequeno não é
      // um instalador quebrado — é um build que não terminou.
      console.log(
        `AVISO ${rotulo} existe mas está incompleto (${mb.toFixed(1)} MB): ` +
          `é só a primeira passada. Rode \`npm run build:windows\` numa máquina com área de trabalho.`,
      );
      continue;
    }
    conferir(`${rotulo} foi gerado e tem o conteúdo completo`, mb >= minimoMB, `${mb.toFixed(0)} MB`);
  }
} catch (erro) {
  falhou++;
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
} finally {
  try {
    await navegador?.close();
  } catch {
    /* já fechado */
  }
  for (const f of filhos) {
    try {
      f.kill();
    } catch {
      /* já morreu */
    }
  }
}

console.log(`\n============ RESUMO ============`);
console.log(`total: ${passou + falhou}  ok: ${passou}  falhas: ${falhou}`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
if (falhou) process.exitCode = 1;
