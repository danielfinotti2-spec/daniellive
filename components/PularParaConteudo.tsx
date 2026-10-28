"use client";

import { useTexto } from "@/lib/idioma";

/**
 * O atalho de teclado para quem navega sem mouse.
 *
 * Fica escondido até receber foco — quem tabula a partir do topo encontra ele
 * antes de qualquer outra coisa, e é isso que evita atravessar o cabeçalho
 * inteiro em todas as páginas.
 *
 * É um componente à parte, e não uma linha em `layout.tsx`, porque aquele
 * arquivo exporta `metadata` e portanto roda no servidor: o texto do atalho
 * precisa vir do idioma escolhido, que só existe no cliente.
 */
export function PularParaConteudo() {
  const t = useTexto();
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-broadcast focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
    >
      {t.comum.pularParaConteudo}
    </a>
  );
}
