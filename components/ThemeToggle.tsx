"use client";

import { useEffect, useState } from "react";
import { BotaoIcone, cx } from "@/components/ui";

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
  const [escolha, setEscolha] = useState<Escolha>(() => {
    if (typeof window === "undefined") return "sistema";
    const salvo = window.localStorage.getItem(CHAVE);
    return salvo === "claro" || salvo === "escuro" || salvo === "sistema" ? salvo : "sistema";
  });

  useEffect(() => {
    aplicar(escolha);
    localStorage.setItem(CHAVE, escolha);
    if (escolha !== "sistema") return;
    // Em "sistema", acompanha a troca do SO enquanto a página está aberta.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => aplicar("sistema");
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, [escolha]);

  // Um botão que percorre os três estados, em vez de um menu: são só três e a
  // troca é reversível e imediata.
  const proximo: Escolha = escolha === "claro" ? "escuro" : escolha === "escuro" ? "sistema" : "claro";
  const rotulo =
    escolha === "claro" ? "Tema claro" : escolha === "escuro" ? "Tema escuro" : "Tema do sistema";

  return (
    <BotaoIcone
      rotulo={`${rotulo} — clique para mudar`}
      onClick={() => setEscolha(proximo)}
      className={cx("text-zinc-500 dark:text-zinc-400", className)}
    >
      {escolha === "claro" && <IconeSol />}
      {escolha === "escuro" && <IconeLua />}
      {escolha === "sistema" && <IconeSistema />}
    </BotaoIcone>
  );
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
