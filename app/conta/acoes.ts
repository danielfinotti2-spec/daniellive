"use server";

/**
 * As ações da conta: cadastro, entrada, saída e amizades.
 *
 * Cada formulário devolve um código curto (`erro`) em vez de texto — quem
 * fala a língua da pessoa é o dicionário na interface, e isso mantém estas
 * ações enxutas e testáveis. O sucesso de cadastro/entrada já abre a sessão
 * e navega para a conta no mesmo roundtrip.
 */

import { redirect } from "next/navigation";
import {
  criarUsuario,
  autenticar,
  enviarPedido,
  aceitarPedido,
  desfazer,
} from "@/lib/auth";
import { abrirSessao, fecharSessao, usuarioAtual } from "@/lib/sessao";

export type EstadoAutenticacao = { erro: string | null };
export type EstadoAmizades = { erro: string | null; mensagem: string | null };

/** Cria a conta e já entra nela. Nascimento é obrigatório (validado de novo no back). */
export async function acaoCadastrar(
  _anterior: EstadoAutenticacao,
  dados: FormData,
): Promise<EstadoAutenticacao> {
  const apelidoBruto = String(dados.get("apelido") ?? "").trim();
  const r = criarUsuario(
    String(dados.get("email") ?? ""),
    String(dados.get("senha") ?? ""),
    String(dados.get("nome") ?? ""),
    {
      nascimento: String(dados.get("nascimento") ?? ""),
      apelido: apelidoBruto || undefined,
    },
  );
  if (!r.ok) return { erro: r.erro };
  await abrirSessao(r.valor.id);
  redirect("/conta");
}

/** Entra com e-mail e senha de uma conta criada aqui. */
export async function acaoEntrar(
  _anterior: EstadoAutenticacao,
  dados: FormData,
): Promise<EstadoAutenticacao> {
  const r = autenticar(String(dados.get("email") ?? ""), String(dados.get("senha") ?? ""));
  if (!r.ok) return { erro: r.erro };
  await abrirSessao(r.valor.id);
  redirect("/conta");
}

/** Encerra a sessão desta máquina (sessões em outros lugares continuam). */
export async function acaoSair(): Promise<void> {
  await fecharSessao();
  redirect("/conta");
}

/** Manda pedido de amizade para o e-mail informado. Só com sessão ativa. */
export async function acaoAdicionarAmigo(
  _anterior: EstadoAmizades,
  dados: FormData,
): Promise<EstadoAmizades> {
  const usuario = await usuarioAtual();
  if (!usuario) return { erro: "nao_logado", mensagem: null };
  const r = enviarPedido(usuario.id, String(dados.get("email") ?? ""));
  if (!r.ok) return { erro: r.erro, mensagem: null };
  return { erro: null, mensagem: r.valor === "aceito" ? "amizade_direta" : "pedido_enviado" };
}

/** Aceita um pedido recebido. O id vai escondido no próprio formulário. */
export async function acaoAceitarPedido(
  _anterior: EstadoAmizades,
  dados: FormData,
): Promise<EstadoAmizades> {
  const usuario = await usuarioAtual();
  if (!usuario) return { erro: "nao_logado", mensagem: null };
  const r = aceitarPedido(usuario.id, Number(dados.get("pedidoId")));
  if (!r.ok) return { erro: r.erro, mensagem: null };
  return { erro: null, mensagem: "amizade_aceita" };
}

/** Recusa um pedido ou desfaz uma amizade — a mesma operação, para ambos. */
export async function acaoDesfazer(
  _anterior: EstadoAmizades,
  dados: FormData,
): Promise<EstadoAmizades> {
  const usuario = await usuarioAtual();
  if (!usuario) return { erro: "nao_logado", mensagem: null };
  const r = desfazer(usuario.id, Number(dados.get("pedidoId")));
  if (!r.ok) return { erro: r.erro, mensagem: null };
  return { erro: null, mensagem: "removido" };
}
