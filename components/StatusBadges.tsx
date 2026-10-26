"use client";

import { cx } from "@/components/ui";
import type { SignalingStatus } from "@/lib/signaling";
import type { PeerConnectionState } from "@/lib/webrtc";

/**
 * Selos de estado.
 *
 * O texto vem do estado real da conexão, nunca de um palpite: um "ao vivo" que
 * aparece antes de a primeira faixa chegar é pior do que nenhum aviso, porque
 * ensina a pessoa a desconfiar do indicador.
 */

const TEXTO_SINALIZACAO: Record<SignalingStatus, string> = {
  conectando: "Conectando",
  conectado: "Conectado",
  reconectando: "Reconectando",
  offline: "Sem conexão",
};

const ESTILO_SINALIZACAO: Record<SignalingStatus, string> = {
  conectando:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  conectado:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  reconectando:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  offline: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

export function SeloSinalizacao({
  status,
  className,
}: {
  status: SignalingStatus;
  className?: string;
}) {
  const ativo = status === "conectando" || status === "reconectando";
  const cor = {
    conectando: "bg-zinc-400",
    conectado: "bg-emerald-500",
    reconectando: "bg-amber-500",
    offline: "bg-red-500",
  }[status];

  return (
    <span
      role="status"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        ESTILO_SINALIZACAO[status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cx("h-1.5 w-1.5 rounded-full", cor, ativo && "live-dot")}
      />
      {TEXTO_SINALIZACAO[status]}
    </span>
  );
}

/** Selo de "ao vivo", com o ponto pulsante definido em globals.css. */
export function SeloAoVivo({ ativo, className }: { ativo: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        ativo
          ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx("h-1.5 w-1.5 rounded-full", ativo ? "live-dot bg-red-500" : "bg-zinc-400 dark:bg-zinc-600")}
      />
      {ativo ? "Ao vivo" : "Fora do ar"}
    </span>
  );
}

const TEXTO_PEER: Record<PeerConnectionState, string> = {
  novo: "Preparando",
  conectando: "Conectando",
  conectado: "Assistindo",
  desconectado: "Conexão instável",
  falhou: "Falhou",
  fechado: "Saiu",
};

const ESTILO_PEER: Record<PeerConnectionState, string> = {
  novo: "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  conectando:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  conectado:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  desconectado:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  falhou: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  fechado:
    "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

/** Estado da conexão com um espectador específico, na lista do anfitrião. */
export function SeloEspectador({ estado }: { estado: PeerConnectionState }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ESTILO_PEER[estado],
      )}
    >
      {(estado === "conectando" || estado === "novo") && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {TEXTO_PEER[estado]}
    </span>
  );
}

/** Barra de qualidade, três degraus, sem números inventados. */
export function BarraQualidade({ nivel }: { nivel: "boa" | "media" | "ruim" }) {
  const ativos = nivel === "boa" ? 3 : nivel === "media" ? 2 : 1;
  const cor =
    nivel === "boa" ? "bg-emerald-500" : nivel === "media" ? "bg-amber-500" : "bg-red-500";
  const rotulo =
    nivel === "boa" ? "Conexão boa" : nivel === "media" ? "Conexão instável" : "Conexão ruim";

  return (
    <span className="inline-flex items-center gap-1.5" title={rotulo}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cx(
              "w-1 rounded-sm",
              n === 1 ? "h-1.5" : n === 2 ? "h-2.5" : "h-3.5",
              n <= ativos ? cor : "bg-zinc-300 dark:bg-zinc-700",
            )}
          />
        ))}
      </span>
      <span className="sr-only">{rotulo}</span>
    </span>
  );
}
