"use client";

import { useSyncExternalStore } from "react";
import {
  IDIOMAS,
  IDIOMA_PADRAO,
  NOME_DO_IDIOMA,
  definirIdioma,
  preencher,
  useIdioma,
  useTexto,
  type Idioma,
} from "@/lib/idioma";
import { Menu, MenuItem, cx } from "@/components/ui";

/**
 * Seletor de idioma.
 *
 * Um menu, e não um botão que gira entre os idiomas. Com três idiomas, um botão
 * cíclico obrigaria a pessoa a clicar e conferir a cada passo até chegar no que
 * quer — e quem não lê o idioma atual não tem como saber em que ponto do ciclo
 * está. O menu mostra as três opções de uma vez, cada uma escrita no próprio
 * idioma.
 *
 * A montagem segue o `ThemeToggle`: o idioma real só existe no cliente, então
 * até montar o rótulo usa o padrão. Sem isso, o HTML do servidor divergiria do
 * cliente e o React remontaria o componente.
 */
export function SeletorIdioma({ className }: { className?: string }) {
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const idioma = useIdioma();
  const t = useTexto();

  // Antes de montar, o rótulo não pode afirmar qual é o idioma: o servidor não
  // sabe. O nome genérico evita prometer o que ainda não foi lido.
  const rotulo = montado
    ? preencher(t.nav.idiomaMudar, { idioma: NOME_DO_IDIOMA[idioma] })
    : t.nav.idioma;

  return (
    <Menu
      rotulo={rotulo}
      alinhamento="direita"
      className={cx("shrink-0", className)}
      gatilho={() => (
        /*
         * O visual do gatilho é escrito aqui, e não com `BotaoIcone`, porque o
         * `Menu` já envolve o gatilho num elemento com `role="button"` e o
         * tratador de clique. Um `<button>` de verdade dentro dele seria um
         * botão dentro de outro — HTML inválido e dois alvos de clique para a
         * mesma ação.
         */
        <span
          className={cx(
            "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-2 transition-colors",
            "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-950",
            "dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
          )}
        >
          <IconeIdioma />
          {/*
            A sigla aparece só a partir de `sm`: no celular o ícone sozinho
            basta, e a barra já tem o tema, a ajuda e as duas abas disputando
            espaço. `uppercase` porque "pt" em minúsculas lê como variável.
          */}
          <span className="ml-1 hidden text-xs font-semibold uppercase tracking-wide sm:inline">
            {montado ? idioma.split("-")[0] : ""}
          </span>
        </span>
      )}
    >
      {(fechar) =>
        IDIOMAS.map((i) => (
          <MenuItem
            key={i}
            selecionado={montado && i === idioma}
            onClick={() => {
              definirIdioma(i);
              fechar();
            }}
          >
            {NOME_DO_IDIOMA[i]}
          </MenuItem>
        ))
      }
    </Menu>
  );
}

/**
 * O globo.
 *
 * Traço simples, como os outros ícones do projeto, e sem meridiano desenhado em
 * excesso: em 16px, um globo detalhado vira um borrão cinza.
 */
function IconeIdioma() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </svg>
  );
}

export { IDIOMA_PADRAO, type Idioma };
