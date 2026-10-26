/**
 * Configuração de ICE (STUN/TURN).
 *
 * STUN público basta para a maioria das redes domésticas: ele descobre o
 * endereço externo e permite a conexão direta. Não basta quando as duas pontas
 * estão atrás de NAT simétrico ou de firewall corporativo — aí é preciso um
 * TURN, que retransmite a mídia pelo servidor. TURN custa banda, então vem de
 * fora e por variável de ambiente, nunca embutido no código.
 *
 * Variáveis (todas opcionais, ver .env.example):
 *   NEXT_PUBLIC_STUN_URLS  lista separada por vírgula
 *   NEXT_PUBLIC_TURN_URL  url do TURN
 *   NEXT_PUBLIC_TURN_USERNAME / NEXT_PUBLIC_TURN_CREDENTIAL
 */

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/** STUN públicos usados quando nada é configurado. */
const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function iceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = [];

  const stun = parseList(process.env.NEXT_PUBLIC_STUN_URLS);
  servers.push({ urls: stun.length > 0 ? stun : DEFAULT_STUN });

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (turnUrl) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
    const entry: IceServerConfig = { urls: parseList(turnUrl) };
    if (username) entry.username = username;
    if (credential) entry.credential = credential;
    servers.push(entry);
  }

  return servers;
}

export function iceConfig(): RTCConfiguration {
  return {
    iceServers: iceServers(),
    // `all` para o navegador escolher entre UDP e TCP (TCP salva o caso de
    // rede que bloqueia UDP, ao custo de latência).
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}

/** Há TURN configurado? Usado para avisar o usuário quando a conexão falha. */
export function hasTurn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURN_URL?.trim());
}
