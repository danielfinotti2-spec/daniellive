import Link from "next/link";

/**
 * Rodapé.
 *
 * Discreto de propósito: o que ele carrega é a informação que alguém procura
 * depois de usar a ferramenta, não antes. Dentro de uma sala ele encolhe para
 * uma linha, porque uma transmissão ao vivo não tem espaço para mobília.
 */
export function SiteFooter() {
  const ano = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200/70 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            ScreenLive
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Software livre sob licença MIT. A imagem viaja direto de um navegador para o outro — o
            servidor só apresenta as partes e nunca vê o conteúdo.
          </p>
        </div>

        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Link
            href="/transmitir"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Criar transmissão
          </Link>
          <Link
            href="/como-funciona"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Como funciona
          </Link>
          <a
            href="https://webrtc.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sobre WebRTC
          </a>
        </nav>

        <p className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
          © {ano} ScreenLive · v1.0.0
        </p>
      </div>
    </footer>
  );
}
