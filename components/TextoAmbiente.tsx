"use client";

import { useAplicativo } from "@/lib/desktop";
import { IconeCheck } from "@/components/ui";

/**
 * Escolhe entre dois textos conforme o ambiente.
 *
 * Existe para as páginas que são componentes de servidor (a página inicial, o
 * "Como funciona"): elas não podem chamar o hook, e passar o texto pronto do
 * servidor seria impossível — o servidor não sabe onde a página vai rodar.
 * Este componente é a ponte: o servidor renderiza a versão `web` e o cliente
 * troca para a versão `app` na hidratação, sem divergência de HTML.
 *
 * A troca é só de texto: quem decide o resto é o mesmo layout, com as mesmas
 * cores e a mesma tipografia nos dois ambientes.
 */
export function TextoAmbiente({
  web,
  app,
  className,
}: {
  /** Texto usado no site. */
  web: string;
  /** Texto usado dentro do aplicativo instalado. */
  app: string;
  className?: string;
}) {
  const noAplicativo = useAplicativo();
  return <span className={className}>{noAplicativo ? app : web}</span>;
}

/**
 * O mesmo que `TextoAmbiente`, mas devolve a frase inteira e aceita destaque.
 *
 * Alguns trechos não são uma frase fechada: são um pedaço dentro de um parágrafo
 * maior que continua igual nos dois ambientes. Aqui o conteúdo é livre, para o
 * chamador montar o que precisar em cada caso.
 */
export function TrechoAmbiente({
  web,
  app,
}: {
  web: React.ReactNode;
  app: React.ReactNode;
}) {
  const noAplicativo = useAplicativo();
  return <>{noAplicativo ? app : web}</>;
}

/**
 * Um item da lista de recursos da página inicial, com o visto ao lado.
 *
 * Vive aqui, e não na página, porque o texto muda conforme o ambiente: no
 * aplicativo, "Chrome, Edge, Firefox e Safari" e "áudio da aba" descrevem um
 * navegador que o usuário não está usando — quem transmite ali é o próprio
 * aplicativo, e o áudio disponível é o do sistema.
 */
export function ItemRecurso({ web, app }: { web: string; app: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span aria-hidden className="mt-0.5 shrink-0 text-broadcast">
        <IconeCheck className="h-4 w-4" />
      </span>
      <TextoAmbiente className="text-zinc-700 dark:text-zinc-300" web={web} app={app} />
    </li>
  );
}
