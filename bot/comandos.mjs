/**
 * Comandos slash do bot.
 *
 * Três comandos, e nada além disso:
 *
 *   /status  — o que está ligado neste servidor e quais calls têm link agora
 *   /link    — republica o link da call em que você está
 *   /config  — liga e desliga o aviso no chat e no status
 *
 * A regra de permissão é a mesma do original e é a certa: `/config` exige
 * **Gerenciar Servidor**, porque desligar o aviso muda o servidor inteiro.
 * `/status` e `/link` são para qualquer membro, porque são consulta e não
 * configuração.
 */

import { chaveDaSessao } from "./estado.mjs";

/** A definição dos comandos, no formato que a API do Discord aceita. */
export function definicoesDeComandos() {
  return [
    {
      name: "status",
      description: "Mostra o que está ligado neste servidor e as calls com link.",
      type: 1, // CHAT_INPUT
    },
    {
      name: "link",
      description: "Republica o link da transmissão da call onde você está.",
      type: 1,
    },
    {
      name: "config",
      description: "Liga ou desliga o aviso de link neste servidor.",
      type: 1,
      // Administrador do servidor: é uma configuração que afeta todos.
      default_member_permissions: String(1n << 5n), // MANAGE_GUILD
      options: [
        {
          type: 3, // STRING
          name: "opcao",
          description: "O que configurar",
          required: true,
          choices: [
            { name: "chat — mandar o link no chat da call", value: "chat" },
            { name: "status — mostrar o link no status da call", value: "status" },
          ],
        },
        {
          type: 5, // BOOLEAN
          name: "ligado",
          description: "true = liga, false = desliga",
          required: true,
        },
      ],
    },
  ];
}

/** Resposta efêmera só para quem chamou (não polui o canal). */
const privada = (conteudo) => ({ content: conteudo, ephemeral: true });

/**
 * Liga o handler de interações ao cliente.
 *
 * Responde **sempre** em menos de 3 segundos, que é o prazo do Discord antes de
 * marcar a interação como "o aplicativo não respondeu". As consultas aqui são
 * locais (o estado está em memória), então cabe folgado.
 */
export function ligarComandos(client, estado, { origem, caminho = "/assistir" } = {}) {
  client.on("interactionCreate", async (interacao) => {
    if (!interacao.isChatInputCommand?.()) return;

    try {
      // Fora de servidor não existe canal de voz nem configuração por servidor.
      if (!interacao.inGuild?.()) {
        await interacao.reply(privada("Este comando só funciona dentro de um servidor."));
        return;
      }

      switch (interacao.commandName) {
        case "status": {
          await interacao.reply(privada(textoDeStatus(estado, interacao.guildId)));
          return;
        }

        case "link": {
          const noCanal = interacao.member?.voice?.channelId ?? null;
          if (!noCanal) {
            await interacao.reply(
              privada("Entre num canal de voz primeiro: o link é da call em que você está."),
            );
            return;
          }
          const sessao = estado.sessaoDe(interacao.guildId, noCanal);
          if (!sessao) {
            await interacao.reply(
              privada("Esta call ainda não tem link. O bot cria um quando alguém entra."),
            );
            return;
          }
          const raiz = String(origem).replace(/\/+$/, "");
          const prefixo = caminho.startsWith("/") ? caminho : `/${caminho}`;
          await interacao.reply({
            content: `${raiz}${prefixo.replace(/\/+$/, "")}/${sessao.chave}`,
          });
          return;
        }

        case "config": {
          // A permissão já é exigida pelo próprio Discord (`default_member_permissions`),
          // mas repetir aqui cobre quem instalou o comando antes de a exigência existir.
          const pode = interacao.memberPermissions?.has?.(1n << 5n) === true;
          if (!pode) {
            await interacao.reply(privada("Você precisa da permissão **Gerenciar Servidor**."));
            return;
          }
          const opcao = interacao.options.getString("opcao", true);
          const ligado = interacao.options.getBoolean("ligado", true);
          const cfg = estado.definirConfig(interacao.guildId, opcao, ligado);
          const qual = opcao === "chat" ? "Aviso no chat da call" : "Aviso no status da call";
          await interacao.reply(privada(`${qual}: **${cfg[opcao] ? "LIGADO" : "DESLIGADO"}**`));
          return;
        }

        default:
          await interacao.reply(privada("Comando desconhecido."));
      }
    } catch (erro) {
      console.error("[bot] falha ao responder comando:", erro?.message ?? erro);
      // Se já respondemos, `reply` falha; a segunda tentativa usa followUp.
      const resposta = privada("Deu erro ao executar o comando. Tente de novo.");
      try {
        if (interacao.replied || interacao.deferred) await interacao.followUp(resposta);
        else await interacao.reply(resposta);
      } catch {
        /* nada mais a fazer */
      }
    }
  });
}

/** Texto do `/status`, montado do estado local. */
export function textoDeStatus(estado, guildId) {
  const cfg = estado.configDe(guildId);
  const linhas = ["**Este servidor**"];
  linhas.push(`• Aviso no chat da call: **${cfg.chat ? "ligado" : "desligado"}**`);
  linhas.push(`• Aviso no status da call: **${cfg.status ? "ligado" : "desligado"}**`);

  const sessoes = [...estado.sessoes.values()].filter((s) => s.guildId === guildId);
  linhas.push("");
  if (sessoes.length === 0) {
    linhas.push("Nenhuma call com link neste momento.");
  } else {
    linhas.push(`**${sessoes.length}** call(s) com link agora:`);
    for (const s of sessoes) {
      linhas.push(`• <#${s.channelId}> — chave \`${s.chave}\``);
    }
  }
  return linhas.join("\n");
}

export { chaveDaSessao };
