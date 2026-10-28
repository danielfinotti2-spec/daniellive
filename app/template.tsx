"use client";

/**
 * Transição entre rotas.
 *
 * `template.tsx` remonta a cada navegação — é o gancho natural de entrada que
 * o App Router oferece sem troca de páginas manual. Cada tela chega subindo
 * levemente; a saída continua instantânea (o App Router desmonta ao navegar),
 * o que lê como intenção: chega com suavidade, vai embora sem enrolação.
 *
 * O `div` precisa ter tamanho próprio — `display: contents` não pode ser
 * transformado nem opacado — então ele espelha o flex do `<main>` e os filhos
 * ocupam o mesmo espaço de sempre.
 */

import { motion, MOLA_PEQUENA } from "@/components/animacao";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOLA_PEQUENA}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
