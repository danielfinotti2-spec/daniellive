/**
 * Onde esta interface está rodando: no site ou dentro do aplicativo?
 *
 * A mesma base de código serve os dois — é o que impede que a versão web e a
 * versão instalada divirjam. Mas nem todo texto serve para as duas: "sem instalar
 * nada" é verdade no navegador e mentira em um programa instalado; "aba do
 * navegador" não existe para quem está no aplicativo.
 *
 * Quem responde não é o `userAgent` — ele muda a cada versão do Chromium e
 * quebraria sem avisar, fazendo o aplicativo voltar a mentir "sem instalar nada"
 * numa atualização. Quem responde é o processo principal do Electron, que marca
 * `window.__DANIELLIVE_DESKTOP__` no preload (ver desktop/preload.cjs). É uma
 * informação que só ele tem, e por isso é confiável.
 *
 * Em qualquer navegador a marca não existe e a resposta é `false`: o site é o
 * caso padrão.
 */

import { useSyncExternalStore } from "react";

declare global {
  interface Window {
    __DANIELLIVE_DESKTOP__?: boolean;
  }
}
/** Resposta direta, para uso fora de renderização (eventos, efeitos). */
export function ehAplicativo(): boolean {
  if (typeof window === "undefined") return false;
  return window.__DANIELLIVE_DESKTOP__ === true;
}

/**
 * Assinatura estável.
 *
 * O valor não muda durante a vida da página, então não há o que observar: as
 * funções existem apenas para satisfazer `useSyncExternalStore`, que precisa de
 * um `subscribe` e de um `getSnapshot`.
 */
const semInscricao = () => () => {};

/** Para uso em componentes de cliente: resolve a diferença servidor/cliente. */
export function useAplicativo(): boolean {
  return useSyncExternalStore(semInscricao, ehAplicativo, () => false);
}

/**
 * Escolhe um texto conforme o ambiente, sem quebrar a hidratação.
 *
 * O servidor sempre renderiza a versão `web` (não existe `window` lá) e o
 * cliente troca para a versão `app` depois de montar. A troca acontece na
 * hidratação, não na primeira pintura, então não há divergência de HTML.
 */
export function useTexto(web: string, app: string): string {
  return useAplicativo() ? app : web;
}
