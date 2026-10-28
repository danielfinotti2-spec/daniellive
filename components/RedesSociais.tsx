"use client";

import { redesConfirmadas, redesPendentes, MARCA } from "@/lib/marca";
import { IconeRede, IconeExterno, cx } from "@/components/ui";
import { preencher, useTexto } from "@/lib/idioma";

/**
 * Seção de redes sociais da página inicial.
 *
 * Regra que a interface segue: **só vira link o que foi confirmado.** Uma rede
 * ainda não preenchida não some da tela — ela aparece como "a confirmar". Isso
 * é deliberado em duas frentes:
 *
 *  - ninguém clica num endereço que não existe nem cai no perfil de outra
 *    pessoa;
 *  - quem mantém o projeto vê, na própria página, o que ainda falta preencher,
 *    em vez de descobrir depois.
 *
 * Os links confirmados abrem em nova aba com `rel="noopener noreferrer"` e têm
 * rótulo acessível que diz o nome da rede e que o link é externo.
 */
export function RedesSociais() {
  const t = useTexto();
  const confirmadas = redesConfirmadas();
  const pendentes = redesPendentes();

  return (
    <section
      id="redes"
      aria-labelledby="redes-titulo"
      className="border-t border-zinc-200/70 px-5 py-14 sm:px-8 dark:border-zinc-800"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2">
          <h2 id="redes-titulo" className="text-xl font-semibold tracking-tight">
            {preencher(t.redes.titulo, { marca: MARCA.nome })}
          </h2>
          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            {/*
              O `@` e o handle não se traduzem; só a moldura da frase. A chave
              recebe o autor já com o `@` para a pontuação final ficar fora dele.
            */}
            {preencher(t.redes.descricao, { autor: `@${MARCA.autor}` })}
          </p>
        </div>

        {confirmadas.length > 0 && (
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {confirmadas.map((rede) => (
              <li key={rede.id}>
                <a
                  href={rede.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cx(
                    "group flex items-center gap-3 rounded-xl border border-zinc-200/70",
                    "bg-white px-4 py-3.5 transition-colors",
                    "hover:border-zinc-300 hover:bg-zinc-50",
                    "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-broadcast",
                  )}
                >
                  <span className="text-zinc-500 transition-colors group-hover:text-zinc-950 dark:text-zinc-400 dark:group-hover:text-zinc-50">
                    <IconeRede id={rede.id} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{rede.nome}</span>
                    {rede.usuario && (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        @{rede.usuario}
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-400 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                    <IconeExterno />
                    <span className="sr-only">
                      {preencher(t.redes.externo, { rede: rede.nome })}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {confirmadas.length === 0 && (
          <p className="mt-7 rounded-xl border border-dashed border-zinc-300 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {t.redes.semConfirmadas}
          </p>        )}

        {/*
          Enquanto houver rede sem confirmar, mostramos a lista. É o lembrete
          visível de que falta preencher, e some sozinho quando o último
          endereço for confirmado.
        */}
        {pendentes.length > 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 px-4 py-3.5 dark:border-zinc-700">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {t.redes.pendentesTitulo}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
              {pendentes.map((rede) => (
                <li
                  key={rede.id}
                  className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-600"
                >
                  <IconeRede id={rede.id} className="h-4 w-4" />
                  <span>
                    {preencher(t.redes.pendentesItem, {
                      rede: rede.nome,
                      usuario: rede.usuario
                        ? preencher(t.redes.usuarioComArroba, { usuario: rede.usuario })
                        : "",
                    })}
                  </span>
                </li>
              ))}
            </ul>
            {/*
              Instrução para quem mantém o projeto. Some junto com a lista, e
              por isso pode ser específica sem poluir a página publicada.
            */}
            {/*
              A frase fica no dicionário com dois marcadores porque os valores
              são código (`lib/marca.ts`, `confirmado: true`): eles aparecem
              dentro de `<code>` e não podem ser traduzidos junto com o texto.
              Os dois pedaços são JSX, então a interpolação é feita em duas
              partes — o que muda entre idiomas é só a ordem delas.
            */}
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
              {t.redes.pendentesInstrucao.split(/(\{arquivo\}|\{confirmado\})/).map((pedaco, i) => {
                if (pedaco === "{arquivo}") {
                  return (
                    <code
                      key={i}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.7rem] dark:bg-zinc-900"
                    >
                      lib/marca.ts
                    </code>
                  );
                }
                if (pedaco === "{confirmado}") {
                  return (
                    <code key={i} className="font-mono text-[0.7rem]">
                      confirmado: true
                    </code>
                  );
                }
                return pedaco;
              })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Versão compacta, para o rodapé: só os ícones, sem os rótulos.
 *
 * Os rótulos continuam existindo para leitores de tela, via `aria-label`, então
 * a economia de espaço não custa acessibilidade.
 */
export function RedesRodape() {
  const t = useTexto();
  const confirmadas = redesConfirmadas();
  const pendentes = redesPendentes();

  if (confirmadas.length === 0 && pendentes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {t.redes.rodapeTitulo}
      </p>
      <ul className="flex flex-wrap items-center gap-1.5">
        {confirmadas.map((rede) => (
          <li key={rede.id}>
            <a
              href={rede.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={preencher(t.redes.rodapeConfirmada, {
                rede: rede.nome,
                autor: MARCA.autor,
              })}
              className={cx(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/70",
                "text-zinc-500 transition-colors",
                "hover:border-zinc-300 hover:text-zinc-950",
                "dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-50",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-broadcast",
              )}
            >
              <IconeRede id={rede.id} className="h-4 w-4" />
            </a>
          </li>
        ))}
        {/*
          No rodapé as pendentes não são link: são só o ícone, esmaecido, com o
          rótulo dizendo que ainda falta confirmar. Sem `href`, não há clique
          para lugar nenhum.
        */}
        {pendentes.map((rede) => (
          <li key={rede.id}>
            <span
              aria-label={preencher(t.redes.rodapePendente, { rede: rede.nome })}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-300 dark:border-zinc-700 dark:text-zinc-700"
            >
              <IconeRede id={rede.id} className="h-4 w-4" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
