/**
 * Anúncio do site: um recado único, gerado pelo operador, que aparece por cima
 * de todas as salas e de todas as telas.
 *
 * Para que serve em um produto de compartilhamento de tela: avisar todo mundo
 * de uma vez — "manutenção às 22h", "saiu a versão 1.1", "hoje o servidor está
 * lento". Sem isso, o único canal é o README, que ninguém lê no meio de uma
 * transmissão.
 *
 * Escolhas:
 *
 *  - Vive UM anúncio por vez. Uma lista de avisos empilhados vira ruído em cima
 *    de uma videochamada; um de cada vez é o que cabe na tela e na atenção.
 *  - Tem prazo. Anúncio esquecido ligado por três semanas é o mesmo que anúncio
 *    nenhum — e o esquecimento é o modo de falha mais provável aqui.
 *  - Módulo puro: sem WebSocket, sem HTTP, sem disco. A entrega para quem está
 *    conectado é responsabilidade de quem usa (server/index.mjs); aqui só mora
 *    a regra de o que é válido e quando expira.
 */

/** Teto do texto principal: cabe numa faixa de tela sem virar parágrafo. */
export const MAX_TEXTO = 280;
/** Teto do rótulo do botão — precisa caber num botão. */
export const MAX_ROTULO_BOTAO = 40;
/** Duração máxima de um anúncio: 7 dias. Mais que isso é configuração, não aviso. */
export const DURACAO_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;
export const CORES = Object.freeze(["verde", "vermelho", "azul"]);
export const ACOES = Object.freeze(["abrir-nova-aba", "abrir-mesma-aba", "recarregar"]);

/**
 * Rejeita caracteres de controle.
 *
 * `\n` é permitido no texto (anúncio de duas linhas é razoável) e proibido no
 * rótulo do botão. Controle restante é recusado porque esse texto vai direto
 * para a tela de todo mundo: um `\u0000` ou um ESC não é conteúdo, é acidente
 * ou tentativa de bagunçar o terminal de quem debuga.
 */
function semControle(texto, { multilinha = false } = {}) {
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    if (multilinha && codigo === 10) continue;
    if (codigo < 32 || codigo === 127) return false;
  }
  return true;
}

/**
 * Aceita só http/https.
 *
 * O endereço é digitado pelo operador e usado no `href` de um botão que todo
 * mundo clica. Sem esta trava, `javascript:...` viraria execução de script na
 * origem do DanielLive — na tela de quem assiste, não na de quem configurou.
 */
export function urlSegura(entrada) {
  if (typeof entrada !== "string" || entrada.length === 0) return null;
  try {
    const url = new URL(entrada);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Valida e normaliza o anúncio que o operador mandou.
 *
 * Devolve `{ ok: true, anuncio }` ou `{ ok: false, erro }` com o nome do campo
 * que falhou — o painel mostra o motivo, nunca um "dados inválidos" genérico.
 */
export function validarAnuncio(bruto, { agora = Date.now() } = {}) {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, erro: "corpo-invalido" };
  }

  const texto = typeof bruto.texto === "string" ? bruto.texto.trim() : "";
  if (texto.length === 0) return { ok: false, erro: "texto-vazio" };
  if (texto.length > MAX_TEXTO) return { ok: false, erro: "texto-longo" };
  if (!semControle(texto, { multilinha: true })) return { ok: false, erro: "texto-com-controle" };

  const cor = bruto.cor === undefined ? "azul" : bruto.cor;
  if (!CORES.includes(cor)) return { ok: false, erro: "cor-invalida" };

  const dispensavel = bruto.dispensavel === undefined ? true : bruto.dispensavel === true;

  // Botão é opcional: um anúncio pode ser só um aviso, sem convite a clique.
  let botao = null;
  if (bruto.botao !== undefined && bruto.botao !== null) {
    const b = bruto.botao;
    if (typeof b !== "object" || Array.isArray(b)) return { ok: false, erro: "botao-invalido" };

    const rotulo = typeof b.rotulo === "string" ? b.rotulo.trim() : "";
    if (rotulo.length === 0) return { ok: false, erro: "botao-sem-rotulo" };
    if (rotulo.length > MAX_ROTULO_BOTAO) return { ok: false, erro: "botao-rotulo-longo" };
    if (!semControle(rotulo)) return { ok: false, erro: "botao-rotulo-com-controle" };

    const acao = b.acao === undefined ? "abrir-nova-aba" : b.acao;
    if (!ACOES.includes(acao)) return { ok: false, erro: "botao-acao-invalida" };

    // Só as ações que abrem algo exigem URL; "recarregar" não tem destino.
    let url = null;
    if (acao !== "recarregar") {
      url = urlSegura(b.url);
      if (!url) return { ok: false, erro: "botao-url-invalida" };
    }

    botao = { rotulo, acao, url };
  }

  let expiraEm = null;
  if (bruto.expiraEm !== undefined && bruto.expiraEm !== null) {
    const quando = Number(bruto.expiraEm);
    if (!Number.isFinite(quando)) return { ok: false, erro: "prazo-invalido" };
    // Data no passado só produz um anúncio que nasce morto — melhor recusar e
    // dizer isso agora do que o operador não entender por que ninguém viu.
    if (quando <= agora) return { ok: false, erro: "prazo-no-passado" };    if (quando - agora > DURACAO_MAXIMA_MS) return { ok: false, erro: "prazo-longo" };
    expiraEm = quando;
  }

  return {
    ok: true,
    anuncio: {
      texto,
      cor,
      dispensavel,
      botao,
      expiraEm,
      criadoEm: agora,
    },
  };
}

/**
 * Guarda o anúncio atual e responde por ele ao longo do tempo.
 *
 * `ativo()` é a única leitura do resto do sistema: já embute a regra de
 * expiração, então nenhum chamador precisa lembrar de conferir a data.
 */
export class QuadroDeAnuncios {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.atual = null;
  }

  /** Troca o anúncio em vigor. Devolve o que passou a valer. */
  definir(anuncio) {
    this.atual = anuncio;
    return this.ativo();
  }

  /** Retira o anúncio. Idempotente: limpar duas vezes não é erro. */
  limpar() {
    this.atual = null;
  }

  /**
   * O anúncio vigente, ou `null`.
   *
   * A expiração não apaga o registro na hora: ela só faz `ativo()` responder
   * `null`. Assim o operador ainda vê no painel o que publicou por último, em
   * vez de o campo sumir sozinho sem explicação.
   */
  ativo() {
    if (!this.atual) return null;
    if (this.atual.expiraEm !== null && this.now() >= this.atual.expiraEm) return null;
    return this.atual;
  }

  /** O anúncio guardado, mesmo que já tenha expirado (para o painel). */
  ultimo() {
    return this.atual;
  }
}
