"use client";

import Link from "next/link";
import { CartaoCriarTransmissao, FormularioEntrar } from "@/components/HomeActions";
import { Cartao } from "@/components/ui";
import { RedesSociais } from "@/components/RedesSociais";
import { TextoAmbiente, TrechoAmbiente, ItemRecurso } from "@/components/TextoAmbiente";
import { useTexto } from "@/lib/idioma";

export default function Home() {
  const t = useTexto();
  return (
    <>
      {/* Primeira tela: a altura desconta o cabeçalho para o conteúdo ficar
          centralizado sem empurrar a dobra. */}
      <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-start gap-10 px-4 pb-12 pt-10 lg:justify-center lg:py-16">
        <div className="flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
          <div className="w-full max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
              {/* No site, "sem instalar nada" é o argumento. No aplicativo, quem
                  lê já instalou — o argumento passa a ser não precisar de conta. */}
              <TextoAmbiente web={t.home.seloWeb} app={t.home.seloApp} />
            </span>

            <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-zinc-950 sm:text-4xl lg:text-5xl dark:text-zinc-50">
              {t.home.titulo}
              <br />
              <span className="text-broadcast">{t.home.tituloDestaque}</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              <TrechoAmbiente web={t.home.subtituloWeb} app={t.home.subtituloApp} />
            </p>

            {/*
              Aqui havia o mascote acompanhado da descrição do produto. Os dois
              saíram: o pato já aparece no cabeçalho, e repeti-lo ao lado de um
              texto que apenas reformulava o parágrafo acima ocupava a dobra sem
              acrescentar nada. A lista de recursos começa logo abaixo do título.
            */}

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              <ItemRecurso web={t.home.recursoNavegadoresWeb} app={t.home.recursoNavegadoresApp} />
              <ItemRecurso web={t.home.recursoCelularWeb} app={t.home.recursoCelularApp} />
              <ItemRecurso web={t.home.recursoAudioWeb} app={t.home.recursoAudioApp} />
              <ItemRecurso web={t.home.recursoGravacaoWeb} app={t.home.recursoGravacaoApp} />
            </ul>
          </div>

          {/* O cartão de ação fica sozinho numa coluna: é o que a pessoa veio
              fazer, e dividir espaço com o texto o colocaria em segundo lugar. */}
          <Cartao className="w-full max-w-md p-5 sm:p-7" id="entrar">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.home.comecarAgora}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t.home.comecarDescricao}
            </p>

            <div className="mt-6">
              <CartaoCriarTransmissao />
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400 dark:text-zinc-600">{t.home.ou}</span>
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <FormularioEntrar compacto />
          </Cartao>
        </div>
      </section>

      {/* Como funciona, em quatro passos. */}
      <section className="border-t border-black/5 bg-zinc-50 px-4 py-16 dark:border-white/5 dark:bg-black">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t.home.passosTitulo}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-zinc-500 dark:text-zinc-400">
            <TrechoAmbiente web={t.home.passosWeb} app={t.home.passosApp} />
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                titulo: t.home.passo1Titulo,
                texto: t.home.passo1Web,
                textoApp: t.home.passo1App,
              },
              {
                titulo: t.home.passo2Titulo,
                texto: t.home.passo2Web,
                textoApp: t.home.passo2App,
              },
              {
                titulo: t.home.passo3Titulo,
                texto: t.home.passo3Web,
                textoApp: t.home.passo3App,
              },
              {
                titulo: t.home.passo4Titulo,
                texto: t.home.passo4Web,
                textoApp: t.home.passo4App,
              },
            ].map((passo, i) => (
              <li key={passo.titulo}>
                <Cartao className="h-full p-5">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-broadcast text-xs font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {passo.titulo}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    <TextoAmbiente web={passo.texto} app={passo.textoApp} />
                  </p>
                </Cartao>
              </li>
            ))}
          </ol>

          <div className="mt-10 text-center">
            <Link
              href="/como-funciona"
              className="text-sm font-medium text-broadcast underline underline-offset-2 hover:text-broadcast-strong"
            >
              {t.home.verInstrucoes}
            </Link>
          </div>
        </div>
      </section>

      {/* Privacidade: a pergunta que sempre vem antes de compartilhar a tela. */}
      <section className="border-t border-black/5 bg-zinc-50 px-4 py-16 dark:border-white/5 dark:bg-black">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
          <Cartao className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.home.privacidade.titulo1}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              <TrechoAmbiente
                web={t.home.privacidade.texto1Web}
                app={t.home.privacidade.texto1App}
              />
            </p>
          </Cartao>

          <Cartao className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.home.privacidade.titulo2}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              <TrechoAmbiente
                web={t.home.privacidade.texto2Web}
                app={t.home.privacidade.texto2App}
              />
            </p>
          </Cartao>

          <Cartao className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.home.privacidade.titulo3}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t.home.privacidade.texto3}
            </p>
          </Cartao>
        </div>
      </section>

      {/* Redes sociais: quem gostou do que viu costuma querer acompanhar. */}
      <RedesSociais />
    </>
  );
}
