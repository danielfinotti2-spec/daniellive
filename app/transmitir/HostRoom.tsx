"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotaoCopiar } from "@/components/CopyButton";
import { useSuporteCaptura, AvisoContextoInseguro } from "@/components/HomeActions";
import { CampoNome, useNomeGuardado } from "@/components/NameField";
import { SeloAoVivo, SeloSinalizacao, SeloEspectador, BarraQualidade } from "@/components/StatusBadges";
import { PalcoVideo } from "@/components/VideoSurface";
import {
  Aviso,
  Botao,
  Cartao,
  CartaoSecao,
  Dialogo,
  Entrada,
  Interruptor,
  Menu,
  MenuItem,
  MenuSeparador,
  Selo,
  Selecao,
  Spinner,
  cx,
} from "@/components/ui";
import { useHost } from "@/lib/useHost";
import { useAplicativo } from "@/lib/desktop";
import { VoltarAoInicio } from "@/components/VoltarAoInicio";
import { AnimatePresence, ListaViva, ItemVivo } from "@/components/animacao";
import { preencher, useTexto } from "@/lib/idioma";
import type { CaptureOptions } from "@/lib/webrtc";

/**
 * A ordem das qualidades no menu.
 *
 * Só a ordem mora aqui. O texto de cada uma vem do dicionário, em dois
 * tamanhos: `qualidadeCurta` para o botão, `qualidadeLonga` para a lista.
 *
 * Antes existia uma constante com o texto completo, e o botão mostrava
 * `.split(" ")[0]` — a primeira palavra. Isso funcionava em português por
 * acidente: "1080p (nitidez máxima)" começa com o que interessa. Numa tradução
 * em que o qualificador viesse primeiro, o botão mostraria a palavra errada, e
 * não haveria erro de compilação para avisar.
 */
const QUALIDADES: CaptureOptions["quality"][] = ["auto", "1080p", "720p", "480p"];

/**
 * Sala de controle de quem transmite.
 *
 * A ordem da tela segue a ordem em que as decisões são tomadas: primeiro quem
 * você é, depois o que será mostrado, e só então o link — porque um link só
 * faz sentido depois que existe algo para assistir.
 */
