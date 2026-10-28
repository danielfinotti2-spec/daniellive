"use client";

/**
 * Esqueleto da sala de assistir.
 *
 * A rota `/assistir/[code]` é a única dinâmica do site: a página chega
 * streaming do servidor, e sem este arquivo a barra daria marcha, mas a tela
 * ficaria o que era — uma transição que mente sobre não ter acontecido. O
 * esqueleto tem a geometria da sala de verdade (palco grande à esquerda,
 * coluna de painéis à direita), então a chegada do conteúdo parece pintura,
 * não substituição.
 *
 * É cliente para ler o idioma escolhido: o servidor renderiza sempre pt-BR, e
 * o status audível "a sala está carregando" precisa acompanhar o restante.
 * O pulso dos blocos vem de `globals.css`, que já desliga o movimento para
 * quem pediu menos animação no sistema.
 */

import { useTexto } from "@/lib/idioma";

function Bloco({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton rounded-xl bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function CarregandoSala() {
  const t = useTexto();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* Cabeçalho: voltar, título da sala, selo de estado. */}
      <div className="flex items-center gap-3">
        <Bloco className="h-8 w-8 shrink-0" />
        <Bloco className="h-6 w-48" />
        <Bloco className="ml-auto h-6 w-24 rounded-full" />
      </div>

      {/* O conteúdo da sala: palco e coluna lateral, mesma grade da página. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="skeleton relative aspect-video w-full bg-zinc-900/90" />
          <div className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
            <Bloco className="h-6 w-20 rounded-full" />
            <Bloco className="ml-auto h-8 w-24" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Bloco className="h-32" />
          <Bloco className="h-24" />
          <Bloco className="h-24" />
        </div>
      </div>

      {/* Leitores de tela precisam saber o que se passa; os blocos são decorados. */}
      <p className="sr-only" role="status">
        {t.comum.carregando}…
      </p>
    </div>
  );
}
