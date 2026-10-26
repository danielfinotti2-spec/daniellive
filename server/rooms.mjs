/**
 * Gerenciamento de salas em memória.
 *
 * Módulo puro: não conhece WebSocket, não conhece HTTP, não escreve em disco.
 * Toda a regra de negócio de sala (quem é o anfitrião, quem está compartilhando,
 * quando uma sala está abandonada) vive aqui, o que torna o comportamento
 * verificável em teste sem subir servidor.
 *
 * Escolha de armazenamento: um Map em memória. O estado de uma transmissão ao
 * vivo é intrinsecamente efêmero — se o processo reinicia, as conexões WebRTC
 * já morreram junto, então persistir sala em banco só criaria registros órfãos.
 * A limitação (uma instância, estado volátil) está documentada no README.
 */

import { randomBytes } from "node:crypto";

/** Sem 0/O/1/I/L: o código é lido em voz alta e digitado à mão. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 9; // ~31^9 ≈ 2.6e13 combinações

/**
 * Gera o identificador público da sala.
 *
 * Feito com randomBytes do CSPRNG e não com Math.random: o link É a credencial
 * de acesso (quem tem o link assiste), então o identificador precisa ser
 * imprevisível. Ver a seção de segurança do README.
 */
export function generateRoomCode(random = randomBytes) {
  const bytes = random(CODE_LENGTH * 2);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    // Lê dois bytes por caractere e descarta o excedente que enviesaria o
    // módulo (rejection sampling): 256 % 31 != 0, então um único byte daria
    // mais peso às primeiras letras do alfabeto.
    let value = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    value %= CODE_ALPHABET.length;
    out += CODE_ALPHABET[value];
  }
  return out;
}