export function HostRoom() {
  const t = useTexto();
  const [nome, setNome] = useNomeGuardado();
  const host = useHost({ name: nome.trim() || "Apresentador" });
  const [dialogoQualidade, setDialogoQualidade] = useState(false);

  const podeCapturar = useSuporteCaptura();
  const nomePronto = nome.trim().length > 0;
  const aoVivo = host.phase === "ao-vivo";
  const noAplicativo = useAplicativo();
  /** A captura está sendo pedida agora: o palco dá lugar a um estado de espera. */
  const abrindoCaptura = host.phase === "criando" && Boolean(host.code);

  // Avisa antes de fechar a aba com uma transmissão em andamento: fechar sem
  // querer derrubaria todo mundo que está assistindo.
  useEffect(() => {
    if (!aoVivo) return;
    const aoSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [aoVivo]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/*
        A saída da sala fica acima do título, e não no cabeçalho do site.
        Durante uma transmissão o cabeçalho encolhe para dar espaço à imagem, e
        quem está ao vivo precisa de um caminho de volta que não dependa dele —
        mais ainda no aplicativo, onde não existe botão "voltar" do navegador.
      */}
      <VoltarAoInicio />

      {/* Cabeçalho da sala */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-zinc-50">
          {t.transmitir.titulo}
        </h1>
        <SeloAoVivo ativo={aoVivo && !host.pausado} />
        <SeloSinalizacao status={host.status} />
        {host.pausado && <Selo tom="aviso">{t.assistir.pausada}</Selo>}
        <Link
          href="/como-funciona"
          className="ml-auto text-sm font-medium text-zinc-500 underline underline-offset-2 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {t.comum.ajuda}
        </Link>
      </div>

      {/*
       * Erros e avisos saem desvanecendo (AnimatePresence montado sempre, a
       * condição dentro dele). Dois `AnimatePresence` separados porque as duas
       * mensagens são independentes — uma pode dispensar a outra.
       */}
      <div className="mt-4 flex flex-col gap-3">
        <AnimatePresence>{host.error && (
          <Aviso key="erro" tom="erro" titulo={t.transmitir.erroTitulo} aoFechar={host.dismissError}>
            {host.error}
          </Aviso>
        )}</AnimatePresence>
        <AnimatePresence>{host.notice && (
          <Aviso key="aviso" tom="info" aoFechar={host.dismissNotice}>
            {host.notice}
          </Aviso>
        )}</AnimatePresence>
      </div>
      {!podeCapturar && (
        <div className="mt-4">
          <Aviso tom="erro" titulo={t.transmitir.semCapturaTitulo}>
            {t.transmitir.semCapturaTexto}
          </Aviso>
        </div>
      )}
      <AvisoContextoInseguro className="mt-4" />
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Coluna principal */}
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-black">
              <PalcoVideo
                stream={host.localPreview}
                nome={nome || "Você"}
                papel="anfitriao"
                aoVivo={aoVivo && !host.pausado}
                className="rounded-none"
                legenda={legendaDoPalco(host.phase, host.motivoParada, noAplicativo)}
              />

              {/*
                Enquanto o seletor de tela está aberto, o palco fica num estado de
                espera visível. Sem isto, o intervalo entre o clique e a escolha
                parece que o botão não respondeu — e é justamente o momento em que
                a pessoa está decidindo se compartilha.
              */}
              {abrindoCaptura && (
                <div className="fade-in pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center">
                  <Spinner className="h-6 w-6 text-white/70" />
                  <p className="text-sm font-medium text-white/80">
                    {noAplicativo
                      ? t.transmitir.escolhaNoAplicativo
                      : t.transmitir.escolhaNoNavegador}
                  </p>
                  <p className="max-w-sm text-xs text-white/45">
                    {t.transmitir.nadaCapturadoAntes}
                  </p>
                </div>
              )}

              {/* Confirmação de que a captura começou. Aparece uma vez e sai:
                  um aviso permanente sobre o vídeo vira estorvo. */}
              {aoVivo && <SeloInicio />}
            </div>

            {/* Barra de controles */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              {!aoVivo ? (
                <Botao
                  variant="primario"
                  onClick={() => void host.startSharing()}
                  // Sem suporte à captura, o clique só produziria um erro que já
                  // está explicado acima — deixar o botão ativo seria oferecer
                  // uma ação que não existe.
                  disabled={!nomePronto || !podeCapturar}
                  carregando={abrindoCaptura}
                  rotuloCarregando="Abrindo a captura…"
                >
                  <IconePlay />
                  {host.phase === "parado" ? t.transmitir.transmitirDeNovo : t.transmitir.comecar}
                </Botao>
              ) : (
                <>
                  <Botao
                    variant={host.pausado ? "sucesso" : "secundario"}
                    onClick={host.alternarPausa}
                  >
                    {host.pausado ? <IconePlay /> : <IconePausa />}
                    {host.pausado ? t.transmitir.retomar : t.transmitir.pausar}
                  </Botao>
                  <Botao variant="perigo" onClick={() => host.stopSharing()}>
                    <IconeParar />
                    {t.transmitir.encerrar}
                  </Botao>
                </>
              )}

              <Menu
                rotulo={t.transmitir.qualidade}
                alinhamento="esquerda"
                gatilho={({ aberto }) => (
                  <span
                    className={cx(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      aberto
                        ? "border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900"
                        : "border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                    )}
                  >
                    <IconeAjustes />
                    {t.transmitir.qualidadeCurta[host.options.quality]}
                    <IconeSeta />
                  </span>
                )}
              >
                {(fechar) => (
                  <>
                    <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {t.transmitir.qualidade}
                    </div>
                    {QUALIDADES.map((q) => (
                      <MenuItem
                        key={q}
                        selecionado={host.options.quality === q}
                        onClick={() => {
                          host.setOptions((atual) => ({ ...atual, quality: q }));
                          fechar();
                        }}
                      >
                        {t.transmitir.qualidadeLonga[q]}
                      </MenuItem>
                    ))}
                    <MenuSeparador />
                    <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {t.transmitir.audio}
                    </div>
                    <MenuItem
                      selecionado={host.options.withAudio}
                      onClick={() => {
                        host.setOptions((atual) => ({ ...atual, withAudio: !atual.withAudio }));
                        fechar();
                      }}
                    >
                      {t.transmitir.incluirAudioAba}
                    </MenuItem>
                    <MenuSeparador />
                    <MenuItem onClick={() => { setDialogoQualidade(true); fechar(); }}>
                      {t.transmitir.maisDetalhes}
                    </MenuItem>
                    <p className="px-2 pb-1 pt-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
                      {t.transmitir.escolhasValemProxima}
                    </p>
                  </>
                )}
              </Menu>

              {aoVivo && (
                <div className="ml-auto flex items-center gap-2">
                  <BarraQualidade nivel={nivelDaConexao(host.viewerStates)} />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {host.viewers.length === 0
                      ? t.transmitir.espectadoresContagem.zero
                      : host.viewers.length === 1
                        ? t.transmitir.espectadoresContagem.one
                        : preencher(t.transmitir.espectadoresContagem.other, {
                            n: String(host.viewers.length),
                          })}
                  </span>
                </div>
              )}
            </div>
          </Cartao>

          {/* Link de convite */}
          {(host.code || host.phase === "criando") && (
            <CartaoSecao
              titulo={t.transmitir.linkTitulo}
              descricao={t.transmitir.linkDica}
              icone={<IconeLink />}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Entrada
                  readOnly
                  value={host.shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={t.transmitir.linkTitulo}
                  /*
                   * Um gancho estável para os testes.
                   *
                   * O `aria-label` acima agora é traduzível, então testar por
                   * ele amarraria o teste ao português: bastaria alguém abrir o
                   * app em inglês para o seletor não achar mais o campo. Este
                   * atributo não muda com o idioma e nem aparece na tela.
                   */
                  data-campo="link-transmissao"
                  className="font-mono text-xs"
                />
                <BotaoCopiar
                  texto={host.shareUrl}
                  rotulo={t.transmitir.linkCopiar}
                  variant="primario"
                  className="shrink-0"
                />
              </div>
              {host.code && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.transmitir.ouDiteCodigo}
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2.5 py-1 font-mono text-xs font-medium tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {host.code}
                  </span>
                  <BotaoCopiar texto={host.code} rotulo={t.comum.copiarCodigo} size="sm" />
                </div>
              )}
            </CartaoSecao>
          )}

          {/* Antes de existir um link, explica o que vai acontecer. */}
          {!host.code && (
            <CartaoSecao
              titulo={t.transmitir.linkTitulo}
              descricao={t.transmitir.linkApareceQuando}
              icone={<IconeLink />}
            >
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner className="text-zinc-400" />
                {t.transmitir.criandoSala}
              </div>
            </CartaoSecao>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="flex min-w-0 flex-col gap-4">
          <CartaoSecao titulo={t.transmitir.nomeTitulo} descricao={t.transmitir.nomeDica}>
            <CampoNome
              valor={nome}
              onChange={setNome}
              rotulo={t.transmitir.nomePlaceholder}
              dica={nomePronto ? undefined : t.transmitir.nomeObrigatorio}
              autoFoco={!nomePronto}
            />
          </CartaoSecao>

          <CartaoSecao
            titulo={t.transmitir.espectadores}
            descricao={
              host.viewers.length === 0
                ? t.transmitir.ninguemAinda
                : preencher(t.transmitir.espectadoresDe, {
                    n: String(host.viewers.length),
                    max: "32",
                  })
            }
            contagem={host.viewers.length}
          >
            {host.viewers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-800">
                <IconePessoas />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.transmitir.listaSePreenche}
                </p>
              </div>
            ) : (
              /*
               * Lista viva: quem entra sobe no lugar, quem sai desvanece e os
               * outros deslizam para preencher o espaço — uma lista que pisca
               * para reorganizar parece bug, esta lê como fato acontecendo.
               */
              <ListaViva className="flex flex-col gap-1">
                {host.viewers.map((v) => (
                  <ItemVivo
                    key={v.id}
                    chave={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {(v.name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                        {v.name || "Sem nome"}
                      </span>
                    </span>
                    <SeloEspectador estado={host.viewerStates[v.id] ?? "novo"} />
                  </ItemVivo>
                ))}
              </ListaViva>
            )}
          </CartaoSecao>

          <Cartao className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.transmitir.enquantoTransmite}
            </h3>
            {/*
              As frases trazem o nome de um botão em destaque, e a posição dele
              muda entre idiomas. Por isso o texto do dicionário vem com um
              marcador e é partido nele: o `<strong>` continua envolvendo o nome
              do botão, na posição que cada língua pedir.

              "Parar de compartilhar" não é nosso: é o rótulo do botão do Chrome,
              que aparece na barra do navegador. Traduzi-lo apontaria para um
              botão que não existe com aquele nome.
            */}
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {noAplicativo ? (
                <>
                  <li>
                    <FraseComBotao
                      texto={t.transmitir.dicaApp1}
                      botao={t.transmitir.botaoEncerrar}
                    />
                  </li>
                  <li>{t.transmitir.dicaApp2}</li>
                  <li>{t.transmitir.dicaPausar}</li>
                </>
              ) : (
                <>
                  <li>
                    <FraseComBotao
                      texto={t.transmitir.dicaWeb1}
                      botao={t.transmitir.botaoPararDeCompartilhar}
                    />
                  </li>
                  <li>{t.transmitir.dicaWeb2}</li>
                  <li>{t.transmitir.dicaPausar}</li>
                </>
              )}
            </ul>
          </Cartao>
        </div>
      </div>

      <DialogoQualidade
        aberto={dialogoQualidade}
        aoFechar={() => setDialogoQualidade(false)}
        options={host.options}
        setOptions={host.setOptions}
      />
    </div>
  );
}

/** Traduz o pior estado entre os espectadores em um degrau de qualidade. */
function nivelDaConexao(estados: Record<string, RTCPeerConnectionState>): "boa" | "media" | "ruim" {
  const valores = Object.values(estados);
  if (valores.length === 0) return "boa";
  if (valores.some((e) => e === "failed" || e === "disconnected")) return "ruim";
  if (valores.some((e) => e !== "connected")) return "media";
  return "boa";
}

/**
 * A legenda do palco, uma frase por situação.
 *
 * No aplicativo não existe "o navegador encerrou o compartilhamento" — quem
 * encerra é o próprio aplicativo ou o Windows. Dizer "navegador" ali seria
 * apontar para um programa que o usuário não está usando.
 */
function legendaDoPalco(
  phase: string,
  motivo: "usuario" | "navegador" | null,
  noAplicativo: boolean,
): string {
  if (phase === "parado") {
    if (motivo === "navegador") {
      return noAplicativo
        ? "A captura de tela foi encerrada pelo Windows"
        : "O navegador encerrou o compartilhamento";
    }
    return "Você encerrou a transmissão";
  }
  return "Sua tela aparece aqui quando você começar";
}

/**
 * Confirmação passageira de que a captura começou.
 *
 * Um "ao vivo" que já existia antes do clique não informa nada; este aparece
 * quando o primeiro quadro chega e sai sozinho, sem exigir que ninguém o feche.
 * A animação é declarada em globals.css e respeita `prefers-reduced-motion`.
 */
function SeloInicio() {
  const t = useTexto();
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <span className="confirmacao-inicio inline-flex items-center gap-1.5 rounded-full bg-emerald-600/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
        {t.transmitir.telaCompartilhada}
      </span>
    </div>
  );
}

/**
 * Uma frase do dicionário com o nome de um botão em destaque.
 *
 * O texto chega com um marcador `{botao}`, e é partido nele para que o
 * `<strong>` envolva exatamente o nome do botão — na posição que o idioma pedir.
 * Montar a frase concatenando `"O botão " + <strong> + " para a captura"` no
 * ponto de uso fixaria a ordem do português, e em inglês o nome do botão vem
 * depois do verbo.
 *
 * Se o marcador não existir no texto, a frase sai inteira e sem destaque, em
 * vez de sumir: um erro de tradução vira texto sem negrito, não texto ausente.
 */
function FraseComBotao({ texto, botao }: { texto: string; botao: string }) {
  const [antes, depois] = texto.split("{botao}");
  if (depois === undefined) return <>{texto}</>;
  return (
    <>
      {antes}
      <strong className="font-medium">{botao}</strong>
      {depois}
    </>
  );
}

/**
 * Diálogo com as opções de captura.
 *
 * Existe porque a escolha de qualidade também precisa de texto de apoio que não
 * cabe num menu — e porque a decisão muda o consumo de banda de quem assiste,
 * o que merece ser explicado antes e não depois.
 */
function DialogoQualidade({
  aberto,
  aoFechar,
  options,
  setOptions,
}: {
  aberto: boolean;
  aoFechar: () => void;
  options: CaptureOptions;
  setOptions: React.Dispatch<React.SetStateAction<CaptureOptions>>;
}) {
  // O dicionário vem do hook, e não por prop: o diálogo só existe dentro desta
  // árvore, e passar o texto inteiro por parâmetro obrigaria cada chamador a
  // repassá-lo sem usá-lo para nada.
  const t = useTexto();
  return (
    <Dialogo
      aberto={aberto}
      onFechar={aoFechar}
      titulo={t.transmitir.qualidadeEAudio}
      descricao={t.transmitir.escolhasValemProxima}
      largura="md"
    >
      <div className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="qualidade"
            className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
          >
            {t.transmitir.resolucao}
          </label>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.transmitir.resolucaoDica}
          </p>
          <Selecao
            id="qualidade"
            value={options.quality}
            onChange={(e) =>
              setOptions((atual) => ({ ...atual, quality: e.target.value as CaptureOptions["quality"] }))
            }
            className="mt-2"
          >
            {QUALIDADES.map((q) => (
              <option key={q} value={q}>
                {t.transmitir.qualidadeLonga[q]}
              </option>
            ))}
          </Selecao>
        </div>

        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <Interruptor
            checked={options.withAudio}
            onChange={(v) => setOptions((atual) => ({ ...atual, withAudio: v }))}
            label={t.transmitir.incluirAudioAba}
            descricao={t.transmitir.audioSoEmAbaApache}
          />
        </div>

        <Aviso tom="info">{t.transmitir.avisoPrimeiraVez}</Aviso>
      </div>
    </Dialogo>
  );
}

function IconePlay() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconePausa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}

function IconeParar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconeAjustes() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className="shrink-0">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconeLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

function IconePessoas() {
  return (
    <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5.5 5.5 0 0 0-2-4.3" />
      </svg>
    </span>
  );
}
