"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BotaoCopiar } from "@/components/CopyButton";
import { CampoNome, useNomeGuardado } from "@/components/NameField";
import { SeloAoVivo, SeloSinalizacao } from "@/components/StatusBadges";
import { PalcoVideo } from "@/components/VideoSurface";
import {
  Aviso,
  Botao,
  Cartao,
  CartaoSecao,
  Selo,
  Spinner,
  cx,
} from "@/components/ui";
import { useViewer } from "@/lib/useViewer";
import { SalaChat } from "@/components/SalaChat";
import { AnimatePresence, ListaViva, ItemVivo } from "@/components/animacao";
import { preencher, useTexto, type Dicionario } from "@/lib/idioma";

/**
 * A sala de quem assiste.
 *
 * A tela é montada em volta de uma única pergunta: o vídeo já está chegando?
 * Enquanto não estiver, o espaço do vídeo mostra em que ponto a conexão está —
 * um retângulo preto mudo não distingue "aguardando o anfitrião" de "erro".
 */
export function WatchRoom({ code }: { code: string }) {
  const t = useTexto();
  const [nome, setNome] = useNomeGuardado();
  const nomePronto = nome.trim().length > 0;
  const viewer = useViewer({ code, name: nome.trim() || "Espectador" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);

  // Só pede o nome quando ele faz falta: o WebSocket já está aberto e a sala já
  // sabe que alguém entrou, então pedir o nome não bloqueia nada.
  const precisaNome = !nomePronto && (viewer.phase === "aguardando" || viewer.phase === "recebendo");

  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  async function alternarTelaCheia() {
    const alvo = videoRef.current?.parentElement;
    if (!alvo) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await alvo.requestFullscreen();
    } catch {
      // Alguns navegadores recusam quando o elemento não está visível; não há o
      // que fazer além de deixar o botão como está.
    }
  }

  const recebendo = viewer.phase === "recebendo" && Boolean(viewer.remote);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* Cabeçalho da sala */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href="/"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          aria-label={t.assistir.voltarAoInicio}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="truncate text-base font-semibold tracking-tight text-zinc-950 sm:text-lg dark:text-zinc-50">
          {viewer.hostName
            ? preencher(t.assistir.transmissaoDe, { nome: viewer.hostName })
            : t.assistir.salaDeTransmissao}
        </h1>
        <span className="shrink-0 rounded-full bg-zinc-200 px-2.5 py-1 font-mono text-xs font-medium tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {code}
        </span>
        <SeloAoVivo ativo={recebendo} />
        {viewer.paused && <Selo tom="aviso">{t.assistir.pausada}</Selo>}
        <SeloSinalizacao status={viewer.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Palco */}
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-black">
              <PalcoVideo
                stream={viewer.remote}
                videoRef={videoRef}
                nome={viewer.hostName || t.assistir.apresentador}
                papel="espectador"
                aoVivo={recebendo}
                compacto
                className="rounded-none"
                legenda={textoDoPalco(viewer.phase, viewer.hostName, t)}
              />

              {/* Enquanto o vídeo não chega, o estado fica por cima do preto.
                  Com a transmissão pausada, o aviso também aparece: uma imagem
                  parada sem explicação é indistinguível de uma conexão travada. */}
              {(!recebendo || viewer.paused) && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/40 px-6 text-center">
                  {(viewer.phase === "conectando" || viewer.phase === "aguardando") && (
                    <Spinner className="h-6 w-6 text-white/50" />
                  )}
                  <p className="text-sm font-medium text-white/70">
                    {viewer.paused
                      ? preencher(t.assistir.pausouTransmissao, {
                          nome: viewer.hostName || t.assistir.quemApresenta,
                        })
                      : textoDoPalco(viewer.phase, viewer.hostName, t)}
                  </p>
                  {viewer.paused ? (
                    <p className="max-w-sm text-xs text-white/40">
                      {t.assistir.pausadaDica}
                    </p>
                  ) : (
                    viewer.phase === "aguardando" && (
                      <p className="max-w-sm text-xs text-white/40">
                        {t.assistir.aguardandoDica}
                      </p>
                    )
                  )}
                </div>
              )}

              {recebendo && (
                <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void alternarTelaCheia()}
                    aria-label={telaCheia ? t.assistir.telaCheiaSair : t.assistir.telaCheiaVer}
                    title={telaCheia ? t.assistir.telaCheiaSair : t.assistir.telaCheiaVer}
                    className="cursor-pointer rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                  >
                    {telaCheia ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </Cartao>

          {/* Falhas: cada estado diz o que fazer, não só o que houve. */}
          <AnimatePresence>
            {viewer.phase === "inexistente" && (
              <Aviso key="naoexiste" tom="erro" titulo={t.assistir.naoExisteTitulo}>
                {t.assistir.naoExisteTexto}
              </Aviso>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {viewer.phase === "cheia" && (
              <Aviso key="cheia" tom="aviso" titulo={t.assistir.cheiaTitulo}>
                {t.assistir.cheiaTexto}
              </Aviso>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {viewer.phase === "encerrada" && (
              <Aviso key="encerrada" tom="info" titulo={t.assistir.encerradaTitulo}>
                {t.assistir.encerradaTexto}
              </Aviso>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {viewer.phase === "erro" && (
              <Aviso
                key="erro"
                tom="erro"
                titulo={t.assistir.erroTitulo}
                acao={
                  <Botao variant="secundario" size="sm" onClick={viewer.retry}>
                    {t.assistir.tentarDeNovo}
                  </Botao>
                }
              >
                {viewer.error ?? t.assistir.erroTexto}
              </Aviso>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {viewer.connectionState === "disconnected" && recebendo && (
              <Aviso key="caiu" tom="aviso" titulo={t.assistir.caiuTitulo}>
                {t.assistir.caiuTexto}
              </Aviso>
            )}
          </AnimatePresence>
        </div>

        {/* Coluna lateral */}
        <div className="flex min-w-0 flex-col gap-4">
          {precisaNome && (
            <CartaoSecao titulo={t.assistir.digaSeuNome} descricao={t.assistir.paraSaberQuemEntrou}>
              <CampoNome
                valor={nome}
                onChange={setNome}
                rotulo={t.assistir.seuNome}
                autoFoco
                onSubmit={() => undefined}
              />
            </CartaoSecao>
          )}

          <CartaoSecao
            titulo={t.assistir.nestaSala}
            descricao={
              viewer.participants.length === 0 ? t.assistir.soVoce : t.assistir.quemTransmiteMarcado
            }
            contagem={viewer.participants.length}
          >
            {viewer.participants.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.assistir.ninguemNaSala}</p>
            ) : (
              <ListaViva className="flex flex-col gap-1">
                {viewer.participants.map((p) => {
                  const transmite = Boolean(p.isSharing);
                  return (
                    <ItemVivo
                      key={p.id}
                      chave={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={cx(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            transmite
                              ? "bg-broadcast text-white"
                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                          )}
                        >
                          {(p.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                          {p.name || "Sem nome"}
                        </span>
                      </span>
                      {transmite && <Selo tom="ao-vivo">{t.assistir.apresentando}</Selo>}
                    </ItemVivo>
                  );
                })}
              </ListaViva>
            )}
          </CartaoSecao>

          <SalaChat
            mensagens={viewer.mensagens}
            selfId={viewer.selfId}
            onEnviar={viewer.enviarChat}
            conectado={viewer.status === "conectado"}
          />

          <CartaoSecao titulo={t.assistir.convidarMaisGente} descricao={t.assistir.envieMesmoLink}>
            <div className="flex flex-col gap-2">
              <BotaoCopiar
                texto={typeof window !== "undefined" ? window.location.href : ""}
                rotulo={t.assistir.copiarEsteLink}
                variant="secundario"
                className="w-full"
              />
            </div>
          </CartaoSecao>

          <Cartao className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t.assistir.dicaRedeTitulo}
            </h3>
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              <li>{t.assistir.dicaRede1}</li>
              <li>{t.assistir.dicaRede2}</li>
              <li>{t.assistir.dicaRede3}</li>
            </ul>
          </Cartao>
        </div>
      </div>
    </div>
  );
}

/**
 * Uma frase por estado — as mesmas palavras no palco e por cima dele.
 *
 * Recebe o dicionário em vez de ler o idioma: é chamada no meio da renderização
 * a partir de um valor já calculado, e passar o texto pronto mantém a função
 * pura e trivial de testar. Os casos são os valores de `ViewerPhase`, e o
 * `default` cobre "erro" e qualquer estado futuro que ninguém previu.
 */
function textoDoPalco(phase: string, hostName: string, t: Dicionario): string {
  switch (phase) {
    case "conectando":
      return t.assistir.entrando;
    case "aguardando":
      return hostName
        ? preencher(t.assistir.aindaNaoComecou, { nome: hostName })
        : t.assistir.aguardandoApresentador;
    case "recebendo":
      return t.assistir.conectado;
    case "encerrada":
      return t.assistir.transmissaoTerminou;
    case "inexistente":
      return t.assistir.salaNaoEncontrada;
    case "cheia":
      return t.assistir.salaCheia;
    default:
      return t.assistir.naoFoiPossivelConectar;
  }
}
