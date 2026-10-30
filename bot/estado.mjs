/**
 * Estado do bot, em memória.
 *
 * Guarda duas coisas: as sessões (uma por canal de voz com gente dentro) e a
 * configuração de cada servidor.
 *
 * Por que memória e não banco: uma sessão de call é intrinsecamente efêmera —
 * ela existe enquanto existe uma call. Se o processo reinicia, as pessoas
 * continuam na call do Discord mas o bot perdeu o registro; na prática, isso se
 * resolve sozinho, porque ao entrar alguém o bot recria a sessão e o link é
 * publicado de novo (e ele ainda reaproveita a chave da última mensagem, então
 * o link nem muda). Um banco aqui adicionaria um serviço para guardar um dado
 * que se regenera em um segundo.
 *
 * A configuração de servidor é a exceção honesta: ela não se regenera. Perder
 * um "chat desligado" no restart é chato, não é grave, e é o preço aceito por
 * não depender de um banco. Está documentado no README.
 *
 * Módulo puro: sem discord.js, sem rede, sem temporizador. É o que permite
 * testar a regra de sessão inteira sem token nem conexão.
 */

/**
 * Uma sessão por (servidor, canal).
 *
 * A chave composta evita o acidente de dois servidores usarem o mesmo id de
 * canal — impossível hoje, mas o formato custa nada e deixa o mapa legível.
 */
function chaveDaSessao(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

const CONFIG_PADRAO = Object.freeze({
  /** Mandar o link no chat do canal de voz. */
  chat: true,
  /** Mostrar o link no status do canal de voz. */
  status: true,
});

export class EstadoDoBot {
  /** `agora` injetável para o teste não depender do relógio real. */
  constructor({ agora = Date.now } = {}) {
    this.agora = agora;
    /** @type {Map<string, {guildId: string, channelId: string, chave: string, criadoEm: number}>} */
    this.sessoes = new Map();
    /** @type {Map<string, {chat: boolean, status: boolean}>} */
    this.configuracoes = new Map();
    /**
     * Chaves em uso AGORA, para a geração não repetir.
     * Separado das sessões porque uma chave pode estar reservada durante a
     * criação, antes de a sessão existir.
     */
    this.chavesAtivas = new Set();
  }

  /** A chave já está em uso por alguma sessão viva? */
  chaveEmUso(chave) {
    return this.chavesAtivas.has(chave);
  }

  /** A sessão daquele canal de voz, ou `null`. */
  sessaoDe(guildId, channelId) {
    return this.sessoes.get(chaveDaSessao(guildId, channelId)) ?? null;
  }

  /**
   * Abre a sessão do canal com a chave dada.
   *
   * Devolve a sessão criada, ou `null` se já havia uma — reabrir a mesma call
   * não é erro, é o caso comum (alguém sai e volta). Quem chama decide o que
   * fazer com o `null`; aqui não se sobrescreve estado de ninguém.
   */
  abrirSessao(guildId, channelId, chave) {
    const id = chaveDaSessao(guildId, channelId);
    if (this.sessoes.has(id)) return null;
    if (this.chavesAtivas.has(chave)) {
      throw new Error(`a chave ${chave} já está em uso por outra call`);
    }
    const sessao = { guildId, channelId, chave, criadoEm: this.agora() };
    this.sessoes.set(id, sessao);
    this.chavesAtivas.add(chave);
    return sessao;
  }

  /** Encerra a sessão do canal e libera a chave. Devolve a sessão encerrada. */
  encerrarSessao(guildId, channelId) {
    const id = chaveDaSessao(guildId, channelId);
    const sessao = this.sessoes.get(id);
    if (!sessao) return null;
    this.sessoes.delete(id);
    this.chavesAtivas.delete(sessao.chave);
    return sessao;
  }

  /** Quantas sessões estão vivas (para `/status` e para os logs). */
  get totalDeSessoes() {
    return this.sessoes.size;
  }

  /** Configuração do servidor, com os padrões preenchidos. */
  configDe(guildId) {
    return { ...CONFIG_PADRAO, ...(this.configuracoes.get(guildId) ?? {}) };
  }

  /**
   * Muda um campo da configuração do servidor.
   *
   * Só aceita as chaves conhecidas: um valor inesperado vindo de um comando
   * (ou de uma versão futura da interface) é ignorado em vez de virar uma
   * propriedade qualquer no objeto de configuração.
   */
  definirConfig(guildId, campo, valor) {
    if (!Object.hasOwn(CONFIG_PADRAO, campo)) {
      throw new Error(`campo de configuração desconhecido: ${campo}`);
    }
    const atual = this.configDe(guildId);
    const novo = { ...atual, [campo]: valor === true };
    this.configuracoes.set(guildId, novo);
    return novo;
  }
}

export { CONFIG_PADRAO, chaveDaSessao };
