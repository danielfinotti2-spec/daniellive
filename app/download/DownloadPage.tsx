"use client";

import Link from "next/link";
import { Cartao, IconeCheck, IconeWindows } from "@/components/ui";
import { Mascote } from "@/components/Mascote";
import { VoltarAoInicio } from "@/components/VoltarAoInicio";
import { DOWNLOAD, MARCA } from "@/lib/marca";
import { preencher, useTexto, type Dicionario } from "@/lib/idioma";

/**
 * O corpo da página de download do aplicativo.
 *
 * Fica separado de `page.tsx` porque aquele arquivo exporta `metadata` e por
 * isso precisa continuar sendo componente de servidor — este lado é de cliente,
 * que é onde o dicionário do idioma em uso existe.
 *
 * Rótulos, descrições e tamanhos dos arquivos continuam vindo de
 * `lib/marca.ts`, ainda em português: traduzi-los é uma passada à parte.
 */
export function DownloadPage() {  const t = useTexto();
  const principal = DOWNLOAD.arquivos.find((a) => a.principal) ?? DOWNLOAD.arquivos[0];
  const outros = DOWNLOAD.arquivos.filter((a) => a !== principal);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <VoltarAoInicio />

      <div className="mt-8 flex flex-col items-center text-center">
        <Mascote tamanho={72} className="h-18 w-18" />
        {/* O `{marca}` é o nome do produto: entra por marcador, não concatenado. */}
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          {preencher(t.download.tituloPagina, { marca: MARCA.nome })}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t.download.subtitulo}
        </p>
      </div>

      {/* O botão principal fica sozinho e centralizado: é o que a pessoa veio
          fazer. As outras opções vêm depois, sem competir com ele. */}
      <div className="mt-10 flex flex-col items-center">
        {DOWNLOAD.confirmado ? (
          <a
            href={DOWNLOAD.url}
            className="inline-flex items-center gap-2.5 rounded-xl bg-broadcast px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-broadcast"
          >
            <IconeWindows className="h-4.5 w-4.5" />
            {t.download.botao}
          </a>
        ) : (
          <div className="inline-flex flex-col items-center gap-2">
            <span
              aria-disabled
              className="inline-flex cursor-not-allowed items-center gap-2.5 rounded-xl border border-dashed border-zinc-300 px-7 py-3.5 text-base font-semibold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
            >
              <IconeWindows className="h-4.5 w-4.5" />
              {t.download.emBreve}
            </span>
            {/* O aviso aponta para a versão web no meio da frase. A frase é
                partida no marcador `{link}` para o `<Link>` cair na posição que
                cada idioma lhe der, em vez de ficar preso à ordem do português. */}
            <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {t.download.emBreveAviso.split("{link}").flatMap((parte, i, partes) =>
                i < partes.length - 1
                  ? [
                      parte,
                      <Link key={i} href="/site" className="font-medium text-broadcast hover:underline">
                        {t.download.emBreveLink}
                      </Link>,
                    ]
                  : [parte],
              )}
            </p>
          </div>
        )}
        <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {preencher(t.download.arquivoMeta, {
            rotulo: textoDoArquivo(t, principal).rotulo,
            tamanho: principal.tamanho,
          })}
          <br />
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{principal.nome}</span>
        </p>
      </div>

      {/* Requisitos junto do botão: descobrir que a máquina não serve depois de
          baixar 400 MB é um jeito garantido de irritar quem chegou aqui. */}
      <Cartao className="mt-12 p-6">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t.download.antesDeBaixar}
        </h2>
        <ul className="mt-4 grid gap-2.5">
          {t.download.requisitosLista.map((r) => (
            <li key={r} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <IconeCheck className="mt-0.5 h-4 w-4 shrink-0 text-broadcast" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      {/* As opções alternativas ficam separadas e explicadas: quem precisa de uma
          delas sabe que precisa; quem não precisa não deve ser distraído. */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t.download.outrasTitulo}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {outros.map((arquivo) => (
            <Cartao key={arquivo.id} className="p-5">
              <h3 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {textoDoArquivo(t, arquivo).rotulo}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {textoDoArquivo(t, arquivo).descricao}
              </p>
              <p className="mt-3 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                {preencher(t.download.arquivoMeta, {
                  rotulo: arquivo.nome,
                  tamanho: arquivo.tamanho,
                })}
              </p>
            </Cartao>
          ))}
        </div>
      </section>

      <Cartao className="mt-12 p-6">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t.download.semInstalar}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t.download.semInstalarTexto}
        </p>
        <Link
          href="/site"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        >
          {t.download.usarNavegador}
        </Link>
      </Cartao>
    </div>
  );
}

/**
 * O rótulo e a descrição de um arquivo, no idioma em uso.
 *
 * O `lib/marca.ts` guarda o que é dado — o nome do arquivo, o tamanho, qual é o
 * principal. O texto que a pessoa lê fica no dicionário, e a ligação entre os
 * dois é o `id` do arquivo, não o rótulo: casar por texto funcionaria por
 * acidente em português e falharia assim que alguém traduzisse o rótulo, que é
 * justamente o que se está fazendo aqui.
 *
 * Um `id` sem tradução cai no rótulo de `marca.ts`, para que um arquivo novo
 * apareça com o nome certo em vez de sumir da lista.
 */
function textoDoArquivo(
  t: Dicionario,
  arquivo: { id: string; rotulo: string; descricao: string },
): { rotulo: string; descricao: string } {
  const a = t.download.arquivos;
  switch (arquivo.id) {
    case "instalador":
      return { rotulo: a.instaladorRotulo, descricao: a.instaladorDescricao };
    case "portatil":
      return { rotulo: a.portatilRotulo, descricao: a.portatilDescricao };
    case "msi":
      return { rotulo: a.msiRotulo, descricao: a.msiDescricao };
    default:
      return { rotulo: arquivo.rotulo, descricao: arquivo.descricao };
  }
}
