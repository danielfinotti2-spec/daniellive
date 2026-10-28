/**
 * Tipos do protocolo, compartilhados entre servidor e cliente.
 * Ficam em um único arquivo para que uma mudança de campo quebre a compilação
 * dos dois lados em vez de falhar silenciosamente em tempo de execução.
 */

export type Role = "host" | "viewer";

export type Participant = {
  id: string;
  name: string;
  role: Role;
  isSharing?: boolean;
};

export type RoomSnapshot = {
  code: string;
  sharing: boolean;
  hostId: string | null;
  hostName: string;
  hasHost: boolean;
  participants: Participant[];
};

/** Mensagens que o cliente envia. */
export type ClientMessage =
  | { type: "hello"; name?: string; version?: number }
  | { type: "create"; name?: string }
  | { type: "join"; code: string; name?: string }
  | { type: "leave" }
  | { type: "sharing"; on: boolean; paused?: boolean }
  | { type: "signal"; to: string; data: SignalPayload }
  | { type: "requestStream" }
  | { type: "chat"; texto: string }
  | { type: "ping" };

/** Uma mensagem do chat da sala (autor é a sala, não o corpo enviado). */
export type ChatMessage = {
  /** Sequencial da sala: a ordem oficial da conversa. */
  id: number;
  /** Nome do autor segundo a sala. */
  de: string;
  /** Id da conexão do autor — o cliente usa para marcar "você". */
  deId: string;
  texto: string;
  /** Relógio do servidor (epoch ms). */
  quando: number;
};

/** Sinal WebRTC: ou uma descrição de sessão, ou um candidato ICE. */
export type SignalPayload = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

/** Mensagens que o servidor envia. */
export type ServerMessage =
  | { type: "welcome"; id: string; version: number; limits: { maxViewersPerRoom: number } }
  | { type: "hello-ok"; id: string }
  | { type: "created"; code: string; you: Participant; room: RoomSnapshot }
  | {
      type: "joined";
      code: string;
      you: Participant;
      room: RoomSnapshot;
      hostId: string | null;
      sharing: boolean;
      /** A conversa que já rolava: chega junto com a entrada. */
      chat: ChatMessage[];
    }
  | { type: "join-error"; code: string; room: string }
  | { type: "chat"; msg: ChatMessage }
  | { type: "peer-joined"; id: string; name: string; role: Role }
  | { type: "peer-left"; id: string; name: string; timeout?: boolean }
  | { type: "host-changed"; hostId: string; hostName: string }
  | { type: "host-left"; code: string }
  | { type: "sharing"; id: string; on: boolean; paused?: boolean }
  | { type: "sharing-ok"; on: boolean; paused?: boolean }
  | { type: "viewers"; viewers: { id: string; name: string }[] }
  | { type: "stream-requested"; from: string; name: string }
  | { type: "signal"; from: string; data: SignalPayload }
  | { type: "no-host"; code: string }
  | { type: "error"; code: string }
  | { type: "pong"; t: number }
  | { type: "server-shutdown" };

/** Tradução dos códigos de erro do servidor para o português da interface. */
export const ERROR_TEXT: Record<string, string> = {
  "sala-nao-encontrada": "Essa transmissão não existe ou já foi encerrada.",
  "sala-cheia": "A sala está cheia. Tente novamente mais tarde.",
  "sem-permissao": "Apenas o anfitrião pode iniciar a transmissão.",
  "destino-invalido": "O outro participante não está mais na sala.",
  "limite-de-salas": "Você criou muitas transmissões em pouco tempo. Aguarde um minuto.",
  "muitas-mensagens": "Muitas mensagens em sequência. Aguarde um instante.",
  "mensagem-invalida": "Houve um problema de comunicação com o servidor.",
};

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? "Algo deu errado. Tente novamente.";
}
