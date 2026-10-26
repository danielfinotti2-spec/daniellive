"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconeCheck, cx } from "@/components/ui";

/**
 * Copia texto para a área de transferência.
 *
 * A Clipboard API só existe em contexto seguro (HTTPS ou localhost). Em
 * `http://` por IP — que é como se testa na rede local — ela não está lá, então
 * há um caminho alternativo com um campo temporário e `execCommand`, que é
 * antigo mas continua funcionando onde a API moderna não chegou.
 *
 * O botão sempre dá retorno visual: um "copiar" que não diz nada deixa a pessoa
 * clicando de novo, sem saber se funcionou.
 */
export function useCopiar() {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copiar = useCallback(async (texto: string) => {
    setFalhou(false);
    let ok = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(texto);
        ok = true;
      } catch {
        ok = false;
      }
    }

    if (!ok) {
      // Caminho alternativo: um campo fora da tela, selecionado e copiado.
      try {
        const campo = document.createElement("textarea");
        campo.value = texto;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.top = "-1000px";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        campo.setSelectionRange(0, texto.length);
        ok = document.execCommand("copy");
        document.body.removeChild(campo);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setCopiado(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiado(false), 2000);
    } else {
      setFalhou(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFalhou(false), 3000);
    }
    return ok;
  }, []);

  return { copiar, copiado, falhou };
}

/** Botão de copiar com o rótulo trocando enquanto o retorno está na tela. */
export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  rotuloCopiado = "Copiado!",
  className,
  variant = "secundario",
  size = "md",
  children,
}: {
  texto: string;
  rotulo?: string;
  rotuloCopiado?: string;
  className?: string;
  variant?: "primario" | "secundario" | "discreto" | "sucesso";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}) {
  const { copiar, copiado, falhou } = useCopiar();

  return (
    <button
      type="button"
      onClick={() => void copiar(texto)}
      aria-live="polite"
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : size === "lg" ? "px-5 py-2.5 text-sm" : "px-3.5 py-2 text-sm",
        copiado
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : falhou
            ? "bg-red-600 text-white hover:bg-red-700"
            : variant === "primario"
              ? "bg-broadcast text-white shadow-sm hover:bg-broadcast-strong"
              : variant === "discreto"
                ? "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                : "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
        className,
      )}
    >
      {copiado ? <IconeCheck className="h-3.5 w-3.5" /> : <IconeCopiar />}
      {children}
      <span>{copiado ? rotuloCopiado : falhou ? "Não foi possível" : rotulo}</span>
    </button>
  );
}

function IconeCopiar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
