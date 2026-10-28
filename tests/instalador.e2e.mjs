/**
 * Teste de instalação real do DanielLive.
 *
 * O que este teste resolve: o instalador NSIS **não** dá para conferir lendo o
 * arquivo. O desinstalador não está no payload — o NSIS o gera em tempo de
 * instalação, compilando um script que vive comprimido dentro do instalador.
 * Por isso a única prova de que ele existe é instalar de verdade.
 *
 * O que ele faz, tudo em pastas temporárias, sem tocar no aplicativo do
 * usuário e sem precisar de UAC:
 *
 *   1. Instala em `%TEMP%\daniellive-teste-instalacao` com `/S /D=...`.
 *   2. Confere que o aplicativo foi para lá e que o desinstalador foi criado.
 *   3. Confere o registro do Windows (nome no Painel de Controle, comando de
 *      desinstalação, ícone) e o atalho do Menu Iniciar.
 *   4. Desinstala e confere que a pasta sumiu e o registro foi limpo.
 *   5. Reinstala, para provar que o ciclo se repete.
 *
 * Por que `/S`: o assistente em português e a escolha de pasta são do modo
 * interativo, que exige uma janela e não roda em automação. O `/D=` exercita
 * exatamente o mesmo caminho de código que a escolha de pasta do assistente, e
 * é o que dá para verificar sem interação. O roteiro do README cobre o
 * assistente visual, que só uma pessoa pode confirmar.
 *
 * Uso:
 *   node tests/instalador.e2e.mjs
 *
 * Variáveis:
 *   INSTALADOR  caminho do .exe (padrão: dist-desktop/DanielLive-Setup-1.0.0.exe)
 *   MANTER      "1" para não desinstalar no fim (útil para inspecionar)
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const INSTALADOR = path.resolve(
  process.env.INSTALADOR ?? path.join(RAIZ, "dist-desktop", "DanielLive-Setup-1.0.0.exe"),
);
const DESTINO = path.join(tmpdir(), "daniellive-teste-instalacao");
const CHAVE_REGISTRO = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";

const resultados = [];
let falhas = 0;

function registrar(nome, condicao, detalhe = "") {
  const ok = Boolean(condicao);
  if (!ok) falhas++;
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

/** Executa o instalador/desinstalador e devolve o código de saída. */
function executar(exe, argumentos) {
  // `__COMPAT_LAYER=RunAsInvoker` impede que o Windows tente elevar: o
  // instalador é por usuário (`perMachine: false`), então a elevação não é
  // necessária e pedi-la travaria o teste num prompt de UAC.
  const r = spawn(exe, argumentos, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, __COMPAT_LAYER: "RunAsInvoker" },
  });
  return new Promise((resolver) => {
    r.on("exit", (codigo) => resolver(codigo ?? -1));
    r.on("error", () => resolver(-1));
  });
}

/** Consulta o registro: devolve a entrada do DanielLive, se existir. */
function lerRegistro() {
  try {
    const saida = execFileSync(
      "reg",
      ["query", CHAVE_REGISTRO, "/s", "/f", "DanielLive"],
      { encoding: "latin1", stdio: ["ignore", "pipe", "ignore"] },
    );
    const linhas = saida.split(/\r?\n/);
    const valor = (nome) => {
      const l = linhas.find((x) => x.includes(nome));
      if (!l) return null;
      return l.split(/\s{2,}/).slice(3).join("  ").trim() || null;
    };
    return {
      existe: /DanielLive/i.test(saida),
      displayName: valor("DisplayName"),
      uninstallString: valor("UninstallString"),
      displayIcon: valor("DisplayIcon"),
    };
  } catch {
    return { existe: false, displayName: null, uninstallString: null, displayIcon: null };
  }
}

/** Apaga a pasta de instalação do registro anterior, se houver. */
function limpar() {
  rmSync(DESTINO, { recursive: true, force: true });
}

