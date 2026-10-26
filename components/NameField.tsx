"use client";

import { useEffect, useRef, useState } from "react";
import { Entrada, cx } from "@/components/ui";

const CHAVE = "screenlive-name";

/**
 * Lê o nome guardado entre visitas.
 *
 * O inicializador roda uma única vez, no cliente; no servidor não existe
 * localStorage, por isso a guarda de `window`. O valor do servidor é só um
 * palpite até a hidratação — nada depende dele para o layout.
 */
export function useNomeGuardado(inicial = ""): [string, (v: string) => void] {
  const [nome, setNome] = useState<string>(() => {
    if (typeof window === "undefined") return inicial;
    return window.localStorage.getItem(CHAVE) ?? inicial;
  });

  useEffect(() => {
    if (nome.trim()) localStorage.setItem(CHAVE, nome.trim());
  }, [nome]);

  return [nome, setNome];
}

/**
 * Campo de nome com sugestão e validação.
 *
 * O nome é a única coisa pedida antes de transmitir: quem assiste precisa saber
 * quem está falando, e pedir mais do que isso antes de mostrar a tela é atrito
 * sem retorno.
 */
export function CampoNome({
  valor,
  onChange,
  onSubmit,
  rotulo = "Seu nome",
  dica,
  placeholder = "Como você quer aparecer",
  autoFoco = true,
  id = "display-name",
}: {
  valor: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  rotulo?: string;
  dica?: string;
  placeholder?: string;
  autoFoco?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFoco) ref.current?.focus();
  }, [autoFoco]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
        {rotulo}
      </label>
      {dica && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{dica}</p>}
      <Entrada
        ref={ref}
        id={id}
        name="name"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        autoComplete="nickname"
        maxLength={40}
        className={cx("mt-1.5")}
      />
    </div>
  );
}
