"use client";

import Link from "next/link";
import { FormularioEntrar } from "@/components/HomeActions";
import { TextoAmbiente, TrechoAmbiente } from "@/components/TextoAmbiente";
import { Aviso, Cartao, CartaoSecao } from "@/components/ui";
import { preencher, useTexto, type Dicionario } from "@/lib/idioma";

/**
 * A página "Como funciona" — corpo.
 *
 * Fica separada de `page.tsx` porque aquele arquivo exporta `metadata`, e um
 * componente de servidor com `metadata` não pode receber `"use client"`. O
 * `<title>` da aba continua sendo gerado no servidor; só o texto visível muda
 * de idioma, e é este arquivo que cuida dele.
 */
export function ComoFuncionaPage() {
  const t = useTexto();
  const c = t.comoFunciona;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
        {c.titulo}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
        <TrechoAmbiente web={c.introWeb} app={c.introApp} />
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <CartaoSecao titulo={c.transmitirTitulo} descricao={c.tresPassos}>
          <ol className="flex flex-col gap-4">
            <PassoTransmitir
              numero={1}
              titulo={c.passo1}
              web={c.passo1Texto}
              app={c.passo1Texto}
            />
            <PassoTransmitir
              numero={2}
              titulo={c.passo2}
              web={c.passo2Web}
              app={c.passo2App}
            />
            <PassoTransmitir
              numero={3}
              titulo={c.passo3}
              web={c.passo3Texto}
              app={c.passo3Texto}
            />
          </ol>
        </CartaoSecao>

        <CartaoSecao titulo={c.controlarTitulo} descricao={c.duranteTransmissao}>
          <dl className="flex flex-col gap-4">
            {[
              { t: c.controlarPausar, d: c.controlarPausarTexto },
              { t: c.controlarQualidade, d: c.controlarQualidadeTexto },
              { t: c.controlarAudio, d: c.controlarAudioTexto },
              { t: c.controlarEncerrar, d: c.controlarEncerrarTexto },
            ].map((item) => (
              <div key={item.t}>
                <dt className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.t}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.d}
                </dd>
              </div>
            ))}
          </dl>
        </CartaoSecao>

        <CartaoSecao titulo={c.navegadoresTitulo} descricao={c.navegadoresDescricao}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th scope="col" className="py-2 pr-4 font-semibold">{c.colNavegador}</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">{c.colTransmitir}</th>
                  <th scope="col" className="py-2 font-semibold">{c.colAssistir}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {[
                  [c.navChromeEdge, c.simComAudioAba, c.sim],
                  [c.navFirefox, c.simSemAudioAba, c.sim],
                  [c.navSafari, c.simSemAudioAba, c.sim],
                  [c.navCelular, c.naoSoAssistir, c.sim],
                ].map(([nav, trans, ass]) => (
                  <tr key={nav}>
                    <td className="py-2.5 pr-4 text-zinc-800 dark:text-zinc-200">{nav}</td>
                    <td className="py-2.5 pr-4 text-zinc-500 dark:text-zinc-400">{trans}</td>
                    <td className="py-2.5 text-zinc-500 dark:text-zinc-400">{ass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {/*
              A nota troca de forma entre ambientes: no site ela traz dois
              trechos de código (`https://` e `localhost`), no aplicativo uma
              palavra em destaque. Por isso são dois textos distintos, e não um
              com marcadores opcionais.
            */}
            <TrechoAmbiente
              web={<NotaSegurancaWeb texto={c.notaSegurancaWeb} t={c} />}
              app={
                <FraseComDestaque
                  texto={c.notaSegurancaApp}
                  destaque={c.destaqueAssiste}
                  marcador="destaque"
                />
              }
            />
          </p>
        </CartaoSecao>

        <CartaoSecao titulo={c.naoConectaTitulo} descricao={c.naoConectaDescricao}>
          <div className="flex flex-col gap-4">
            <Aviso tom="info" titulo={c.avisoRedeTitulo}>
              <TrechoAmbiente
                web={<FraseComDestaque texto={c.avisoRedeWeb} destaque={c.tecnicoIceServers} marcador="code" mono />}
                app={c.avisoRedeApp}
              />
            </Aviso>
            <Aviso tom="info" titulo={c.avisoSalaTitulo}>
              {c.avisoSalaTexto}
            </Aviso>
          </div>
        </CartaoSecao>

        <CartaoSecao titulo={c.privacidadeTitulo} descricao={c.privacidadeDescricao}>
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            <TrechoAmbiente web={c.privacidadeWeb} app={c.privacidadeApp} />
          </p>
        </CartaoSecao>

        <Cartao className="p-6">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {c.prontoTitulo}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{c.prontoTexto}</p>
          <div className="mt-5 flex flex-col gap-4">
            <Link
              href="/transmitir"
              className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-broadcast px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-broadcast-strong"
            >
              {t.home.criar}
            </Link>
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <FormularioEntrar compacto />
            </div>
          </div>
        </Cartao>
      </div>
    </div>
  );
}

/**
 * A nota de segurança do site, com dois trechos técnicos no meio.
 *
 * Só o site tem esta frase. Os dois trechos (`https://` e `localhost`) são
 * literais técnicos: ficam monoespaçados e na posição que o idioma pedir.
 *
 * Os dois marcadores têm nomes diferentes — `{code}` e `{code2}` — e é isso que
 * permite dividir em sequência: cada `split` corta uma vez só e devolve o
 * pedaço antes e o depois. A versão anterior procurava `{code}` duas vezes e
 * esperava três partes, o que nunca acontecia; o `{code2}` sobrava no texto e
 * aparecia literal na tela, nos três idiomas.
 */
function NotaSegurancaWeb({
  texto,
  t,
}: {
  texto: string;
  t: Dicionario["comoFunciona"];
}) {
  const [antesDoPrimeiro, resto] = texto.split("{code}");
  if (resto === undefined) return <>{texto}</>;
  const [entreOsDois, depoisDoSegundo] = resto.split("{code2}");
  if (depoisDoSegundo === undefined) return <>{texto}</>;
  return (
    <>
      {antesDoPrimeiro}
      <span className="font-mono">{t.tecnicoHttps}</span>
      {entreOsDois}
      <span className="font-mono">{t.tecnicoLocalhost}</span>
      {depoisDoSegundo}
    </>
  );
}

/**
 * Uma frase com um trecho em destaque, na posição que o idioma mandar.
 *
 * O marcador é passado por parâmetro porque a mesma ideia serve para dois casos
 * diferentes: um trecho de código monoespaçado e uma palavra em negrito. Se o
 * marcador não existir no texto, a frase sai inteira e sem destaque — um erro
 * de tradução vira texto sem estilo, não texto ausente.
 */
function FraseComDestaque({
  texto,
  destaque,
  marcador,
  mono,
}: {
  texto: string;
  destaque: string;
  marcador: string;
  mono?: boolean;
}) {
  const partes = texto.split(`{${marcador}}`);
  if (partes.length !== 2) return <>{texto}</>;
  return (
    <>
      {partes[0]}
      {mono ? (
        <span className="font-mono">{destaque}</span>
      ) : (
        <strong className="font-medium">{destaque}</strong>
      )}
      {partes[1]}
    </>
  );
}

/**
 * Um passo numerado da lista de quem transmite.
 *
 * Existe como componente porque o texto do passo 2 muda conforme o ambiente: no
 * site quem abre o seletor é o navegador, e há abas; no aplicativo quem abre é o
 * próprio DanielLive, e abas do navegador não fazem parte do que ele captura.
 */
function PassoTransmitir({
  numero,
  titulo,
  web,
  app,
}: {
  numero: number;
  titulo: string;
  web: string;
  app: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-broadcast text-xs font-bold text-white"
      >
        {numero}
      </span>
      <div>
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{titulo}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          <TextoAmbiente web={web} app={app} />
        </p>
      </div>
    </li>
  );
}
