/**
 * Ponte da tela de abertura.
 *
 * A janela do splash precisa de três informações do processo principal e de
 * nada mais: o passo atual do carregamento, a arte do mascote (como data URL) e
 * a versão do aplicativo. Como no seletor, `contextIsolation` está ligado, então
 * este arquivo é o único ponto de contato — a janela não enxerga o Node.
 *
 * É CommonJS porque preloads do Electron são carregados antes do carregador de
 * módulos ES.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splash", {
  /** Recebe { texto, valor } a cada avanço do carregamento. */
  aoAtualizar: (callback) => {
    ipcRenderer.on("splash:estado", (_evento, estado) => callback(estado));
  },
  /** Recebe a arte do mascote como data URL (ou string vazia se faltar). */
  aoReceberArte: (callback) => {
    ipcRenderer.on("splash:arte", (_evento, arte) => callback(arte));
  },
  /** Recebe o rótulo de versão mostrado sob o nome. */
  aoReceberVersao: (callback) => {
    ipcRenderer.on("splash:versao", (_evento, texto) => callback(texto));
  },
});
