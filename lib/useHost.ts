"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignalingClient, type SignalingStatus } from "./signaling";
import {
  captureScreen,
  stopStream,
  HostPeer,
  ScreenCaptureError,
  supportsDisplayCapture,
  aplicarQualidadeAoVivo,
  type CaptureOptions,
  type LocalCapture,
} from "./webrtc";
import type { Participant, SignalPayload } from "./protocol";
import { useIdioma, dicionario } from "./idioma";

export type HostPhase = "criando" | "pronto" | "ao-vivo" | "parado" | "erro";

/** Por que a transmissão foi encerrada — muda o que a interface diz. */
export type MotivoParada = "usuario" | "navegador" | null;

/**
 * Liga ou desliga o envio de vídeo de uma conexão sem desanexar a faixa.
 *
 * A pausa usa `RTCRtpSender.setParameters` com `encoding.active`, e não
 * `replaceTrack(null)`: desanexar a faixa descarta o estado do codificador e o
 * decodificador do outro lado passa a esperar por um quadro-chave que nunca
 * chega — na prática, a imagem congela para sempre ao retomar. Com `active`, o
 * envio para e volta de onde estava, e a banda cai a quase zero enquanto isso.
 *
 * A faixa continua anexada de propósito: é o que permite retomar sem
 * renegociar a conexão.
 */
function aplicarPausa(peer: HostPeer, pausado: boolean): void {
  for (const sender of peer.pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        // Alguns navegadores só expõem `encodings` depois de haver tráfego.
        params.encodings = [{}];
      }
      for (const encoding of params.encodings) {
        encoding.active = !pausado;
      }
      void sender.setParameters(params).catch(() => {
        /* parâmetro recusado: a pausa continua valendo na interface */
      });
    } catch {
      /* `getParameters` indisponível: nada a fazer além de seguir */
    }
  }
}

/**
 * Aplica a pausa a uma conexão recém-criada.
 *
 * Necessário porque `peer.start()` anexa a faixa já ativa: ao entrar alguém
 * enquanto a transmissão está pausada, a conexão nova começaria enviando vídeo,
 * contrariando o estado que vale para a transmissão inteira.
 */
function aplicarPausaAoSender(peer: HostPeer): void {
  aplicarPausa(peer, true);
}

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

  /*
   * O idioma numa ref, atualizado por um efeito.
   *
   * As mensagens nascem em callbacks de eventos do WebSocket e no `onended` da
   * captura — todos registrados uma vez e vivos depois. Fechar sobre o
   * dicionário do primeiro render faria a próxima mensagem sair no idioma
   * antigo depois de uma troca.
   *
   * A escrita fica num efeito, e não no corpo do render: escrever numa ref
   * durante a renderização é impuro, e o lint do projeto recusa — com razão.
   */
  const idioma = useIdioma();
  const idiomaRef = useRef(idioma);
  useEffect(() => {
    idiomaRef.current = idioma;
  }, [idioma]);

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

  /**
   * Trocar de qualidade durante a transmissão passa a valer na hora.
   *
   * Antes só capturas novas pegavam o degrau: quem mudava a qualidade ao vivo
   * via a confirmação da escolha, mas nada acontecia na rede — o que dava a
   * impressão certa de que a opção "não funcionava". O efeito aplica o degrau
   * à captura e aos transmissores existentes; na próxima captura ele já vem
   * por `captureScreen` de qualquer forma.
   */
  useEffect(() => {
    const capture = captureRef.current;
    if (!capture || phase !== "ao-vivo") return;
    aplicarQualidadeAoVivo(capture, [...peersRef.current.values()], options.quality);
  }, [options.quality, phase]);

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
        // Se a transmissão já estava pausada quando este espectador entrou, a
        // conexão recém-criada nasceria enviando vídeo — e a pausa, que vale
        // para a transmissão inteira, seria furada justamente para quem chegou
        // depois. Reaplicar aqui mantém o estado coerente para todos.
        if (pausadoRef.current) aplicarPausaAoSender(peer);
      } catch {
        peer.close();
        peersRef.current.delete(viewerId);
      }
    };
  }, []);

  /**
   * Alterna a pausa do envio.
   *
   * A faixa **continua anexada** ao transmissor; o que muda é o parâmetro
   * `active` da codificação. Essa distinção é o que faz a pausa ser reversível:
   * remover a faixa (`replaceTrack(null)`) descarta o estado do codificador, e
   * ao devolvê-la o decodificador do outro lado espera por um quadro-chave que
   * não chega — a imagem fica congelada para sempre, mesmo com a conexão de pé.
   *
   * Desligar a faixa (`track.enabled`) também não serve: o navegador continuaria
   * enviando quadros, agora pretos, gastando a mesma banda. `active = false`
   * interrompe a codificação de verdade, sem mexer no SDP.
   */
  const alternarPausa = useCallback(() => {
    const proximo = !pausadoRef.current;
    pausadoRef.current = proximo;

    for (const peer of peersRef.current.values()) {
      aplicarPausa(peer, proximo);
    }

    // `on` continua true: pausar não encerra a transmissão. Mandar `on: false`
    // aqui faria o servidor e os espectadores entenderem que tudo acabou, e
    // retomar viraria um "começar de novo" — que é justamente o que a pausa
    // existe para evitar.
    clientRef.current?.send({ type: "sharing", on: true, paused: proximo });
    setPausado(proximo);
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
              ? dicionario(idiomaRef.current).erro.salaCheia
              : dicionario(idiomaRef.current).erro.salaNaoCriada,
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
        case "error": {
          const erro = dicionario(idiomaRef.current).erro;
          setError(message.code === "limite-de-salas" ? erro.muitasSalas : erro.operacaoRecusada);
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
      // Texto de tela compartilhada fica nítido com a dica de conteúdo certa:
      // sem ela, alguns navegadores otimizam para movimento e borram as letras.
      capture.videoTrack.contentHint = "detail";
      setLocalPreview(capture.stream);
      setHasAudio(capture.hasAudio);
      setPhase("ao-vivo");

      // O navegador tem a própria barra de "parar compartilhamento": quando ela
      // é usada, a faixa termina e nós precisamos reagir como se o usuário
      // tivesse clicado em parar, senão a interface mentiria "ao vivo".
      capture.videoTrack.addEventListener("ended", () => {
        setMotivoParada("navegador");
        stopSharing(dicionario(idiomaRef.current).erro.paradaPeloNavegador);
      });

      clientRef.current?.send({ type: "sharing", on: true });
      // A lista vem do ref: o efeito de conexão não é recriado quando alguém
      // entra ou sai, então `viewers` aqui poderia estar desatualizado.
      for (const viewer of viewersRef.current) {
        void offerToRef.current(viewer.id);
      }
    } catch (err) {
      if (err instanceof ScreenCaptureError && err.kind === "cancelado") {
        setNotice(dicionario(idiomaRef.current).erro.capturaCancelada);
        return;
      }
      setError(
        err instanceof Error ? err.message : dicionario(idiomaRef.current).erro.capturaNaoIniciada,
      );
    }
  }, [options, stopSharing]);

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
    /** Pausa/retoma o envio sem derrubar a captura. */
    pausado,
    alternarPausa,
    /** Deixa a tela de "encerrada" explicar quem encerrou. */
    motivoParada,
    dismissError: () => setError(null),
    dismissNotice: () => setNotice(null),
  };
}
