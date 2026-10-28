import type { Metadata } from "next";
import { ComoFuncionaPage } from "./ComoFuncionaPage";

/**
 * Casca de servidor da página "Como funciona".
 *
 * Existe por causa do `metadata`: um arquivo que exporta `metadata` roda no
 * servidor, e `"use client"` não convive com isso. O corpo traduzível mora em
 * `ComoFuncionaPage.tsx`, que é cliente e lê o idioma escolhido.
 *
 * O `<title>` e a `<meta description>` continuam em português de propósito: o
 * idioma é uma escolha guardada no navegador, não um segmento da URL, então o
 * servidor não tem como saber qual usar antes de responder. Traduzir aqui
 * exigiria uma rota por idioma, o que é uma decisão de arquitetura maior do que
 * esta página.
 */
export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "O que é o DanielLive, o que é preciso para transmitir, quais navegadores funcionam e o que fazer quando a imagem trava.",
};

export default function Page() {
  return <ComoFuncionaPage />;
}
