"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SignalingClient, type SignalingStatus } from "./signaling";
import { ViewerPeer, connectionHelp } from "./webrtc";
import type { Participant, SignalPayload, ChatMessage } from "./protocol";
import { useTexto, useIdioma, dicionario } from "./idioma";

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

  /*
   * O idioma numa ref, atualizado por um efeito.
   *
   * As mensagens de erro nascem em callbacks de eventos do WebSocket, que são
   * registrados uma vez e continuam valendo depois. Se elas fechassem sobre o
   * dicionário do primeiro render, trocar de idioma no meio de uma conexão
   * faria o erro seguinte sair no idioma antigo — e o efeito que abre a conexão
   * depende de uma lista fixa de dependências, então o callback nem seria
   * recriado.
   *
   * A escrita fica num efeito, e não no corpo do render: escrever numa ref
   * durante a renderização é impuro (o React pode descartar o render e a
   * escrita valeria para um estado que nunca chegou à tela). O efeito roda
   * depois de cada render em que o idioma muda, que é exatamente quando a ref
   * precisa acompanhar.
   */
  const idioma = useIdioma();
  const idiomaRef = useRef(idioma);
  useEffect(() => {
    idiomaRef.current = idioma;
  }, [idioma]);

  const [status, setStatus] = useState<SignalingStatus>("offline");
  const [phase, setPhase] = useState<ViewerPhase>("conectando");
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [hostName, setHostName] = useState<string>("Anfitrião");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sharing, setSharing] = useState(false);
  /** O anfitrião pausou: a transmissão continua, mas não chegam quadros novos. */
  const [paused, setPaused] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** A conversa da sala, na ordem oficial do servidor (historico + ao vivo). */
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  /** O id desta conexão, devolvido pelo servidor na entrada. */
  const [selfId, setSelfId] = useState<string | null>(null);

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
          setMensagens(message.chat ?? []);
          setSelfId(message.you?.id ?? null);
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
            setPaused(false);
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
          setPaused(message.on && message.paused === true);
          if (message.on) {
            // O anfitrião começou: pede a oferta. Uma pausa não precisa de
            // oferta nova — a conexão continua de pé, só sem quadros novos.
            requestStream();
            setPhase((current) => (current === "encerrada" ? "aguardando" : current));
          } else {
            closePeer();
            setRemote(null);
            setPaused(false);
            setPhase("aguardando");
          }
          break;
        }
        case "no-host": {
          setPhase("encerrada");
          break;
        }
        case "chat": {
          setMensagens((atual) => [...atual, message.msg]);
          break;
        }
        case "signal": {
          const from = message.from;
          if (!hostIdRef.current) hostIdRef.current = from;
          if (from !== hostIdRef.current) break;

          if (message.data.description) {
            // O anfitrião manda oferta tanto para abrir a transmissão quanto
            // para retomar de uma pausa. Reaproveitar a conexão viva é o que
            // permite retomar sem derrubar o caminho já estabelecido — refazer a
            // conexão do zero custaria uma nova rodada de ICE e deixaria a faixa
            // de vídeo muda por tempo indeterminado.
            const oferta = message.data.description;
            const atual = peerRef.current;
            const podeReusar =
              atual !== null && atual.pc.signalingState === "stable" && !atual.fechado;

            if (!podeReusar) {
              closePeer();
              peerRef.current = new ViewerPeer(
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
                        setError(connectionHelp(dicionario(idiomaRef.current)));
                        setPhase("erro");
                      }
                    }
                  },
                  onFailure: () => {
                    closePeer();
                  },
                },
              );
            }
            void peerRef.current?.acceptOffer(oferta).catch(() => {
              setError(dicionario(idiomaRef.current).erro.naoRespondeuAoAnfitriao);
            });
          } else if (message.data.candidate && peerRef.current) {
            void peerRef.current.addCandidate(message.data.candidate);
          }
          break;
        }
        case "server-shutdown": {
          setError(dicionario(idiomaRef.current).erro.servidorReiniciando);
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

  /** Manda uma linha para o chat da sala. */
  const enviarChat = useCallback((texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    clientRef.current?.send({ type: "chat", texto: limpo });
  }, []);

  return {
    status,
    phase,
    error,
    remote,
    hostName,
    participants,
    sharing,
    /** O anfitrião pausou: mostrar "pausado" em vez de parecer travado. */
    paused,
    connectionState,
    attempt,
    retry,
    mensagens,
    selfId,
    enviarChat,
  };
}
