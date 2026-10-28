/**
 * DanielLive Desktop — processo principal do Electron.
 *
 * O aplicativo é a mesma interface do site, servida localmente: este processo
 * sobe o Next (HTML/JS da interface) e o servidor de sinalização (WebSocket do
 * WebRTC) como processos filhos, e abre uma janela apontando para o servidor
 * local. Nada da interface foi reescrito — é a mesma base de código, o que
 * garante que site e aplicativo não divirjam.
 *
 * Por que subir servidores locais em vez de carregar arquivos direto:
 * `getDisplayMedia` e `RTCPeerConnection` só funcionam em contexto seguro. O
 * Chromium trata `http://127.0.0.1` como seguro, mas `file://` não — e sem
 * origem HTTP o WebSocket de sinalização também não teria de onde derivar o
 * endereço. Servir localmente resolve os dois de uma vez.
 *
 * Sobre a captura de tela: o Electron não abre o seletor nativo do sistema. Ele
 * pergunta ao processo principal qual fonte usar (`setDisplayMediaRequestHandler`),
 * então mostramos o seletor do próprio aplicativo — ver desktop/seletor.mjs.
 */
/**
 * DanielLive Desktop — processo principal do Electron.
 */

const { existsSync, readFileSync, appendFileSync } = require("node:fs");
const os = require("node:os");
const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  shell,
  Menu,
} = require("electron");

/**
 * Configuração gráfica — o que a captura de tela exige no Windows.
 *
 * A captura de tela do Chromium no Windows usa a Duplicação de Área de Trabalho
 * do DXGI, que é um caminho da **GPU**. Sem um processo gráfico funcional, o log
 * enche de `DxgiAdapterDuplicator::CreateForMonitor failed`: o seletor lista as
 * telas, mas nenhum quadro chega. Três decisões mantêm esse caminho de pé.
 *
 * 1. Aceleração de hardware **ligada**. Aqui havia
 *    `app.disableHardwareAcceleration()`, e era isso que quebrava a transmissão:
 *    sem aceleração não existe adaptador para duplicar. A chamada não voltou, e
 *    não deve voltar.
 *
 * 2. `disable-gpu-sandbox`. Não é o mesmo que `--no-sandbox`: ele não desliga a
 *    sandbox do aplicativo (a que isola o conteúdo da página), apenas a do
 *    processo gráfico. Em máquinas onde o sandbox de GPU não consegue subir, o
 *    processo gráfico morre e leva a janela junto — e é justamente esse processo
 *    que a captura precisa. É uma concessão estreita, de hardware, e vale mais
 *    que a alternativa (não capturar).
 *
 * 3. `--no-sandbox` **não** existe aqui, de propósito. Ele desligava a sandbox do
 *    renderizador — a proteção que separa a página do resto do sistema — e era
 *    muleta para o problema 1. Com a aceleração ligada, não é preciso, e uma
 *    ferramenta que compartilha tela não deve abrir mão dessa proteção.
 *
 * O estado real do processo gráfico é registrado em `registrarEstadoGrafico()`:
 * quando a captura falhar na máquina de alguém, o log precisa dizer se a GPU
 * subiu, em vez de deixar a suspeita no ar.
 */
/*
 * Aqui havia `disable-gpu-sandbox`, e depois um `disable-software-rasterizer`
 * condicionado a uma variável de ambiente. Os dois saíram, e vale explicar por
 * quê — a segunda foi um erro meu, e o sintoma que ela produzia era pior que o
 * problema que tentava resolver.
 *
 * `disable-software-rasterizer` bloqueava o recuo do Chromium para SwiftShader.
 * A intenção era não deixar "a GPU caiu" se disfarçar de funcionamento. Só que,
 * ao bloquear o recuo, o processo gráfico **morre** em vez de degradar: o
 * renderizador encerra com código 18, o WebGL fica indisponível e a janela some.
 * Ou seja, troquei um aplicativo que funcionava devagar por um que não abre. O
 * recuo para software é uma rede de segurança, não um disfarce — quem precisa
 * dela é justamente quem tem driver problemático.
 *
 * `disable-gpu-sandbox` existia porque, em tese, o sandbox do processo gráfico
 * falharia em alguns drivers. Só que a captura de tela **depende** desse processo:
 * ao tirar a sandbox dele, o processo gráfico é reiniciado com uma configuração
 * diferente da que o Chromium espera, e é uma fonte conhecida de GPU desligada —
 * exatamente o `gpu_compositing: disabled_software` que aparecia no log. Quando o
 * sandbox da GPU realmente falha, o próprio Chromium já sabe recuar sozinho; não
 * é preciso decidir isso por ele.
 *
 * O que sobra é a configuração padrão, que é a mais testada — e a única em que a
 * aceleração de hardware, o WebGL e a captura por DXGI convivem.
 */

