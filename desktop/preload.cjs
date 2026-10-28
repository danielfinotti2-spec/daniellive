/**
 * Ponte da janela principal do DanielLive.
 *
 * Existe por dois motivos: informar à interface já compilada qual é a porta da
 * sinalização e avisar que ela está rodando dentro do aplicativo.
 *
 * O Next grava as variáveis `NEXT_PUBLIC_*` dentro do bundle em tempo de
 * **compilação**. Isso funciona para o site, cujo endereço é fixo, mas não para
 * o aplicativo: ele escolhe uma porta livre ao abrir e precisa avisar o cliente,
 * que já está compilado. Um preload roda antes de qualquer script da página, que
 * é exatamente o momento certo para deixar esse valor no `window`.
 *
 * O valor chega por argumento de linha de comando (`--signal-url=`), porque o
 * preload tem `contextIsolation` ligado e não enxerga variáveis do processo
 * principal.
 *
 * Nada além disso é exposto: a interface não ganha acesso ao Node.
 *
 * ## Por que `contextBridge`, e não `window.x = ...`
 *
 * Aqui já esteve `Object.defineProperty(window, "__DANIELLIVE_DESKTOP__", ...)`,
 * com a justificativa de que "a interface roda no mesmo contexto e só lê o
 * valor". **Estava errado.** Com `contextIsolation: true` — que é o padrão do
 * Electron e o que `criarJanela()` usa — o preload roda num mundo isolado, e
 * tudo o que ele escreve em `window` fica visível **só para ele mesmo**. A
 * página nunca via nada: `window.__DANIELLIVE_DESKTOP__` era `undefined` e a
 * interface se identificava como site (mostrando textos de "sem instalar nada"
 * dentro do aplicativo instalado), e `__DANIELLIVE_SIGNAL_URL__` também sumia,
 * deixando o cliente apontando para a porta padrão em vez da que o aplicativo
 * escolheu.
 *
 * O sintoma era mudo: nenhum erro, nenhum aviso — o preload carregava
 * perfeitamente e não comunicava nada. `contextBridge.exposeInMainWorld` é o
 * único caminho suportado para atravessar a isolação, e é o que se usa aqui.
 */

const { contextBridge } = require("electron");

const prefixo = "--signal-url=";
const argumento = process.argv.find((a) => a.startsWith(prefixo));

/**
 * Marca que a interface está rodando dentro do aplicativo.
 *
 * A mesma base de código serve o site e o aplicativo, e alguns textos só fazem
 * sentido num dos dois: "sem instalar nada" é verdade no navegador e mentira
 * aqui. Em vez de adivinhar pelo `userAgent` — que muda com a versão do Chromium
 * e quebra sem avisar —, o processo principal diz explicitamente onde está: é
 * uma informação que só ele tem.
 */
try {
  contextBridge.exposeInMainWorld("__DANIELLIVE_DESKTOP__", true);
} catch {
  // Sem `contextIsolation` (não é o caso aqui) o bridge não existe e a
  // atribuição direta funciona. Mantido como rede de segurança.
  window.__DANIELLIVE_DESKTOP__ = true;
}

if (argumento) {
  const url = argumento.slice(prefixo.length);
  try {
    contextBridge.exposeInMainWorld("__DANIELLIVE_SIGNAL_URL__", url);
  } catch {
    window.__DANIELLIVE_SIGNAL_URL__ = url;
  }
}
