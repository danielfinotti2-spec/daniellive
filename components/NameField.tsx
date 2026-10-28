"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Entrada, cx } from "@/components/ui";
import { useTexto } from "@/lib/idioma";

const CHAVE = "screenlive-name";

/**
 * Lê o nome guardado entre visitas.
 *
 * O `localStorage` é um sistema fora do React e o servidor tem um retrato
 * diferente do cliente (vazio). `useSyncExternalStore` resolve as duas coisas:
 * o servidor renderiza a string vazia, o cliente lê o valor guardado, e não há
 * divergência de hidratação nem efeito chamando setState.
 */
export function useNomeGuardado(inicial = ""): [string, (v: string) => void] {
  const guardado = useSyncExternalStore(assinarArmazenamento, lerNomeGuardado, () => "");
  const [digitado, setDigitado] = useState<string | null>(null);
  const nome = digitado ?? guardado ?? inicial;

  useEffect(() => {
    const limpo = nome.trim();
    if (limpo) localStorage.setItem(CHAVE, limpo);
  }, [nome]);

  return [nome, setDigitado];
}

function assinarArmazenamento(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

function lerNomeGuardado(): string {
  return window.localStorage.getItem(CHAVE) ?? "";
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
  rotulo,
  dica,
  placeholder,
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
  const t = useTexto();
  const ref = useRef<HTMLInputElement>(null);

  /*
    Os padrões saem do dicionário dentro do corpo, e não na lista de parâmetros:
    um valor padrão ali é avaliado fora do componente, onde não há como chamar o
    gancho — e o texto ficaria preso no idioma padrão mesmo com a interface em
    inglês.
  */
  const rotuloFinal = rotulo ?? t.campo.nome;
  const placeholderFinal = placeholder ?? t.campo.nomePlaceholder;

  useEffect(() => {
    if (!autoFoco) return;
    /**
     * `preventScroll` não é detalhe: sem ele, focar dispara a rolagem automática
     * do navegador até o campo. Numa página longa — e a tela de transmissão é
     * longa — isso empurra a interface para baixo sozinha no instante em que ela
     * abre, e a pessoa perde o título e o contexto do que está acontecendo. O
     * foco continua vindo de graça; só a rolagem é que não pode ser consequência
     * dele.
     */
    ref.current?.focus({ preventScroll: true });
  }, [autoFoco]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
        {rotuloFinal}
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
        placeholder={placeholderFinal}
        autoComplete="nickname"
        maxLength={40}
        className={cx("mt-1.5")}
      />
    </div>
  );
}
