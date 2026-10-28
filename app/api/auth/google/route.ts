import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

/**
 * Início do login com Google.
 *
 * Apenas um cartão de embarque: guarda um `state` aleatório num cookie
 * httpOnly e manda o navegador para o Google. No retorno, o callback confere
 * que o `state` bate com o do cookie — sem essa conferência, um atacante
 * poderia fazer outra pessoa "entrar" na conta dele (CSRF de login).
 *
 * Só existe configurado: sem GOOGLE_CLIENT_ID/SECRET o primeiro passo já
 * devolve a pessoa para /conta com erro, em vez de apontar para um provedor
 * impossível (era exatamente por isso que o botão some quando não configurado,
 * mas a rota também se protege — URL digitada à mão existe).
 */
export function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/conta?erro=google", request.url), 302);
  }

  const state = randomBytes(24).toString("hex");
  const origem = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() || new URL(request.url).origin;
  const retorno = `${origem}/api/auth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", retorno);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);

  const resposta = NextResponse.redirect(url.toString(), 302);
  resposta.cookies.set("daniellive-oauth-state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // o trâmite com o Google não dura mais que minutos
  });
  return resposta;
}
