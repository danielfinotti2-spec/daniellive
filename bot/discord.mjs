/**
 * Adaptador entre o núcleo (bot/sessao.mjs) e o discord.js.
 *
 * É a única camada que fala com a biblioteca. Tudo o que é regra ficou no
 * núcleo, que é testável sem token; aqui mora só a tradução: eventos do
 * Discord viram "presenças", e as operações pedidas pelo núcleo viram chamadas
 * à API.
 *
 * O carregamento do discord.js é dinâmico de propósito: assim os testes e o
 * próprio núcleo rodam numa máquina sem a dependência instalada.
 */

import { aoEntrarNaVoz, aoSairDaVoz, aoMudarDeVoz } from "./sessao.mjs";
import { montarLink, extrairChave } from "./chave.mjs";

/**
 * Tudo o que o núcleo precisa saber sobre quem entrou/saiu.
 *
 * `membroEhBot` é lido com tolerância: durante a inicialização o discord.js
 * pode entregar o membro como `null` ou como id ainda não resolvido, e um erro
 * aqui derrubaria o handler inteiro por causa de um evento de bot.
 */
function presencaDe(state) {
  return {
    guildId: state.guild?.id ?? "",
    channelId: state.channelId ?? "",
    membroEhBot: state.member?.user?.bot === true,
  };
}

/**
 * Monta o "mundo" que o núcleo usa, ligado ao discord.js.
 *
 * Cada operação devolve uma Promise e **não engole erro de propósito**: o
 * núcleo já decide o que fazer com falha de permissão (seguir em frente com a
 * sessão criada), então quem trata é ele, e não este arquivo escondido.
 */
function criarMundo(client, estado, { origem, caminho }) {
  return {
    async humanoNaVoz(guildId, channelId) {
      const canal = await client.channels.fetch(channelId).catch(() => null);
      if (!canal || !canal.isVoiceBased?.()) return 0;
      // `members` é uma coleção só com quem está conectado ao canal de voz.
      return canal.members.filter((m) => m.user?.bot !== true).size;
    },

    async ultimaMensagemDoBot(channelId) {
      const canal = await client.channels.fetch(channelId).catch(() => null);
      if (!canal || !canal.isTextBased?.() || !canal.messages?.fetch) return null;
      const ultimas = await canal.messages.fetch({ limit: 10 });
      // Procura entre as últimas, não só na última: depois do link pode ter
      // vindo a mensagem de "entrou na call" de outro bot.
      for (const msg of ultimas.values()) {
        if (msg.author?.id !== client.user?.id) continue;
        if (extrairChave(msg.content ?? "", { origem, caminho })) return msg.content;
      }
      return null;
    },

    async publicarLink(channelId, texto) {
      const canal = await client.channels.fetch(channelId);
      if (!canal?.isTextBased?.()) throw new Error("canal de voz sem chat de texto");
      await canal.send(texto);
    },

    async definirStatus(channelId, texto) {
      // O status do canal de voz é um endpoint da API que o discord.js não
      // expõe directamente; é um PUT simples.
      const resposta = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/voice-status`,
        {
          method: "PUT",
          headers: {
            authorization: `Bot ${client.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: texto.slice(0, 500) }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resposta.ok) throw new Error(`status HTTP ${resposta.status}`);
    },

    async limparStatus(channelId) {
      const resposta = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/voice-status`,
        {
          method: "PUT",
          headers: {
            authorization: `Bot ${client.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "" }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resposta.ok) throw new Error(`status HTTP ${resposta.status}`);
    },

    montarLink: (chave) => montarLink(chave, { origem, caminho }),
    extrairChave: (texto) => extrairChave(texto, { origem, caminho }),
  };
}

/** Log curto e com contexto — o suficiente para achar um problema no painel. */
function log(evento, dados = {}) {
  const quando = new Date().toISOString();
  const partes = Object.entries(dados)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  console.log(`[${quando}] ${evento}${partes.length ? " " + partes.join(" ") : ""}`);
}

/**
 * Liga os eventos de voz e devolve o cliente conectado.
 *
 * `config` traz `token`, `origem` e `caminho` — lidos e validados por quem
 * chama (bot/index.mjs), para este arquivo não ter decisão de configuração.
 */
export async function iniciarBot({ token, origem, caminho = "/assistir" }) {
  const { Client, GatewayIntentBits, Events } = await import("discord.js");

  const estado = new (await import("./estado.mjs")).EstadoDoBot();

  // Intents mínimos: só o necessário para saber quem está num canal de voz.
  // Pedir mais do que se usa é pedir permissão que não sabemos proteger.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const mundo = criarMundo(client, estado, { origem, caminho });

  /**
   * Eventos de voz do discord.js têm assinatura `(oldState, newState)`.
   *
   * A classificação em "entrou", "saiu" e "mudou" é feita aqui porque é aqui
   * que a informação existe: o estado antigo e o novo vêm juntos. O núcleo
   * recebe os três casos já separados.
   */
  client.on(Events.VoiceStateUpdate, async (antigo, novo) => {
    try {
      const de = presencaDe(antigo);
      const para = presencaDe(novo);
      const estavaFora = !de.channelId;
      const estaFora = !para.channelId;

      if (estavaFora && !estaFora) {
        const r = await aoEntrarNaVoz({ presenca: para, estado, mundo });
        log("entrou", {
          canal: para.channelId,
          acao: r.acao,
          chave: r.chave,
          reaproveitada: r.reaproveitada,
        });
        return;
      }

      if (!estavaFora && estaFora) {
        const r = await aoSairDaVoz({ presenca: de, estado, mundo });
        log("saiu", { canal: de.channelId, acao: r.acao, restantes: r.restantes });
        return;
      }

      if (!estavaFora && !estaFora && de.channelId !== para.channelId) {
        const r = await aoMudarDeVoz({ de, para, estado, mundo });
        log("mudou", {
          de: de.channelId,
          para: para.channelId,
          saiu: r.saida.acao,
          entrou: r.entrada.acao,
        });
      }
      // Qualquer outra transição (mudo, ensurdecido, streaming) não interessa:
      // a sessão depende de presença, não de microfone.
    } catch (erro) {
      // Um evento com erro não pode derrubar o processo: o próximo evento
      // (a próxima pessoa entrando) conserta o estado.
      console.error("[bot] falha ao tratar mudança de voz:", erro?.message ?? erro);
    }
  });

  // Os comandos são registrados por um passo separado (bot/comandos.mjs);
  // aqui só ligamos o handler que já foi preparado.
  const { ligarComandos } = await import("./comandos.mjs").catch(() => ({ ligarComandos: null }));
  if (ligarComandos) ligarComandos(client, estado, { origem, caminho });

  await client.login(token);
  return { client, estado };
}
