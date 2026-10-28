"use client";

/**
 * Botão de envio de formulário que sabe quando o formulário está esperando.
 *
 * A pendência vem de `useFormStatus` — único jeito correto com Server
 * Actions, porque só o React sabe quando a ação do servidor terminou. Por
 * isso este botão TEM que morar dentro do `<form>` (o contexto vem por baixo,
 * não por prop), e por isso ele existe: sem ele, cada formulário precisaria
 * de estado local de "carregando" rastreado à mão, que é exatamente a fonte
 * de botão que fica girando para sempre depois de um erro.
 */

import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";

export function BotaoEnvio({
  rotulo,
  rotuloCarregando,
  className,
  variant,
  size,
}: {
  rotulo: string;
  /** O que o botão diz enquanto espera ("Enviando…") — nunca um giro mudo. */
  rotuloCarregando: string;
  className?: string;
  variant?: "primario" | "secundario" | "discreto" | "perigo" | "sucesso";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Botao
      type="submit"
      variant={variant}
      size={size}
      className={className}
      carregando={pending}
      rotuloCarregando={rotuloCarregando}
    >
      {rotulo}
    </Botao>
  );
}
