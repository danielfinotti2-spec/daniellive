/**
 * Limite de requisições por conexão.
 *
 * Janela deslizante por contador com recarga proporcional ao tempo decorrido
 * (token bucket): simples o bastante para ser conferido a olho e suficiente
 * para o que precisa ser contido aqui — um cliente em laço apertado que
 * inundaria a sala de mensagens de sinalização.
 */
export class RateLimiter {
  /**
   * @param {object} opts
   * @param {number} opts.capacity rajada máxima (mensagens seguidas permitidas)
   * @param {number} opts.refillPerSecond taxa sustentada
   */
  constructor({ capacity = 60, refillPerSecond = 20, now = Date.now } = {}) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
    this.tokens = capacity;
    this.last = now();
    this.hits = 0;
  }

  /** `true` quando a mensagem pode passar; `false` quando deve ser recusada. */
  take(cost = 1) {
    const now = this.now();
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    if (this.tokens < cost) {
      this.hits += 1;
      return false;
    }
    this.tokens -= cost;
    return true;
  }
}

/** Limites por tipo de mensagem: sinalização pesa menos que ping. */
export const COST_BY_TYPE = {
  ping: 0.2,
  hello: 1,
  create: 2,
  join: 2,
  leave: 1,
  sharing: 1,
  signal: 1,
  requestStream: 1,
  // Chat é a porta mais convidativa para spam: custa o dobro de uma ação
  // comum. Conversa normal nunca chega perto do tecido (~1 msg/s sustentada).
  chat: 2,
};

export function costFor(type) {
  return COST_BY_TYPE[type] ?? 1;
}

/**
 * Trava a criação de salas por endereço de origem.
 *
 * Existe porque criar sala é a operação que aloca estado no servidor e o
 * único ponto em que um cliente anônimo faz o servidor trabalhar de graça.
 * Janelas longas (minuto) mantêm o uso legítimo — abrir algumas transmissões
 * — muito abaixo do teto.
 */
export class RoomCreationLimiter {
  constructor({ perAddress = 10, windowMs = 60_000, now = Date.now } = {}) {
    this.perAddress = perAddress;
    this.windowMs = windowMs;
    this.now = now;
    /** @type {Map<string, number[]>} */
    this.log = new Map();
  }

  allow(address) {
    const now = this.now();
    const key = address || "desconhecido";
    const stamps = (this.log.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (stamps.length >= this.perAddress) {
      this.log.set(key, stamps);
      return false;
    }
    stamps.push(now);
    this.log.set(key, stamps);
    return true;
  }

  /** Descarta entradas antigas para o mapa não crescer sem limite. */
  sweep() {
    const now = this.now();
    for (const [key, stamps] of this.log) {
      const alive = stamps.filter((t) => now - t < this.windowMs);
      if (alive.length === 0) this.log.delete(key);
      else this.log.set(key, alive);
    }
  }
}