/** O desinstalador se apaga em segundo plano; espera a pasta sumir. */
async function esperarSumir(caminho, limiteMs = 60_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (!existsSync(caminho)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return !existsSync(caminho);
}

/**
 * Espera uma condição virar verdadeira, devolvendo `true` se ela acontecer
 * dentro do limite. Usada para o registro e o atalho: o desinstalador remove
 * essas entradas só no fim do processo, e confirmar cedo demais dá falso
 * negativo (o teste acusava "registro não limpo" num sistema que limpara).
 */
async function esperarCondicao(fn, limiteMs = 15_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return fn();
}

function atalhoMenuIniciar() {
  const base = path.join(
    process.env.APPDATA ?? "",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
  );
  if (!existsSync(base)) return false;
  return readdirSync(base).some((n) => /DanielLive/i.test(n));
}

// ============================================================ INÍCIO

console.log(`\ninstalador: ${INSTALADOR}`);
console.log(`destino:    ${DESTINO}\n`);

if (!existsSync(INSTALADOR)) {
  console.error(
    `O instalador não existe.\nGere-o com \`npm run build:windows\` antes de rodar este teste.`,
  );
  process.exit(1);
}

const mb = statSync(INSTALADOR).size / (1024 * 1024);
console.log(`tamanho: ${mb.toFixed(1)} MB\n`);

if (process.platform !== "win32") {
  console.error("Este teste só roda no Windows.");
  process.exit(1);
}

// Uma instalação anterior deixaria o teste mentindo (a pasta já existiria).
limpar();

// ---------------------------------------------------- 1) INSTALAÇÃO
console.log("--- instalando ---");
const codigoInstalacao = await executar(INSTALADOR, ["/S", `/D=${DESTINO}`]);
registrar("o instalador terminou com código 0", codigoInstalacao === 0, `código ${codigoInstalacao}`);

const appExe = path.join(DESTINO, "DanielLive.exe");
registrar("o aplicativo foi instalado", existsSync(appExe));

// O desinstalador é o ponto central: é ele que faltava quando a passada-1
// falhava em silêncio e o build gerava um instalador sem desinstalação.
let desinstalador = null;
if (existsSync(DESTINO)) {
  const arquivos = readdirSync(DESTINO);
  const nome = arquivos.find((n) => /^Uninstall .*\.exe$/i.test(n));
  desinstalador = nome ? path.join(DESTINO, nome) : null;
}
registrar(
  "o desinstalador foi criado na pasta (é o que faltava antes)",
  desinstalador !== null,
  desinstalador ? path.basename(desinstalador) : "nenhum arquivo 'Uninstall *.exe'",
);
registrar(
  "a pasta tem o conteúdo completo do aplicativo (não só um stub)",
  existsSync(DESTINO) && readdirSync(path.join(DESTINO, "resources")).length > 0,
);

// ---------------------------------------------------- 2) REGISTRO
console.log("\n--- registro do Windows ---");
const registro = lerRegistro();
registrar("o Painel de Controle lista o DanielLive", registro.existe, registro.displayName ?? "");
registrar(
  "o nome exibido é 'DanielLive'",
  /\bDanielLive\b/i.test(registro.displayName ?? ""),
  registro.displayName ?? "",
);
registrar(
  "o comando de desinstalação aponta para o desinstalador",
  /Uninstall/i.test(registro.uninstallString ?? ""),
  registro.uninstallString ?? "",
);
registrar(
  "o ícone exibido é o do aplicativo",
  /icon/i.test(registro.displayIcon ?? ""),
  registro.displayIcon ?? "",
);

// O atalho do Menu Iniciar independe do OneDrive, então é confiável aqui. O da
// Área de Trabalho não é conferido porque em muitas máquinas ela é redirecionada
// (OneDrive), e o caminho real só o shell conhece.
registrar("o atalho do Menu Iniciar foi criado", atalhoMenuIniciar());

// ---------------------------------------------------- 3) DESINSTALAÇÃO
if (desinstalador) {
  console.log("\n--- desinstalando ---");
  const codigoRemocao = await executar(desinstalador, ["/S", "/currentuser"]);
  registrar("o desinstalador terminou com código 0", codigoRemocao === 0, `código ${codigoRemocao}`);

  const sumiu = await esperarSumir(DESTINO);
  registrar("a pasta de instalação foi removida", sumiu);

  registrar("o registro foi limpo", await esperarCondicao(() => !lerRegistro().existe));
  registrar("o atalho do Menu Iniciar foi removido", await esperarCondicao(() => !atalhoMenuIniciar()));

  // ---------------------------------------------------- 4) REINSTALAÇÃO
  // Prova que o ciclo se repete: um instalador que só funciona na primeira vez
  // deixa o usuário sem saída depois de desinstalar.
  console.log("\n--- reinstalando ---");
  const codigoReinstalacao = await executar(INSTALADOR, ["/S", `/D=${DESTINO}`]);
  registrar("a reinstalação terminou com código 0", codigoReinstalacao === 0, `código ${codigoReinstalacao}`);
  registrar("o aplicativo voltou", existsSync(appExe));

  const teardownDesinstalador = existsSync(DESTINO)
    ? readdirSync(DESTINO).find((n) => /^Uninstall .*\.exe$/i.test(n))
    : null;
  registrar("o desinstalador foi recriado", Boolean(teardownDesinstalador));

  if (process.env.MANTER === "1") {
    console.log(`\nMANTER=1: a instalação ficou em ${DESTINO}`);
  } else if (teardownDesinstalador) {
    await executar(path.join(DESTINO, teardownDesinstalador), ["/S", "/currentuser"]);
    await esperarSumir(DESTINO);
  }
} else {
  console.log("\nsem desinstalador: pulando desinstalação e reinstalação.");
}

// ---------------------------------------------------- RESUMO
console.log("\n============ RESUMO ============");
console.log(`total: ${resultados.length}  ok: ${resultados.length - falhas}  falhas: ${falhas}`);
if (falhas > 0) {
  console.log("\nverificações que falharam:");
  for (const r of resultados.filter((x) => !x.ok)) console.log(`  • ${r.nome}${r.detalhe ? ` (${r.detalhe})` : ""}`);
}
process.exit(falhas > 0 ? 1 : 0);
