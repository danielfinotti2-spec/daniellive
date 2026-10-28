"use client";

import Link from "next/link";
import { RedesRodape } from "@/components/RedesSociais";
import { TrechoAmbiente } from "@/components/TextoAmbiente";
import { preencher, useTexto } from "@/lib/idioma";

/**
 * Rodapé.
 *
 * Discreto de propósito: o que ele carrega é a informação que alguém procura
 * depois de usar a ferramenta, não antes. Dentro de uma sala ele encolhe para
 * uma linha, porque uma transmissão ao vivo não tem espaço para mobília.
 */
export function SiteFooter() {
  // O ano vem do relógio, não do dicionário — só a frase ao redor é traduzida.
  const ano = new Date().getFullYear();
  const t = useTexto();

  return (
    <footer className="border-t border-zinc-200/70 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            DanielLive
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            <TrechoAmbiente web={t.rodape.licencaWeb} app={t.rodape.licencaApp} />
          </p>
        </div>

        <nav aria-label={t.rodape.navRotulo} className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Link
            href="/transmitir"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {t.rodape.criar}
          </Link>
          <Link
            href="/como-funciona"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {t.rodape.comoFunciona}
          </Link>
          <a
            href="https://webrtc.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {t.rodape.sobreWebrtc}
          </a>
        </nav>

        {/* As redes ficam junto do rodapé, e não como um bloco próprio: quem
            chegou até aqui já usou a ferramenta. */}
        <RedesRodape />

        <p className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
          {preencher(t.rodape.copyright, { ano: String(ano) })}
        </p>
      </div>
    </footer>
  );
}
