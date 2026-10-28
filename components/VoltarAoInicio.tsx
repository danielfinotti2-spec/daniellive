"use client";

import Link from "next/link";
import { useTexto } from "@/lib/idioma";

/**
 * Caminho de volta para a tela inicial.
 *
 * Existe porque `/site` e `/download` são páginas de decisão: quem entrou por
 * elas pode ter escolhido errado, e sem esta saída o único jeito de voltar seria
 * o botão do navegador — que não existe quando a interface roda dentro do
 * aplicativo, onde não há barra de endereço nem histórico visível.
 *
 * Fica no topo e alinhado à esquerda, que é onde o olho procura uma saída. Não é
 * um botão com fundo: a ação principal destas páginas é criar a transmissão ou
 * baixar o aplicativo, e uma seta discreta não compete com elas.
 */
export function VoltarAoInicio() {
  // Texto do idioma em uso: o idioma vive no `localStorage`, então este
  // componente precisa ser de cliente — como o cabeçalho, que já é.
  const t = useTexto();

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 rounded-lg py-1.5 pr-3 text-sm font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      {t.comum.voltarAoInicio}
    </Link>
  );
}
