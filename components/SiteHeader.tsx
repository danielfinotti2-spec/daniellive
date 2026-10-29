"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { Mascote } from "@/components/Mascote";
import { cx } from "@/components/ui";
import { useTexto } from "@/lib/idioma";
import { useAplicativo } from "@/lib/desktop";
import { SITE_PUBLICO } from "@/lib/marca";

/**
 * Barra superior do site.
 *
 * Fixa e translúcida: numa página longa, o caminho de volta não pode ficar a
 * várias telas de rolagem. O desfoque é o que mantém o texto legível enquanto o
 * conteúdo passa por baixo — sem ele uma barra vazada vira ruído.
 *
 * As ações ficam em dois grupos de propósito. Criar uma transmissão é o que a
 * pessoa veio fazer, então é um botão com borda, à esquerda, junto do nome.
 * Como funciona é leitura, então é um link discreto. Misturar os dois numa
 * linha de links iguais é exatamente o que enterraria a ação principal.
 */
export function SiteHeader() {
  const caminho = usePathname();
  const t = useTexto();
  // No aplicativo, duas abas do site deixam de fazer sentido (ver os comentários
  // nas próprias abas abaixo); o servidor sempre renderiza a versão web e o
  // cliente corrige na hidratação, sem divergir o HTML.
  const noApp = useAplicativo();
  // Dentro de uma sala a barra some: é uma tela de transmissão com controles
  // próprios, e navegação por cima de uma chamada ao vivo é mobília que
  // ninguém pediu. O rodapé continua, discreto.
  const emSala = caminho.startsWith("/assistir") || caminho.startsWith("/transmitir");
  if (emSala) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-zinc-50/85 backdrop-blur-md dark:border-white/5 dark:bg-black/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition hover:opacity-80"
          aria-label={`DanielLive — ${t.comum.inicio}`}
        >
          {/* O mascote ocupa o lugar do antigo glifo de monitor. Pequeno (h-7)
              para não competir com o nome; `object-contain` impossibilita
              deformação, e o fallback para o glifo ocorre sozinho quando a arte
              não está no repositório. */}
          <Mascote tamanho={28} className="h-7 w-7 shrink-0" />
          <span className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            DanielLive
          </span>
        </Link>

        {/* A ação principal, e o único item da barra com borda. */}
        <nav className="flex items-center gap-2">
          <Link
            href="/transmitir"
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition",
              caminho === "/transmitir"
                ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
            )}
          >
            <IconeTransmitir />
            {/* Dois rótulos longos não cabem num celular, e dois ícones soltos
                viram adivinhação — então o rótulo encurta em vez de sumir. */}
            <span className="hidden sm:inline">{t.nav.transmitir}</span>
            <span className="sm:hidden">{t.nav.aoVivo}</span>
          </Link>
        </nav>

        <nav className="ml-auto flex items-center gap-1">
          {/* No celular estas duas abas ficam só com ícone.
              A barra já tinha o nome, o botão "Ao vivo", a ajuda e o botão de
              tema; somando dois rótulos de texto ela passava a 510px numa tela
              de 390px e a página inteira ganhava rolagem horizontal. O ícone
              mantém as duas alcançáveis sem empurrar nada para fora — e o
              `aria-label` garante que quem usa leitor de tela continue sabendo
              o que cada uma faz.
              A altura de 40px (contra 27px do padding sozinho) é para o alvo de
              toque ficar confortável: são as duas abas principais, e errar o
              toque num celular é o defeito mais fácil de introduzir aqui. */}
          {/* No aplicativo, "Site" não pode ser uma aba interna: levaria para a
              mesma interface que a pessoa já está vendo. Ali ele vira um link
              EXTERNO para a página pública — é a informação que só o site tem
              (como usar pelo navegador, o que é o projeto). No navegador
              continua sendo a aba de sempre. */}
          {noApp ? (
            <a
              href={SITE_PUBLICO}
              target="_blank"
              rel="noreferrer"
              aria-label={t.nav.siteRotulo}
              title={t.nav.siteRotulo}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-950 sm:px-2.5 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <IconeNavegador />
              <span className="hidden md:inline">{t.nav.site}</span>
              <IconeExterno />
            </a>
          ) : (
            <Link
              href="/site"
              aria-current={caminho === "/site" ? "page" : undefined}
              aria-label={t.nav.siteRotulo}
              title={t.nav.siteRotulo}
              className={cx(
                "inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm transition sm:px-2.5",
                caminho === "/site"
                  ? "font-medium text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              <IconeNavegador />
              <span className="hidden md:inline">{t.nav.site}</span>
            </Link>
          )}

          {/* "Baixar" DENTRO do aplicativo é a pergunta já respondida — o
              programa está instalado e aberto. A aba sai do menu em vez de
              levar a pessoa para uma página que oferece o que ela tem nas mãos.
              No site, onde é a ação que importa, ela continua. */}
          {!noApp && (
            <Link
              href="/download"
              aria-current={caminho === "/download" ? "page" : undefined}
              aria-label={t.nav.downloadRotulo}
              title={t.nav.downloadRotulo}
              className={cx(
                "inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm transition sm:px-2.5",
                caminho === "/download"
                  ? "font-medium text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              <IconeDownload />
              <span className="hidden md:inline">{t.nav.download}</span>
            </Link>
          )}

          {/* A aba da conta. No celular ela sai do topo: a barra do rodapé já
              tem a Conta como aba completa, e mais um ícone aqui estouraria a
              linha nos 390px. A partir de sm ela aparece com o resto. */}
          <Link
            href="/conta"
            aria-current={caminho === "/conta" ? "page" : undefined}
            aria-label={t.nav.contaRotulo}
            title={t.nav.contaRotulo}
            className={cx(
              "hidden sm:inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm transition sm:px-2.5",
              caminho === "/conta"
                ? "font-medium text-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <IconePessoa />
            <span className="hidden md:inline">{t.nav.conta}</span>
          </Link>

          {/* No celular a ajuda some: ela é leitura, e as duas abas acima são
              escolha. Numa barra apertada, o que informa a decisão fica. */}
          <Link
            href="/como-funciona"
            aria-current={caminho === "/como-funciona" ? "page" : undefined}
            className={cx(
              "hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition sm:inline-flex sm:px-2.5",
              caminho === "/como-funciona"
                ? "font-medium text-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <IconeInterrogacao />
            <span className="hidden md:inline">{t.rodape.comoFunciona}</span>
            <span className="md:hidden">{t.comum.ajuda}</span>
          </Link>

          {/* Entrar com um código não cabe na barra do celular como texto, mas
              é uma ação — some por último, e por isso vive como ícone. */}
          <Link
            href="/#entrar"
            aria-label={t.comum.entrarComCodigo}
            title={t.comum.entrarComCodigo}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-950 sm:hidden dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            <IconeEntrar />
          </Link>

          <SeletorIdioma />

          <ThemeToggle />

          <Link
            href="/transmitir"
            className="hidden shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 lg:inline-flex"
          >
            {t.home.criar}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function IconeTransmitir() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconeDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
    </svg>
  );
}

/**
 * A setinha de "abre fora".
 *
 * Bem pequena e ao lado do rótulo: dentro do aplicativo, o link do site abre o
 * navegador, e essa mudança de lugar precisa estar visível antes do clique —
 * senão a pessoa clica achando que troca de aba e a janela some.
 */
function IconeExterno() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 opacity-60">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

/** Janela de navegador: distingue "usar pelo site" de "baixar o aplicativo". */
function IconeNavegador() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 9h19" />
      <path d="M6 6.5h.01M9 6.5h.01" />
    </svg>
  );
}

function IconeInterrogacao() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01" />
    </svg>
  );
}

function IconeEntrar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

function IconePessoa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {/* Busto de pessoa: cabeça + ombros, o ícone universal de "conta". */}
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c1-3.4 3.7-5 7.2-5s6.2 1.6 7.2 5" />
    </svg>
  );
}
