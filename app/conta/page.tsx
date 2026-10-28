import type { Metadata } from "next";
import { ContaPage } from "./ContaPage";
import { usuarioAtual } from "@/lib/sessao";
import { listarAmigos, pedidosRecebidos } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = {
  title: `Sua conta — ${MARCA.nome}`,
  description: "Crie sua conta no DanielLive, entre e gerencie seus amigos.",
};

export const dynamic = "force-dynamic";

/**
 * A porta da conta: cadastro, entrada e amizades.
 *
 * Uma só tela resolve os dois mundos — quem não tem sessão vê os formulários
 * de criar/entrar, quem tem vê o próprio nome e os amigos. A lógica de banco
 * fica no servidor; aqui entra só o que a interface precisa (usuário, listas
 * e a informação honesta de se o Google está configurado: o botão só aparece
 * quando há credenciais para o provedor funcionar de verdade).
 */
export default async function Conta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await usuarioAtual();
  const parametros = await searchParams;
  // O caminho do Google volta pela URL quando algo falha no meio do caminho.
  const erroEntrada = parametros.erro === "google" ? "google_falhou" : null;
  const dados = usuario
    ? {
        usuario,
        amigos: listarAmigos(usuario.id),
        pedidos: pedidosRecebidos(usuario.id),
      }
    : null;
  const googleHabilitado = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  return <ContaPage dados={dados} googleHabilitado={googleHabilitado} erroEntrada={erroEntrada} />;
}
