/**
 * Protocolo de sinalização.
 *
 * Cada mensagem que entra pelo WebSocket passa por aqui antes de virar ação.
 * A regra é simples: nada de `JSON.parse` cru chegando no manipulador de sala.
 * Mensagem que não bate com um dos esquemas abaixo é descartada e contada, e o
 * cliente recebe um erro genérico — nunca a mensagem interna que explica por
 * que foi recusada.
 */

import { isValidRoomCode } from "./rooms.mjs";

export const PROTOCOL_VERSION = 1;

/** Teto de tamanho de uma mensagem. SDP com muitos candidatos é o maior caso real. */
export const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_NAME = 48;
const MAX_TEXT = 2000;
/**
 * Mensagem de chat: curta, porque é conversa e não documento. 500 caracteres
 * comporta um parágrafo razoável e frustra apenas abusos (colar um arquivo de
 * texto inteiro numa sala não é conversar).
 */
export const MAX_CHAT = 500;

const isStr = (v, max = MAX_TEXT) => typeof v === "string" && v.length > 0 && v.length <= max;
const isBool = (v) => typeof v === "boolean";
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Descrição de sessão do WebRTC: a forma exata não é validada aqui porque ela
 * é produzida pelo próprio navegador. O que se garante é que é um objeto, tem
 * `type` conhecido e não carrega nada além de `sdp` na oferta/resposta.
 */
function isSessionDescription(v) {
  if (!isObj(v)) return false;
  if (v.type !== "offer" && v.type !== "answer" && v.type !== "pranswer" && v.type !== "rollback") {
    return false;
  }
  if (v.sdp !== undefined && typeof v.sdp !== "string") return false;
  return true;
}

function isIceCandidate(v) {
  if (!isObj(v)) return false;
  // candidate vazio é legítimo: é o fim da coleta de candidatos.
  if (v.candidate !== undefined && typeof v.candidate !== "string") return false;
  if (v.sdpMid !== undefined && v.sdpMid !== null && typeof v.sdpMid !== "string") return false;
  if (v.sdpMLineIndex !== undefined && v.sdpMLineIndex !== null && typeof v.sdpMLineIndex !== "number") {
    return false;
  }
  if (v.usernameFragment !== undefined && v.usernameFragment !== null && typeof v.usernameFragment !== "string") {
    return false;
  }
  return true;
}

/** Corpo do sinal WebRTC trocado entre dois participantes. */
function isSignalPayload(v) {
  if (!isObj(v)) return false;
  if (v.description !== undefined && !isSessionDescription(v.description)) return false;
  if (v.candidate !== undefined && !isIceCandidate(v.candidate)) return false;
  if (v.description === undefined && v.candidate === undefined) return false;
  return true;
}

/**
 * Esquemas aceitos: nome -> { campos obrigatórios, validador }.
 * `validate` devolve a mensagem normalizada (só os campos previstos) para que
 * dado extra enviado pelo cliente não chegue ao resto do sistema.
 */
const SCHEMAS = {
  hello: {
    validate: (m) => ({
      name: isStr(m.name, MAX_NAME) ? m.name.trim() : null,
      version: typeof m.version === "number" ? m.version : null,
    }),
  },

  create: {
    validate: (m) => ({
      name: isStr(m.name, MAX_NAME) ? m.name.trim() : null,
      // Opcional: quem omite cria uma sala listada, como sempre foi. Só um
      // `true` de verdade marca a sala como privada — string "true" vinda de
      // um cliente antigo não deve, por acidente, esconder a sala.
      privada: m.privada === true,
    }),
  },

  join: {
    validate: (m) => {
      if (!isValidRoomCode(m.code)) return null;
      return { code: m.code, name: isStr(m.name, MAX_NAME) ? m.name.trim() : null };
    },
  },

  leave: { validate: () => ({}) },

  /** O anfitrião anuncia que começou ou parou de transmitir. */
  sharing: {
    // `paused` é opcional: quem só começa ou encerra a transmissão não precisa
    // informá-lo. Quando vem, precisa ser booleano de verdade.
    validate: (m) => {
      if (!isBool(m.on)) return null;
      if (m.paused !== undefined && !isBool(m.paused)) return null;
      return { on: m.on, paused: m.paused === true };
    },
  },

  /** Sinal dirigido: `to` é o id de destino, `data` é SDP ou candidato ICE. */
  signal: {
    validate: (m) => {
      if (!isStr(m.to, 64)) return null;
      if (!isSignalPayload(m.data)) return null;
      return { to: m.to, data: m.data };
    },
  },

  /** Espectador pede ao anfitrião que reenvie a oferta (recuperação de conexão). */
  requestStream: {
    validate: () => ({}),
  },

  /**
   * Chat da sala. Chega só com o texto: quem enviou é a conexão que mandou —
   * nunca um campo no corpo. Se a mensagem pudesse dizer "sou Fulano", mentir
   * nome no chat custaria zero.
   */
  chat: {
    validate: (m) => {
      if (typeof m.texto !== "string") return null;
      const texto = m.texto.trim();
      // O teto conta depois de aparar: 600 espaços + 10 letras continuam sendo
      // uma mensagem de 10 letras — e "   " não é mensagem nenhuma.
      return texto.length > 0 && texto.length <= MAX_CHAT ? { texto } : null;
    },
  },

  ping: { validate: () => ({}) },

  /**
   * Pedido de lista de salas públicas. Sem campos: quem pede não escolhe
   * filtro nenhum, e o servidor já decide o que é público.
   */
  "salas:listar": { validate: () => ({}) },

  /** Pedido do anúncio vigente (atualização sob demanda). */
  "anuncio:atual": { validate: () => ({}) },
};

/**
 * Valida e normaliza. Devolve `{ ok: true, message }` ou `{ ok: false, reason }`.
 * `reason` é para o log do servidor; o cliente recebe só um código curto.
 */
export function validateMessage(raw) {
  if (!isObj(raw)) return { ok: false, reason: "nao-objeto" };
  if (!isStr(raw.type, 32)) return { ok: false, reason: "sem-tipo" };
  const schema = SCHEMAS[raw.type];
  if (!schema) return { ok: false, reason: `tipo-desconhecido:${raw.type}` };
  const fields = schema.validate(raw);
  if (fields === null || fields === undefined) {
    return { ok: false, reason: `campos-invalidos:${raw.type}` };
  }
  return { ok: true, message: { type: raw.type, ...fields } };
}

/**
 * Serializa uma mensagem de saída. Um único ponto de saída garante que todo
 * envio passa pela mesma serialização e pelo mesmo teto de tamanho.
 */
export function encode(message) {
  return JSON.stringify(message);
}

/** Decodifica aplicando o teto de bytes antes de gastar CPU com JSON.parse. */
export function decode(raw, isBinary = false) {
  if (isBinary) return { ok: false, reason: "binario-nao-suportado" };
  const text = typeof raw === "string" ? raw : raw.toString("utf8");
  if (text.length > MAX_MESSAGE_BYTES) return { ok: false, reason: "mensagem-grande" };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json-invalido" };
  }
  return { ok: true, value: parsed };
}
