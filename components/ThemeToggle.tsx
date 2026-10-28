"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BotaoIcone, cx } from "@/components/ui";
import { preencher, useTexto } from "@/lib/idioma";

/**
 * A escolha guardada.
 *
 * ATENÇÃO: estes literais são **dados**, não texto de interface — vão para o
 * `localStorage` em `screenlive-theme` e são comparados com o que está lá. Não
 * entram no dicionário e não podem ser traduzidos: traduzi-los mudaria o valor
 * gravado e a preferência de tema de todo mundo se perderia em silêncio, sem
 * erro de compilação para avisar. O que se traduz é só o rótulo exibido.
 */
type Escolha = "claro" | "escuro" | "sistema";

const CHAVE = "screenlive-theme";

/** Escreve o tema no <html>: `data-theme` para os utilitários, `colorScheme` para o SO. */
function aplicar(escolha: Escolha) {
  const escuroDoSistema = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const tema = escolha === "claro" ? "light" : escolha === "escuro" ? "dark" : escuroDoSistema ? "dark" : "light";
  const raiz = document.documentElement;
  raiz.setAttribute("data-theme", tema);
  raiz.style.colorScheme = tema;
}

/**
 * Botão de tema em três estados.
 *
 * A preferência é lida no inicializador do estado, não em um efeito: um efeito
 * que chama setState provoca uma segunda renderização e, no caso do tema, um
 * piscar visível. O inicializador roda uma única vez, no cliente.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTexto();
  /**
   * `false` no servidor e na primeira renderização do cliente; `true` logo
   * depois.
   *
   * A preferência real só existe no `localStorage`, que o servidor não tem. Se
   * o ícone e o rótulo saíssem dela já na primeira renderização, o HTML do
   * servidor e o do cliente discordariam — que é exatamente o erro de
   * hidratação do React. Renderizar o estado neutro primeiro e trocar no
   * cliente mantém as duas saídas iguais.
   */
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  /**
   * A escolha guardada, lida como fonte externa.
   *
   * `useSyncExternalStore` é o gancho certo aqui: o `localStorage` é um sistema
   * fora do React, o servidor tem um retrato diferente do cliente (vazio), e o
   * gancho resolve as duas coisas sem um efeito que chame setState — que
   * provocaria uma renderização em cascata.
   */
  const guardada = useSyncExternalStore(
    assinarArmazenamento,
    lerEscolhaGuardada,
    () => "sistema" as Escolha,
  );
  // A escolha da sessão vence a guardada; `null` significa "ainda não mexeu".
  const [mexida, setMexida] = useState<Escolha | null>(null);
  const escolha: Escolha = mexida ?? guardada;

  useEffect(() => {
    if (!montado) return;
    aplicar(escolha);
    if (escolha !== "sistema") {
      localStorage.setItem(CHAVE, escolha);
      return;
    }
    // Em "sistema", acompanha a troca do SO enquanto a página está aberta.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => aplicar("sistema");
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, [escolha, montado]);

  // O ciclo parte do que está na tela, não do rótulo guardado. Em "sistema"
  // com o SO claro, o próximo estado é "escuro": um primeiro clique que não
  // muda nada visível parece um botão quebrado.
  //
  // O `matchMedia` só existe no cliente, então o alvo do ciclo é calculado no
  // clique — durante a renderização do servidor isso quebraria a pré-renderização.
  const proximo: Escolha =
    escolha === "sistema" ? "escuro" : escolha === "escuro" ? "claro" : "sistema";
  // O estado comparado acima continua sendo o literal; o que sai daqui é só o
  // rótulo exibido no `title`/`aria-label` do botão.
  const rotulo =
    escolha === "claro"
      ? t.nav.temaClaro
      : escolha === "escuro"
        ? t.nav.temaEscuro
        : t.nav.temaSistema;

  return (
    <BotaoIcone
      rotulo={montado ? preencher(t.nav.temaMudar, { tema: rotulo }) : t.nav.tema}
      onClick={() => {
        // Partindo de "sistema", o alvo é o oposto do que está na tela agora.
        if (escolha === "sistema") {
          const escuroAgora = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setMexida(escuroAgora ? "claro" : "escuro");
          return;
        }
        setMexida(proximo);
      }}
      className={cx("text-zinc-500 dark:text-zinc-400", className)}
    >
      {montado && escolha === "claro" && <IconeSol />}
      {montado && escolha === "escuro" && <IconeLua />}
      {(!montado || escolha === "sistema") && <IconeSistema />}
    </BotaoIcone>
  );
}

/** Ouve mudanças do `localStorage` feitas em outra aba. */
function assinarArmazenamento(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

function lerEscolhaGuardada(): Escolha {
  const salvo = window.localStorage.getItem(CHAVE);
  return salvo === "claro" || salvo === "escuro" || salvo === "sistema" ? salvo : "sistema";
}

function IconeSol() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function IconeSistema() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
