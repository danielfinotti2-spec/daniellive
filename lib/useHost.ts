"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignalingClient, type SignalingStatus } from "./signaling";
import {
  captureScreen,
  stopStream,
  HostPeer,
  ScreenCaptureError,
  supportsDisplayCapture,
  type CaptureOptions,
  type LocalCapture,
} from "./webrtc";
import type { Participant, SignalPayload } from "./protocol";

export type HostPhase = "criando" | "pronto" | "ao-vivo" | "parado" | "erro";

/** Por que a transmissão foi encerrada — muda o que a interface diz. */
export type MotivoParada = "usuario" | "navegador" | null;

/**
 * Toda a lógica de quem apresenta.
 *
 * Separado da página para que a interface seja só apresentação: o componente
 * desenha `phase`, `viewers` e `error`, e chama `startSharing`/`stopSharing`.
 * Nenhuma regra de WebRTC mora no JSX.
 */
export function useHost({ name }: { name: string }) {
  const clientRef = useRef<SignalingClient | null>(null);
  const peersRef = useRef<Map<string, HostPeer>>(new Map());
  const captureRef = useRef<LocalCapture | null>(null);

  const [status, setStatus] = useState<SignalingStatus>("offline");
  const [phase, setPhase] = useState<HostPhase>("criando");
  const [code, setCode] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [viewerStates, setViewerStates] = useState<Record<string, RTCPeerConnectionState>>({});
  const [chat, setChat] = useState<{ id: string; from: string; text: string; at: number }[]>([]);
  /**
   * Pausa o envio sem encerrar a captura.
   *
   * Desligar a faixa (`enabled = false`) manda quadros pretos em vez de parar o
   * envio, então a banda continua sendo gasta. Desabilitar o canal do
   * transmissor é o que realmente interrompe os dados.
   */
  const [pausado, setPausado] = useState(false);
  const [motivoParada, setMotivoParada] = useState<MotivoParada>(null);
  /**
   * Espelho síncrono de `pausado`.
   *
   * O callback de alternância lê o valor para decidir o próximo estado; se
   * lesse o state, duas chamadas no mesmo lote veriam o mesmo valor antigo e a
   * segunda desfaria a primeira.
   */
  const pausadoRef = useRef(false);

  const [options, setOptions] = useState<CaptureOptions>({ withAudio: true, quality: "auto" });

  // Guarda o nome mais recente sem reiniciar o efeito de conexão: o nome só é
  // enviado ao servidor na criação da sala.
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  /** Texto de estado, para a interface não recalcular rótulos. */
  const canCapture = useMemo(() => supportsDisplayCapture(), []);

  /**
   * Espectadores conhecidos.
   *
   * Guardados também em ref porque a captura e as ofertas acontecem dentro de
   * callbacks de socket criados uma única vez: eles precisam enxergar a lista
   * atual sem que o efeito de conexão seja recriado a cada entrada ou saída.
   */
  const viewersRef = useRef<Participant[]>([]);
  useEffect(() => {
    viewersRef.current = viewers;
  }, [viewers]);

  /** Encerra todas as conexões com espectadores. */
  const closeAllPeers = useCallback(() => {
    for (const peer of peersRef.current.values()) peer.close();
    peersRef.current.clear();
    setViewerStates({});
  }, []);

  /**
   * Cria (ou recria) a conexão com um espectador e manda a oferta.
   *
   * Fica em um ref sincronizado por efeito, e não em `useCallback`: ela é
   * chamada de dentro do manipulador de socket, que é registrado uma única vez
   * na montagem. Uma função nova a cada render deixaria o manipulador preso à
   * primeira versão; um ref sempre aponta para a versão atual.
   */
  const offerToRef = useRef<(viewerId: string) => Promise<void>>(async () => {});

  useEffect(() => {
    offerToRef.current = async (viewerId: string) => {
      const capture = captureRef.current;
      if (!capture) return;

      const existing = peersRef.current.get(viewerId);
      if (
        existing &&
        existing.pc.connectionState !== "failed" &&
        existing.pc.connectionState !== "closed"
      ) {
        return;
      }
      existing?.close();

      const client = clientRef.current;
      if (!client) return;

      const peer = new HostPeer(
        viewerId,
        (to: string, data: SignalPayload) => client.send({ type: "signal", to, data }),
        (id, state) => setViewerStates((current) => ({ ...current, [id]: state })),
        (id) => {
          // Falhou de vez: descarta a conexão para que um novo pedido a refaça.
          const failed = peersRef.current.get(id);
          if (failed) {
            failed.close();
            peersRef.current.delete(id);
          }
        },
      );
      peersRef.current.set(viewerId, peer);
      try {
        await peer.start(capture.stream);
      } catch {
        peer.close();
        peersRef.current.delete(viewerId);
      }
    };
  }, []);

  /**
   * Alterna a pausa do envio.
   *
   * Só mexe no canal do transmissor de cada conexão: a captura continua viva e
   * a faixa continua anexada, então retomar é instantâneo e não dispara de novo
   * o pedido de permissão da tela. Desligar a faixa (`track.enabled`) faria o
   * navegador enviar quadros pretos, gastando a mesma banda — por isso o que
   * mexemos é o `sender`.
   */
  const alternarPausa = useCallback(() => {
    const proximo = !pausadoRef.current;
    pausadoRef.current = proximo;
    for (const peer of peersRef.current.values()) {
      for (const sender of peer.pc.getSenders()) {
        if (sender.track?.kind === "video") {
          // `replaceTrack(null)` interrompe o envio de verdade sem renegociar
          // SDP, que é o que causaria um novo pedido de permissão em alguns
          // navegadores.
          void sender.replaceTrack(proximo ? null : (captureRef.current?.videoTrack ?? null));
        }
      }
    }
    setPausado(proximo);
    clientRef.current?.send({ type: "sharing", on: !proximo, paused: proximo });
  }, []);

  /** Atalho estável, usado pela interface (botão de parar, lista de viewers). */
  const offerTo = useCallback((viewerId: string) => offerToRef.current(viewerId), []);

  /** Para a captura e anuncia ao servidor que não há mais transmissão. */
  const stopSharing = useCallback(
    (reason?: string) => {
      const hadCapture = captureRef.current !== null;
      closeAllPeers();
      if (captureRef.current) {
        stopStream(captureRef.current.stream);
        captureRef.current = null;
      }
      setLocalPreview(null);
      setHasAudio(false);
      pausadoRef.current = false;
      setPausado(false);
      clientRef.current?.send({ type: "sharing", on: false });
      setPhase((current) => (current === "ao-vivo" || hadCapture ? "parado" : current));
      if (reason) setNotice(reason);
    },
    [closeAllPeers],
  );

  // ---------------------------------------------------------------- conexão
  useEffect(() => {
    const client = new SignalingClient();
    clientRef.current = client;
    const offStatus = client.onStatus(setStatus);

    const offMessage = client.onMessage((message) => {
      switch (message.type) {
        case "created": {
          setCode(message.code);
          setSelfId(message.you.id);
          setPhase("pronto");
          setError(null);
          break;
        }
        case "join-error": {
          setError(
            message.code === "sala-cheia"
              ? "A sala atingiu o limite de espectadores."
              : "Não foi possível criar a sala. Tente novamente.",
          );
          setPhase("erro");
          break;
        }
        case "peer-joined": {
          if (message.role === "viewer") {
            setViewers((current) =>
              current.some((v) => v.id === message.id)
                ? current
                : [...current, { id: message.id, name: message.name, role: "viewer" }],
            );
            // Se já estamos ao vivo, o recém-chegado precisa de oferta agora.
            void offerToRef.current(message.id);
          }
          break;
        }
        case "peer-left": {
          setViewers((current) => current.filter((v) => v.id !== message.id));
          const peer = peersRef.current.get(message.id);
          if (peer) {
            peer.close();
            peersRef.current.delete(message.id);
          }
          setViewerStates((current) => {
            const next = { ...current };
            delete next[message.id];
            return next;
          });
          break;
        }
        case "signal": {
          const peer = peersRef.current.get(message.from);
          if (peer && message.data.description) {
            void peer.acceptAnswer(message.data.description).catch(() => {
              /* resposta inválida: a conexão cai e é refeita no próximo pedido */
            });
          } else if (peer && message.data.candidate) {
            void peer.addCandidate(message.data.candidate);
          }
          break;
        }
        case "stream-requested": {
          // Um espectador pediu de novo (recuperação de conexão).
          void offerToRef.current(message.from);
          break;
        }
        case "viewers": {
          setViewers((current) => {
            const known = new Map(current.map((v) => [v.id, v]));
            return message.viewers.map(
              (v) => known.get(v.id) ?? { id: v.id, name: v.name, role: "viewer" as const },
            );
          });
          break;
        }
        case "chat": {
          setChat((current) => [
            ...current.slice(-49),
            { id: message.id, from: message.from, text: message.text, at: message.at },
          ]);
          break;
        }
        case "error": {
          setError(
            message.code === "limite-de-salas"
              ? "Você criou muitas transmissões em pouco tempo. Aguarde um minuto."
              : "O servidor recusou a operação. Tente novamente.",
          );
          break;
        }
        default:
          break;
      }
    });

    client.connect();
    client.send({ type: "hello", name: nameRef.current, version: 1 });
    client.send({ type: "create", name: nameRef.current });

    return () => {
      offStatus();
      offMessage();
      closeAllPeers();
      if (captureRef.current) {
        stopStream(captureRef.current.stream);
        captureRef.current = null;
      }
      client.send({ type: "leave" });
      client.disconnect();
      clientRef.current = null;
    };
    // Roda uma única vez: a sala é criada na montagem da página. As funções
    // voláteis (offerTo, closeAllPeers) são estáveis de propósito, para não
    // recriar a conexão a cada mudança de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Inicia a captura e passa a atender os espectadores. */
  const startSharing = useCallback(async () => {
    if (captureRef.current) return;
    setError(null);
    setNotice(null);
    try {
      const capture = await captureScreen(options);
      captureRef.current = capture;
      setLocalPreview(capture.stream);
      setHasAudio(capture.hasAudio);
      setPhase("ao-vivo");

      // O navegador tem a própria barra de "parar compartilhamento": quando ela
      // é usada, a faixa termina e nós precisamos reagir como se o usuário
      // tivesse clicado em parar, senão a interface mentiria "ao vivo".
      capture.videoTrack.addEventListener("ended", () => {
        setMotivoParada("navegador");
        stopSharing("O compartilhamento foi encerrado pelo navegador.");
      });

      clientRef.current?.send({ type: "sharing", on: true });
      // A lista vem do ref: o efeito de conexão não é recriado quando alguém
      // entra ou sai, então `viewers` aqui poderia estar desatualizado.
      for (const viewer of viewersRef.current) {
        void offerToRef.current(viewer.id);
      }
    } catch (err) {
      if (err instanceof ScreenCaptureError && err.kind === "cancelado") {
        setNotice("Você cancelou a seleção de tela. Nada foi transmitido.");
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a captura.");
    }
  }, [options, stopSharing]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clientRef.current?.send({ type: "chatsend", text: trimmed });
  }, []);

  const shareUrl = code && typeof window !== "undefined" ? `${window.location.origin}/assistir/${code}` : "";

  return {
    status,
    phase,
    code,
    selfId,
    viewers,
    viewerStates,
    error,
    notice,
    localPreview,
    hasAudio,
    canCapture,
    options,
    setOptions,
    startSharing,
    stopSharing,
    shareUrl,
    chat,
    sendChat,
    /** Pausa/retoma o envio sem derrubar a captura. */
    pausado,
    alternarPausa,
    /** Deixa a tela de "encerrada" explicar quem encerrou. */
    motivoParada,
    dismissError: () => setError(null),
    dismissNotice: () => setNotice(null),
  };
}
