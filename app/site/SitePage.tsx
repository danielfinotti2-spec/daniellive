"use client";

import Link from "next/link";
import { CartaoCriarTransmissao, FormularioEntrar } from "@/components/HomeActions";
import { Cartao, IconeCheck } from "@/components/ui";
import { Mascote } from "@/components/Mascote";
import { VoltarAoInicio } from "@/components/VoltarAoInicio";
import { useTexto } from "@/lib/idioma";

/**
 * O corpo da versão web do DanielLive.
 *
 * Fica separado de `page.tsx` porque aquele arquivo exporta `metadata` e por
 * isso precisa continuar sendo componente de servidor — este lado é de cliente,
 * que é onde o dicionário do idioma em uso existe.
 */
export function SitePage() {
  const t = useTexto();

  /**
   * O que o navegador faz e o que ele não faz.
   *
   * A lista é montada aqui, e não escrita solta no JSX, porque a chave de cada
   * item é o próprio texto traduzido — é o que o `map` usa como `key`.
   */
  const ganhos = [
    t.site.ganhos.item1,
    t.site.ganhos.item2,
    t.site.ganhos.item3,
    t.site.ganhos.item4,
    t.site.ganhos.item5,
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <VoltarAoInicio />

      <div className="mt-8 flex flex-col items-center text-center">
        <Mascote tamanho={72} className="h-18 w-18" />
        <h1 className="mt-6 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          {t.site.tituloPagina}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t.site.subtitulo}
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center">
        <Cartao className="w-full max-w-md p-5 sm:p-7" id="entrar">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t.site.comecarAgora}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t.home.comecarDescricao}
          </p>
          <div className="mt-5">
            <CartaoCriarTransmissao />
          </div>
          <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {t.site.entrarExistente}
            </h3>
            <FormularioEntrar />
          </div>
        </Cartao>
      </div>

      {/* O que o navegador faz e o que ele não faz. A lista existe para a
          escolha entre Site e Download ficar informada, não por acaso. */}
      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Cartao className="p-6">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t.site.ganhosTitulo}
          </h2>
          <ul className="mt-4 grid gap-2.5">
            {ganhos.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                <IconeCheck className="mt-0.5 h-4 w-4 shrink-0 text-broadcast" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao className="p-6">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t.site.limiteTitulo}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t.site.limiteTexto1}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t.site.limiteTexto2}
          </p>
          <Link
            href="/download"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-broadcast hover:underline"
          >
            {t.site.limiteLink}
          </Link>
        </Cartao>

        <Cartao className="p-6 sm:col-span-2 lg:col-span-1">
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t.site.privacidadeTitulo}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t.site.privacidadeTexto}
          </p>
          <Link
            href="/como-funciona"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-broadcast hover:underline"
          >
            {t.site.privacidadeLink}
          </Link>
        </Cartao>
      </section>
    </div>
  );
}
