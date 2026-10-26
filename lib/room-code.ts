/**
 * Código de sala: leitura, escrita e normalização.
 *
 * Módulo sem dependência de navegador para poder ser testado em Node. É a
 * mesma definição de alfabeto do servidor (server/rooms.mjs): 9 caracteres sem
 * 0/O/1/I/L, para o código ser ditado por voz ou copiado à mão sem confusão.
 */

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 9;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function isValidRoomCode(code: string): boolean {
  return CODE_RE.test(code);
}

/**
 * Extrai o código de qualquer uma das formas em que ele chega:
 *   "K7M2PQR4T"
 *   "https://exemplo.com/assistir/K7M2PQR4T"
 *   "/assistir/k7m2pqr4t?utm=zap"
 * Devolve null quando não há código reconhecível.
 */
export function normalizeRoomCode(input: string): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value) return null;

  // URL ou caminho: procura o segmento depois de /assistir/ ou /sala/.
  if (value.includes("/") || value.includes("?")) {
    try {
      const url = value.startsWith("http")
        ? new URL(value)
        : new URL(value, "https://local.invalid");
      const segments = url.pathname.split("/").filter(Boolean);
      const marker = segments.findIndex((s) => s === "assistir" || s === "sala" || s === "watch");
      const candidate = marker >= 0 ? segments[marker + 1] : segments[segments.length - 1];
      value = candidate ?? "";
    } catch {
      // Não era URL: segue tratando como código puro.
    }
  }

  // Só letras e números sobrevivem; hífens e espaços de um código colado saem.
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (isValidRoomCode(cleaned)) return cleaned;

  // Segunda tentativa trocando os caracteres que costumam ser confundidos na
  // leitura: 0/O e 1/I/L. O alfabeto não contém nenhum deles, então a troca
  // nunca produz um código válido por acidente.
  const swapped = cleaned.replace(/0/g, "O").replace(/1/g, "I");
  if (isValidRoomCode(swapped)) return swapped;

  // Terceira tentativa: procurar um código dentro de texto livre, como
  // "olha isso: K7M2PQR4T" ou um código cercado de pontuação. Varre cada
  // janela do tamanho exato, porque o código pode começar no meio da frase.
  const source = value.toUpperCase();
  for (let i = 0; i + CODE_LENGTH <= source.length; i += 1) {
    const window = source.slice(i, i + CODE_LENGTH);
    if (isValidRoomCode(window)) return window;
    const windowSwapped = window.replace(/0/g, "O").replace(/1/g, "I");
    if (isValidRoomCode(windowSwapped)) return windowSwapped;
  }

  return null;
}

/** Link absoluto da sala, a partir da origem atual. */
export function watchUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/assistir/${code}`;
}

/** Agrupa em 3 blocos de 3 para exibição (facilita ditar). */
export function formatRoomCode(code: string): string {
  return code.replace(/(.{3})(?=.)/g, "$1 ").trim();
}
