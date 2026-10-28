import { NextRequest, NextResponse } from "next/server";
import { buscarOuCriarExterno } from "@/lib/auth";
import { abrirSessao } from "@/lib/sessao";

/**
 * Volta do Google com o código: troca por tokens, confirma identidade no
 * userinfo (endpoint oficial) e abre a sessão.
 *
 * Por que `userinfo` em vez de decodificar o id_token: validar a assinatura do
 * JWT custaria uma biblioteca de criptografia assimétrica; chamar o endpoint
 * do Google com o e-mail comprovado já é a prova — e o escopo trouxe exatamente
 * o que a conta precisa (e-mail e nome). Menos código, mesma garantia.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const falhar = () => NextResponse.redirect(new URL("/conta?erro=google", request.url), 302);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!clientId || !clientSecret || !code || !state) return falhar();

  // O state viaja no cookie httpOnly: se não bate, este "retorno" não nasceu
  // de um cartão de embarque emitido por nós para este navegador.
  const cookie = request.cookies.get("daniellive-oauth-state")?.value;
  if (!cookie || cookie !== state) return falhar();

  const origem = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() || url.origin;
  const retorno = `${origem}/api/auth/google/callback`;

  // 1) Troca o código pelos tokens.
  const respToken = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: retorno,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!respToken?.ok) return falhar();
  const tokens = (await respToken.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokens?.access_token) return falhar();

  // 2) Quem é esse token? — a resposta oficial já traz o e-mail verificado.
  const respUser = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!respUser?.ok) return falhar();
  const perfil = (await respUser.json().catch(() => null)) as
    | { email?: string; email_verified?: boolean; name?: string }
    | null;
  if (!perfil?.email || perfil.email_verified === false) return falhar();

  // 3) Conta local (criada na primeira entrada Google) e já com sessão aberta.
  const conta = buscarOuCriarExterno(perfil.email, perfil.name ?? perfil.email.split("@")[0], "google");
  if (!conta.ok) return falhar();
  await abrirSessao(conta.valor.id);

  // O state só prestava uma vez: some junto com a resposta final.
  const resposta = NextResponse.redirect(new URL("/conta", request.url), 302);
  resposta.cookies.delete("daniellive-oauth-state");
  return resposta;
}
