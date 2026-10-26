"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

/**
 * Superfície de vídeo.
 *
 * `srcObject` não é atributo de JSX — precisa ser escrito na mão, e é por isso
 * que este componente existe em vez de um `<video>` solto. O `play()` também
 * pode ser recusado quando o navegador exige um gesto; nesse caso mostramos um
 * botão em vez de deixar uma tela preta silenciosa, que é indistinguível de
 * "não está funcionando".
 */
export function VideoSurface({
  stream,
  muted = false,
  className,
  onNeedsGesture,
  videoRef,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  onNeedsGesture?: () => void;
  /** Referência opcional, para um controle de volume agir no mesmo elemento. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const proprioRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? proprioRef;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (!stream) return;
    const tentativa = video.play();
    if (tentativa && typeof tentativa.catch === "function") {
      tentativa.catch(() => onNeedsGesture?.());
    }
  }, [stream, onNeedsGesture, ref]);

  return (
    <video
      ref={ref}
      // Vídeo de tela nunca é espelhado: é uma tela, não uma selfie.
      autoPlay
      playsInline
      muted={muted}
      controls={false}
      className={className}
    />
  );
}

/**
 * A área de transmissão: moldura preta, o vídeo dentro e as sobreposições.
 *
 * O preto não é decoração — a faixa de letterbox de uma tela 16:9 dentro de uma
 * janela mais larga incomoda muito menos sobre preto do que sobre cinza.
 */
export function PalcoVideo({
  stream,
  nome,
  papel,
  aoVivo,
  compacto = false,
  children,
  legenda,
  videoRef,
  className,
}: {
  stream: MediaStream | null;
  nome: string;
  papel: "anfitriao" | "espectador";
  aoVivo: boolean;
  compacto?: boolean;
  children?: React.ReactNode;
  legenda?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const [precisaGesto, setPrecisaGesto] = useState(false);

  return (
    <div
      className={cx(
        "group relative flex h-full w-full items-center justify-center overflow-hidden bg-black",
        compacto ? "rounded-xl" : "rounded-2xl",
        className,
      )}
    >
      {stream ? (
        <VideoSurface
          stream={stream}
          videoRef={videoRef}
          // O próprio vídeo do anfitrião é silenciado: ouvir a própria tela em
          // eco é desconcertante e não ajuda em nada.
          muted={papel === "anfitriao"}
          onNeedsGesture={() => setPrecisaGesto(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <span
            aria-hidden
            className={cx(
              "flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40",
              compacto ? "h-11 w-11" : "h-14 w-14",
            )}
          >
            <svg width={compacto ? 20 : 26} height={compacto ? 20 : 26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="2" y="4" width="20" height="13" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </span>
          <p className={cx("font-medium text-white/70", compacto ? "text-xs" : "text-sm")}>
            {legenda ?? "Nada sendo transmitido agora"}
          </p>
        </div>
      )}

      {precisaGesto && stream && (
        <button
          type="button"
          onClick={() => {
            void videoRef?.current?.play();
            setPrecisaGesto(false);
          }}
          className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-2 bg-black/60 text-white"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="text-sm font-medium">Clique para iniciar o vídeo</span>
        </button>
      )}

      {/* Faixa de nome, sobre um degradê: o nome precisa continuar legível
          sobre qualquer conteúdo, inclusive uma tela branca. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx("truncate font-medium text-white", compacto ? "text-xs" : "text-sm")}>
            {nome || "Sem nome"}
          </span>
          {papel === "anfitriao" && (
            <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
              Apresentando
            </span>
          )}
        </span>
        {aoVivo && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            <span aria-hidden className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
            Ao vivo
          </span>
        )}
      </div>

      {children}
    </div>
  );
}
