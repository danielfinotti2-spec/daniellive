/**
 * Porteiro da rota de assistir — corre ANTES da página começar a responder.
 *
 * Por que existe: a sala ganhou um `loading.tsx` (o esqueleto que aparece na
 * navegação). Com ele, o Next abre o streaming imediatamente — e o cabeçalho
 * sai com 200 antes que a página possa dizer 404. A sala fica correta na
 * tela, mas o status mente, e buscadores não gostam de 200 em endereço que
 * não existe (a documentação do App Router aponta exatamente este trade-off e
 * indica verificar antes da resposta, em Proxy).
 *
 * A validação roda aqui e o pedido é reescrito para `/sala-nao-existe`, uma
 * rota mínima cuja única função é disparar `notFound()`. Como ela não tem
 * `loading.tsx` próprio, o 404 sai no status — e a página de "não encontrado"
 * é a mesma de sempre, com a URL original preservada (rewrite, não redirect).
 *
 * O import de `lib/room-code` é seguro apesar do aviso da documentação sobre
 * módulos compartilhados: ele é um módulo-folha puro (sem estado, sem IO), e
 * este projeto é auto-hospedado em Node — não há desdobramento para uma CDN
 * de borda que exigiria o código inline.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

export function proxy(request: NextRequest) {
  // O matcher já garante o prefixo; aqui sobra só o código (vazio se nulo).
  const codigo = request.nextUrl.pathname.replace(/^\/assistir\/?/, "");
  const normalizado = normalizeRoomCode(codigo) ?? "";

  if (!isValidRoomCode(normalizado)) {
    return NextResponse.rewrite(new URL("/sala-nao-existe", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/assistir/:code*"],
};
