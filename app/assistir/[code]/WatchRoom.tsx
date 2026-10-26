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

/**
 * Salas em que o código não tem o formato esperado.
 *
 * Checar antes de abrir o WebSocket evita uma ida ao servidor só para receber
 * um erro que dá para saber daqui.
 */
export function CodigoInvalido({ code }: { code: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5M12 16h.01" />
        </svg>
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Este código não parece válido
      </h1>
      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        O código de uma sala do ScreenLive tem 9 caracteres, como{" "}
        <span className="font-mono text-zinc-700 dark:text-zinc-300">K7M2PQR4T</span>. O que veio no
        endereço foi{" "}
        <span className="font-mono break-all text-zinc-700 dark:text-zinc-300">{code}</span>.
      </p>
      <Botao variant="primario" onClick={() => (window.location.href = "/")}>
        Voltar ao início
      </Botao>
    </div>
  );
}

/**
 * A sala de quem assiste.
 *
 * A tela é montada em volta de uma única pergunta: o vídeo já está chegando?
 * Enquanto não estiver, o espaço do vídeo mostra em que ponto a conexão está —
 * um retângulo preto mudo não distingue "aguardando o anfitrião" de "erro".
 */
export function WatchRoom({ code }: { code: string }) {
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
          aria-label="Voltar ao início"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="truncate text-base font-semibold tracking-tight text-zinc-950 sm:text-lg dark:text-zinc-50">
          {viewer.hostName ? `Transmissão de ${viewer.hostName}` : "Sala de transmissão"}
        </h1>
        <span className="shrink-0 rounded-full bg-zinc-200 px-2.5 py-1 font-mono text-xs font-medium tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {code}
        </span>
        <SeloAoVivo ativo={recebendo} />
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
                nome={viewer.hostName || "Apresentador"}
                papel="espectador"
                aoVivo={recebendo}
                compacto
                className="rounded-none"
                legenda={textoDoPalco(viewer.phase, viewer.hostName)}
              />

              {/* Enquanto o vídeo não chega, o estado fica por cima do preto. */}
              {!recebendo && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  {(viewer.phase === "conectando" || viewer.phase === "aguardando") && (
                    <Spinner className="h-6 w-6 text-white/50" />
                  )}
                  <p className="text-sm font-medium text-white/70">
                    {textoDoPalco(viewer.phase, viewer.hostName)}
                  </p>
                  {viewer.phase === "aguardando" && (
                    <p className="max-w-sm text-xs text-white/40">
                      A página se conecta sozinha assim que a transmissão começar. Você pode deixá-la
                      aberta.
                    </p>
                  )}
                </div>
              )}

              {recebendo && (
                <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void alternarTelaCheia()}
                    aria-label={telaCheia ? "Sair da tela cheia" : "Ver em tela cheia"}
                    title={telaCheia ? "Sair da tela cheia" : "Ver em tela cheia"}
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
          {viewer.phase === "inexistente" && (
            <Aviso tom="erro" titulo="Esta sala não existe (ou já terminou)">
              Confira o link com quem enviou. Salas deixam de existir quando o apresentador sai e
              ninguém mais está assistindo.
            </Aviso>
          )}
          {viewer.phase === "cheia" && (
            <Aviso tom="aviso" titulo="A sala está cheia">
              O limite é de 32 pessoas assistindo ao mesmo tempo. Tente de novo em alguns minutos.
            </Aviso>
          )}
          {viewer.phase === "encerrada" && (
            <Aviso tom="info" titulo="A transmissão terminou">
              Quem apresentava encerrou o compartilhamento. Você pode fechar esta página.
            </Aviso>
          )}
          {viewer.phase === "erro" && (
            <Aviso
              tom="erro"
              titulo="Não foi possível ver o vídeo"
              acao={
                <Botao variant="secundario" size="sm" onClick={viewer.retry}>
                  Tentar de novo
                </Botao>
              }
            >
              {viewer.error ?? "A conexão falhou."}
            </Aviso>
          )}
          {viewer.connectionState === "disconnected" && recebendo && (
            <Aviso tom="aviso" titulo="A conexão caiu, tentando reconectar">
              A imagem volta sozinha quando a rede se recuperar.
            </Aviso>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="flex min-w-0 flex-col gap-4">
          {precisaNome && (
            <CartaoSecao titulo="Diga seu nome" descricao="Para o apresentador saber quem entrou.">
              <CampoNome
                valor={nome}
                onChange={setNome}
                rotulo="Seu nome"
                autoFoco
                onSubmit={() => undefined}
              />
            </CartaoSecao>
          )}

          <CartaoSecao
            titulo="Nesta sala"
            descricao={
              viewer.participants.length === 0
                ? "Só você por aqui."
                : "Quem transmite aparece marcado."
            }
            contagem={viewer.participants.length}
          >
            {viewer.participants.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Ninguém na sala ainda.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {viewer.participants.map((p) => {
                  const transmite = p.id === viewer.sharing;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
                          {p.id === viewer.participants[0]?.id && !transmite ? "" : ""}
                        </span>
                      </span>
                      {transmite && <Selo tom="ao-vivo">Apresentando</Selo>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CartaoSecao>

          <CartaoSecao titulo="Convidar mais gente" descricao="Envie o mesmo link para quem quiser.">
            <div className="flex flex-col gap-2">
              <BotaoCopiar
                texto={typeof window !== "undefined" ? window.location.href : ""}
                rotulo="Copiar este link"
                variant="secundario"
                className="w-full"
              />
            </div>
          </CartaoSecao>

          <Cartao className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Se a imagem travar
            </h3>
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              <li>Feche outras abas que estejam usando a rede.</li>
              <li>Prefira o cabo ao Wi-Fi, quando houver.</li>
              <li>Peça para quem transmite escolher uma qualidade menor.</li>
            </ul>
          </Cartao>
        </div>
      </div>
    </div>
  );
}

/** Uma frase por estado — as mesmas palavras no palco e por cima dele. */
function textoDoPalco(phase: string, hostName: string): string {
  switch (phase) {
    case "conectando":
      return "Entrando na sala…";
    case "aguardando":
      return hostName ? `${hostName} ainda não começou` : "Aguardando o apresentador";
    case "recebendo":
      return "Conectado";
    case "encerrada":
      return "A transmissão terminou";
    case "inexistente":
      return "Sala não encontrada";
    case "cheia":
      return "Sala cheia";
    default:
      return "Não foi possível conectar";
  }
}
