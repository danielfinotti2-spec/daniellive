"use client";

import { useState } from "react";
import { MASCOTE } from "@/lib/marca";
import { cx } from "@/components/ui";

/**
 * O mascote do DanielLive.
 *
 * Existe como componente, e não como uma imagem solta na página, por três
 * motivos que se repetiriam em cada uso:
 *
 *  1. **A arte pode não estar presente.** O repositório pode ser clonado sem
 *     ela. Nesse caso o componente cai no glifo da marca — nunca num desenho
 *     inventado no lugar do mascote. Substituir a identidade por um palpite é
 *     pior do que mostrar menos.
 *  2. **Nada é distorcido.** A imagem é sempre encaixada por proporção
 *     (`object-contain`), com a proporção real declarada. Uma arte quadrada,
 *     alta ou larga entra sem esticar.
 *  3. **A transparência é respeitada.** Sem fundo forçado: o mascote pousa
 *     sobre o cartão, e o mesmo componente serve nos dois temas.
 *
 * Por que `<img>` e não `next/image`: o otimizador do Next **derruba a rota**
 * quando o arquivo não existe. Ele tenta buscar `/branding/pato.png`, recebe
 * 404 e lança erro no servidor, impedindo a hidratação — o `onError` do cliente
 * nunca chega a rodar. Como a ausência da arte é um estado previsto (quem clona
 * o repositório sem ela), a imagem precisa poder falhar em silêncio. Uma `<img>`
 * comum faz exatamente isso, e um PNG pequeno não ganha nada com otimização.
 */
export function Mascote({
  className,
  tamanho = 320,
  /** Proporção da arte, em largura/altura. Ajuste se a sua imagem não for quadrada. */
  proporcao = 1,
}: {
  className?: string;
  tamanho?: number;
  proporcao?: number;
}) {
  const [falhou, setFalhou] = useState(false);

  // Sem a arte: o glifo da marca, que é o mesmo do ícone do aplicativo.
  if (falhou) {
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-3xl bg-gradient-to-br from-broadcast to-broadcast-strong",
          className,
        )}
        role="img"
        aria-label={MASCOTE.alt}
      >
        <GlifoMarca className="h-1/3 w-1/3 text-white" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- ver o comentário acima: o otimizador do Next derruba a rota quando a arte não existe.
    <img
      src={MASCOTE.src}
      alt={MASCOTE.alt}
      width={tamanho}
      height={Math.round(tamanho / proporcao)}
      // `contain` garante que a arte nunca seja cortada nem esticada.
      className={cx("object-contain", className)}
      onError={() => setFalhou(true)}
    />
  );
}

/**
 * O glifo da marca: uma tela com um ponto de transmissão.
 *
 * É o mesmo desenho do ícone do aplicativo e do cabeçalho, o que dá coerência
 * quando o mascote não está disponível.
 */
export function GlifoMarca({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="4" width="15" height="11" rx="1.6" />
      <path d="M6.5 19h7" />
      <circle cx="19" cy="17" r="2.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
