"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SignalingClient, type SignalingStatus } from "./signaling";
import { ViewerPeer, connectionHelp } from "./webrtc";
import type { Participant, SignalPayload } from "./protocol";

export type ViewerPhase =
  | "conectando" // abrindo o WebSocket
  | "aguardando" // na sala, anfitrião ainda não compartilha
  | "recebendo" // vídeo chegando
  | "encerrada" // transmissão terminou
  | "inexistente" // sala não existe
  | "cheia" // sala lotada
  | "erro"; // falha de conexão/mídia

/**
 * Toda a lógica de quem assiste.
 *
 * Recuperação: quando a conexão com o anfitrião falha, pedimos uma nova oferta
 * em vez de mostrar erro de imediato — na maioria dos casos é um blip de rede
 * e a segunda tentativa passa. Só depois de algumas tentativas o erro aparece.
 */
export function useViewer({ code, name }: { code: string; name: string }) {
  const clientRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<ViewerPeer | null>(null);
  const hostIdRef = useRef<string | null>(null);
  const retryRef = useRef(0);

  const [status, setStatus] = useState<SignalingStatus>("offline");
  const [phase, setPhase] = useState<ViewerPhase>("conectando");
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [hostName, setHostName] = useState<string>("Anfitrião");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sharing, setSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setConnectionState(null);
  }, []);

  /** Pede ao anfitrião uma oferta nova (usado na recuperação). */
  const requestStream = useCallback(() => {
    clientRef.current?.send({ type: "requestStream" });
  }, []);

  useEffect(() => {
    const client = new SignalingClient();
    clientRef.current = client;
    const offStatus = client.onStatus(setStatus);

    const offMessage = client.onMessage((message) => {
      switch (message.type) {
        case "joined": {
          hostIdRef.current = message.hostId;
          setSharing(message.sharing);
          setParticipants(message.room?.participants ?? []);
          const host = message.room?.participants.find((p) => p.role === "host");
          if (host) setHostName(host.name);
          // Se o anfitrião já está transmitindo, pedimos a oferta; se não,
          // ficamos em "aguardando" até o evento de sharing chegar.
          if (message.sharing && message.hostId) {
            setPhase("aguardando");
            requestStream();
          } else {
            setPhase("aguardando");
          }
          break;
        }
        case "join-error": {
          closePeer();
          setPhase(message.code === "sala-cheia" ? "cheia" : "inexistente");
          setError(null);
          break;
        }
        case "peer-joined": {
          if (message.role === "host") {
            hostIdRef.current = message.id;
            setHostName(message.name);
          }
          setParticipants((current) =>
            current.some((p) => p.id === message.id)
              ? current
              : [...current, { id: message.id, name: message.name, role: message.role }],
          );
          break;
        }
        case "peer-left": {
          setParticipants((current) => current.filter((p) => p.id !== message.id));
          if (message.id === hostIdRef.current) {
            closePeer();
            setRemote(null);
            setSharing(false);
            setPhase("encerrada");
          }
          break;
        }
        case "host-changed": {
          hostIdRef.current = message.hostId;
          setHostName(message.hostName);
          break;
        }
        case "host-left": {
          closePeer();
          setRemote(null);
          setSharing(false);
          setPhase("encerrada");
          break;
        }
        case "sharing": {
          setSharing(message.on);
          if (message.on) {
            // O anfitrião começou: pede a oferta.
            requestStream();
            setPhase((current) => (current === "encerrada" ? "aguardando" : current));
          } else {
            closePeer();
            setRemote(null);
            setPhase("aguardando");
          }
          break;
        }
        case "no-host": {
          setPhase("encerrada");
          break;
        }
        case "signal": {
          const from = message.from;
          if (!hostIdRef.current) hostIdRef.current = from;
          if (from !== hostIdRef.current) break;

          if (message.data.description) {
            // Nova oferta: substitui qualquer conexão anterior. É assim que a
            // recuperação funciona sem o espectador recarregar a página.
            closePeer();
            const peer = new ViewerPeer(
              from,
              (to: string, data: SignalPayload) => client.send({ type: "signal", to, data }),
              {
                onTrack: (track, stream) => {
                  setRemote(stream);
                  setPhase("recebendo");
                  setError(null);
                  retryRef.current = 0;
                  if (track.kind === "video") {
                    track.addEventListener("ended", () => {
                      setPhase("encerrada");
                    });
                  }
                },
                onStateChange: (state) => {
                  setConnectionState(state);
                  if (state === "connected") {
                    retryRef.current = 0;
                    setError(null);
                  }
                  if (state === "failed" || state === "disconnected") {
                    // Uma tentativa automática antes de desistir.
                    if (retryRef.current < 3) {
                      retryRef.current += 1;
                      setAttempt((n) => n + 1);
                      setTimeout(() => requestStream(), 800 * retryRef.current);
                    } else {
                      setError(connectionHelp());
                      setPhase("erro");
                    }
                  }
                },
                onFailure: () => {
                  if (retryRef.current < 3) {
                    retryRef.current += 1;
                    setAttempt((n) => n + 1);
                    setTimeout(() => requestStream(), 800 * retryRef.current);
                  } else {
                    setError(connectionHelp());
                    setPhase("erro");
                  }
                },
              },
            );
            peerRef.current = peer;
            void peer.acceptOffer(message.data.description).catch(() => {
              setError("Não foi possível responder ao anfitrião.");
            });
          } else if (message.data.candidate && peerRef.current) {
            void peerRef.current.addCandidate(message.data.candidate);
          }
          break;
        }
        case "server-shutdown": {
          setError("O servidor está reiniciando. Recarregue a página em instantes.");
          setPhase("erro");
          break;
        }
        default:
          break;
      }
    });

    client.connect();
    client.send({ type: "hello", name: nameRef.current, version: 1 });
    client.send({ type: "join", code, name: nameRef.current });

    return () => {
      offStatus();
      offMessage();
      closePeer();
      client.send({ type: "leave" });
      client.disconnect();
      clientRef.current = null;
    };
  }, [code, closePeer, requestStream]);

  /** Nova tentativa manual, oferecida na tela de erro. */
  const retry = useCallback(() => {
    retryRef.current = 0;
    setError(null);
    setPhase("aguardando");
    setAttempt((n) => n + 1);
    requestStream();
  }, [requestStream]);

  return {
    status,
    phase,
    error,
    remote,
    hostName,
    participants,
    sharing,
    connectionState,
    attempt,
    retry,
  };
}
