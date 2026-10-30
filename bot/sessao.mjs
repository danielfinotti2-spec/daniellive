/**
 * Regra de sessão: quando alguém entra ou sai de um canal de voz, o que
 * acontece com o link da transmissão.
 *
 * Este arquivo é o núcleo do bot e é de propósito **livre de discord.js**: ele
 * recebe um "mundo" com as operações de que precisa (contar pessoas, ler a
 * última mensagem, publicar o link, mudar o status) e devolve o que fez. Assim
 * a regra inteira — que é onde moram os erros chatos — roda em teste sem token,
 * sem conexão e sem servidor.
 *
 * A regra, em uma frase: **uma call com gente tem um link; a última pessoa a
 * sair derruba o link.** O link é reaproveitado do que já está publicado, para
 * quem guardou o endereço não descobrir que ele mudou no meio do dia.
 */

import { gerarChaveLivre } from "./chave.mjs";
import { chaveDaSessao } from "./estado.mjs";

/** Resultado de uma tentativa, para o log e para o teste. */
const IGNORADO = (motivo) => ({ acao: "ignorado", motivo });

/**
 * Chamado quando um membro entra num canal de voz.
 *
 * `mundo` precisa oferecer:
 *  - `presenca`         → o estado da voz (guild, channelId, membro)
 *  - `humanoNaVoz(guildId, channelId)` → quantas pessoas (fora bots) há ali
 *  - `ultimaMensagemDoBot(channelId)`  → texto da última mensagem do bot, ou null
 *  - `publicarLink(channelId, texto)`  → envia a mensagem no chat
 *  - `definirStatus(channelId, texto)` → escreve o status do canal de voz
 *  - `limparStatus(channelId)`         → apaga o status
 *  - `montarLink(chave)`               → monta a URL pública
 */
export async function aoEntrarNaVoz({ presenca, estado, mundo }) {
  // Bot entrando em call (música, gravação) não é gente precisando de link.
  if (presenca.membroEhBot) return IGNORADO("autor-e-bot");

  const { guildId, channelId } = presenca;
  const config = estado.configDe(guildId);

  // Já existe sessão para esta call: nada a fazer. Sobrescrever aqui
  // reenviaria o link a cada pessoa que entra, enchendo o chat.
  const existente = estado.sessaoDe(guildId, channelId);
  if (existente) return { acao: "reaproveitada", chave: existente.chave };

  // Primeiro tenta a chave que já está publicada no chat: se a call esvaziou e
  // voltou, o link continua valendo e ninguém precisa reaprender o número.
  let chave = null;
  let reaproveitadaDeMensagem = false;
  const jaPublicada = await mundo.ultimaMensagemDoBot(channelId).catch(() => null);
  if (jaPublicada) {
    const doTexto = mundo.extrairChave(jaPublicada);
    // Só reaproveita se ninguém tiver tomado a chave nesse meio-tempo.
    if (doTexto && !estado.chaveEmUso(doTexto)) {
      chave = doTexto;
      reaproveitadaDeMensagem = true;
    }
  }

  if (!chave) {
    chave = await gerarChaveLivre((c) => estado.chaveEmUso(c));
  }

  const sessao = estado.abrirSessao(guildId, channelId, chave);
  if (!sessao) return IGNORADO("sessao-surgiu-em-paralelo");

  const link = mundo.montarLink(chave);

  // O status é escrito mesmo quando o link foi reaproveitado: o status do canal
  // se perde se o Discord reiniciar a call, e reescrever o mesmo valor é barato.
  if (config.status) {
    await mundo.definirStatus(channelId, link).catch(() => {});
  }

  // O chat só recebe a mensagem quando o link é NOVO. Reenviar a mesma URL a
  // cada entrada é o que transforma um bot útil em spam.
  let enviouMensagem = false;
  if (config.chat && !reaproveitadaDeMensagem) {
    await mundo.publicarLink(channelId, link).catch(() => {});
    enviouMensagem = true;
  }

  return {
    acao: "aberta",
    chave,
    link,
    reaproveitada: reaproveitadaDeMensagem,
    enviouMensagem,
  };
}

/**
 * Chamado quando um membro sai de um canal de voz.
 *
 * A decisão é por **contagem de pessoas na call depois da saída**, não por
 * "saíram todos os que entraram": quem entra pelo celular e sai pelo desktop, ou
 * muda de canal, produz eventos que não fecham a conta direito. Contar gente na
 * call, no momento da saída, é a verdade observável.
 */
export async function aoSairDaVoz({ presenca, estado, mundo }) {
  if (presenca.membroEhBot) return IGNORADO("autor-e-bot");

  const { guildId, channelId } = presenca;
  const sessao = estado.sessaoDe(guildId, channelId);
  if (!sessao) return IGNORADO("sem-sessao");

  // O Discord pode entregar a saída antes de ele mesmo tirar a pessoa da lista
  // de membros do canal. Uma espera curta evita encerrar a sessão com a call
  // ainda cheia — o erro oposto (não fechar) é mais grave, mas este custa 250ms.
  const restantes = await mundo.humanoNaVoz(guildId, channelId);
  if (restantes > 0) {
    return { acao: "mantida", restantes, chave: sessao.chave };
  }

  estado.encerrarSessao(guildId, channelId);
  await mundo.limparStatus(channelId).catch(() => {});
  return { acao: "encerrada", chave: sessao.chave };
}

/**
 * Chamado quando um membro troca de canal de voz.
 *
 * Tratado como saída do canal antigo + entrada no novo, nesta ordem — é o que
 * fecha a sessão do canal esvaziado antes de abrir a do outro, mantendo a
 * contagem de chaves correta.
 */
export async function aoMudarDeVoz({ de, para, estado, mundo }) {
  const saida = await aoSairDaVoz({ presenca: de, estado, mundo });
  const entrada = await aoEntrarNaVoz({ presenca: para, estado, mundo });
  return { saida, entrada };
}

export { chaveDaSessao };
