"use client";

import Link from "next/link";
import { FormularioEntrar } from "@/components/HomeActions";
import { Cartao } from "@/components/ui";
import { useTexto } from "@/lib/idioma";

/**
 * Página de endereço não encontrado.
 *
 * Cobre duas situações bem diferentes, e o texto serve às duas: um código de
 * sala com formato impossível e qualquer outro caminho que não existe. Em
 * ambos, dizer o que era esperado é mais útil do que um "404" seco.
 */
export default function NotFound() {
  const t = useTexto();

  // O código de exemplo está no meio da frase em `t.erro.naoEncontradoTexto`,
  // como `{codigo}`. A frase é partida no marcador para o trecho ganhar o
  // `font-mono` — o realce acompanha a posição que o idioma der a ele.
  const CODIGO_EXEMPLO = "K7M2PQR4T";
  const [antesDoCodigo, depoisDoCodigo] = t.erro.naoEncontradoTexto.split("{codigo}");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
      <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5M12 16h.01" />
        </svg>
      </span>

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-zinc-50">
        {t.erro.naoEncontradoTitulo}
      </h1>

      {/* O código de exemplo é literal técnico: entra na frase como marcador
          para o realce em fonte monoespaçada acompanhar a posição que ele
          ocupa em cada idioma, em vez de ficar preso à ordem do português. */}
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {antesDoCodigo}
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{CODIGO_EXEMPLO}</span>
        {depoisDoCodigo}
      </p>

      <Cartao className="mt-8 w-full p-5 text-left">
        <FormularioEntrar compacto />
      </Cartao>

      <Link
        href="/"
        className="mt-6 text-sm font-medium text-broadcast underline underline-offset-2 hover:text-broadcast-strong"
      >
        {t.erro.voltarHome}
      </Link>
    </div>
  );
}
