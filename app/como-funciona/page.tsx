import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Como funciona",
  description: "Entenda em um minuto como o ScreenLive leva sua tela até quem assiste.",
};

export default function ComoFuncionaPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Como funciona</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Sem programa para instalar, sem conta para criar. A tela sai do seu navegador e chega ao
        navegador de quem assiste.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">Para quem transmite</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              Abra <Link href="/transmitir" className="text-brand underline">Criar transmissão</Link> e
              escolha o seu nome. A sala é criada na hora.
            </li>
            <li>Copie o link e mande para quem vai assistir.</li>
            <li>
              Clique em <strong>Compartilhar minha tela</strong>. O navegador pergunta o que mostrar
              — tela inteira, uma janela ou uma aba.
            </li>
            <li>
              Para terminar, clique em <strong>Parar</strong> ou use o botão “Parar compartilhamento”
              que o próprio navegador exibe.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Para quem assiste</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Abra o link recebido. Nada é instalado.</li>
            <li>Se a transmissão já começou, a tela aparece sozinha.</li>
            <li>
              Se ainda não começou, a página avisa e conecta assim que o anfitrião iniciar — não
              precisa recarregar.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Dúvidas comuns</h2>
          <dl className="mt-3 space-y-4 text-sm leading-relaxed">
            <div>
              <dt className="font-medium">Preciso criar conta?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Não. O link é a chave da sala. Quem tem o link, entra.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Dá para transmitir com áudio?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Sim, quando o navegador permite. No Chrome e no Edge, escolha “Compartilhar áudio da
                aba” ou “do sistema” na janela de seleção. No Safari e no Firefox o áudio do sistema
                não é capturável — o vídeo funciona normalmente.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Funciona no celular?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Assistir, sim, em qualquer navegador móvel moderno. Transmitir a tela pelo celular
                depende do navegador: no Android o Chrome permite; no iOS o Safari não permite
                capturar a tela de outros aplicativos.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Quantas pessoas podem assistir?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Até 32 por sala. Como cada espectador recebe uma conexão direta do anfitrião, o
                consumo de banda de quem transmite cresce com o público.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Minha tela fica gravada?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Não. Nada é gravado no servidor, e a imagem trafega direto entre os navegadores.
              </dd>
            </div>
            <div>
              <dt className="font-medium">E se a conexão não abrir?</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                Redes corporativas com firewall rígido às vezes bloqueiam a conexão direta. Quando
                isso acontece, a página explica o motivo. Um servidor TURN resolve — veja a seção de
                configuração no README do projeto.
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-12 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pronto para começar? O primeiro passo leva um clique.
        </p>
        <Link
          href="/transmitir"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          Criar transmissão
        </Link>
      </div>
    </div>
  );
}
