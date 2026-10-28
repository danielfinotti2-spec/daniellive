"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { useTexto } from "@/lib/idioma";

/**
 * Barra inferior do celular.
 *
 * Abaixo de `lg`, navegação no topo de uma tela pequena é um alvo de toque
 * pequeno no canto mais distante do polegar. Aqui as duas telas do site viram
 * abas na base, onde o polegar já está — por isso o cabeçalho esconde os
 * mesmos destinos nessa largura.
 *
 * Não aparece dentro de uma sala: uma transmissão ao vivo é a tela inteira, e
 * uma barra fixa por cima de um vídeo rouba altura de quem está assistindo.
 */
export function TabBar() {
  const t = useTexto();
  const caminho = usePathname();
  if (caminho.startsWith("/assistir") || caminho.startsWith("/transmitir")) return null;

  /*
    Rótulos curtos por necessidade de espaço: a barra cabe em 390px de largura
    com três abas, e em inglês e espanhol as palavras são mais longas que em
    português ("Transmitir" → "Go live" / "Emitir" já é o limite confortável,
    "Ajuda" → "Help" / "Ayuda"). Antes de encompridar qualquer rótulo, confira
    a largura num celular estreito.
  */
  const abas = [
    { href: "/", rotulo: t.nav.inicio, Icone: IconeCasa },
    { href: "/transmitir", rotulo: t.nav.transmitir, Icone: IconeTransmitir },
    { href: "/conta", rotulo: t.nav.conta, Icone: IconePessoa },
    { href: "/como-funciona", rotulo: t.nav.ajudaCurto, Icone: IconeInterrogacao },
  ];

  return (
    <nav
      aria-label={t.nav.navegacaoPrincipal}
      className="sticky bottom-0 z-30 border-t border-black/5 bg-zinc-50/95 backdrop-blur-md dark:border-white/5 dark:bg-black/90 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {abas.map(({ href, rotulo, Icone }) => {
          const ativo = caminho === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition-colors",
                  ativo
                    ? "text-broadcast"
                    : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50",
                )}
              >
                <Icone />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconeCasa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
    </svg>
  );
}

function IconeTransmitir() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconeInterrogacao() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3M12 17h.01" />
    </svg>
  );
}

function IconePessoa() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {/* Mesmo busto do ícone da conta no cabeçalho, no peso da barra inferior. */}
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c1-3.4 3.7-5 7.2-5s6.2 1.6 7.2 5" />
    </svg>
  );
}
