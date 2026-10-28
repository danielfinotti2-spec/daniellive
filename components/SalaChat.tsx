"use client";

/**
 * O chat da sala, compartilhado entre anfitrião e espectadores.
 *
 * Morar na sala (e não por usuário da conta) é a conversa que esta tela tem:
 * a conversa existe enquanto a transmissão existe, some com ela, e não pede
 * conta de ninguém — quem já tem nome na sala já pode falar. A autoria real
 * vem do servidor (é a conexão que envia), então o "você" aqui só destaca as
 * mensagens cuja origem bate com o id da própria conexão.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MOLA_PEQUENA } from "@/components/animacao";
import { Botao, CartaoSecao, Entrada, cx } from "@/components/ui";
import { useTexto, useIdioma } from "@/lib/idioma";
import type { ChatMessage } from "@/lib/protocol";

export function SalaChat({
  mensagens,
  selfId,
  onEnviar,
  conectado,
}: {
  /** Histórico + novas, na ordem do servidor. */
  mensagens: ChatMessage[];
  /** A própria conexão — para marcar "você". */
  selfId: string | null;
  onEnviar: (texto: string) => void;
  /** Sem conexão o envio cairia no vazio — então o campo trava e diz por quê. */
  conectado: boolean;
}) {
  const t = useTexto();
  const idioma = useIdioma();
  const [texto, setTexto] = useState("");
  const caixaRef = useRef<HTMLDivElement | null>(null);

  // Chegou mensagem: a rolagem acompanha o fim — direto no elemento, porque
  // `scrollIntoView` arrastaria a página inteira junto.
  useEffect(() => {
    const caixa = caixaRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [mensagens.length]);

  const relogio = new Intl.DateTimeFormat(idioma, { hour: "2-digit", minute: "2-digit" });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    onEnviar(limpo);
    setTexto("");
  }

  return (
    <CartaoSecao titulo={t.chat.titulo} descricao={t.chat.dica}>
      {/* A conversa cresce para baixo; altura fixa para a página não crescer
          junto — o que é de conversa fica dentro da conversa. */}
      <div
        ref={caixaRef}
        className="mb-2 flex max-h-64 min-h-14 flex-col gap-1.5 overflow-y-auto rounded-lg"
        aria-live="polite"
        aria-relevant="additions"
      >
        {mensagens.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {t.chat.vazio}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {mensagens.map((m) => {
              const propria = selfId !== null && m.deId === selfId;
              return (
                <motion.div
                  key={m.id}
                  layout={false}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={MOLA_PEQUENA}
                  className={cx(
                    "rounded-lg px-2.5 py-1.5 text-sm",
                    propria
                      ? "ml-6 bg-broadcast/10 dark:bg-broadcast/15"
                      : "mr-6 bg-zinc-100 dark:bg-zinc-900",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cx(
                        "truncate text-[11px] font-semibold",
                        propria ? "text-broadcast" : "text-zinc-600 dark:text-zinc-400",
                      )}
                    >
                      {propria ? `${m.de} (${t.chat.voce})` : m.de}
                    </span>
                    <time
                      className="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600"
                      dateTime={new Date(m.quando).toISOString()}
                    >
                      {relogio.format(m.quando)}
                    </time>
                  </span>
                  {/* Espaços e quebras da pessoa valem: é o formato da mensagem
                      dela, e elimina a tentação de interpretar algo como HTML. */}
                  <p className="whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200">
                    {m.texto}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <Entrada
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={conectado ? t.chat.placeholder : t.chat.aguardandoConexao}
          maxLength={500}
          disabled={!conectado}
          aria-label={t.chat.placeholder}
        />
        <Botao
          type="submit"
          variant="primario"
          size="sm"
          disabled={!conectado || !texto.trim()}
          className="h-10 shrink-0 self-center px-3"
        >
          {t.chat.enviar}
        </Botao>
      </form>
    </CartaoSecao>
  );
}