const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const path = require("node:path");
// Pasta de dados do aplicativo. O sufixo "-debug" era resíduo da fase de
// depuração: um aplicativo publicado guarda os próprios dados no nome dele.
app.setPath("userData", path.join(app.getPath("appData"), "daniellive"));

const RAIZ = path.join(__dirname, "..");

/**
 * Raiz real dos arquivos do aplicativo.
 *
 * Empacotado, tudo vive dentro de `app.asar`, que é um arquivo — o Node só
 * consegue *ler* de dentro dele através do Electron, não iniciar um processo a
 * partir de um caminho lá dentro. Como o Next é iniciado como processo separado,
 * o caminho dele precisa sair do asar; o Electron mantém automaticamente uma
 * cópia fora do pacote em `app.asar.unpacked` para o que precisa ser executado.
 *
 * Em desenvolvimento os dois caminhos coincidem, então nada muda.
 */
function raizExecutavel() {
  const base = app.getAppPath();
  return base.includes("app.asar") ? base.replace("app.asar", "app.asar.unpacked") : base;
}

/**
 * Caminho de um preload, já fora do asar quando existe pacote.
 *
 * O `__dirname` do main aponta para dentro do `app.asar`, e o Electron carrega
 * a si mesmo de lá sem problema — mas **preload é outra história**: quem o lê é
 * o processo do renderizador, que não enxerga asar. O caminho
 * `app.asar\desktop\preload.cjs` não existe como arquivo em disco, a janela
 * abria **sem preload nenhum** e a interface ficava sem `__DANIELLIVE_DESKTOP__`
 * (se identificando como site) e sem `__DANIELLIVE_SIGNAL_URL__` (sem saber em
 * que porta a sinalização subiu). Não falhava em `npm run desktop`, porque ali
 * `desktop/` é pasta de verdade; só o pacote quebrava, e em silêncio.
 *
 * A cópia fora do asar vem do `asarUnpack` em `electron-builder.config.cjs`. A
 * checagem de existência é o que torna isso seguro nos dois modos: em
 * desenvolvimento o caminho real já é o certo e nada muda.
 */
function caminhoPreload(nome) {
  const foraDoAsar = path.join(raizExecutavel(), "desktop", nome);
  return existsSync(foraDoAsar) ? foraDoAsar : path.join(__dirname, nome);
}

/** Ícone usado na janela, na barra de tarefas e no instalador. */
const ICONE = path.join(RAIZ, "build", "icon.ico");

/**
 * O mascote, como data URL, para a tela de abertura.
 *
 * O splash é uma janela local que roda antes de a interface existir, então não
 * tem servidor de onde buscar `/branding/pato.png`. Ler o arquivo aqui e mandar
 * os bytes evita abrir exceção de CSP ou protocolo próprio só para uma imagem.
 * Se a arte não estiver no repositório, devolvemos vazio e o splash mostra o
 * glifo da marca — o mesmo critério do componente `Mascote` da interface.
 */
