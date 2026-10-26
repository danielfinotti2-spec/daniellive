"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BotaoIcone, cx } from "@/components/ui";

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
          aria-label="ScreenLive — início"
        >
          <Marca />
          <span className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            ScreenLive
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
            <span className="hidden sm:inline">Transmitir</span>
            <span className="sm:hidden">Ao vivo</span>
          </Link>
        </nav>

        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/como-funciona"
            aria-current={caminho === "/como-funciona" ? "page" : undefined}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition sm:px-2.5",
              caminho === "/como-funciona"
                ? "font-medium text-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <IconeInterrogacao />
            <span className="hidden md:inline">Como funciona</span>
            <span className="md:hidden">Ajuda</span>
          </Link>

          {/* Só o ícone de ajuda resta no celular, então o alvo de toque ganha
              um pouco mais de respiro. */}
          <BotaoIcone
            rotulo="Entrar com um código"
            className="sm:hidden"
            onClick={() => {
              const campo = document.getElementById("room-code");
              if (campo) {
                campo.scrollIntoView({ behavior: "smooth", block: "center" });
                (campo as HTMLInputElement).focus();
              } else {
                window.location.href = "/#entrar";
              }
            }}
          >
            <IconeEntrar />
          </BotaoIcone>

          <ThemeToggle />

          <Link
            href="/transmitir"
            className="hidden shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 lg:inline-flex"
          >
            Criar transmissão
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** O símbolo: uma tela com um ponto de transmissão no canto. */
function Marca() {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 items-center justify-center rounded-md bg-broadcast text-white shadow-sm"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="2.5" y="4" width="15" height="11" rx="1.6" />
        <path d="M6.5 19h7" />
        <circle cx="19" cy="17" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
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
