/**
 * Ponte da janela de escolha de tela.
 *
 * A janela do seletor precisa falar com o processo principal, mas não deve ter
 * acesso ao Node: com `contextIsolation` ligado, este arquivo é o único ponto de
 * contato, e ele expõe exatamente dois canais — receber a lista de fontes e
 * devolver a escolha. É CommonJS porque preloads do Electron são carregados
 * antes do carregador de módulos ES.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seletor", {
  /** Recebe as fontes disponíveis (telas e janelas). */
  aoReceberFontes: (callback) => {
    ipcRenderer.on("seletor:fontes", (_evento, fontes) => callback(fontes));
  },
  /** Confirma a escolha pelo id da fonte. */
  escolher: (id) => ipcRenderer.send("seletor:escolher", id),
  /** Fecha sem compartilhar. */
  cancelar: () => ipcRenderer.send("seletor:cancelar"),
});