function arteDoMascote() {
  const candidatos = [
    path.join(app.getAppPath(), "public", "branding", "pato.png"),
    path.join(RAIZ, "public", "branding", "pato.png"),
  ];
  for (const caminho of candidatos) {
    try {
      if (!existsSync(caminho)) continue;
      const bytes = readFileSync(caminho);
      // PNG tem assinatura fixa; conferir evita mandar um HTML de erro como imagem.
      const ehPng =
        bytes.length > 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
      if (!ehPng) continue;
      return `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {
      /* tenta o próximo caminho */
    }
  }
  return "";
}

const ehDesenvolvimento = !app.isPackaged;

/** Processos filhos que precisam morrer junto com o aplicativo. */
const filhos = new Set();

/**
 * Log do aplicativo.
 *
 * Vai para o console **e** para um arquivo em `userData/daniellive.log`. O
 * arquivo é o que torna um problema relatado por outra pessoa investigável: um
 * aplicativo empacotado no Windows não tem console visível, então sem ele a
 * única informação disponível é "não abriu".
 *
 * A escrita nunca derruba o aplicativo: se o arquivo estiver bloqueado ou a
 * pasta não existir, o log simplesmente não é gravado.
 */
let arquivoDeLog = null;
function log(...args) {
  const linha = [new Date().toISOString(), ...args].join(" ");
  console.log(linha);
  try {
    if (arquivoDeLog === null) {
      arquivoDeLog = path.join(app.getPath("userData"), "daniellive.log");
    }
    // `appendFileSync` porque a ordem importa mais do que o custo: são poucas
    // linhas por execução, e perder a última antes de uma queda é pior.
    appendFileSync(arquivoDeLog, linha + os.EOL);
  } catch {
    /* sem permissão de escrita: o console já registrou */
  }
}

/**
 * Registra o que o Chromium conseguiu fazer com a GPU.
 *
 * Existe porque `DxgiAdapterDuplicator::CreateForMonitor failed` não diz de onde
 * veio: pode ser GPU que não subiu, driver recusado, ou apenas uma tela que o
 * Windows não deixa duplicar (janela protegida, sessão remota). São problemas
 * diferentes. Este resumo separa os casos no log, para o relato de um usuário
 * chegar com o motivo em vez de só o sintoma.
 *
 * `getGPUFeatureStatus()` devolve o estado por recurso; `gpu/compositing` em
 * `disabled_software` é o sinal claro de que a captura por DXGI não vai
 * funcionar, porque não há composição por hardware para duplicar.
 */
async function registrarEstadoGrafico() {
  try {
    const { app: electron } = require("electron");
    const status = electron.getGPUFeatureStatus();
    const relevantes = ["gpu_compositing", "video_decode", "rasterization", "webgl"];
    const resumo = relevantes
      .filter((chave) => status[chave])
      .map((chave) => `${chave}=${status[chave]}`)
      .join(" ");

    log("estado gráfico:", resumo || "(sem dados)");

    const info = await electron.getGPUInfo("basic").catch(() => null);
    const aux = info?.gpuDevice?.length ? info.gpuDevice : [];
    if (aux.length === 0) {
      log("estado gráfico: nenhum adaptador de GPU reportado");
    } else {
      for (const d of aux) {
        log(`estado gráfico: adaptador ${d.vendorId ?? "?"}:${d.deviceId ?? "?"} "${d.name ?? "sem nome"}"`);
      }
    }

    // Sem composição por hardware, a captura por DXGI não tem o que duplicar.
    if (status.gpu_compositing && status.gpu_compositing !== "enabled") {
      log(
        "estado gráfico: ATENÇÃO — composição por hardware em",
        status.gpu_compositing,
        "; a captura de tela pode não entregar quadros.",
      );
    }
  } catch (erro) {
    log("estado gráfico: não foi possível consultar:", erro?.message ?? erro);
  }
}

/**
 * Descobre uma porta livre em `127.0.0.1`.
 *
 * Porta fixa seria mais simples, mas quebra quando o usuário já tem algo na
 * 3000 — e um aplicativo que não abre porque "a porta está ocupada" é pior do
 * que um que escolhe outra sozinho. O intervalo começa em 3480 para não
 * colidir com os servidores de desenvolvimento (3000/8787).
 */
function portaLivre(inicial) {
  return new Promise((resolve, rejeitar) => {
    const tentar = (porta) => {
      if (porta > inicial + 40) {
        rejeitar(new Error("Não encontrei uma porta livre."));
        return;
      }
      const sonda = createServer();
      sonda.once("error", () => tentar(porta + 1));
      sonda.once("listening", () => {
        sonda.close(() => resolve(porta));
      });
      sonda.listen(porta, "127.0.0.1");
    };
    tentar(inicial);
  });
}

/**
 * Inicia um processo filho e o registra para encerramento posterior.
 *
 * O diretório de trabalho **não** pode ser `RAIZ`. Empacotado, `RAIZ` aponta
 * para dentro de `app.asar`, que é um arquivo, não uma pasta: o Windows não
 * consegue usar esse caminho como diretório de trabalho e o `spawn` falha com
 * `ENOENT` — que é enganoso, porque o executável existe. Era isso que quebrava a
 * versão compilada enquanto `npm run desktop` funcionava.
 *
 * `raizExecutavel()` devolve a pasta real (`app.asar.unpacked` quando
 * empacotado), que é um caminho válido nos dois casos e é de onde os scripts
 * filhos são realmente lidos.
 */
function iniciar(nome, comando, argumentos, opcoes) {
  const filho = spawn(comando, argumentos, {
    cwd: raizExecutavel(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...opcoes,
  });
  filho.stdout?.on("data", (d) => log(`[${nome}]`, String(d).trim()));
  filho.stderr?.on("data", (d) => log(`[${nome}]`, String(d).trim()));
  filho.on("exit", (code) => log(`[${nome}] saiu com código`, code));
  // Sem isto, um executável inexistente falha em silêncio e o aplicativo fica
  // esperando um servidor que nunca vai subir.
  filho.on("error", (erro) => {
    log(`[${nome}] não foi possível iniciar:`, erro?.code ?? "", erro?.message ?? erro);
  });
  filhos.add(filho);
  return filho;
}

/**
 * Espera uma URL responder, relatando o tempo decorrido.
 *
 * Subir o servidor e abrir a janela na sequência imediata dá tela de erro: o
 * Next leva alguns segundos para ficar pronto. Esperar aqui é o que evita o
 * "não foi possível conectar" na primeira impressão do usuário.
 *
 * `aoEsperar` recebe a fração decorrida (0 a 1) a cada tentativa. É o que
 * permite a barra da abertura **acompanhar o tempo real** em vez de saltar de um
 * número fixo para outro: a espera mais longa da inicialização é justamente esta,
 * e era a única sem nenhum retorno visual.
 */
async function esperarServidor(url, {
  limiteMs = 60_000,
  aoEsperar,
  intervaloMs = 220,
} = {}) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const resposta = await fetch(url, { method: "HEAD" });
      if (resposta.ok || resposta.status === 405) return true;
    } catch {
      /* ainda não subiu */
    }
    const decorrido = Date.now() - inicio;
    aoEsperar?.(Math.min(1, decorrido / limiteMs), decorrido);
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  return false;
}

let janela = null;
let servidorWeb = null;
let servidorSinalizacao = null;
let urlApp = null;

/**
 * Verdadeiro enquanto a abertura está em curso.
 *
 * Existe para `window-all-closed` saber diferenciar "não há janela porque o
 * aplicativo está começando" de "não há janela porque o usuário fechou tudo".
 * São a mesma condição observada pelo Electron, mas pedem decisões opostas.
 */
let emAbertura = false;

/**
 * A tela de abertura.
 *
 * Vive durante o carregamento e é fechada quando a janela real está pronta. É o
 * que transforma "abriu um retângulo preto por alguns segundos" em uma abertura:
 * o mascote, o nome e o que está acontecendo, em vez de silêncio.
 */
let splash = null;

/** Fecha o splash com uma saída curta, para não piscar na troca de janela. */
function fecharSplash() {
  const alvo = splash;
  if (!alvo || alvo.isDestroyed()) return;
  splash = null;
  // A classe dispara o fade no CSS; fechar no mesmo quadro daria um corte seco.
  void alvo.webContents
    .executeJavaScript("document.body.classList.add('saindo')")
    .catch(() => undefined)
    .then(() => new Promise((r) => setTimeout(r, 260)))
    .then(() => {
      if (!alvo.isDestroyed()) alvo.destroy();
    });
}

/** Atualiza o texto (e o quanto já andou) na tela de abertura. */
function progresso(texto, valor) {
  if (!splash || splash.isDestroyed()) return;
  splash.webContents.send("splash:estado", { texto, valor });
}

/**
 * Abre a tela de abertura.
 *
 * `show: false` + `ready-to-show` evita o flash branco padrão do Chromium: a
 * janela só aparece quando tem o que desenhar.
 */
function abrirSplash() {
  splash = new BrowserWindow({
    width: 420,
    height: 380,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#101014",
    icon: ICONE,
    title: "DanielLive",
    // Sem moldura de menu e sem barra de tarefas própria: é uma abertura, não
    // uma segunda janela do aplicativo.
    skipTaskbar: false,
    webPreferences: {
      preload: caminhoPreload("preload-splash.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splash.once("ready-to-show", () => {
    if (!splash || splash.isDestroyed()) return;
    splash.show();
    // A arte vai depois do show: são ~1 MB de data URL, e enviá-los antes de a
    // janela existir só atrasaria a primeira pintura da moldura.
    splash.webContents.send("splash:arte", arteDoMascote());
    splash.webContents.send("splash:versao", `Versão ${app.getVersion()}`);
    progresso("Iniciando…", -1);
  });

  splash.on("closed", () => {
    splash = null;
  });

  splash.loadFile(path.join(__dirname, "splash.html"));
}

/**
 * Porta da sinalização escolhida nesta execução.
 *
 * Fica no escopo do módulo porque é usada em dois momentos distantes: ao subir
 * os servidores e ao criar a janela, que precisa repassá-la à interface.
 */
let portaSinalGlobal = null;

async function subirServidores() {
  const comecou = Date.now();
  progresso("Preparando os servidores locais…", 6);
  const portaWeb = await portaLivre(3480);
  const portaSinal = await portaLivre(portaWeb + 1);
  portaSinalGlobal = portaSinal;
  urlApp = `http://127.0.0.1:${portaWeb}`;

  // O Next empacotado roda com o próprio binário do Electron, que já é um
  // runtime Node — por isso `ELECTRON_RUN_AS_NODE`, e não um `node` externo que
  // pode não existir na máquina do usuário.
  const ambiente = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    // A sinalização é local: o aplicativo é o próprio anfitrião do WebSocket.
    NEXT_PUBLIC_SIGNAL_PORT: String(portaSinal),
    NEXT_PUBLIC_SIGNAL_URL: "",
    SIGNAL_PORT: String(portaSinal),
    SIGNAL_HOST: "127.0.0.1",
    // Origens: o que a janela do Electron usa. Sem isso o servidor recusa a
    // conexão, porque em produção uma lista vazia é tratada como falha.
    ALLOWED_ORIGINS: `http://127.0.0.1:${portaWeb},http://localhost:${portaWeb}`,
  };

  log(`subindo interface em ${urlApp} e sinalização na porta ${portaSinal}`);
  progresso("Abrindo o servidor de sinalização…", 14);

  // A sinalização é um script nosso. Assim como o Next, ela roda como processo
  // separado, então precisa estar fora do asar (ver `asarUnpack` na
  // configuração de empacotamento).
  const servidorSinal = [
    path.join(raizExecutavel(), "server", "index.mjs"),
    path.join(RAIZ, "server", "index.mjs"),
  ].find((c) => existsSync(c));
  servidorSinalizacao = iniciar("sinal", process.execPath, [servidorSinal], { env: ambiente });

  // A interface usa o servidor do Next, que é um pacote JS com entrypoint.
  // O caminho é procurado primeiro fora do asar: é de lá que um processo
  // separado consegue executar. O asar fica como reserva, para o caso de o
  // empacotamento manter o pacote inteiro dentro dele.
  const candidatos = [
    path.join(raizExecutavel(), "node_modules", "next", "dist", "bin", "next"),
    path.join(RAIZ, "node_modules", "next", "dist", "bin", "next"),
  ];
  const nextBin = candidatos.find((c) => existsSync(c)) ?? candidatos[0];

  /*
   * O diretório da aplicação precisa ser passado explicitamente.
   *
   * Sem ele, o Next procura `.next` relativa ao *próprio* pacote
   * (`.../node_modules/next/...`) e falha com "Could not find a production build
   * in the '.next' directory", mesmo com a interface compilada presente.
   *
   * O caminho é o **real**, não `app.getAppPath()`: empacotado, aquele valor
   * aponta para dentro de `app.asar`, e um processo Node separado não enxerga
   * dentro de um asar — só o próprio Electron consegue. Passar o caminho do asar
   * fazia o Next falhar ao ler `.next`, e a janela abria sem interface.
   */
  const dirApp = raizExecutavel();
  log("iniciando a interface com", nextBin, "em", dirApp);
  progresso("Carregando a interface…", 30);

  /*
   * A espera pela interface é a etapa mais longa da abertura — e era a única sem
   * retorno nenhum: a barra ficava parada em 30% até o Next responder, o que
   * parece travamento justamente quando o aplicativo está trabalhando.
   *
   * A faixa vai de 30 a 82% e anda conforme o tempo passa. A curva é medida
   * contra uma duração **esperada**, não contra o limite de desistência: o Next
   * leva cerca de 1 s para responder (medido nesta máquina), enquanto o limite é
   * de 60 s. Usar o limite como referência deixava a barra em 36% quando o
   * servidor ficava pronto e em 49% depois de 8 s de espera — ou seja, ela mal se
   * mexia justamente quando o usuário mais precisa ver que algo acontece.
   *
   * Com a expectativa de ~1,2 s, a barra chega perto do fim do trecho no tempo
   * típico e continua andando devagar se demorar. A sobra até 82% é pequena de
   * propósito: a barra pode *quase* encostar no fim e esperar, mas não pode
   * chegar antes do servidor e ficar travada em 82% por muito tempo.
   */
  const ESPERA_TIPICA_MS = 1_200;
  const FAIXA_INICIO = 30;
  /**
   * Onde a barra deve estar ao terminar cada etapa.
   *
   * Os números são o *destino* de cada trecho, não um valor fixo: entre dois
   * destinos a barra anda conforme o tempo. A folga final (86 → 96) é grande de
   * propósito — depois da interface pronta ainda falta montar a janela e pintar,
   * e é aí que o usuário percebe qualquer travamento.
   */
  const ATE_INTERFACE = 74;
  const ATE_SINAL = 86;
  const ATE_JANELA = 96;

  servidorWeb = iniciar(
    "web",
    process.execPath,
    [nextBin, "start", dirApp, "-p", String(portaWeb), "-H", "127.0.0.1"],
    { env: ambiente },
  );

  const pronto = await esperarServidor(urlApp, {
    limiteMs: 60_000,
    intervaloMs: 180,
    aoEsperar: (_fracao, decorrido) => {
      /*
       * A barra anda em direção ao fim do trecho sem nunca alcançá-lo: sempre
       * resta barra para o que falta. A curva precisa ser **sempre crescente** —
       * uma barra que recua é um defeito visível, e foi o que aconteceu com a
       * tentativa anterior (`x²/(1+x)`, que subia e depois caía).
       *
       * `1 - 1/(1 + x)` é crescente e limitada a 1: sobe em degraus cada vez
       * menores, chegando a ~50% do trecho no tempo típico e continuando a andar
       * devagar quando a máquina for lenta, sem nunca estourar o destino.
       */
      const x = decorrido / ESPERA_TIPICA_MS;
      const fracao = 1 - 1 / (1 + x);
      const valor = FAIXA_INICIO + fracao * (ATE_INTERFACE - FAIXA_INICIO);
      progresso(
        decorrido < 1_200 ? "Carregando a interface…" : "Preparando a interface…",
        valor,
      );
    },
  });
  if (!pronto) {
    throw new Error(`A interface não respondeu em ${urlApp}.`);
  }

  progresso("Conectando…", ATE_INTERFACE);
  // A sinalização é um WebSocket; o /health confirma que o HTTP dela subiu.
  await esperarServidor(`http://127.0.0.1:${portaSinal}/health`, {
    limiteMs: 20_000,
    aoEsperar: (fracao) =>
      progresso("Conectando…", ATE_INTERFACE + fracao * (ATE_SINAL - ATE_INTERFACE)),
  });

  progresso("Ajustando os últimos detalhes…", ATE_SINAL);

  /*
   * Abertura mínima.
   *
   * O aplicativo costuma ficar pronto em cerca de 1 s (medido), e uma animação
   * que aparece e some nesse intervalo lê como falha, não como abertura: dá para
   * ver o mascote piscar e nada mais. Aqui a sequência é levada até um tempo
   * mínimo para poder ser lida — mas nunca além do necessário, e **nunca no lugar
   * de trabalho real**: se o carregamento demorar mais que isso, é ele que manda
   * no tempo e o trecho abaixo nem roda.
   *
   * O que resta é intervalo para as etapas finais, que são marcos verdadeiros
   * (montar o menu, abrir a janela, esperar a primeira pintura). Nada aqui
   * inventa trabalho: são os passos que a `criarJanela()` executa logo depois.
   */
  const MINIMO_MS = 2_600;
  const decorrido = Date.now() - comecou;
  if (decorrido < MINIMO_MS) {
    const faltam = MINIMO_MS - decorrido;
    // Metade do tempo que falta para "organizar", metade para "abrir a janela".
    // A divisão existe para haver duas mensagens distintas onde antes havia uma
    // espera muda de quase dois segundos.
    await esperar(faltam * 0.45);
    progresso("Organizando a tela inicial…", ATE_SINAL + (ATE_JANELA - ATE_SINAL) * 0.5);
    await esperar(faltam * 0.55);
    progresso("Preparando a janela…", ATE_JANELA);
  }

  log(`servidores prontos em ${Date.now() - comecou} ms`);
}

/** Espera simples, nomeada, para as pausas da abertura se lerem como etapas. */
function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Seletor de tela do aplicativo.
 *
 * O Chromium não mostra o seletor nativo dentro do Electron: quem decide a
 * fonte é este handler. Montamos uma janela própria com as telas e janelas
 * disponíveis, e devolvemos a escolha. Sem isso, `getDisplayMedia` falharia com
 * "NotAllowedError" e a função principal do aplicativo não existiria.
 */
function configurarCaptura() {
  require("electron").session.defaultSession.setDisplayMediaRequestHandler(
    async (_pedido, responder) => {
      try {
        const fontes = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 480, height: 300 },
          fetchWindowIcons: true,
        });

        if (fontes.length === 0) {
          responder({});
          return;
        }

        const escolha = await abrirSeletor(fontes);
        if (!escolha) {
          // Usuário cancelou: responder vazio faz o Chromium lançar
          // NotAllowedError, que a interface já trata como "você cancelou".
          responder({});
          return;
        }

        const fonte = fontes.find((f) => f.id === escolha);
        if (!fonte) {
          responder({});
          return;
        }

        // Áudio do sistema: o Electron só o oferece no Windows ao capturar a
        // tela inteira. Pedimos quando disponível e deixamos a interface
        // mostrar se veio ou não.
        responder({ video: fonte, audio: "loopback" });
      } catch (erro) {
        log("falha ao listar fontes de captura:", erro?.message ?? erro);
        responder({});
      }
    },
  );
}

