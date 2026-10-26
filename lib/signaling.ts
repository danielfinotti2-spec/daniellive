/**
 * Cliente do servidor de sinalização.
 *
 * Responsabilidades: manter o WebSocket de pé (com reconexão e espera
 * progressiva), reenviar a entrada na sala depois de uma reconexão e entregar
 * as mensagens já tipadas para quem assinou.
 *
 * Não sabe nada de WebRTC — quem cuida das conexões de mídia é lib/webrtc.ts.
 * Essa separação é o que permite testar a sinalização sem navegador.
 */

import type { ClientMessage, ServerMessage } from "./protocol";

export type SignalingStatus = "conectando" | "conectado" | "reconectando" | "offline";

type Listener = (message: ServerMessage) => void;
type StatusListener = (status: SignalingStatus) => void;

/** De onde vem o WebSocket: variável de ambiente ou a própria origem. */
export function signalingUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SIGNAL_URL?.trim();
  if (explicit) return explicit;

  if (typeof window === "undefined") return "ws://localhost:8787";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  // Em desenvolvimento o Next roda na 3000 e a sinalização na 8787; com o
  // site atrás de um proxy que encaminha /ws, o mesmo host serve os dois.
  const port = process.env.NEXT_PUBLIC_SIGNAL_PORT?.trim();
  if (port) return `${proto}//${host}:${port}`;
  return `${proto}//${host}:8787`;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private status: SignalingStatus = "offline";
  /** Última entrada pedida, para repetir após reconectar. */
  private lastJoin: { code: string; name?: string } | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  private queue: ClientMessage[] = [];

  connect(): void {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    this.setStatus(this.reconnectAttempt === 0 ? "conectando" : "reconectando");

    const ws = new WebSocket(signalingUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("conectado");
      // A fila existe para o caso de o usuário clicar em "criar" antes de o
      // socket abrir: essas mensagens são enviadas agora, na ordem original.
      const pending = this.queue;
      this.queue = [];
      for (const message of pending) this.send(message);
      // `join` não entra na fila justamente para não ser enviado duas vezes:
      // ele é reenviado aqui, a partir de lastJoin, tanto na primeira conexão
      // quanto depois de uma reconexão.
      if (this.lastJoin) {
        this.ws?.send(JSON.stringify({ type: "join", ...this.lastJoin }));
      }
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 25_000);
    };

    ws.onmessage = (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      for (const listener of this.listeners) listener(parsed);
    };

    ws.onclose = () => {
      this.stopPing();
      if (this.closedByUser) {
        this.setStatus("offline");
        return;
      }
      // Espera progressiva com teto: 0,5s → 1s → 2s → 4s → 5s (máximo).
      this.reconnectAttempt += 1;
      const delay = Math.min(500 * 2 ** (this.reconnectAttempt - 1), 5000);
      this.setStatus("reconectando");
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => {
      // O onclose cuida da reconexão; aqui só evitamos que o erro suba.
    };
  }

  /** Encerra de vez (o usuário saiu): não reconecta. */
  disconnect(): void {
    this.closedByUser = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.lastJoin = null;
    this.queue = [];
    this.ws?.close(1000, "client closing");
    this.ws = null;
    this.setStatus("offline");
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(message: ClientMessage): void {
    // `join` é guardado à parte, em lastJoin, porque precisa ser reenviado a
    // cada reconexão. Ele NÃO entra na fila: o onopen já o reenvia a partir de
    // lastJoin, e enfileirá-lo também faria a mensagem sair duas vezes.
    if (message.type === "join") {
      this.lastJoin = { code: message.code, name: message.name };
    }
    if (message.type === "leave") this.lastJoin = null;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Mensagens de estado (create/hello) são lembradas; as efêmeras (signal)
      // seriam inúteis depois da reconexão e são descartadas.
      if (message.type === "create" || message.type === "hello") {
        this.queue.push(message);
      }
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  get currentStatus(): SignalingStatus {
    return this.status;
  }

  private setStatus(status: SignalingStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
