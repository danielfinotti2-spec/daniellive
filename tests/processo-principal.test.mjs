/**
 * Guarda estrutural do processo principal do Electron.
 *
 * Estes testes existem por causa de um defeito real: em certa altura o
 * `desktop/main.cjs` ficou corrompido — o arquivo aparecia com 1335 linhas, sendo
 * o próprio conteúdo colado em si mesmo, com um `app.on("before-quit")` cortado
 * no meio. Nada quebrou de imediato: em JavaScript, declarações de função
 * posteriores sobrescrevem as anteriores, então o aplicativo *parecia* funcionar
 * enquanto o encerramento dos processos filhos nunca era registrado.
 *
 * Nenhum teste olhava para esse arquivo. O sintoma só apareceria como "sobrou um
 * processo depois de fechar o aplicativo", que é difícil de ligar à causa.
 *
 * O que se verifica aqui não é estilo: é integridade. Arquivo que não fecha as
 * chaves, função definida duas vezes (sinal de conteúdo duplicado) ou
 * configuração gráfica ausente são defeitos que passam por `node --check` e por
 * qualquer teste de interface, mas quebram o aplicativo de verdade.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = readFileSync(path.join(RAIZ, "desktop", "main.cjs"), "utf8");

/** Remove comentários de linha e de bloco, para não confundir texto com código. */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CODIGO = semComentarios(FONTE);