/** Aceita só o formato que nós mesmos emitimos. */
export function isValidRoomCode(code) {
  if (typeof code !== "string") return false;
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Quantidade máxima de espectadores simultâneos por sala (limite de uso). */
export const MAX_VIEWERS_PER_ROOM = 32;
/** Salas expiram depois deste tempo sem ninguém conectado. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
/** Sem batimento por este tempo, a conexão é considerada morta. */
export const HEARTBEAT_TIMEOUT_MS = 45 * 1000;

export class RoomRegistry {
  constructor({ ttlMs = ROOM_TTL_MS, maxViewers = MAX_VIEWERS_PER_ROOM, now = Date.now } = {}) {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
    this.ttlMs = ttlMs;
    this.maxViewers = maxViewers;
    this.now = now;
  }

  /**
   * Cria a sala e devolve o registro. O código só é escolhido depois de
   * confirmar que não colide com uma sala existente — com 2.6e13 combinações
   * uma colisão é improvável, mas "improvável" não é "impossível" e o laço
   * custa nada.
   */
  create({ hostName = "Anfitrião" } = {}) {
    let code = generateRoomCode();
    let guard = 0;
    while (this.rooms.has(code)) {
      code = generateRoomCode();
      if ((guard += 1) > 10) throw new Error("não foi possível alocar um código de sala");
    }
    const room = {
      code,
      createdAt: this.now(),
      hostId: null,
      hostName,
      sharing: false,
      // participante -> { id, name, role, isSharing, joinedAt, lastSeen }
      participants: new Map(),
      emptySince: this.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    if (typeof code !== "string") return null;
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  has(code) {
    return this.get(code) !== null;
  }

  /**
   * Registra um participante na sala.
   *
   * O primeiro a entrar vira anfitrião. Quem chega depois entra como
   * espectador, a menos que use a chave de anfitrião devolvida na criação —
   * é assim que o mesmo link serve para quem apresenta e para quem assiste.
   */
  join(code, { id, name, asHost = false } = {}) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "sala-nao-encontrada" };

    const existing = room.participants.get(id);
    if (existing) {
      existing.lastSeen = this.now();
      existing.name = name ?? existing.name;
      return { ok: true, room, participant: existing, rejoined: true };
    }

    const isFirst = room.participants.size === 0;
    const becomesHost = isFirst || asHost || room.hostId === null;
    if (becomesHost) {
      room.hostId = id;
      room.hostName = name ?? room.hostName;
    } else if (room.participants.size - 1 >= this.maxViewers) {
      // size inclui o anfitrião, que não conta no teto de espectadores.
      return { ok: false, error: "sala-cheia" };
    }

    const participant = {
      id,
      name: name || (becomesHost ? "Anfitrião" : "Espectador"),
      role: becomesHost ? "host" : "viewer",
      isSharing: false,
      joinedAt: this.now(),
      lastSeen: this.now(),
    };
    room.participants.set(id, participant);
    room.emptySince = null;

    // O anfitrião pode já estar compartilhando quando alguém entra (recarga de
    // página do espectador, por exemplo): o estado vai no resultado para o
    // chamador repassar sem precisar de uma segunda consulta.
    return { ok: true, room, participant, rejoined: false };
  }

  /**
   * Remove um participante. Se era o anfitrião, a sala fica marcada como sem
   * anfitrião e o compartilhamento para — quem apresentava foi embora, então
   * continuar anunciando "ao vivo" seria mentira para os espectadores.
   */
  leave(code, id) {
    const room = this.get(code);
    if (!room) return null;
    const participant = room.participants.get(id);
    if (!participant) return null;
    room.participants.delete(id);

    let hostLeft = false;
    if (room.hostId === id) {
      hostLeft = true;
      room.hostId = null;
      room.sharing = false;
      // Promove o próximo da fila: uma plateia que ficou sem anfitrião não
      // precisa de um novo, mas manter hostId nulo faz o próximo que entrar
      // assumir naturalmente (ver join()).
    }
    if (room.participants.size === 0) room.emptySince = this.now();
    return { room, participant, hostLeft };
  }

  setSharing(code, id, sharing) {
    const room = this.get(code);
    if (!room) return { ok: false, error: "sala-nao-encontrada" };
    const participant = room.participants.get(id);
    if (!participant) return { ok: false, error: "nao-participante" };
    if (sharing && room.hostId !== id) return { ok: false, error: "sem-permissao" };
    participant.isSharing = Boolean(sharing);
    room.sharing = Boolean(sharing);
    return { ok: true, room };
  }

  /** Espectadores que devem receber a oferta WebRTC do anfitrião. */
  viewers(code, exceptId = null) {
    const room = this.get(code);
    if (!room) return [];
    return [...room.participants.values()].filter(
      (p) => p.id !== exceptId && p.role !== "host",
    );
  }

  touch(code, id) {
    const room = this.get(code);
    if (!room) return false;
    const participant = room.participants.get(id);
    if (!participant) return false;
    participant.lastSeen = this.now();
    return true;
  }

  /** Retrato serializável da sala — nunca inclui nada que o cliente não deva ver. */
  snapshot(code) {
    const room = this.get(code);
    if (!room) return null;
    return {
      code: room.code,
      sharing: room.sharing,
      hostId: room.hostId,
      hostName: room.hostName,
      hasHost: room.hostId !== null,
      participants: [...room.participants.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isSharing: p.isSharing,
      })),
    };
  }

  /**
   * Remove salas abandonadas e participantes que pararam de responder.
   * Devolve o que mudou para o chamador avisar quem ficou.
   */
  sweep() {
    const now = this.now();
    const removedRooms = [];
    const dropped = [];

    for (const room of this.rooms.values()) {
      for (const [id, p] of room.participants) {
        if (now - p.lastSeen > HEARTBEAT_TIMEOUT_MS) {
          dropped.push({ code: room.code, id, name: p.name });
          this.leave(room.code, id);
        }
      }
      const empty = room.participants.size === 0;
      const expired = empty && room.emptySince !== null && now - room.emptySince > this.ttlMs;
      // Uma sala que nunca recebeu ninguém também expira, pelo createdAt.
      const neverUsed = room.participants.size === 0 && now - room.createdAt > this.ttlMs;
      if (expired || neverUsed) {
        this.rooms.delete(room.code);
        removedRooms.push(room.code);
      }
    }
    return { removedRooms, dropped };
  }

  get size() {
    return this.rooms.size;
  }
}
