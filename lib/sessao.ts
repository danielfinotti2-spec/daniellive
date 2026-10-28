/**
 * A sessão do navegador: ler quem é, abrir, renovar e fechar.
 *
 * Cola entre `lib/auth.ts` (que só conhece o banco) e o Next (que só conhece
 * cookies). O cookie guarda o token opaco; o banco guarda o hash — mesmo se
 * o arquivo do banco vazasse, nenhuma sessão ativa seria revelada.
 *
 * Opções do cookie e por quê:
 *  - `httpOnly`: o token nunca passa pelo JavaScript da página — um XSS não o
 *    rouba, porque nem o próprio código legítimo o lê.
 *  - `sameSite: "lax"`: navegação vinda de um link externo está logada, mas um
 *    POST feito por outro site não carrega o cookie — bloqueio natural de CSRF.
 *  - sem `secure`: o site precisa de HTTPS para compartilhar a tela de
 *    qualquer jeito (o navegador exige contexto seguro), e o aplicativo desktop
 *    fala com o servidor local em http://127.0.0.1, onde `Secure` seria
 *    recusado. `Lax` + HTTPS do resto da-stack já dão a proteção que cabe.
 *
 * SÓ SERVIDOR: este arquivo lê cookies do Next — importar num componente de
 * cliente é erro e a build deixa isso claro.
 */

import { cookies } from "next/headers";
import {
  criarSessao,
  donoDaSessao,
  encerrarSessao,
  renovarSessao,
  SESSAO_DIAS,
  type Usuario,
} from "./auth.ts";

export const COOKIE_SESSAO = "daniellive-sessao";

/** Quem tem uma sessão válida neste pedido — ou ninguém (`null`). */
export async function usuarioAtual(): Promise<Usuario | null> {
  const armazem = await cookies();
  const token = armazem.get(COOKIE_SESSAO)?.value ?? null;
  const dono = donoDaSessao(token);
  if (dono && token) {
    // Renovar na visita: quem usa todo dia nunca cai no prazo de 30 dias.
    renovarSessao(token);
  }
  return dono;
}

/** Abre a sessão no navegador após um login confirmado. */
export async function abrirSessao(usuarioId: string): Promise<void> {
  const armazem = await cookies();
  const token = criarSessao(usuarioId);
  armazem.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSAO_DIAS * 24 * 60 * 60,
  });
}

/** Fecha a sessão atual, se existir. */
export async function fecharSessao(): Promise<void> {
  const armazem = await cookies();
  const token = armazem.get(COOKIE_SESSAO)?.value ?? null;
  if (token) encerrarSessao(token);
  armazem.delete(COOKIE_SESSAO);
}
