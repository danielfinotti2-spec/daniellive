/**
 * Captura de tela e conexões WebRTC.
 *
 * Arquitetura: mesh com o anfitrião como única origem. Cada espectador tem uma
 * RTCPeerConnection própria com o anfitrião, que é quem cria a oferta. Não há
 * negociação entre espectadores — ninguém além do anfitrião envia mídia.
 *
 * Regras que o código garante:
 *  - a captura só começa dentro de um gesto do usuário (getDisplayMedia exige),
 *  - quando o navegador encerra o compartilhamento pela barra dele, `onended`
 *    derruba tudo e o estado volta para "parado" (não fica mentindo "ao vivo"),
 *  - toda faixa e toda conexão são fechadas em stop(), inclusive em erro.
 */

import { iceConfig, hasTurn } from "./ice";
import type { SignalPayload } from "./protocol";
import type { Dicionario } from "./idioma";

export type CaptureOptions = {
  /** Áudio da aba/sistema quando o navegador oferecer. */
  withAudio: boolean;
  /** Qualidade alvo da captura. */
  quality: "auto" | "1080p" | "720p" | "480p";
};

export type LocalCapture = {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  audioTrack: MediaStreamTrack | null;
  hasAudio: boolean;
  label: string;
};

const QUALITY_CONSTRAINTS: Record<CaptureOptions["quality"], MediaTrackConstraints> = {
  auto: {},
  "1080p": { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  "720p": { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  "480p": { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
};

export class ScreenCaptureError extends Error {
  constructor(
    message: string,
    readonly kind: "cancelado" | "sem-suporte" | "sem-permissao" | "desconhecido",
  ) {
    super(message);
    this.name = "ScreenCaptureError";
  }
}

/**
 * Diz se este navegador sabe capturar a tela.
 *
 * É uma pergunta sobre o ambiente, não sobre o React: o servidor não tem
 * `navigator.mediaDevices`, então ele responde `false` e o navegador responde
 * a verdade. Para uso durante a renderização, prefira `useSuporteCaptura`, que
 * resolve essa diferença sem quebrar a hidratação.
 */
export function supportsDisplayCapture(): boolean {
  if (typeof navigator === "undefined") return false;
  const md = navigator.mediaDevices;
  return Boolean(md && typeof md.getDisplayMedia === "function");
}

/**
 * Pede a tela ao usuário. Traduz cada falha conhecida para uma mensagem útil:
 * "você cancelou" e "seu navegador não suporta" exigem reações diferentes.
 */
export async function captureScreen(options: CaptureOptions): Promise<LocalCapture> {
  if (!supportsDisplayCapture()) {
    throw new ScreenCaptureError(
      "Este navegador não permite compartilhar a tela. Use Chrome, Edge, Firefox ou Safari atualizados.",
      "sem-suporte",
    );
  }

  const video: MediaTrackConstraints = {
    ...QUALITY_CONSTRAINTS[options.quality],
    // `displaySurface` é uma dica: o navegador pode ignorar e mostrar todas as
    // opções, que é o comportamento desejado de qualquer forma.
    displaySurface: "monitor",
  } as MediaTrackConstraints;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video,
      audio: options.withAudio
        ? {
            // O áudio do sistema só existe no Chrome/Edge (captura de aba ou
            // de tela inteira). Onde não existe, o navegador simplesmente
            // ignora e a captura segue só com vídeo.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: true,
          }
        : false,
      // Sem isso o Chrome não oferece "compartilhar esta aba" com áudio.
      ...(options.withAudio ? { systemAudio: "include" } : {}),
    } as DisplayMediaStreamOptions);
  } catch (err) {
    const name = (err as DOMException)?.name ?? "";
    if (name === "NotAllowedError") {
      throw new ScreenCaptureError("Compartilhamento cancelado ou não autorizado.", "cancelado");
    }
    if (name === "NotFoundError") {
      throw new ScreenCaptureError("Nenhuma tela disponível para compartilhar.", "desconhecido");
    }
    if (name === "NotSupportedError") {
      throw new ScreenCaptureError(
        "Seu navegador não suporta essa forma de captura.",
        "sem-suporte",
      );
    }
    throw new ScreenCaptureError(
      "Não foi possível iniciar a captura de tela. Tente novamente.",
      "desconhecido",
    );
  }

  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    stream.getTracks().forEach((t) => t.stop());
    throw new ScreenCaptureError("A captura não retornou vídeo.", "desconhecido");
  }

  const audioTrack = stream.getAudioTracks()[0] ?? null;

  return {
    stream,
    videoTrack,
    audioTrack,
    hasAudio: audioTrack !== null,
    label: videoTrack.label || "Tela compartilhada",
  };
}

