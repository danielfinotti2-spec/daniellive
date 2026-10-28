"use client";

import { cx } from "@/components/ui";
import type { SignalingStatus } from "@/lib/signaling";
import { useTexto, type Dicionario } from "@/lib/idioma";

/** Os estados de `RTCPeerConnection` que a interface precisa distinguir. */
export type EstadoDaConexao = RTCPeerConnectionState;

/**
 * Selos de estado.
 *
 * O texto vem do estado real da conexão, nunca de um palpite: um "ao vivo" que
 * aparece antes de a primeira faixa chegar é pior do que nenhum aviso, porque
 * ensina a pessoa a desconfiar do indicador.
 */

/**
 * Os textos de cada estado saem do dicionário por função, e não de uma
 * constante de módulo: a constante é avaliada uma única vez, fora do
 * componente, e por isso ficaria presa no idioma vigente no primeiro render —
 * trocar de idioma não a atualizaria.
 *
 * As chaves dos `Record` são estados técnicos de `RTCPeerConnection` /
 * `SignalingStatus` e continuam intraduzíveis: só o valor é texto de interface.
 */
function textoDaSinalizacao(t: Dicionario): Record<SignalingStatus, string> {
  return {
    conectando: t.comum.conectar,
    conectado: t.comum.conectado,
    reconectando: t.comum.reconectar,
    offline: t.comum.offline,
  };
}

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
  const t = useTexto();
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
      {textoDaSinalizacao(t)[status]}
    </span>
  );
}

/** Selo de "ao vivo", com o ponto pulsante definido em globals.css. */
export function SeloAoVivo({ ativo, className }: { ativo: boolean; className?: string }) {
  const t = useTexto();
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
      {ativo ? t.comum.aoVivo : t.comum.foraDoAr}
    </span>
  );
}

/** Mesma razão da sinalização: o texto depende do idioma em uso. */
function textoDoPeer(t: Dicionario): Record<EstadoDaConexao, string> {
  return {
    new: t.comum.preparando,
    connecting: t.comum.conectar,
    connected: t.comum.assistindo,
    disconnected: t.comum.conexaoInstavel,
    failed: t.comum.falhou,
    closed: t.comum.saiu,
  };
}

const ESTILO_PEER: Record<EstadoDaConexao, string> = {
  new: "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  connecting:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  connected:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  disconnected:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  closed:
    "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

/** Estado da conexão com um espectador específico, na lista do anfitrião. */
export function SeloEspectador({ estado }: { estado: EstadoDaConexao }) {
  const t = useTexto();
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ESTILO_PEER[estado],
      )}
    >
      {(estado === "connecting" || estado === "new") && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {textoDoPeer(t)[estado]}
    </span>
  );
}

/** Barra de qualidade, três degraus, sem números inventados. */
export function BarraQualidade({ nivel }: { nivel: "boa" | "media" | "ruim" }) {
  const t = useTexto();
  const ativos = nivel === "boa" ? 3 : nivel === "media" ? 2 : 1;
  const cor =
    nivel === "boa" ? "bg-emerald-500" : nivel === "media" ? "bg-amber-500" : "bg-red-500";
  const rotulo =
    nivel === "boa"
      ? t.comum.conexaoBoa
      : nivel === "media"
        ? t.comum.conexaoInstavel
        : t.comum.conexaoRuim;

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
