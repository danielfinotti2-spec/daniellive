/**
 * Chaves de sessão: o identificador curto que vira o link da transmissão.
 *
 * Por que curta e numérica: o link é digitado no chat de uma call e lido em
 * voz alta ("entra no quatro sete dois um"). Por isso cinco dígitos, e não um
 * UUID. O custo dessa escolha é o espaço pequeno — 100 mil combinações — e é
 * ele que dita a regra de unicidade abaixo.
 *
 * Por que a unicidade é verificada: com 100 mil combinações e um servidor com
 * muitas calls simultâneas, duas chaves iguais ao mesmo tempo fariam duas
 * pessoas caírem na MESMA sala — vazamento de uma transmissão para estranhos.
 * A colisão não é improvável o bastante para ser ignorada, então o gerador
 * recebe uma função que diz se a chave já está em uso.
 */

import { randomInt } from "node:crypto";

/** Quantidade de dígitos da chave. */
export const DIGITOS = 5;
/** 00000..99999 */
export const ESPACO = 10 ** DIGITOS;

/**
 * Sorteia uma chave.
 *
 * `randomInt` do crypto e não `Math.random`: a chave é a credencial de acesso
 * (quem tem o link assiste). `Math.random` é previsível o suficiente para
 * alguém deduzir a próxima chave a partir das anteriores.
 */
export function gerarChave() {
  return String(randomInt(0, ESPACO)).padStart(DIGITOS, "0");
}

/**
 * Sorteia uma chave que não esteja em uso.
 *
 * `emUso` pode ser síncrona ou assíncrona (um banco, por exemplo). O limite de
 * tentativas existe porque um laço infinito num gerador é um jeito silencioso
 * de travar o processo inteiro quando o espaço de chaves se esgota — é melhor
 * falhar alto e deixar quem chamou decidir.
 */
export async function gerarChaveLivre(emUso, { tentativas = 1000 } = {}) {
  for (let i = 0; i < tentativas; i += 1) {
    const chave = gerarChave();
    if (!(await emUso(chave))) return chave;
  }
  throw new Error(
    `não foi possível gerar uma chave de ${DIGITOS} dígitos livre em ${tentativas} tentativas`,
  );
}

/** Uma chave só é válida se for exatamente o formato que emitimos. */
export function chaveValida(chave) {
  return typeof chave === "string" && new RegExp(`^\\d{${DIGITOS}}$`).test(chave);
}

/**
 * Monta o link da transmissão.
 *
 * `origem` é a raiz pública (ex.: https://daniellive.onrender.com) e `caminho`
 * o prefixo da sala (padrão `/assistir`, que é a rota real do DanielLive).
 * A origem vazia é tratada como erro de configuração, não como "link relativo":
 * um link relativo no chat do Discord é inútil, e o bot tem que gritar isso no
 * boot em vez de publicar links quebrados.
 */
export function montarLink(chave, { origem, caminho = "/assistir" } = {}) {
  if (!chaveValida(chave)) throw new Error(`chave inválida: ${chave}`);
  const raiz = String(origem ?? "").trim().replace(/\/+$/, "");
  if (!raiz) throw new Error("origem pública não configurada");
  const prefixo = String(caminho).startsWith("/") ? String(caminho) : `/${caminho}`;
  return `${raiz}${prefixo.replace(/\/+$/, "")}/${chave}`;
}

/**
 * Lê a chave de volta de um texto — por exemplo, de uma mensagem antiga do bot.
 *
 * Serve para reaproveitar o link quando a call esvazia e volta: quem já tinha
 * o link guardado continua entrando no mesmo lugar, em vez de descobrir que o
 * link mudou. A busca é pela URL completa (com origem), não por "5 dígitos
 * soltos": um horário como "12:30" não pode ser confundido com uma chave.
 */
export function extrairChave(texto, { origem, caminho = "/assistir" } = {}) {
  if (typeof texto !== "string" || !texto) return null;
  const raiz = String(origem ?? "").trim().replace(/\/+$/, "");
  if (!raiz) return null;
  const prefixo = String(caminho).startsWith("/") ? String(caminho) : `/${caminho}`;
  const escapada = `${raiz}${prefixo.replace(/\/+$/, "")}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achado = new RegExp(`${escapada}/(\\d{${DIGITOS}})`).exec(texto);
  return achado ? achado[1] : null;
}