/** Encerra todas as faixas de um stream. */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* faixa já encerrada */
    }
  }
}

/**
 * Uma conexão do anfitrião com um espectador.
 *
 * O anfitrião sempre cria a oferta (`createOffer`). O espectador responde.
 * Candidatos ICE são enviados conforme aparecem — não esperamos a coleta
 * terminar, o que reduz o tempo até o primeiro quadro.
 */
export class HostPeer {
  readonly pc: RTCPeerConnection;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private closed = false;

  constructor(
    readonly viewerId: string,
    private readonly send: (to: string, data: SignalPayload) => void,
    private readonly onStateChange: (viewerId: string, state: RTCPeerConnectionState) => void,
    private readonly onFailure: (viewerId: string) => void,
  ) {
    this.pc = new RTCPeerConnection(iceConfig());

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send(this.viewerId, { candidate: event.candidate.toJSON() });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.onStateChange(this.viewerId, state);
      if (state === "failed") this.onFailure(this.viewerId);
    };

    // `oniceconnectionstatechange` é o que costuma disparar primeiro quando a
    // rede não permite a conexão direta (e não há TURN).
    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === "failed") this.onFailure(this.viewerId);
    };
  }

  /** Anexa as faixas e cria a oferta. */
  async start(stream: MediaStream): Promise<void> {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.send(this.viewerId, { description: this.pc.localDescription!.toJSON() });
  }

  /** Aplica a resposta do espectador, liberando os candidatos que chegaram antes. */
  async acceptAnswer(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    if (this.pc.signalingState === "closed") return;
    await this.pc.setRemoteDescription(description);
    this.remoteSet = true;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        /* candidato tardio ou inválido: ignorar é seguro */
      }
    }
  }

  async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.closed) return;
    // Candidato antes da descrição remota é o caso comum (o ICE começa assim
    // que a oferta é criada): guardar evita o NotSupportedError do navegador.
    if (!this.remoteSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* ignorado: candidato de uma tentativa anterior */
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingCandidates = [];
    this.pc.onicecandidate = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    try {
      this.pc.close();
    } catch {
      /* já fechada */
    }
  }
}

/**
 * O lado do espectador: uma única conexão com o anfitrião.
 *
 * Aqui não criamos oferta — só respondemos. O vídeo que chega é entregue por
 * `ontrack`, o que também cobre o caso de a trilha ser substituída no meio da
 * transmissão.
 */
export class ViewerPeer {
  readonly pc: RTCPeerConnection;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private closed = false;

  constructor(
    private readonly hostId: string,
    private readonly send: (to: string, data: SignalPayload) => void,
    private readonly handlers: {
      onTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
      onStateChange: (state: RTCPeerConnectionState) => void;
      onFailure: () => void;
    },
  ) {
    this.pc = new RTCPeerConnection(iceConfig());

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send(this.hostId, { candidate: event.candidate.toJSON() });
      }
    };

    this.pc.ontrack = (event) => {
      this.handlers.onTrack(event.track, event.streams[0] ?? new MediaStream([event.track]));
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.handlers.onStateChange(state);
      if (state === "failed") this.handlers.onFailure();
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === "failed") this.handlers.onFailure();
    };
  }

  async acceptOffer(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    await this.pc.setRemoteDescription(description);
    this.remoteSet = true;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        /* ignorado */
      }
    }
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.send(this.hostId, { description: this.pc.localDescription!.toJSON() });
  }

  async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.closed) return;
    if (!this.remoteSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* ignorado */
    }
  }

  /** Reinicia a conexão preservando o papel de espectador (recuperação). */
  async restartIce(hint: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) return;
    await this.pc.setRemoteDescription(hint);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.send(this.hostId, { description: this.pc.localDescription!.toJSON() });
  }

  /** Já foi encerrado: uma oferta nova precisa de uma conexão nova. */
  get fechado(): boolean {
    return this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingCandidates = [];
    this.pc.ontrack = null;
    this.pc.onicecandidate = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    try {
      this.pc.close();
    } catch {
      /* já fechada */
    }
  }
}

/**
 * Texto de diagnóstico para quando a conexão não fecha.
 *
 * Recebe o dicionário em vez de ler o idioma de um contexto: esta é uma função
 * pura, chamada de dentro de um tratador de evento — não de um componente — e
 * um hook aqui não funcionaria. O texto vem de quem chama, que já tem o
 * dicionário em mãos.
 *
 * A escolha entre as duas mensagens continua sendo técnica (há TURN
 * configurado ou não), e por isso mora aqui, não no dicionário: quem traduz não
 * tem como saber qual das duas se aplica.
 */
export function connectionHelp(t: Dicionario): string {
  return hasTurn() ? t.erro.conexaoComTurn : t.erro.conexaoSemTurn;
}
