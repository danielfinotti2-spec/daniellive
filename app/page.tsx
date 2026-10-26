import Link from "next/link";
import { CartaoCriarTransmissao, FormularioEntrar } from "@/components/HomeActions";
import { Cartao, IconeCheck } from "@/components/ui";

export default function Home() {
  return (
    <>
      {/* Primeira tela: a altura desconta o cabeçalho para o conteúdo ficar
          centralizado sem empurrar a dobra. */}
      <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-start gap-10 px-4 pb-12 pt-10 lg:justify-center lg:py-16">
        <div className="flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
          <div className="w-full max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
              Grátis, sem conta e sem instalar nada
            </span>

            <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-zinc-950 sm:text-4xl lg:text-5xl dark:text-zinc-50">
              Mostre sua tela
              <br />
              <span className="text-broadcast">mandando um link.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              O ScreenLive abre uma sala no navegador e liga quem apresenta a quem assiste, direto
              de um para o outro. Não há programa para instalar nem conta para criar — só o link.
            </p>

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {[
                "Chrome, Edge, Firefox e Safari",
                "Assistir pelo celular funciona",
                "Pode incluir o áudio da aba",
                "Nada fica gravado no servidor",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden className="mt-0.5 shrink-0 text-broadcast">
                    <IconeCheck className="h-4 w-4" />
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* O cartão de ação fica sozinho numa coluna: é o que a pessoa veio
              fazer, e dividir espaço com o texto o colocaria em segundo lugar. */}
          <Cartao className="w-full max-w-md p-5 sm:p-7" id="entrar">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Começar agora
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Crie uma sala e receba um link para convidar quem quiser.
            </p>

            <div className="mt-6">
              <CartaoCriarTransmissao />
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-xs text-zinc-400 dark:text-zinc-600">ou</span>
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
            Como funciona
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-zinc-500 dark:text-zinc-400">
            Não há nada para configurar. O navegador cuida da conexão entre as duas pontas.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                titulo: "Crie a transmissão",
                texto: "Escolha um nome e a sala é criada com um código próprio.",
              },
              {
                titulo: "Copie o link",
                texto: "Um endereço único para mandar por onde você já conversa.",
              },
              {
                titulo: "Compartilhe a tela",
                texto: "Você escolhe a tela, a janela ou a aba. Nada é capturado sem isso.",
              },
              {
                titulo: "A pessoa abre e vê",
                texto: "Quem receber o link assiste na hora, sem instalar nada.",
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
                    {passo.texto}
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
              Ver as instruções completas e as dúvidas comuns
            </Link>
          </div>
        </div>
      </section>

      {/* Privacidade: a pergunta que sempre vem antes de compartilhar a tela. */}
      <section className="border-t border-black/5 bg-zinc-50 px-4 py-16 dark:border-white/5 dark:bg-black">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
          {[
            {
              titulo: "A imagem não passa pelo servidor",
              texto:
                "Ela viaja direto de um navegador para o outro, cifrada pelo próprio WebRTC. O servidor só apresenta as duas pontas uma à outra.",
            },
            {
              titulo: "Você decide o que mostrar",
              texto:
                "O navegador sempre pergunta antes de capturar, e mostra uma barra enquanto isso dura. Fechar essa barra encerra a transmissão.",
            },
            {
              titulo: "Nada é gravado",
              texto:
                "Não há gravação nem histórico. Quando todo mundo sai da sala, ela deixa de existir no servidor.",
            },
          ].map((item) => (
            <Cartao key={item.titulo} className="p-5">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {item.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {item.texto}
              </p>
            </Cartao>
          ))}
        </div>
      </section>
    </>
  );
}
