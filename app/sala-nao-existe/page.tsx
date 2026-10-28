import { notFound } from "next/navigation";

/**
 * Rota-destino para códigos de sala com formato impossível.
 *
 * O `proxy.ts` reescreve `/assistir/<codigo-inválido>` para cá porque só um
 * `notFound()` executado ANTES de qualquer streaming preserva o status 404 —
 * a sala de assistir tem `loading.tsx`, e com Suspense no caminho o cabeçalho
 * sairia 200 antes que a página pudesse recusar o código.
 *
 * Chegar aqui diretamente (`/sala-nao-existe` na barra de endereços) dá na
 * mesma página: o comportamento é o esperado em qualquer endereço em que "a
 * coisa que se pediu não existe".
 */
export default function SalaNaoExiste() {
  notFound();
}
