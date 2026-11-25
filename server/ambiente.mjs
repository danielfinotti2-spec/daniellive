/**
 * Configuração do servidor público, sem iniciar Next ou abrir portas.
 * Pode ser validada nos testes e reutilizada na Altare e no Render.
 */
export function configurarAmbientePublico(ambiente = process.env) {
  const porta = Number(ambiente.PORT ?? ambiente.SERVER_PORT ?? 3000);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("PORT/SERVER_PORT deve ser uma porta inteira entre 1 e 65535.");
  }

  const hospedeiro = ambiente.HOST?.trim() || "0.0.0.0";

  if (!ambiente.ALLOWED_ORIGINS?.trim()) {
    const endereco = ambiente.ALTARE_URL?.trim() || ambiente.RENDER_EXTERNAL_URL?.trim();
    if (endereco) {
      let url;
      try {
        url = new URL(endereco);
      } catch {
        throw new Error("ALTARE_URL/RENDER_EXTERNAL_URL deve ser uma URL HTTP(S) válida.");
      }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("ALTARE_URL/RENDER_EXTERNAL_URL deve ser uma URL HTTP(S) sem credenciais.");
      }
      ambiente.ALLOWED_ORIGINS = url.origin;
    }
  }

  return { porta, hospedeiro };
}