describe("integridade do processo principal", () => {
  test("o arquivo tem um tamanho plausível", () => {
    const linhas = FONTE.split("\n").length;
    // Duplicação acidental do arquivo já chegou a 1335 linhas; um processo
    // principal deste aplicativo fica entre 400 e 900.
    assert.ok(linhas > 400, `arquivo curto demais: ${linhas} linhas`);
    assert.ok(linhas < 1000, `arquivo suspeito de duplicação: ${linhas} linhas`);
  });

  test("as chaves estão balanceadas", () => {
    const abre = (CODIGO.match(/\{/g) ?? []).length;
    const fecha = (CODIGO.match(/\}/g) ?? []).length;
    assert.equal(abre, fecha, `{ = ${abre}, } = ${fecha}`);
  });

  test("as funções do processo principal aparecem uma única vez", () => {
    // Uma segunda definição só aparece se o conteúdo foi colado duas vezes.
    const nomes = [
      "log",
      "portaLivre",
      "iniciar",
      "esperarServidor",
      "esperar",
      "raizExecutavel",
      "arteDoMascote",
      "abrirSplash",
      "fecharSplash",
      "progresso",
      "configurarCaptura",
      "abrirSeletor",
      "criarJanela",
      "montarMenu",
      "subirServidores",
      "registrarEstadoGrafico",
    ];
    for (const nome of nomes) {
      const ocorrencias = (CODIGO.match(new RegExp(`function\\s+${nome}\\s*\\(`, "g")) ?? []).length;
      assert.equal(ocorrencias, 1, `"${nome}" está definida ${ocorrencias} vezes`);
    }
  });

  test("o arquivo não contém a si mesmo", () => {
    /*
     * O sinal da corrupção era o módulo inteiro aparecer duas vezes: o cabeçalho
     * do arquivo surgia no começo e de novo no meio do `before-quit`.
     *
     * A marca usada é a primeira linha de código, não o cabeçalho em comentário:
     * o texto "processo principal do Electron" também é citado legitimamente em
     * outros comentários, e contar ocorrências dele acusaria texto correto.
     */
    const primeiroRequire = "const { existsSync, readFileSync, appendFileSync }";
    const ocorrencias = (CODIGO.match(new RegExp(primeiroRequire.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    assert.equal(ocorrencias, 1, `o bloco de imports aparece ${ocorrencias} vezes`);

    const whenReady = (CODIGO.match(/app\.whenReady\s*\(/g) ?? []).length;
    assert.equal(whenReady, 1, `app.whenReady aparece ${whenReady} vezes`);

    const beforeQuit = (CODIGO.match(/app\.on\(\s*"before-quit"/g) ?? []).length;
    assert.equal(beforeQuit, 1, `before-quit aparece ${beforeQuit} vezes`);
  });

  test("o encerramento dos processos filhos está completo", () => {
    // Era exatamente este trecho que ficou cortado na corrupção: o `for` abria e
    // o corpo sumia, deixando servidores órfãos a cada fechamento.
    assert.match(FONTE, /app\.on\("before-quit"/, "sem tratador de encerramento");
    assert.match(CODIGO, /filho\.kill\(\)/, "o encerramento não mata os filhos");
    assert.match(CODIGO, /filhos\.clear\(\)/, "o encerramento não limpa a lista de filhos");
  });

  test("as janelas são criadas com o preload que as identifica", () => {
    // O caminho passa por `caminhoPreload()` porque no pacote o `__dirname`
    // aponta para dentro do `app.asar`, de onde o renderizador não lê.
    assert.match(CODIGO, /preload:\s*caminhoPreload\("preload\.cjs"\)/);
    assert.match(CODIGO, /preload:\s*caminhoPreload\("preload-splash\.cjs"\)/);
  });
});

describe("configuração gráfica para captura de tela", () => {
  test("a aceleração de hardware não é desligada", () => {
    // Desligá-la foi a causa de `DxgiAdapterDuplicator::CreateForMonitor failed`:
    // a captura no Windows depende da GPU. A chamada não pode voltar.
    assert.doesNotMatch(
      CODIGO,
      /app\.disableHardwareAcceleration\s*\(/,
      "disableHardwareAcceleration() desliga a captura de tela",
    );
  });

  test("nenhum argumento de linha de comando mexe na GPU ou na sandbox", () => {
    /*
     * Cada um destes já causou um defeito real:
     *
     * - `--no-sandbox` desligava a sandbox do renderizador (a proteção que separa
     *   a página do sistema) e era muleta para o problema de aceleração.
     * - `disable-software-rasterizer` bloqueava o recuo para SwiftShader, e o
     *   processo gráfico passou a **morrer** em vez de degradar: renderizador
     *   encerrando com código 18, WebGL indisponível e janela sumindo. O recuo
     *   para software é rede de segurança, não disfarce.
     * - `disable-gpu-sandbox` tirava a sandbox do processo gráfico, que é
     *   justamente o processo de que a captura depende.
     *
     * O aplicativo deve rodar com a configuração padrão do Electron. Se algum
     * argumento voltar, precisa ser por um motivo medido — e este teste força
     * que a decisão seja consciente.
     */
    const switches = [...CODIGO.matchAll(/appendSwitch\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    assert.deepEqual(switches, [], `argumentos inesperados: ${switches.join(", ")}`);
  });

  test("a captura de tela tem um seletor próprio", () => {
    // O Electron não abre o seletor nativo: sem este tratador, `getDisplayMedia`
    // falha com NotAllowedError e o aplicativo perde sua função principal.
    assert.match(CODIGO, /setDisplayMediaRequestHandler\s*\(/);
    assert.match(CODIGO, /desktopCapturer\.getSources\s*\(/);
  });
});

describe("processos filhos e caminhos", () => {
  test("os filhos não usam um caminho dentro do app.asar como diretório", () => {
    /*
     * `cwd: RAIZ` aponta para dentro de `app.asar` quando empacotado. Um asar é
     * um arquivo, não uma pasta: o Windows recusa usá-lo como diretório de
     * trabalho e o `spawn` falha com ENOENT — erro enganoso, porque o executável
     * existe. Isso quebrava a versão compilada enquanto `npm run desktop`
     * funcionava, que é o pior tipo de defeito: só aparece no que se entrega.
     */
    assert.doesNotMatch(CODIGO, /cwd:\s*RAIZ\b/, "cwd aponta para dentro do asar");
    assert.match(CODIGO, /cwd:\s*raizExecutavel\(\)/, "cwd precisa ser um diretório real");
  });

  test("o diretório passado ao Next é um caminho real", () => {
    // O mesmo vale para o `dirApp`: um processo Node separado não enxerga dentro
    // de um asar, então o Next não acharia `.next` e a janela abriria vazia.
    assert.match(CODIGO, /const dirApp = raizExecutavel\(\)/);
    assert.doesNotMatch(CODIGO, /const dirApp = app\.getAppPath\(\)/);
  });

  test("um filho que não sobe é relatado", () => {
    // Sem tratador de `error`, um executável ausente falha em silêncio e o
    // aplicativo fica esperando um servidor que nunca vem.
    assert.match(CODIGO, /filho\.on\(\s*"error"/);
  });

  test("a janela não é encerrada durante a abertura", () => {
    /*
     * A tela de abertura é uma janela: quando ela sai, existe um instante sem
     * janela nenhuma enquanto a interface carrega atrás. Sem guarda,
     * `window-all-closed` entendia isso como "o usuário fechou tudo" e encerrava
     * o aplicativo bem quando ele ia aparecer.
     */
    assert.match(CODIGO, /emAbertura\s*=\s*true/);
    assert.match(CODIGO, /emAbertura\s*=\s*false/);
    const fechamento = CODIGO.slice(CODIGO.indexOf('app.on("window-all-closed"'));
    assert.match(fechamento.slice(0, 300), /if\s*\(emAbertura\)\s*return/);
  });
});

describe("empacotamento: o que precisa ficar fora do asar", () => {
  /*
   * Um processo Node separado não enxerga dentro de um asar — só o próprio
   * Electron consegue. Tudo de que o Next precisa para servir a interface tem de
   * estar solto no disco. Cada item abaixo foi, em algum momento, a causa de uma
   * janela vazia ou de uma imagem faltando no aplicativo instalado.
   */
  const CONFIG = readFileSync(path.join(RAIZ, "electron-builder.config.cjs"), "utf8");

  test(".next fica fora do asar", () => {
    // Dentro do asar, o `next start` encerra com "Could not find a production
    // build in the '.next' directory" e a janela abre sem interface.
    assert.match(CONFIG, /asarUnpack:\s*\[[\s\S]*?["']\.next\/\*\*\/\*["']/);
  });

  test("public fica fora do asar", () => {
    // O `next start` serve os arquivos públicos de `<dirApp>/public`. Dentro do
    // asar, a arte do mascote respondia 404 no aplicativo instalado.
    assert.match(CONFIG, /asarUnpack:\s*\[[\s\S]*?["']public\/\*\*\/\*["']/);
  });

  test("server fica fora do asar", () => {
    // A sinalização também sobe como processo separado.
    assert.match(CONFIG, /asarUnpack:\s*\[[\s\S]*?["']server\/\*\*\/\*["']/);
  });

  test("o entrypoint do Next fica fora do asar", () => {
    assert.match(CONFIG, /asarUnpack:\s*\[[\s\S]*?["']node_modules\/next\/\*\*\/\*["']/);
  });

  test("os preloads ficam fora do asar", () => {
    // Preload é lido pelo renderizador, que **não** enxerga asar — ao contrário
    // do `main.cjs`, que o próprio Electron carrega. Sem esta entrada a janela
    // abria sem preload nenhum: a interface não recebia `__DANIELLIVE_DESKTOP__`
    // (se identificava como site) nem `__DANIELLIVE_SIGNAL_URL__` (não sabia a
    // porta da sinalização). Não quebrava em `npm run desktop`, só no pacote.
    assert.match(CONFIG, /asarUnpack:\s*\[[\s\S]*?["']desktop\/preload\*?[^"']*\.cjs["']/);
  });

  test("o preload é carregado por caminho que existe fora do asar", () => {
    // Não basta o preload estar no `asarUnpack`: o caminho passado ao
    // `BrowserWindow` precisa **apontar** para fora. `path.join(__dirname, ...)`
    // resolve para dentro do `app.asar`, onde o renderizador não lê — foi
    // exatamente esse o defeito que deixou a janela sem preload no pacote.
    assert.match(CODIGO, /function caminhoPreload\(/);
    for (const nome of ["preload.cjs", "preload-splash.cjs", "preload-seletor.cjs"]) {
      assert.ok(
        CODIGO.includes(`caminhoPreload("${nome}")`),
        `${nome} deveria ser carregado por caminhoPreload()`,
      );
    }
    // E nenhum preload pode voltar a ser montado direto do __dirname.
    assert.doesNotMatch(CODIGO, /preload:\s*path\.join\(__dirname,/);
  });

  test("todo preload atravessa o contextIsolation pelo contextBridge", () => {
    /**
     * Este é o defeito mais silencioso que apareceu aqui.
     *
     * `criarJanela()` usa `contextIsolation: true`. Nesse modo o preload roda
     * num mundo isolado: o que ele escreve em `window` vale **só para ele**. O
     * `preload.cjs` fazia `Object.defineProperty(window, "__DANIELLIVE_DESKTOP__",
     * ...)` e nada chegava à página — sem erro, sem aviso, o preload carregava
     * certo e não comunicava coisa alguma. A interface se identificava como site
     * dentro do aplicativo e o cliente não descobria a porta da sinalização.
     *
     * `contextBridge.exposeInMainWorld` é o único caminho suportado.
     */
    for (const arquivo of ["preload.cjs", "preload-splash.cjs", "preload-seletor.cjs"]) {
      const fonte = readFileSync(path.join(RAIZ, "desktop", arquivo), "utf8");
      assert.match(fonte, /contextBridge/, `${arquivo} não usa contextBridge`);
      assert.match(
        fonte,
        /contextBridge\.exposeInMainWorld\(/,
        `${arquivo} não expõe nada pelo contextBridge`,
      );
    }
  });

  test("o modo de desenvolvimento do Next não entra no pacote", () => {
    // `.next/dev` é escrito pelo `next dev` e somava ~258 MB sem ser usado.
    assert.match(CONFIG, /["']!\.next\/dev\/\*\*\/\*["']/);
  });
});

describe("relato do que aconteceu", () => {
  test("o log também vai para arquivo", () => {
    // Empacotado no Windows não há console: sem arquivo, o único sintoma
    // possível é "não abriu", que não permite investigar nada.
    assert.match(CODIGO, /appendFileSync\s*\(/);
    assert.match(CODIGO, /daniellive\.log/);
  });

  test("o estado da GPU é registrado", () => {
    assert.match(CODIGO, /getGPUFeatureStatus\s*\(/);
    assert.match(CODIGO, /registrarEstadoGrafico\s*\(/);
  });

  test("a pasta de dados usa o nome do aplicativo", () => {
    assert.match(CODIGO, /setPath\(\s*"userData"/);
    assert.doesNotMatch(CODIGO, /daniellive-debug/, "resíduo da fase de depuração");
  });
});

describe("abertura e progresso", () => {
  test("a abertura é mostrada antes de os servidores subirem", () => {
    const quandoPronto = CODIGO.slice(CODIGO.indexOf("app.whenReady("));
    const posAbertura = quandoPronto.indexOf("abrirSplash()");
    const posServidores = quandoPronto.indexOf("subirServidores()");
    assert.ok(posAbertura >= 0, "a abertura não é chamada");
    assert.ok(posServidores >= 0, "os servidores não são chamados");
    assert.ok(
      posAbertura < posServidores,
      "a abertura precisa vir primeiro: é ela que cobre a espera",
    );
  });

  test("o progresso é relatado em etapas, sempre para a frente", () => {
    /*
     * As etapas usam tanto números diretos quanto constantes nomeadas
     * (`ATE_INTERFACE`, `ATE_JANELA`), então a checagem é pela chamada — não
     * pelo valor literal. O que importa é haver etapas suficientes para a
     * abertura não ficar parada, e nenhuma delas fora da faixa 0–100.
     */
    const chamadas = [...CODIGO.matchAll(/progresso\(/g)].length;
    assert.ok(chamadas >= 8, `poucas etapas de progresso: ${chamadas}`);

    const literais = [...CODIGO.matchAll(/progresso\(\s*"[^"]*"\s*,\s*(-?[0-9.]+)/g)].map((m) =>
      Number(m[1]),
    );
    for (const v of literais) {
      assert.ok(v >= -1 && v <= 100, `valor de progresso fora da faixa: ${v}`);
    }

    // As constantes de destino precisam existir e ser crescentes, senão a barra
    // andaria para trás — defeito que já ocorreu durante o ajuste da curva.
    const destinos = ["FAIXA_INICIO", "ATE_INTERFACE", "ATE_SINAL", "ATE_JANELA"].map((nome) => {
      const m = CODIGO.match(new RegExp(`${nome}\\s*=\\s*([0-9.]+)`));
      assert.ok(m, `constante "${nome}" não encontrada`);
      return Number(m[1]);
    });
    for (let i = 1; i < destinos.length; i++) {
      assert.ok(
        destinos[i] > destinos[i - 1],
        `destino ${destinos[i]} não é maior que o anterior ${destinos[i - 1]}`,
      );
    }
  });

  test("a abertura tem um tempo mínimo legível", () => {
    // Sem um mínimo, a sequência some antes de ser lida em máquinas rápidas.
    assert.match(CODIGO, /MINIMO_MS\s*=\s*[\d_]+/);
    const m = CODIGO.match(/MINIMO_MS\s*=\s*([\d_]+)/);
    const ms = Number(m[1].replace(/_/g, ""));
    assert.ok(ms >= 1500 && ms <= 6000, `tempo mínimo fora do razoável: ${ms} ms`);
  });

  test("o progresso desconhecido não inventa porcentagem", () => {
    // `-1` é o sinal combinado com a janela para "ainda não sei": ela mostra a
    // barra indeterminada em vez de um número falso.
    assert.match(CODIGO, /progresso\([^)]*,\s*-1\s*\)/s);
  });
});
