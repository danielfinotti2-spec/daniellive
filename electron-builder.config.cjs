/**
 * Configuração do empacotamento desktop (electron-builder).
 *
 * O aplicativo carrega a interface do Next e o servidor de sinalização como
 * arquivos dentro do pacote, então o `files` abaixo precisa incluí-los: por
 * padrão o electron-builder embarca só o que está em `dependencies`, e o Next
 * compilado (`.next/`) e o servidor (`server/`) ficariam de fora.
 */
module.exports = {
  appId: "com.daniellive.desktop",
  productName: "DanielLive",
  copyright: "DanielLive — software livre sob licença MIT",

  // Diretório onde os artefatos finais são escritos.
  directories: {
    output: "dist-desktop",
    buildResources: "build",
  },

  /**
   * O que entra no pacote.
   *
   * A lista é explícita de propósito: embarcar o projeto inteiro levaria junto
   * testes, imagens de documentação e o código-fonte original, inflando o
   * instalador sem nenhum ganho. `package.json` é obrigatório porque é dele que
   * o Electron lê o ponto de entrada.
   *
   * `node_modules` NÃO aparece aqui de propósito. Quem o inclui é o próprio
   * electron-builder, que resolve as dependências de produção a partir do
   * `package.json` e poda o que não é alcançável — inclusive as de
   * desenvolvimento. Listá-lo à mão fazia cada pacote ser gravado **duas
   * vezes**: uma dentro do `app.asar` e outra em `app.asar.unpacked` (por causa
   * do `asarUnpack`), somando 631 MB de conteúdo repetido e inflando o
   * instalador para 373 MB. O `asarUnpack` continua valendo: ele move para fora
   * o que já foi incluído, sem duplicar.
   */
  files: [
    "desktop/**/*",
    "server/**/*",
    "lib/**/*",
    "package.json",
    // A interface já compilada: HTML, JS, CSS e os dados das rotas.
    ".next/**/*",
    /**
     * Fora o modo de desenvolvimento do Next.
     *
     * `.next/dev/` é escrito pelo `next dev` — compilações incrementais, cache do
     * depurador e um servidor inteiro de desenvolvimento. O aplicativo empacotado
     * só roda `next start`, que lê `.next/server`; nada ali é usado. Como a pasta
     * fica no disco de quem desenvolveu, ela entrava no pacote e somava ~258 MB
     * (contra ~99 MB do build de produção de verdade) sem servir para nada.
     */
    "!.next/dev/**/*",
    "!.next/cache/**/*",
    "public/**/*",
    "!**/*.test.mjs",
    "!**/tests/**",
    "!**/docs/**",
    "!**/scripts/**",
    // Apenas a pasta `build/` da RAIZ (os ícones-fonte). O padrão precisa ser
    // ancorado: `!**/build/**` também apagava `node_modules/next/dist/build`,
    // que é código do Next que a interface precisa em tempo de execução — o
    // aplicativo empacotado subia e morria com "Cannot find module
    // '../build/output/log'".
    "!build/**",
  ],

  // Dependências de produção são resolvidas pelo próprio electron-builder.
  npmRebuild: false,
  asar: true,

  /**
   * O que precisa ficar FORA do asar, como arquivos soltos.
   *
   * O Next e a sinalização sobem como **processos separados**, e um processo novo
   * não enxerga dentro de um asar — só o próprio Electron sabe lê-lo. Estes
   * diretórios precisam existir como arquivos reais no disco.
   *
   * A lista é enxuta de propósito. Marcar `node_modules/**` inteiro aqui fazia
   * cada pacote ser gravado duas vezes — uma dentro do `app.asar` e outra em
   * `app.asar.unpacked` — somando 631 MB de conteúdo repetido e inflando o
   * instalador para 373 MB. Como o `asarUnpack` **copia** em vez de mover, o que
   * não precisa ser executado por outro processo deve ficar só dentro do asar,
   * onde ocupa espaço uma única vez.
   *
   * O que está listado aqui é o conjunto que o servidor do Next carrega ao subir.
   *
   * `desktop/preload*.cjs` **também** precisam estar aqui, e a ausência deles era
   * um defeito real. O `main.cjs` o próprio Electron carrega de dentro do asar,
   * sem problema — mas **preload não**: ele é lido pelo processo do renderizador,
   * que não enxerga asar. O caminho `app.asar\desktop\preload.cjs` simplesmente
   * não existe como arquivo, a janela abria **sem preload nenhum** e a interface
   * ficava sem `__DANIELLIVE_DESKTOP__` (se identificava como site, com os textos
   * errados) e, pior, sem `__DANIELLIVE_SIGNAL_URL__` — ou seja, sem saber em que
   * porta a sinalização subiu. No `npm run desktop` funcionava, porque ali
   * `desktop/` é uma pasta de verdade no disco; só o pacote quebrava, em silêncio.
   *
   * `.next/**` **precisa** estar aqui, e a ausência dele era um defeito real: o
   * `files` acima embarca a interface compilada, mas dentro do asar. O `next
   * start` roda como processo Node separado, e um processo Node não enxerga
   * dentro de um asar — ele procurava `.next` em `app.asar.unpacked`, não
   * encontrava, e encerrava. O aplicativo abria sem interface, e o sintoma
   * ("Could not find a production build in the '.next' directory") só aparecia no
   * log do filho, não na tela.
   *
   * São ~99 MB soltos no disco em vez de dentro do asar. Não há duplicação: o
   * `asarUnpack` retira do asar o que já foi incluído.
   *
   * `public/**` está aqui pelo mesmo motivo, e o defeito era mais visível: o
   * `next start` serve os arquivos públicos a partir de `<dirApp>/public`, então
   * com a pasta dentro do asar **a arte do mascote respondia 404** no aplicativo
   * instalado — o pato sumia do cabeçalho e da tela de abertura, sobrando o
   * glifo de reserva. No site funcionava, porque ali o `public/` é uma pasta de
   * verdade no disco; só o pacote quebrava.
   */
  asarUnpack: [
    // Os preloads são lidos pelo renderizador, que não lê asar. Sem eles a
    // janela abre sem a ponte para a sinalização.
    "desktop/preload*.cjs",
    ".next/**/*",
    "public/**/*",
    "server/**/*",
    "node_modules/next/**/*",
    "node_modules/@next/**/*",
    "node_modules/@swc/**/*",
    "node_modules/react/**/*",
    "node_modules/react-dom/**/*",
    "node_modules/styled-jsx/**/*",
    "node_modules/scheduler/**/*",
    "node_modules/client-only/**/*",
    "node_modules/caniuse-lite/**/*",
    "node_modules/postcss/**/*",
    "node_modules/nanoid/**/*",
    "node_modules/picocolors/**/*",
    "node_modules/source-map-js/**/*",
    "node_modules/baseline-browser-mapping/**/*",
    "node_modules/semver/**/*",
    "node_modules/detect-libc/**/*",
    "node_modules/sharp/**/*",
    "node_modules/@img/**/*",
    "node_modules/ws/**/*",
    "node_modules/tslib/**/*",
  ],

  win: {
    icon: "build/icon.ico",
    // Sem assinatura de código: o Windows vai mostrar o aviso do SmartScreen na
    // primeira execução. Assinar exigiria um certificado comprado, e é a única
    // forma de remover esse aviso — então ele é esperado, não um defeito.
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "msi", arch: ["x64"] },
      { target: "portable", arch: ["x64"] },
    ],
    artifactName: "DanielLive-${version}-${arch}.${ext}",
  },

  nsis: {
    // Instalador assistido: o usuário escolhe a pasta. É o formato mais
    // previsível para distribuir e o que permite desinstalar pelo Painel.
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "DanielLive",
    installerIcon: "build/icon.ico",
    uninstallerIcon: "build/icon.ico",
    installerHeaderIcon: "build/icon.ico",
    deleteAppDataOnUninstall: false,
    artifactName: "DanielLive-Setup-${version}.${ext}",
    // O idioma do assistente acompanha o sistema, com português disponível.
    installerLanguages: ["pt_BR", "en_US"],
    language: "1033",
    // Sobre o erro "Error writing temporary file" e o desinstalador ausente.
    //
    // Chegou-se a suspeitar da macro ALLOW_ONLY_ONE_INSTALLER_INSTANCE, que
    // chama CreateMutex antes de extrair qualquer coisa. A suspeita era que ela
    // tratasse uma falha da chamada como "já existe uma instância" e abortasse.
    // **O teste desmentiu.** Compilando um instalador que usa a macro real do
    // electron-builder, ela passa e o processo sai com código 0; o `Pop` que a
    // macro usa captura o código de erro do `?e`, então 0 é sucesso e 183 é
    // "já existe", exatamente como o código original supõe. O template **não**
    // é alterado por este projeto.
    //
    // A causa real do instalador que instalava mas não desinstalava é outra: o
    // electron-builder monta o NSIS em duas passadas, e na primeira ele executa
    // um instalador temporário para que ele escreva o desinstalador. Essa
    // execução tem limite fixo de 120 s (`app-builder-lib/out/vm/WineVm.js`) e o
    // resultado não é conferido depois (`NsisTarget.js` chama
    // `signIf(uninstallerPath)` sem testar se o arquivo existe). Numa máquina
    // carregada a primeira passada estoura o limite, e o build segue produzindo
    // um instalador de 427 MB **sem desinstalador**.
    //
    // Como aumentar esse limite exigiria alterar `node_modules` (que o
    // `npm install` recria, e que já corrompeu o projeto uma vez), quem trata o
    // problema é `scripts/build-windows.mjs`: ele reconhece o resíduo pelo
    // tamanho (~300 KB em vez de ~427 MB), limpa e tenta de novo, e falha com
    // mensagem clara se não conseguir — em vez de entregar o arquivo quebrado.
    //
    // Por que não `nsis.script`: com script customizado o electron-builder
    // **deixa de gerar o desinstalador** — há um retorno antecipado em
    // computeScriptAndSignUninstaller — e o build quebra com "macro named
    // CHECK_APP_RUNNING not found", além de impedir a desinstalação.
    //
    // Nada de segurança é desligado: o UAC continua valendo, as permissões
    // também, e nenhuma verificação de integridade é removida. A proteção de
    // instância única segue funcionando no caso normal.
  },

  msi: {
    // MSI para quem distribui por GPO/Intune em ambiente corporativo.
    oneClick: false,
    perMachine: false,
    artifactName: "DanielLive-${version}.${ext}",
  },

  portable: {
    artifactName: "DanielLive-Portatil-${version}.${ext}",
  },
};
