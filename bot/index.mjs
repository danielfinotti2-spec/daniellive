/**
 * Ponto de entrada do bot do DanielLive.
 *
 * O bot olha para os canais de voz de um servidor do Discord e, quando alguém
 * entra numa call, publica o link de uma sala do DanielLive no chat daquele
 * canal (e no status dele). Quando a última pessoa sai, o link some.
 *
 * Executa com: `node bot/index.mjs`
 *
 * Sem token não há bot: este arquivo falha no boot com uma mensagem que diz
 * exatamente qual variável falta, em vez de subir e morrer depois no primeiro
 * evento — que é o jeito mais chato de descobrir um problema de configuração
 * num servidor sem terminal aberto.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { iniciarBot } from "./discord.mjs";

/**
 * Carrega `.env` da raiz do projeto, se existir.
 *
 * Feito à mão, e não com o pacote `dotenv`, porque são 20 linhas e evitam uma
 * dependência no processo. Regras: não sobrescreve variável que já existe no
 * ambiente (no servidor de hospedagem as variáveis vêm de lá, e o `.env` não
 * deve ganhar essa briga), ignora `#` e linhas vazias, e aceita aspas em volta
 * do valor.
 *
 * Roda só quando o arquivo existe; ausência dele não é erro — em produção não
 * há `.env`.
 */
export function carregarEnv(caminho, ambiente = process.env) {
  let texto;
  try {
    texto = readFileSync(caminho, "utf8");
  } catch {
    return {}; // não existe: normal em produção
  }
  const aplicados = {};
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual <= 0) continue;
    const nome = limpa.slice(0, igual).trim();
    if (!nome || nome in ambiente) continue;
    let valor = limpa.slice(igual + 1).trim();
    // Aspas em volta são do arquivo, não do valor.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    ambiente[nome] = valor;
    aplicados[nome] = valor;
  }
  return aplicados;
}

const REQUERIDAS = ["DISCORD_TOKEN", "DANIELLIVE_ORIGIN"];

/**
 * Lê e valida a configuração do ambiente.
 *
 * `DANIELLIVE_ORIGIN` é o endereço do site (o mesmo onde o DanielLive está
 * hospedado). Não tem padrão de propósito: um link relativo ou um domínio
 * errado no chat de todo mundo é pior do que o bot não subir.
 */
export function lerConfiguracao(env = process.env) {
  const faltando = REQUERIDAS.filter((nome) => !String(env[nome] ?? "").trim());
  if (faltando.length > 0) {
    throw new Error(
      `variáveis de ambiente faltando: ${faltando.join(", ")}. ` +
        `Veja bot/env.example para o formato esperado.`,
    );
  }

  const origem = String(env.DANIELLIVE_ORIGIN).trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(origem);
  } catch {
    throw new Error(`DANIELLIVE_ORIGIN não é uma URL válida: ${origem}`);
  }
  // Um link http:// no chat de todo mundo é errado para um site que existe
  // para ser publicado: a única exceção é testar em máquina local.
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error(`DANIELLIVE_ORIGIN precisa ser https (recebido: ${origem})`);
  }

  const caminho = String(env.DANIELLIVE_PATH ?? "/assistir").trim() || "/assistir";

  return { token: String(env.DISCORD_TOKEN).trim(), origem, caminho };
}

/**
 * Só roda quando chamado direto (`node bot/index.mjs`). Importado num teste,
 * fica quieto — é o que permite testar `lerConfiguracao` sem subir nada.
 */
const chamadoDireto =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (chamadoDireto) {
  // O .env fica na raiz do projeto (um nível acima de bot/).
  const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
  carregarEnv(join(raiz, ".env"));

  let config;
  try {
    config = lerConfiguracao();
  } catch (erro) {
    console.error(`[bot] ${erro.message}`);
    process.exit(1);
  }

  console.log(`[bot] publicando links em ${config.origem}${config.caminho}/<chave>`);

  /**
   * A conexão pode falhar por token inválido, intents não habilitados no portal
   * ou falta de rede. Sem este tratamento, o discord.js derruba o processo com
   * um stack trace do próprio pacote — ilegível para quem só quer saber o que
   * configurar. Aqui o erro vira uma frase com o próximo passo.
   */
  let client;
  try {
    ({ client } = await iniciarBot(config));
  } catch (erro) {
    const codigo = erro?.code ?? "";
    if (codigo === "TokenInvalid" || /token/i.test(String(erro?.message))) {
      console.error(
        "[bot] o DISCORD_TOKEN foi recusado. Confira se copiou o token do bot " +
          "(Discord Developer Portal → sua aplicação → Bot → Reset Token) e se ele não expirou.",
      );
    } else if (codigo === "DisallowedIntents" || /intent/i.test(String(erro?.message))) {
      console.error(
        "[bot] faltam intents habilitados. No Discord Developer Portal → Bot → " +
          "Privileged Gateway Intents, ligue **MESSAGE CONTENT INTENT** " +
          "(o bot precisa ler as próprias mensagens para reaproveitar o link).",
      );
    } else {
      console.error(`[bot] não foi possível conectar: ${erro?.message ?? erro}`);
    }
    process.exit(1);
  }

  client.once("ready", () => {
    console.log(`[bot] conectado como ${client.user.tag} em ${client.guilds.cache.size} servidor(es)`);
  });

  /**
   * Sair limpo: fechar o WebSocket do Discord antes de o processo morrer evita
   * a sessão fantasma que deixa o bot "offline" por alguns minutos na próxima
   * vez que a hospedagem reiniciar o processo.
   */
  let encerrando = false;
  for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.on(sinal, () => {
      if (encerrando) return;
      encerrando = true;
      console.log(`[bot] encerrando (${sinal})`);
      Promise.resolve(client.destroy())
        .catch(() => {})
        .finally(() => process.exit(0));
      // Rede de segurança: se o destroy travar, sai de qualquer forma.
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }

  process.on("unhandledRejection", (motivo) => {
    console.error("[bot] promise rejeitada sem tratamento:", motivo);
  });
}
