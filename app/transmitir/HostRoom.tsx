"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BotaoCopiar } from "@/components/CopyButton";
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
import { supportsDisplayCapture } from "@/lib/webrtc";
import type { CaptureOptions } from "@/lib/webrtc";

const ROTULO_QUALIDADE: Record<CaptureOptions["quality"], string> = {
  auto: "Automática",
  "1080p": "1080p (nitidez máxima)",
  "720p": "720p (equilibrada)",
  "480p": "480p (economia de banda)",
};

/**
 * Sala de controle de quem transmite.
 *
 * A ordem da tela segue a ordem em que as decisões são tomadas: primeiro quem
 * você é, depois o que será mostrado, e só então o link — porque um link só
 * faz sentido depois que existe algo para assistir.
 */
export function HostRoom() {
  const [nome, setNome] = useNomeGuardado();
  const host = useHost({ name: nome.trim() || "Apresentador" });
  const [dialogoQualidade, setDialogoQualidade] = useState(false);

  const podeCapturar = useMemo(() => supportsDisplayCapture(), []);
  const nomePronto = nome.trim().length > 0;
  const aoVivo = host.phase === "ao-vivo";

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
      {/* Cabeçalho da sala */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-zinc-50">
          Sua transmissão
        </h1>
        <SeloAoVivo ativo={aoVivo && !host.pausado} />
        <SeloSinalizacao status={host.status} />
        {host.pausado && <Selo tom="aviso">Pausada</Selo>}
        <Link
          href="/como-funciona"
          className="ml-auto text-sm font-medium text-zinc-500 underline underline-offset-2 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Precisa de ajuda?
        </Link>
      </div>

      {host.error && (
        <div className="mt-4">
          <Aviso tom="erro" titulo="Não deu para continuar" aoFechar={host.dismissError}>
            {host.error}
          </Aviso>
        </div>
      )}
      {host.notice && (
        <div className="mt-4">
          <Aviso tom="info" aoFechar={host.dismissNotice}>
            {host.notice}
          </Aviso>
        </div>
      )}
      {!podeCapturar && (
        <div className="mt-4">
          <Aviso tom="erro" titulo="Este navegador não sabe capturar a tela">
            Compartilhar tela depende de uma API que este navegador não oferece. O Chrome, o Edge e
            o Firefox no computador funcionam; no celular, só assistir.
          </Aviso>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Coluna principal */}
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="overflow-hidden p-0">
            <div className="aspect-video w-full bg-black">
              <PalcoVideo
                stream={host.localPreview}
                nome={nome || "Você"}
                papel="anfitriao"
                aoVivo={aoVivo && !host.pausado}
                className="rounded-none"
                legenda={
                  host.phase === "parado"
                    ? host.motivoParada === "navegador"
                      ? "O navegador encerrou o compartilhamento"
                      : "Você encerrou a transmissão"
                    : "Sua tela aparece aqui quando você começar"
                }
              />
            </div>

            {/* Barra de controles */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              {!aoVivo ? (
                <Botao
                  variant="primario"
                  onClick={() => void host.startSharing()}
                  disabled={!nomePronto}
                  carregando={host.phase === "criando" && Boolean(host.code)}
                  rotuloCarregando="Abrindo a captura…"
                >
                  <IconePlay />
                  {host.phase === "parado" ? "Transmitir de novo" : "Compartilhar minha tela"}
                </Botao>
              ) : (
                <>
                  <Botao
                    variant={host.pausado ? "sucesso" : "secundario"}
                    onClick={host.alternarPausa}
                  >
                    {host.pausado ? <IconePlay /> : <IconePausa />}
                    {host.pausado ? "Retomar" : "Pausar"}
                  </Botao>
                  <Botao variant="perigo" onClick={() => host.stopSharing()}>
                    <IconeParar />
                    Encerrar
                  </Botao>
                </>
              )}

              <Menu
                rotulo="Qualidade do vídeo"
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
                    {ROTULO_QUALIDADE[host.options.quality].split(" ")[0]}
                    <IconeSeta />
                  </span>
                )}
              >
                {(fechar) => (
                  <>
                    <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Qualidade do vídeo
                    </div>
                    {(Object.keys(ROTULO_QUALIDADE) as CaptureOptions["quality"][]).map((q) => (
                      <MenuItem
                        key={q}
                        selecionado={host.options.quality === q}
                        onClick={() => {
                          host.setOptions((atual) => ({ ...atual, quality: q }));
                          fechar();
                        }}
                      >
                        {ROTULO_QUALIDADE[q]}
                      </MenuItem>
                    ))}
                    <MenuSeparador />
                    <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Áudio
                    </div>
                    <MenuItem
                      selecionado={host.options.withAudio}
                      onClick={() => {
                        host.setOptions((atual) => ({ ...atual, withAudio: !atual.withAudio }));
                        fechar();
                      }}
                    >
                      Incluir o áudio da aba
                    </MenuItem>
                    <MenuSeparador />
                    <MenuItem onClick={() => { setDialogoQualidade(true); fechar(); }}>
                      Mais detalhes…
                    </MenuItem>
                    <p className="px-2 pb-1 pt-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
                      Vale para a próxima vez que você compartilhar.
                    </p>
                  </>
                )}
              </Menu>

              {aoVivo && (
                <div className="ml-auto flex items-center gap-2">
                  <BarraQualidade nivel={nivelDaConexao(host.viewerStates)} />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {host.viewers.length === 0
                      ? "ninguém assistindo"
                      : host.viewers.length === 1
                        ? "1 assistindo"
                        : `${host.viewers.length} assistindo`}
                  </span>
                </div>
              )}
            </div>
          </Cartao>

          {/* Link de convite */}
          {(host.code || host.phase === "criando") && (
            <CartaoSecao
              titulo="Link para convidar"
              descricao="Quem abrir este endereço entra na sala e passa a ver sua tela."
              icone={<IconeLink />}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Entrada
                  readOnly
                  value={host.shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Link da transmissão"
                  className="font-mono text-xs"
                />
                <BotaoCopiar
                  texto={host.shareUrl}
                  rotulo="Copiar link"
                  variant="primario"
                  className="shrink-0"
                />
              </div>
              {host.code && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ou dite só o código:
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2.5 py-1 font-mono text-xs font-medium tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {host.code}
                  </span>
                  <BotaoCopiar texto={host.code} rotulo="Copiar código" size="sm" />
                </div>
              )}
            </CartaoSecao>
          )}

          {/* Antes de existir um link, explica o que vai acontecer. */}
          {!host.code && (
            <CartaoSecao
              titulo="Link para convidar"
              descricao="O link aparece aqui assim que a sala for criada."
              icone={<IconeLink />}
            >
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner className="text-zinc-400" />
                Criando sua sala…
              </div>
            </CartaoSecao>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="flex min-w-0 flex-col gap-4">
          <CartaoSecao
            titulo="Seu nome"
            descricao="É o nome que aparece para quem está assistindo."
          >
            <CampoNome
              valor={nome}
              onChange={setNome}
              rotulo="Como você quer aparecer"
              dica={nomePronto ? undefined : "Escreva um nome para poder começar."}
              autoFoco={!nomePronto}
            />
          </CartaoSecao>

          <CartaoSecao
            titulo="Quem está assistindo"
            descricao={
              host.viewers.length === 0
                ? "Ninguém entrou ainda. Envie o link."
                : `${host.viewers.length} de 32 possíveis.`
            }
            contagem={host.viewers.length}
          >
            {host.viewers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-800">
                <IconePessoas />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  A lista se preenche conforme as pessoas abrem o link.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {host.viewers.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
                  </li>
                ))}
              </ul>
            )}
          </CartaoSecao>

          <Cartao className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Enquanto transmite
            </h3>
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              <li>
                A barra do navegador com o botão <strong className="font-medium">Parar de compartilhar</strong>{" "}
                encerra a transmissão. O ScreenLive percebe e avisa.
              </li>
              <li>Fechar esta aba derruba a transmissão para todo mundo.</li>
              <li>Pausar interrompe o envio de verdade, sem gastar banda.</li>
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
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Qualidade e áudio"
      descricao="Estas escolhas valem para a próxima vez que você compartilhar a tela."
      largura="md"
    >
      <div className="flex flex-col gap-5">
        <div>
          <label
            htmlFor="qualidade"
            className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
          >
            Resolução
          </label>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Quanto maior, mais nítido e mais banda consumida por quem assiste. Em uma rede ruim,
            cair para 720p costuma resolver a travada.
          </p>
          <Selecao
            id="qualidade"
            value={options.quality}
            onChange={(e) =>
              setOptions((atual) => ({ ...atual, quality: e.target.value as CaptureOptions["quality"] }))
            }
            className="mt-2"
          >
            {(Object.keys(ROTULO_QUALIDADE) as CaptureOptions["quality"][]).map((q) => (
              <option key={q} value={q}>
                {ROTULO_QUALIDADE[q]}
              </option>
            ))}
          </Selecao>
        </div>

        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <Interruptor
            marcado={options.withAudio}
            onChange={(v) => setOptions((atual) => ({ ...atual, withAudio: v }))}
            rotulo="Incluir o áudio da aba"
            descricao="Só funciona ao compartilhar uma aba do navegador. Para uma tela inteira, o áudio do sistema não é capturado."
          />
        </div>

        <Aviso tom="info">
          Na primeira vez, o navegador pergunta o que compartilhar. Dá para trocar depois sem
          recarregar a página.
        </Aviso>
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
