/**
 * Registra os comandos slash no Discord.
 *
 * Precisa rodar UMA vez (e de novo só quando os comandos mudarem). É separado
 * do bot porque registrar comando é operação de administração, não algo que
 * deva acontecer a cada reinício de processo.
 *
 * Executa com: `node bot/registrar.mjs`
 *
 * `DISCORD_CLIENT_ID` é obrigatório aqui e não no bot: é o id da aplicação, e
 * registrAR comando exige ele. Registrar com `DISCORD_GUILD_ID` é instantâneo
 * e ótimo para testar num servidor só; sem ele, o comando vira global e pode
 * levar até uma hora para aparecer.
 */

import { definicoesDeComandos } from "./comandos.mjs";

const API = "https://discord.com/api/v10";

export function lerEnvDeRegistro(env = process.env) {
  const token = String(env.DISCORD_TOKEN ?? "").trim();
  const clientId = String(env.DISCORD_CLIENT_ID ?? "").trim();
  const guildId = String(env.DISCORD_GUILD_ID ?? "").trim();

  const faltando = [];
  if (!token) faltando.push("DISCORD_TOKEN");
  if (!clientId) faltando.push("DISCORD_CLIENT_ID");
  if (faltando.length) {
    throw new Error(
      `variáveis faltando: ${faltando.join(", ")}. ` +
        "DISCORD_CLIENT_ID está em Discord Developer Portal → General Information → Application ID.",
    );
  }

  return { token, clientId, guildId: guildId || null };
}

/**
 * Envia a lista de comandos para a API.
 *
 * A rota é PUT (substitui o conjunto inteiro), e não POST por comando: assim o
 * que está no Discord passa a ser exatamente o que está no código, sem sobrar
 * comando de uma versão anterior.
 */
export async function registrarComandos({ token, clientId, guildId }, { fetch = globalThis.fetch } = {}) {
  const rota = guildId
    ? `${API}/applications/${clientId}/guilds/${guildId}/commands`
    : `${API}/applications/${clientId}/commands`;

  const resposta = await fetch(rota, {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(definicoesDeComandos()),
    signal: AbortSignal.timeout(20_000),
  });

  const corpo = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`o Discord recusou o registro (HTTP ${resposta.status}): ${corpo.slice(0, 300)}`);
  }

  let lista;
  try {
    lista = JSON.parse(corpo);
  } catch {
    throw new Error(`resposta inesperada do Discord: ${corpo.slice(0, 200)}`);
  }
  if (!Array.isArray(lista)) throw new Error("o Discord não devolveu uma lista de comandos");

  return { comandos: lista.map((c) => c.name), escopo: guildId ? `servidor ${guildId}` : "global" };
}

const chamadoDireto =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (chamadoDireto) {
  let env;
  try {
    env = lerEnvDeRegistro();
  } catch (erro) {
    console.error(`[registrar] ${erro.message}`);
    process.exit(1);
  }

  try {
    const { comandos, escopo } = await registrarComandos(env);
    console.log(`[registrar] ${comandos.length} comando(s) registrados (${escopo}): ${comandos.join(", ")}`);
    if (escopo === "global") {
      console.log("[registrar] comandos globais podem levar até 1 hora para aparecer no servidor.");
    }
  } catch (erro) {
    console.error(`[registrar] ${erro.message}`);
    process.exit(1);
  }
}
