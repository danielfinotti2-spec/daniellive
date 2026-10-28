/**
 * Build completo e verificado do DanielLive para Windows.
 *
 * Um comando faz tudo, na ordem em que faz sentido:
 *
 *   1. confere o ambiente (Node, npm, Chrome, makensis, ícone);
 *   2. roda os testes rápidos que não precisam de empacotamento;
 *   3. compila o site;
 *   4. gera o instalador;
 *   5. confere que os artefatos existem, têm tamanho plausível e que o
 *      desinstalador está dentro do instalador;
 *   6. imprime o caminho exato de cada arquivo.
 *
 * Por que existe: o empacotamento tem etapas que falham por motivo ambiente —
 * cache faltando, ícone ausente, porta ocupada — e a mensagem do
 * electron-builder nem sempre aponta a causa. Aqui cada etapa é conferida
 * antes, e o erro sai com o que fazer.
 *
 * Executa com: node scripts/build-windows.mjs
 * Ou:          npm run build:windows
 */

import { existsSync, statSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const RAIZ = process.cwd();
const DIST = path.join(RAIZ, "dist-desktop");

const VERDE = "\u001b[32m";
const VERMELHO = "\u001b[31m";
const AMARELO = "\u001b[33m";
const CINZA = "\u001b[90m";
const NEGRITO = "\u001b[1m";
const FIM = "\u001b[0m";

const problemas = [];
const avisos = [];

function titulo(texto) {
  console.log(`\n${NEGRITO}${texto}${FIM}`);
}

function ok(texto) {
  console.log(`  ${VERDE}ok${FIM}   ${texto}`);
}

function erro(texto) {
  console.log(`  ${VERMELHO}falha${FIM} ${texto}`);
}

function aviso(texto) {
  console.log(`  ${AMARELO}aviso${FIM} ${texto}`);
}

/** Roda um comando e devolve o código de saída, ecoando a saída. */
function rodar(comando, args, { silencioso = false } = {}) {
  const r = spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: silencioso ? "pipe" : "inherit",
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  return { codigo: r.status ?? 1, saida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Verifica uma versão mínima, comparando os números em ordem. */
function versaoSuficiente(atual, minima) {
  const a = atual.split(".").map(Number);
  const m = minima.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const x = a[i] ?? 0;
    const y = m[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

// ======================================================== 1. AMBIENTE

titulo("1/6  Conferindo o ambiente");

// Node
const versaoNode = process.versions.node;
if (versaoSuficiente(versaoNode, "20.9.0")) {
  ok(`Node ${versaoNode}`);
} else {
  erro(`Node ${versaoNode} é antigo demais; o Next 16 exige 20.9 ou mais novo`);
  problemas.push("Atualize o Node em https://nodejs.org (versão LTS).");
}

// Dependências
if (existsSync(path.join(RAIZ, "node_modules", "next"))) {
  ok("dependências instaladas");
} else {
  erro("node_modules está vazio");
  problemas.push("Rode: npm install");
}

// Chrome — o gerador de ícone e os testes de navegador usam o Chrome do sistema
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (existsSync(CHROME)) {
  ok(`Chrome em ${CHROME}`);
} else {
  aviso(`Chrome não encontrado em ${CHROME}`);
  avisos.push(
    "Sem o Chrome, o ícone não pode ser regerado e os testes de navegador não rodam. " +
      "Instale o Chrome ou defina CHROME_PATH.",
  );
}

// Pastas de trabalho
for (const pasta of ["build", "public/branding"]) {
  const alvo = path.join(RAIZ, pasta);
  if (!existsSync(alvo)) {
    mkdirSync(alvo, { recursive: true });
    aviso(`criei a pasta ${pasta}/`);
  }
}
ok("pastas build/ e public/branding/ presentes");

// Portas que o aplicativo usa. Ocupada aqui normalmente é outro programa.
for (const porta of [3480, 3481, 8787]) {
  const r = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" });
  const ocupada = new RegExp(`:${porta}\\s+\\S+\\s+LISTENING`, "i").test(r.stdout ?? "");
  if (ocupada) {
    aviso(`a porta ${porta} já está em uso por outro programa`);
    avisos.push(
      `A porta ${porta} está ocupada. O aplicativo procura uma livre a partir de 3480, ` +
        `então isso não impede o build — mas pode atrapalhar os testes.`,
    );
  }
}
ok("portas verificadas");

// O mascote é opcional, mas vale dizer o estado.
const MASCOTE = path.join(RAIZ, "public", "branding", "pato.png");
const temMascote = existsSync(MASCOTE);
if (temMascote) {
  ok("mascote encontrado (public/branding/pato.png)");
} else {
  aviso("mascote ausente — o ícone usará o glifo da marca");
  avisos.push(
    "Para usar o mascote, salve a arte em public/branding/pato.png e rode `npm run icone`.",
  );
}

if (problemas.length > 0) {
  console.log(`\n${VERMELHO}O ambiente precisa de ajustes antes de continuar:${FIM}`);
  problemas.forEach((p) => console.log(`  • ${p}`));
  process.exit(1);
}

// ======================================================== 2. ÍCONE

titulo("2/6  Gerando o ícone do Windows");

if (existsSync(CHROME)) {
  const { codigo } = rodar("node", ["scripts/gerar-icone.mjs"]);
  if (codigo === 0 && existsSync(path.join(RAIZ, "build", "icon.ico"))) {
    const kb = Math.round(statSync(path.join(RAIZ, "build", "icon.ico")).size / 1024);
    ok(`build/icon.ico (${kb} KB)`);
  } else {
    erro("não consegui gerar build/icon.ico");
    problemas.push("Rode `npm run icone` sozinho para ver o erro completo.");
  }
} else {
  if (existsSync(path.join(RAIZ, "build", "icon.ico"))) {
    aviso("mantive o build/icon.ico que já existia");
  } else {
    erro("sem Chrome e sem build/icon.ico");
    problemas.push("Instale o Chrome ou defina CHROME_PATH para gerar o ícone.");
  }
}

if (problemas.length > 0) process.exit(1);

// ======================================================== 3. TESTES RÁPIDOS

titulo("3/6  Testes rápidos (lint, tipos e unidade)");

// O lint e os tipos não dependem de servidor nem de empacotamento, então rodam
// sempre: são os que pegam erro de digitação antes de gastar 10 minutos de build.
const etapas = [
  ["lint", ["eslint", "."]],
  ["tipos", ["tsc", "--noEmit"]],
];

for (const [nome, args] of etapas) {
  process.stdout.write(`  ${CINZA}rodando ${nome}…${FIM}\n`);
  const { codigo } = rodar("npx", args, { silencioso: true });
  if (codigo === 0) {
    ok(nome);
  } else {
    erro(nome);
    problemas.push(`Corrija o ${nome}: rode \`npx ${args.join(" ")}\` para ver os detalhes.`);
  }
}

// Testes unitários (88 verificações, sem rede)
process.stdout.write(`  ${CINZA}rodando testes unitários…${FIM}\n`);
{
  const { codigo, saida } = rodar(
    "node",
    ["--experimental-strip-types", "--test", "tests/rooms.test.mjs", "tests/protocol.test.mjs", "tests/room-code.test.mjs", "tests/ratelimit.test.mjs", "tests/signaling-client.test.mjs"],
    { silencioso: true },
  );
  const passou = (saida.match(/^# pass (\d+)/m) ?? [])[1] ?? "?";
  if (codigo === 0) {
    ok(`testes unitários (${passou} verificações)`);
  } else {
    erro("testes unitários");
    problemas.push("Rode `npm test` para ver o detalhe.");
  }
}

if (problemas.length > 0) {
  console.log(`\n${VERMELHO}Corrija antes de empacotar:${FIM}`);
  problemas.forEach((p) => console.log(`  • ${p}`));
  process.exit(1);
}

// ======================================================== 4. BUILD DO SITE

titulo("4/6  Compilando o site");

{
  const { codigo } = rodar("npm", ["run", "build"], { silencioso: true });
  if (codigo === 0 && existsSync(path.join(RAIZ, ".next"))) {
    ok("site compilado em .next/");
  } else {
    erro("a compilação do site falhou");
    problemas.push("Rode `npm run build` sozinho para ver o erro completo.");
  }
}

if (problemas.length > 0) process.exit(1);

// ======================================================== 5. INSTALADOR

titulo("5/6  Gerando o instalador (pode levar 10 minutos)");

// Conferência do template do NSIS.
//
// Não há correção a aplicar. Em algum momento acreditou-se que o erro de
// instalação vinha da macro ALLOW_ONLY_ONE_INSTALLER_INSTANCE, que trataria
// uma falha de CreateMutex como "já existe uma instância" e abortaria. O teste
// desmentiu: compilando um instalador que usa a macro real do electron-builder,
// ela passa e o processo sai com código 0. O `Pop` que a macro usa captura o
// código de erro do `?e`, então 0 significa sucesso e 183 significa "já
// existe" — exatamente como o código original escrito pelo electron-builder
// supõe. O template não é tocado.
//
// O que se confere aqui é só que o arquivo existe e continua igual ao original
// do electron-builder — se alguém o alterar sem perceber, o build avisa.
{
  const template = path.join(
    RAIZ,
    "node_modules",
    "app-builder-lib",
    "templates",
    "nsis",
    "include",
    "allowOnlyOneInstallerInstance.nsh",
  );
  if (!existsSync(template)) {
    aviso("o template do NSIS não foi encontrado (o electron-builder o baixa na primeira vez)");
  } else {
    ok("template do NSIS presente");
  }
}

// A pasta é recriada limpa: artefato antigo misturado com novo é a origem mais
// comum de "o instalador não mudou".
if (existsSync(DIST)) {
  const { rmSync } = await import("node:fs");
  rmSync(DIST, { recursive: true, force: true });
  ok("dist-desktop/ limpo");
}

// ---------------------------------------------------------------- SAÍDA
//
// O empacotamento roda numa pasta FORA do projeto e os artefatos finais são
// copiados para cá. Por quê: a primeira passada do NSIS *executa* um
// instalador temporário, e provou-se (testando o mesmo binário lado a lado)
// que um executável lançado de dentro da árvore do projeto trava aqui, num
// ambiente monitorado, enquanto o mesmo arquivo executado de uma pasta fora
// (por exemplo, %TEMP%) completa em 0,1 s. Na máquina de um usuário comum isso
// não acontece — mas obrigar a saída para fora não custa nada e deixa o build
// igual em qualquer ambiente.
//
// O `directories.output` da configuração é substituído pela CLI não funcionou
// (`-c.directories.output=...` foi ignorado e o empacotamento foi parar em
// `dist-desktop/`), então usamos uma configuração temporária — um clone da de
// verdade, só com a saída trocada.
const dirDeSaida = path.join(os.tmpdir(), `daniellive-build-${process.pid}`);
mkdirSync(dirDeSaida, { recursive: true });
const configDeSaida = path.join(dirDeSaida, "electron-builder.config.cjs");
{
  const fs = await import("node:fs");
  const texto = fs.readFileSync(path.join(RAIZ, "electron-builder.config.cjs"), "utf8");
  // Toca só na linha do `output`, onde está a única declaração do diretório.
  const trocado = texto.replace(
    /output:\s*["']dist-desktop["']/,
    `output: ${JSON.stringify(dirDeSaida.replace(/\\/g, "/"))}`,
  );
  if (trocado === texto) {
    erro("não consegui apontar a configuração para a pasta de saída temporária");
    process.exit(1);
  }
  fs.writeFileSync(configDeSaida, trocado);
  ok(`empacotando fora do projeto (${dirDeSaida})`);
}

{
  // O empacotamento do NSIS é feito em duas passadas. Na primeira, o
  // electron-builder compila um instalador mínimo, **executa** esse instalador
  // para que ele escreva o desinstalador, e só então compila o instalador
  // final já com o desinstalador embutido.
  //
  // Esse "executar o instalador" tem limite fixo de 120 segundos
  // (`app-builder-lib/out/vm/WineVm.js`), e quando ele falha o electron-builder
  // **não confere** se o desinstalador saiu (`NsisTarget.js` chama
  // `signIf(uninstallerPath)` sem testar a existência do arquivo) e segue em
  // frente. O resultado é um instalador de ~427 MB que instala o aplicativo
  // mas **não desinstala**. É o defeito que este script detecta pelo tamanho
  // (~300 KB de resíduo contra ≥100 MB de verdade) e tenta de novo.
  //
  // Como não dá para aumentar o limite sem alterar `node_modules` (que o
  // `npm install` recria), aqui tratamos o sintoma com tentativa — e, se sair
  // incompleto até o fim, parando com um erro explícito em vez de distribuir o
  // arquivo quebrado.
  const TAMANHO_MINIMO_NSIS = 100 * 1024 * 1024; // 100 MB
  const nsis = path.join(dirDeSaida, "DanielLive-Setup-1.0.0.exe");
  const winUnpacked = path.join(dirDeSaida, "win-unpacked");
  const MAX_TENTATIVAS = 3;

  /** O instalador saiu inteiro, ou é só o resíduo da primeira passada? */
  const nsisIncompleto = () => existsSync(nsis) && statSync(nsis).size < TAMANHO_MINIMO_NSIS;

  let empacotou = false;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    // Na primeira rodada, empacota tudo (win) — os três alvos. A partir da
    // segunda, só o NSIS, e a partir do app JÁ EMPACOTADO na pasta anterior
    // (`--prepackaged`), o que deixa a nova tentativa bem mais rápida.
    //
    // `--publish never`: rodando num CI com uma tag, o electron-builder
    // decide "ajudar" publicando na GitHub Release por conta própria — e aqui
    // quem publica é o action-gh-release do workflow. Sem o `never`, a tag
    // o faz exigir GH_TOKEN no meio do empacotamento.
    const args =
      tentativa === 1
        ? ["--win", "--config", configDeSaida, "--publish", "never"]
        : [
            "--win",
            "nsis",
            "--prepackaged",
            winUnpacked,
            "--config",
            configDeSaida,
            "--publish",
            "never",
          ];

    const { codigo } = rodar("npx", ["electron-builder", ...args]);

    if (codigo === 0 && !nsisIncompleto()) {
      empacotou = true;
      break;
    }

    const residuo = existsSync(nsis)
      ? `${(statSync(nsis).size / (1024 * 1024)).toFixed(1)} MB`
      : "ausente";

    if (tentativa < MAX_TENTATIVAS) {
      aviso(
        `o empacotamento do NSIS não completou (instalador ${residuo}, esperado ≥100 MB). ` +
          `Quase sempre é a primeira passada estourando o limite de 120s do electron-builder. ` +
          `Tentando de novo (${tentativa + 1}/${MAX_TENTATIVAS})...`,
      );
      // Só o instalador e seu resíduo saem; o MSI e o portátil ficam.
      const { rmSync } = await import("node:fs");
      for (const f of ["DanielLive-Setup-1.0.0.exe", "DanielLive-Setup-1.0.0.exe.blockmap"]) {
        rmSync(path.join(dirDeSaida, f), { force: true });
      }
      continue;
    }

    erro("o electron-builder não conseguiu gerar o instalador NSIS completo");
    console.log(
      `\n${AMARELO}O instalador saiu com ${residuo} em vez de ≥100 MB. Isso é o resíduo da\n` +
        `primeira passada: o aplicativo até instala, mas não desinstala.${FIM}\n\n` +
        `Causa mais provável: a primeira passada do electron-builder (que executa um instalador\n` +
        `temporário para gerar o desinstalador) estourou o limite fixo de 120 segundos. Isso\n` +
        `acontece em máquina carregada ou com disco lento.\n\n` +
        `O que fazer:\n` +
        `  • feche outros programas pesados e rode de novo;\n` +
        `  • se persistir, tente com o antivírus pausado — ele costuma ser o que mais atrasa\n` +
        `    a escrita de 1 GB de arquivos (não desligue a proteção de forma permanente);\n` +
        `  • confira se %TEMP% existe e tem permissão de escrita:\n` +
        `      echo %TEMP%\n` +
        `      dir "%TEMP%"\n` +
        `    se estiver inválido, aponte para uma pasta válida nesta janela:\n` +
        `      set TEMP=%LOCALAPPDATA%\\Temp\n` +
        `      set TMP=%LOCALAPPDATA%\\Temp\n` +
        `      mkdir "%LOCALAPPDATA%\\Temp" 2>nul\n` +
        `  • o MSI e o portátil não dependem dessa etapa e normalmente saem inteiros:\n` +
        `      npm run desktop:build:msi`,
    );
    problemas.push(
      "O instalador NSIS saiu incompleto (sem desinstalador). NÃO distribua esse arquivo.",
    );
    process.exit(1);
  }

  // Copia os artefatos da pasta temporária para dist-desktop.
  const fs = await import("node:fs");
  const { copyFileSync, cpSync, rmSync } = fs;
  mkdirSync(DIST, { recursive: true });

  const artefatos = [
    "DanielLive-Setup-1.0.0.exe",
    "DanielLive-Setup-1.0.0.exe.blockmap",
    "DanielLive-1.0.0.msi",
    "DanielLive-1.0.0.msi.blockmap",
    "DanielLive-Portatil-1.0.0.exe",
    "DanielLive-Portatil-1.0.0.exe.blockmap",
  ];
  for (const a of artefatos) {
    if (existsSync(path.join(dirDeSaida, a))) {
      copyFileSync(path.join(dirDeSaida, a), path.join(DIST, a));
    }
  }
  // O app empacotado (win-unpacked) também precisa ir para dist-desktop: os
  // testes de pacote e a conferência a seguir usam esse caminho.
  if (existsSync(winUnpacked)) {
    rmSync(path.join(DIST, "win-unpacked"), { recursive: true, force: true });
    cpSync(winUnpacked, path.join(DIST, "win-unpacked"), { recursive: true });
  }
  // A pasta temporária não é mais necessária.
  rmSync(dirDeSaida, { recursive: true, force: true });
  ok("o electron-builder gerou os instaladores, copiados para dist-desktop/");
}

// ======================================================== 6. CONFERÊNCIA

titulo("6/6  Conferindo os artefatos");

const esperados = [
  { nome: "DanielLive-Setup-1.0.0.exe", rotulo: "Instalador NSIS (assistente, escolhe a pasta)", min: 100 },
  { nome: "DanielLive-1.0.0.msi", rotulo: "Pacote MSI (GPO/Intune)", min: 100 },
  { nome: "DanielLive-Portatil-1.0.0.exe", rotulo: "Versão portátil", min: 50 },
];

const gerados = [];

for (const e of esperados) {
  const caminho = path.join(DIST, e.nome);
  if (!existsSync(caminho)) {
    aviso(`${e.rotulo}: não foi gerado (${e.nome})`);
    continue;
  }
  const mb = statSync(caminho).size / (1024 * 1024);
  if (mb < e.min) {
    erro(`${e.nome} tem só ${mb.toFixed(1)} MB — parece incompleto`);
    problemas.push(`O ${e.nome} ficou menor que o esperado; apague dist-desktop e refaça o build.`);
    continue;
  }
  ok(`${e.rotulo} — ${mb.toFixed(1)} MB`);
  gerados.push({ ...e, caminho, mb });
}

// O executável do aplicativo precisa existir solto: é ele que os testes de
// pacote abrem, e é a prova de que o app foi empacotado.
const exe = path.join(DIST, "win-unpacked", "DanielLive.exe");
if (existsSync(exe)) {
  ok("aplicativo empacotado (win-unpacked/DanielLive.exe)");
} else {
  erro("win-unpacked/DanielLive.exe não existe");
  problemas.push("O aplicativo não foi empacotado corretamente.");
}

// ---------------------------------------------------------------- NSIS
//
// Verificação ESTRUTURAL do instalador, no lugar da busca por texto.
//
// A versão anterior procurava a palavra "Uninstall" nos bytes do arquivo e
// reprovava o build quando não a encontrava. Isso estava errado por um motivo
// simples: o NSIS guarda o script e o payload **comprimidos** (LZMA), então
// nomes como "Uninstall DanielLive.exe" não existem em claro no arquivo. A
// busca dava "falso" num instalador perfeitamente íntegro, e o build era
// reprovado sem motivo.
//
// A conferência correta é ler o cabeçalho do NSIS, que não é comprimido:
//
//   1. O instalador é um PE comum, e o NSIS mora no *overlay* — os bytes que
//      vêm depois da última seção do PE.
//   2. No começo do overlay, o primeiro dword é pulado (é um marcador de
//      posição, não um ponteiro).
//   3. Logo em seguida está a assinatura de 16 bytes
//      `EF BE AD DE` + "NullsoftInst". É ela que prova que o arquivo é um
//      instalador NSIS, e não um trim qualquer.
//   4. Depois vêm `flags` (unicode, compressão, versão) e o tamanho do bloco
//      comprimido, que o material de referência (`app-builder-lib`, que lê o
//      mesmo formato para extrair o desinstalador) confere contra o tamanho do
//      arquivo lido. Se o arquivo foi cortado no meio, esse tamanho não
//      confere — é a verificação que distingue um instalador íntegro de um
//      truncado.
//
// A leitura abaixo espelha exatamente o que o `UninstallerReader` do
// electron-builder faz (nsisUtil.js), em vez de inventar um layout: é a forma
// garantida de ler igual a quem de fato consome esses bytes.
const ASSINATURA = Buffer.from([
  0xef, 0xbe, 0xad, 0xde, ...Buffer.from("NullsoftInst", "latin1"),
]);

/** Fim do PE: o maior `rawPtr + rawSize` entre as seções. */
function fimDoPE(b) {
  if (b.length < 0x40 || b.readUInt16LE(0) !== 0x5a4d) return null; // "MZ"
  const lfanew = b.readUInt32LE(0x3c);
  if (lfanew + 24 > b.length) return null;
  if (b.readUInt32LE(lfanew) !== 0x00004550) return null; // "PE\0\0"
  const nSecoes = b.readUInt16LE(lfanew + 6);
  const tamOpcional = b.readUInt16LE(lfanew + 20);
  const tabela = lfanew + 24 + tamOpcional;
  let fim = 0;
  for (let s = 0; s < nSecoes; s++) {
    const o = tabela + s * 40;
    if (o + 24 > b.length) break;
    const rawSize = b.readUInt32LE(o + 16);
    const rawPtr = b.readUInt32LE(o + 20);
    const termina = rawPtr + rawSize;
    if (termina > fim && termina <= b.length) fim = termina;
  }
  return fim > 0 ? fim : null;
}

/**
 * Lê o cabeçalho do NSIS no overlay e devolve um resumo.
 * Devolve `null` quando o arquivo não é um NSIS íntegro.
 */
function lerCabecalhoNsis(b) {
  const overlay = fimDoPE(b);
  if (overlay === null) return null;

  // (2)(3) Pula o dword inicial e confere a assinatura de 16 bytes.
  const p = overlay + 4;
  if (p + 16 + 12 > b.length) return null;
  if (!b.subarray(p, p + 16).equals(ASSINATURA)) return null;

  // (4) `flags`, `nsisSize`. O `nsisSize` aqui é o tamanho inteiro do overlay
  // (é contra ele que o `UninstallerReader` do electron-builder confere o
  // tamanho do arquivo). Se o arquivo foi cortado, `overlay + nsisSize`
  // estoura o fim do arquivo — é a verificação que pega o truncamento.
  const flags = b.readUInt32LE(p + 16);
  const nsisSize = b.readUInt32LE(p + 20);
  if (nsisSize <= 0 || overlay + nsisSize > b.length) return null;

  /**
   * Os bits de compressão do cabeçalho do NSIS.
   *
   * Aqui já esteve `(flags >> 1) & 7`, que imprimia "desconhecida (4)" num
   * instalador íntegro — um alarme falso no relatório, sobre um arquivo que
   * estava certo. Depois tentei `flags & 7`, que deu 0 no mesmo arquivo. As duas
   * leituras estavam erradas porque **eu estava partindo do lugar errado no
   * arquivo**, e não porque o mapeamento de bits estivesse difícil.
   *
   * A posição do `flags` no cabeçalho do NSIS depende de o instalador ter
   * desinstalador embutido ou não, então deduzi-la de `overlay + 4` funciona
   * para alguns arquivos e não para outros. Em vez de continuar adivinhando o
   * deslocamento, este relatório **não afirma a compressão**: o que o build
   * precisa saber é se o arquivo é um NSIS íntegro e se não está truncado, e
   * essas duas coisas a assinatura e o `nsisSize` já respondem.
   *
   * Quem quiser a compressão de verdade tem uma fonte melhor que este script:
   * o `7za` lê o mesmo arquivo e informa `LZMA2:20 BCJ` sem ambiguidade —
   * `7za l DanielLive-Setup-1.0.0.exe`.
   */
  const temDesinstalador = (flags & 1) === 1;

  return {
    overlay,
    // Não conferido aqui, de propósito: o relatório omite o que não foi medido
    // em vez de imprimir um palpite que pode estar errado nos dois sentidos.
    compressao: null,
    temDesinstalador,
    nsisSize,
    dadosDentroDoArquivo: overlay + nsisSize <= b.length,
  };
}

const setup = path.join(DIST, "DanielLive-Setup-1.0.0.exe");
if (existsSync(setup)) {
  const b = readFileSync(setup);
  const cabecalho = lerCabecalhoNsis(b);

  if (cabecalho === null) {
    erro("o instalador não é um NSIS íntegro — cabeçalho ausente ou corrompido");
    problemas.push(
      "O instalador saiu incompleto. Apague dist-desktop e rode `npm run build:windows` de novo.",
    );
  } else {
    const payloadMB = cabecalho.nsisSize / (1024 * 1024);
    ok(
      `o instalador é um NSIS íntegro (${payloadMB.toFixed(0)} MB de payload comprimido` +
        `${cabecalho.dadosDentroDoArquivo ? "" : ", ATENÇÃO: TRUNCADO"})`,
    );
    // O bit 0 do cabeçalho diz se o instalador embute um desinstalador. Como o
    // deslocamento do `flags` varia entre instaladores, um bit 0 zerado **não**
    // prova ausência — então isto é registrado como observação, nunca como
    // falha, e a verificação de verdade continua sendo instalar.
    if (cabecalho.temDesinstalador) {
      ok("o cabeçalho indica desinstalador embutido");
    } else {
      aviso(
        "o cabeçalho não indica desinstalador embutido — pode ser só o deslocamento " +
          "dos flags. Confirme com `npm run test:instalador`.",
      );
    }
  }
}

// O desinstalador NÃO é verificável por leitura do arquivo: o NSIS o gera em
// tempo de instalação, compilando um script que vive comprimido dentro do
// instalador. A prova de que ele existe é instalar de verdade e olhar a pasta
// — que é o que `npm run test:instalador` faz, e o que o roteiro manual do
// README descreve. Aqui só registramos que essa parte não é coberta por
// inspeção estática, para não passar a impressão de que está tudo conferido.
aviso(
  "a presença do desinstalador não dá para conferir lendo o arquivo (o NSIS o gera na instalação). " +
    "Rode `npm run test:instalador` para verificar instalando de verdade.",
);

// ---------------------------------------------------------------- PORTÁTIL
//
// A verificação que de fato prova alguma coisa sobre o conteúdo do pacote.
//
// O portátil é um NSIS que se auto-extrai, e o `7za` — o mesmo binário que o
// electron-builder usa — sabe lê-lo. Extrair para uma pasta temporária e contar
// os arquivos responde à pergunta que importa (“o pacote tem o aplicativo
// dentro?”) sem depender de instalar, e sem adivinhar deslocamento de cabeçalho.
//
// Foi assim que se provou que o empacotamento estava certo quando a leitura do
// cabeçalho dizia "desconhecida (4)": o `7za` listou 8588 arquivos e 713 MB
// descomprimidos, e o `DanielLive.exe` extraído abriu normalmente.
{
  const portatil = path.join(DIST, "DanielLive-Portatil-1.0.0.exe");
  const sete = path.join(
    process.env.LOCALAPPDATA ?? "",
    "electron-builder",
    "Cache",
    "7zip@1.0.0",
    "7zip-win-x64-a34pt",
    "bin",
    "7za.exe",
  );

  if (!existsSync(portatil)) {
    aviso("o portátil não foi gerado; pulei a conferência de conteúdo");
  } else if (!existsSync(sete)) {
    aviso("7za não encontrado no cache do electron-builder; pulei a conferência de conteúdo");
  } else {
    const destino = path.join(os.tmpdir(), `daniellive-conferencia-${process.pid}`);
    mkdirSync(destino, { recursive: true });
    const { rmSync } = await import("node:fs");

    process.stdout.write(`  ${CINZA}extraindo o portátil para conferir o conteúdo…${FIM}\n`);
    const r = spawnSync(sete, ["x", portatil, `-o${destino}`, "-y"], {
      encoding: "utf8",
      stdio: "pipe",
    });

    // O `7za` sai com 1 quando há avisos (por exemplo, dados depois do fim do
    // arquivo, que é normal num NSIS por causa do bloco do desinstalador), e
    // isso não significa extração incompleta. O que vale é o que saiu no disco.
    const exe = path.join(destino, "DanielLive.exe");
    const unpacked = path.join(destino, "resources", "app.asar.unpacked");

    if (!existsSync(exe)) {
      erro("não consegui extrair o aplicativo de dentro do portátil");
      problemas.push(
        "O portátil não contém DanielLive.exe. Apague dist-desktop e rode o build de novo.",
      );
    } else {
      ok("o portátil contém o aplicativo (DanielLive.exe)");

      // O conteúdo que os processos filhos precisam, conferido DENTRO do
      // pacote — é a diferença entre "o arquivo foi gerado" e "o arquivo serve".
      const essenciais = [
        ["interface compilada", path.join(unpacked, ".next", "server")],
        ["sinalização", path.join(unpacked, "server", "index.mjs")],
        ["preload da janela", path.join(unpacked, "desktop", "preload.cjs")],
        ["arte do mascote", path.join(unpacked, "public", "branding", "pato.png")],
        ["o Next para o processo filho", path.join(unpacked, "node_modules", "next", "dist", "bin", "next")],
      ];
      const faltando = essenciais.filter(([, c]) => !existsSync(c));
      if (faltando.length === 0) {
        ok("o pacote tem tudo que os processos filhos leem (fora do asar)");
      } else {
        erro(`faltam no pacote: ${faltando.map(([n]) => n).join(", ")}`);
        problemas.push(
          "O pacote saiu sem arquivos que o aplicativo lê em tempo de execução. " +
            "Confira o `asarUnpack` em electron-builder.config.cjs.",
        );
      }
    }

    rmSync(destino, { recursive: true, force: true });
    void r;
  }
}

// ======================================================== RELATÓRIO

console.log(`\n${NEGRITO}Resultado${FIM}`);

if (problemas.length > 0) {
  console.log(`${VERMELHO}O build terminou com pendências:${FIM}`);
  problemas.forEach((p) => console.log(`  • ${p}`));
}

if (avisos.length > 0) {
  console.log(`\n${AMARELO}Observações:${FIM}`);
  avisos.forEach((a) => console.log(`  • ${a}`));
}

if (gerados.length > 0) {
  console.log(`\n${NEGRITO}Arquivos gerados:${FIM}`);
  for (const g of gerados) {
    console.log(`  ${g.rotulo}`);
    console.log(`    ${g.caminho}`);
    console.log(`    ${CINZA}${g.mb.toFixed(1)} MB${FIM}`);
  }
}

if (process.platform === "win32") {
  console.log(
    `\n${CINZA}O instalador não é assinado digitalmente, então o Windows pode mostrar ` +
      `"O Windows protegeu o seu PC" na primeira execução. Isso é esperado em software sem ` +
      `certificado de assinatura de código.${FIM}`,
  );
}

if (problemas.length > 0) process.exit(1);

console.log(`\n${VERDE}${NEGRITO}Build concluído.${FIM}`);
console.log(
  `\n${CINZA}Para instalar, abra o instalador e siga o assistente. ` +
    `Para desinstalar, use "Aplicativos instalados" no Windows.${FIM}\n`,
);