/** Abre a janela de escolha de tela e resolve com o id escolhido (ou null). */
function abrirSeletor(fontes) {
  return new Promise((resolver) => {
    const seletor = new BrowserWindow({
      width: 880,
      height: 620,
      parent: janela ?? undefined,
      modal: true,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      backgroundColor: "#101014",
      icon: ICONE,
      title: "Escolha o que compartilhar",
      webPreferences: {
        preload: caminhoPreload("preload-seletor.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // As miniaturas são enviadas como data URL para o seletor não precisar de
    // nenhum acesso a arquivos nem de protocolo próprio.
    const dados = fontes.map((f) => ({
      id: f.id,
      nome: f.name,
      tipo: f.id.startsWith("screen:") ? "screen" : "window",
      miniatura: f.thumbnail?.toDataURL?.() ?? "",
      icone: f.appIcon?.toDataURL?.() ?? "",
    }));

    let decidido = false;
    const concluir = (valor) => {
      if (decidido) return;
      decidido = true;
      ipcMain.removeListener("seletor:escolher", aoEscolher);
      ipcMain.removeListener("seletor:cancelar", aoCancelar);
      if (!seletor.isDestroyed()) seletor.destroy();
      resolver(valor);
    };

    const aoEscolher = (evento, id) => {
      if (evento.sender === seletor.webContents) concluir(id);
    };
    const aoCancelar = (evento) => {
      if (evento.sender === seletor.webContents) concluir(null);
    };

    ipcMain.on("seletor:escolher", aoEscolher);
    ipcMain.on("seletor:cancelar", aoCancelar);
    seletor.on("closed", () => concluir(null));

    seletor.loadFile(path.join(__dirname, "seletor.html"));
    seletor.webContents.once("did-finish-load", () => {
      seletor.webContents.send("seletor:fontes", dados);
      seletor.show();
    });
  });
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: "#101014",
    icon: ICONE,
    title: "DanielLive",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Informa à interface compilada qual porta de sinalização usar, e que ela
      // está rodando dentro do aplicativo (ver desktop/preload.cjs). O preload
      // roda antes dos scripts da página; sem ele o cliente apontaria para a
      // porta padrão 8787, que não é a que este aplicativo escolheu.
      preload: caminhoPreload("preload.cjs"),
      additionalArguments: [`--signal-url=ws://127.0.0.1:${portaSinalGlobal}`],
      // A interface é o mesmo Next do site; nenhuma ponte com o Node é exposta
      // a ela, de propósito.
      spellcheck: false,
    },
  });

  // Diagnóstico: um renderizador que morre sem isto some em silêncio, e o
  // usuário só vê a janela em branco.
  janela.webContents.on("render-process-gone", (_event, details) => {
    log("renderizador encerrou:", JSON.stringify(details));
  });

  janela.webContents.on("did-fail-load", (_event, code, description, url) => {
    log("falha ao carregar:", code, description, url);
    // A janela pode ter sido fechada enquanto carregava: sem esta guarda, o
    // acesso abaixo estouraria dentro do próprio tratador de erro.
    if (janela && !janela.isDestroyed()) {
      progresso("A interface não respondeu. Verifique o log do aplicativo.", -1);
    }
  });

  // Referência local: se a janela for fechada durante o carregamento, `janela`
  // vira `null` e o log abaixo quebraria em cima do erro que ele deveria relatar.
  const janelaLocal = janela;
  janelaLocal.webContents.on("did-finish-load", () => {
    log("página carregada:", janelaLocal.webContents.getURL());
  });

  // A abertura mostra o que falta de verdade antes de sair: primeiro a moldura
  // pronta, depois a interface desenhada. Só então o splash começa a saída.
  let primeiraPinturaFeita = false;
  const concluirAbertura = () => {
    if (primeiraPinturaFeita) return;
    primeiraPinturaFeita = true;
    progresso("Pronto.", 100);
    // O splash fica um instante a mais já em 100%: sair no mesmo quadro em que a
    // barra chega ao fim dá a impressão de que ela nunca completou.
    setTimeout(() => {
      if (janelaLocal.isDestroyed()) return;
      janelaLocal.show();
      janelaLocal.focus();
      fecharSplash();
    }, 320);
  };

  janelaLocal.once("ready-to-show", () => {
    progresso("Abrindo a janela…", 99);
    // Mostra por trás do splash: a interface pinta enquanto a abertura ainda
    // cobre a tela, então a troca não pega uma janela em branco.
    janelaLocal.show();
    // Rede de segurança: se a primeira pintura não vier (compositor ausente),
    // a abertura não pode ficar presa na tela para sempre.
    setTimeout(concluirAbertura, 2_500);
  });

  janelaLocal.webContents.once("did-finish-load", () => {
    // Um quadro depois do fim do carregamento: é quando o React já montou e há
    // pixels de verdade na tela. `requestAnimationFrame` não existe no processo
    // principal, então a espera é de um intervalo de quadro (≈16 ms).
    setTimeout(concluirAbertura, 120);
  });

  janelaLocal.loadURL(urlApp);

  // Links externos abrem no navegador do sistema, não dentro do aplicativo.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (evento, url) => {
    if (!url.startsWith(urlApp)) {
      evento.preventDefault();
      void shell.openExternal(url);
    }
  });

  janela.on("closed", () => {
    janela = null;
  });
}

