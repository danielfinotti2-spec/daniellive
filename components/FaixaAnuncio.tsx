"use client";

/**
 * Faixa de anúncio: um recado do operador que aparece no topo de todas as
 * páginas, vindo do servidor de sinalização.
 *
 * Por que via WebSocket e não por uma API REST comum: o anúncio precisa chegar
 * a quem JÁ está na página, no meio de uma transmissão, sem recarregar. O canal
 * de sinalização é a única conexão aberta e persistente que toda aba do produto
 * mantém, então é por ele que o aviso viaja.
 *
 * Por que não usa `useHost`/`useHost`-like: este componente não pertence a
 * nenhuma sala. Ele abre a própria conexão e a mantém aberta só para receber o
 * anúncio, inclusive na tela inicial, onde não há sala nenhuma.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MOLA_PEQUENA } from "@/components/animacao";
import { signalingUrl } from "@/lib/signaling";
import type { Anuncio, ServerMessage } from "@/lib/protocol";
import { useTexto } from "@/lib/idioma";

/**
 * Depois de dispensar, o mesmo anúncio fica escondido por este tempo.
 * Guardamos a impressão digital do texto (não o objeto inteiro) para que
 * republicar o MESMO aviso não volte a incomodar quem já o fechou, mas um
 * aviso diferente apareça na hora.
 */
const SILENCIO_MS = 12 * 60 * 60 * 1000; // 12 h
const CHAVE = "screenlive-anuncio-dispensado";

function impressao(a: Anuncio): string {
  return `${a.criadoEm}:${a.texto}`;
}

function dispensado(a: Anuncio): boolean {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return false;
    const { chave, quando } = JSON.parse(bruto) as { chave: string; quando: number };
    if (chave !== impressao(a)) return false;
    return Date.now() - quando < SILENCIO_MS;
  } catch {
    return false;
  }
}

const CORES: Record<Anuncio["cor"], string> = {
  verde:
    "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  vermelho:
    "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100",
  azul: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
};

export function FaixaAnuncio() {
  const t = useTexto();
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [fechado, setFechado] = useState(false);
  const abertoRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let vivo = true;
    let tentativa = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const conectar = () => {
      if (!vivo) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(signalingUrl());
      } catch {
        return;
      }
      abertoRef.current = ws;

      ws.onopen = () => {
        tentativa = 0;
        // Pergunta o anúncio assim que conecta: o "welcome" também o traz, mas
        // pedir explicitamente cobre o caso de a conexão já estar aberta antes
        // de este componente existir.
        ws.send(JSON.stringify({ type: "anuncio:atual" }));
      };

      ws.onmessage = (evento) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(evento.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "welcome") setAnuncio(msg.anuncio ?? null);
        else if (msg.type === "anuncio") {
          setAnuncio(msg.anuncio);
          // Anúncio novo (ou retirada) reabre a faixa: quem fechou o anterior
          // não pediu para nunca mais ser avisado de nada.
          setFechado(false);
        }
      };

      ws.onclose = () => {
        if (!vivo) return;
        // Reconexão com espera crescente: o servidor pode estar reiniciando.
        // Faixa de anúncio não é urgente — o atraso é aceitável e evita um
        // laço de reconexão martelando um servidor que está subindo.
        tentativa += 1;
        const espera = Math.min(30_000, 1000 * 2 ** Math.min(tentativa, 5));
        timer = setTimeout(conectar, espera);
      };

      ws.onerror = () => {
        /* o close cuida da reconexão */
      };
    };

    conectar();

    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      // `close()` num socket ainda conectando é seguro; o navegador aborta.
      abertoRef.current?.close();
      abertoRef.current = null;
    };
  }, []);

  const visivel = anuncio !== null && !fechado && !dispensado(anuncio);

  function fechar() {
    if (!anuncio) return;
    try {
      window.localStorage.setItem(
        CHAVE,
        JSON.stringify({ chave: impressao(anuncio), quando: Date.now() }),
      );
    } catch {
      // Sem armazenamento: fecha só nesta visita.
    }
    setFechado(true);
  }

  function clicarBotao(botao: NonNullable<Anuncio["botao"]>) {
    if (botao.acao === "recarregar") {
      window.location.reload();
      return;
    }
    if (!botao.url) return;
    if (botao.acao === "abrir-nova-aba") {
      window.open(botao.url, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(botao.url);
    }
  }

  return (
    <AnimatePresence initial={false}>
      {visivel && anuncio ? (
        <motion.div
          key={impressao(anuncio)}
          /*
           * `height: "auto"` animado em conjunto com `overflow-hidden` é o
           * padrão para "abrir espaço", mas deixa a caixa com altura 0 durante
           * a animação — e o filho, que já tem altura real, pinta FORA da
           * caixa do pai. Efeito medido: `elementFromPoint` no botão fechar
           * devolvia a section da página, porque o clique atravessava o vazio
           * do pai. Por isso a altura é animada só na entrada (de 0 para
           * auto), e o filho direto recebe `position: relative` — a caixa do
           * pai passa a ser respeitada depois que ela cresce.
           */
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={MOLA_PEQUENA}
          className="overflow-hidden"
        >
          <div className="mx-auto max-w-6xl px-4 pt-3">
            <div
              role="status"
              className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${CORES[anuncio.cor]}`}
            >
              <span aria-hidden className="mt-0.5 shrink-0">
                📢
              </span>
              <p className="min-w-0 flex-1 whitespace-pre-line">{anuncio.texto}</p>

              {anuncio.botao ? (
                <button
                  type="button"
                  onClick={() => clicarBotao(anuncio.botao!)}
                  className="shrink-0 rounded-lg bg-black/10 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  {anuncio.botao.rotulo}
                </button>
              ) : null}

              {anuncio.dispensavel ? (
                <button
                  type="button"
                  onClick={fechar}
                  aria-label={t.anuncio.fechar}
                  title={t.anuncio.fechar}
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-base leading-none opacity-60 transition-opacity hover:opacity-100"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
