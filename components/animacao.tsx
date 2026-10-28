"use client";

/**
 * A camada de animação por Motion.
 *
 * Por que Motion, e por que só aqui: `app/globals.css` já cumpre as entradas
 * simples (fade, sheet, brilho) e todo o respeito a `prefers-reduced-motion`.
 * O que CSS não consegue — saídas animadas antes da desmontagem, transições de
 * layout entre estados e gestos com física de mola — fica concentrado neste
 * módulo, para que cada componente decida o "quanto" e aqui fique o "como".
 *
 * Regras mantidas em todo o uso:
 *  - `MotionConfig reducedMotion="user"` na raiz: movimento transformacional
 *    some para quem pediu menos animação, opacidade fica;
 *  - molas suaves e curtas — esta é uma ferramenta de trabalho, não uma página
 *    promocional; nada de overshoot chamativo;
 *  - só `transform` e `opacity` animam, para nunca brigar pelo main thread.
 */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { Transition } from "motion/react";

export { AnimatePresence, motion };
export type { HTMLMotionProps } from "motion/react";

/* --------------------------------------------------------------- contexto */

/**
 * Liga a preferência de menos animação do sistema em todos os componentes
 * `motion.*` da árvore. Precisa estar num cliente perto da raiz — o layout usa
 * no topo da página.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/* ---------------------------------------------------------------- presets */

/** Mola curta e sem exagero para elementos pequenos (menus, selos, avisos). */
export const MOLA_PEQUENA: Transition = { type: "spring", bounce: 0.14, visualDuration: 0.28 };

/** Mola um pouco mais lenta para superfícies grandes (cartões, diálogos). */
export const MOLA_PAINEIS: Transition = { type: "spring", bounce: 0.1, visualDuration: 0.38 };

/** Toque de reação em gesto: o dedo aproxima o botão, não o projeta. */
export const APERTO = { scale: 0.975 } as const;

/* -------------------------------------------------------- entradas em cena */

/**
 * Entrada suave ao montar: sobe 8px enquanto aparece.
 *
 * Serve tanto sozinho quanto em sequência — `atraso` cria o escalonamento sem
 * que cada chamador monte a conta manualmente.
 */
export function Aparecer({
  atraso = 0,
  y = 8,
  className,
  children,
}: {
  /** Segundos antes de começar, para escalonar irmãos. */
  atraso?: number;
  /** Deslocamento inicial na vertical. */
  y?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOLA_PEQUENA, delay: atraso }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Saída antes da desmontagem.
 *
 * O React tira o elemento do DOM no mesmo quadro em que a condição fica falsa;
 * sem `AnimatePresence`, "sumir" é sempre um corte seco. Envolva o condicional:
 *
 *   <Presenca mostrar={erro !== null} chave="erro">
 *     <Aviso tom="erro">…</Aviso>
 *   </Presenca>
 *
 * O filho precisa ser um `motion.*` (ou expor um) para que `exit` toque.
 */
export function Presenca({
  mostrar,
  chave,
  children,
  contClasse,
}: {
  mostrar: boolean;
  chave: string;
  children: React.ReactNode;
  contClasse?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {mostrar ? (
        <motion.div key={chave} className={contClasse}>
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Entra quando a rolagem o traz para a tela, uma única vez.
 *
 * É o que dá vida às seções da home sem transformá-la numa página de efeitos:
 * cada bloco sobe discretamente ao aparecer e fica parado depois disso.
 * `once` evita a distração de reanimar a cada subida e descida da barra.
 */
export function AoEntrarNaTela({
  atraso = 0,
  className,
  children,
}: {
  atraso?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ ...MOLA_PEQUENA, delay: atraso }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ listas */

/**
 * Lista em que entradas e saídas reposicionam os irmãos com mola.
 *
 * `popLayout` tira o item que sai da contagem de layout na hora: quem fica
 * desliza para o lugar novo em vez de pular. Só vale para itens `motion.li`
 * diretos, com `key` estável.
 */
export function ListaViva({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </ul>
  );
}

/** Item da `ListaViva`: entra subindo, sai desvanecendo, desliza ao reordenar. */
export function ItemVivo({
  chave,
  className,
  children,
}: {
  chave: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.li
      layout
      key={chave}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={MOLA_PEQUENA}
      className={className}
    >
      {children}
    </motion.li>
  );
}