/** Menu enxuto, em português, com o essencial (recarregar, zoom, devtools). */
function montarMenu() {
  const modelo = [
    {
      label: "Arquivo",
      submenu: [{ role: "quit", label: "Sair" }],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { type: "separator" },
        { role: "resetZoom", label: "Tamanho normal" },
        { role: "zoomIn", label: "Ampliar" },
        { role: "zoomOut", label: "Reduzir" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
        ...(ehDesenvolvimento
          ? [{ type: "separator" }, { role: "toggleDevTools", label: "Ferramentas de desenvolvedor" }]
          : []),
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Como funciona",
          click: () => janela?.loadURL(`${urlApp}/como-funciona`),
        },
        {
          label: "Sobre o DanielLive",
          click: () => shell.openExternal("https://github.com/"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

// Uma instância só: abrir o aplicativo de novo traz a janela existente para a
// frente, em vez de subir um segundo par de servidores.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  app.whenReady().then(async () => {
    emAbertura = true;
    try {
      configurarCaptura();
      // A abertura vem antes de tudo: o servidor local leva alguns segundos, e
      // esse tempo precisa mostrar o aplicativo, não o vazio.
      abrirSplash();

      // Em paralelo de propósito: consultar a GPU não interfere em nada e o
      // resultado precisa estar no log mesmo que a inicialização falhe depois.
      void registrarEstadoGrafico();

      await subirServidores();
      montarMenu();
      criarJanela();
      // A partir daqui a janela da interface existe: se ela for fechada, o
      // encerramento volta a ser responsabilidade do usuário.
      emAbertura = false;
    } catch (erro) {
      log("falha ao iniciar:", erro?.message ?? erro);
      // Sem isto o splash ficaria sozinho na tela, sem explicar nada.
      if (splash && !splash.isDestroyed()) {
        progresso("Não foi possível iniciar o aplicativo.", -1);
        setTimeout(() => {
          emAbertura = false;
          app.quit();
        }, 2200);
        return;
      }
      emAbertura = false;
      app.quit();
    }
  });
}

app.on("window-all-closed", () => {
  /*
   * Durante a abertura não se encerra nada.
   *
   * A tela de abertura é uma janela como qualquer outra: quando ela sai, existe
   * um instante em que **nenhuma** janela está aberta — a interface ainda está
   * carregando atrás. Sem esta guarda, o Electron interpreta esse instante como
   * "o usuário fechou tudo" e encerra o aplicativo exatamente quando ele estava
   * ficando pronto. Era isso que destruía a janela antes de carregar.
   */
  if (emAbertura) return;
  app.quit();
});

/** Encerra os servidores junto com o aplicativo, para não deixar órfãos. */
app.on("before-quit", () => {
  for (const filho of filhos) {
    try {
      filho.kill();
    } catch {
      /* já morreu */
    }
  }
  filhos.clear();
});

// Evita que um erro inesperado deixe o aplicativo aberto sem janela.
process.on("uncaughtException", (erro) => log("erro não tratado:", erro?.message ?? erro));

