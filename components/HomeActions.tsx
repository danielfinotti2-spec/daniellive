"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { supportsDisplayCapture } from "@/lib/webrtc";
import { useAplicativo } from "@/lib/desktop";
import { Aviso, Botao, BotaoIcone, Entrada } from "@/components/ui";
import { AnimatePresence, motion, MOLA_PEQUENA } from "@/components/animacao";
import { preencher, useTexto } from "@/lib/idioma";

/**
 * Responde se este navegador sabe capturar a tela, sem quebrar a hidratação.
 *
 * A resposta do servidor é sempre `false` (não existe `navigator` lá), então
 * uma checagem direta durante a renderização faria o HTML do servidor divergir
 * do cliente — o componente que depende disso seria remontado no cliente.
 * `useSyncExternalStore` fornece exatamente esse "retrato do servidor" e depois
 * o valor real do cliente.
 */
export function useSuporteCaptura(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => supportsDisplayCapture(),
    () => false,
  );
}

/**
 * Formulário de entrada por código ou link.
 *
 * Aceita as duas coisas porque é o que a pessoa tem em mãos: o código que ouviu
 * e o link que recebeu. Quem decide é `normalizeRoomCode`, que também perdoa os
 * caracteres ambíguos que aparecem quando alguém digita de memória.
 *
 * O botão "Colar" lê a área de transferência e preenche o campo: quem recebeu
 * o link na janela ao lado não precisa saber onde está Ctrl+V. Ele só aparece
 * em navegador que oferece a leitura — um botão que sempre falhre seria pior
 * do que nenhum.
 */
export function FormularioEntrar({
  id = "entrar",
  autoFoco = false,
  compacto = false,
}: {
  id?: string;
  autoFoco?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const t = useTexto();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  /** Deixando a página para a sala: o botão mostra o que está acontecendo. */
  const [indo, setIndo] = useState(false);
  /** Confirmação breve de que a colagem funcionou. */
  const [colado, setColado] = useState(false);
  const refEntrada = useRef<HTMLInputElement>(null);
  const temporizador = useRef<number | null>(null);
  const podeLerArea = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      Boolean(navigator.clipboard) &&
      typeof navigator.clipboard.readText === "function",
    () => false,
  );

  /**
   * Foco sem arrastar a página.
   *
   * O atributo `autoFocus` do React foca assim que o campo é montado, e o
   * navegador rola até ele para deixá-lo visível — numa página longa isso puxa a
   * interface para baixo no instante em que ela abre, sem ninguém ter pedido. O
   * `preventScroll` mantém o foco (que é a parte útil, para digitar direto) e
   * descarta a rolagem.
   */
  useEffect(() => {
    if (autoFoco) refEntrada.current?.focus({ preventScroll: true });
  }, [autoFoco]);

  // Nenhum temporizador sobrevive à desmontagem — nada de setState em fantasma.
  useEffect(() => {
    return () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    };
  }, []);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = normalizeRoomCode(valor);
    if (!codigo || !isValidRoomCode(codigo)) {
      setErro(t.entrada.codigoInvalido);
      return;
    }
    setErro(null);
    setIndo(true);
    router.push(`/assistir/${codigo}`);
  }

  /** Cola o link da área de transferência — o caminho de quem recebeu o link. */
  async function colarDaArea() {
    try {
      const texto = (await navigator.clipboard.readText()).trim();
      if (!texto) {
        setErro(t.comum.nadaParaColar);
        return;
      }
      setValor(texto);
      setErro(null);
      setColado(true);
      refEntrada.current?.focus({ preventScroll: true });
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setColado(false), 1600);
    } catch {
      // A permissão pode ser recusada; Ctrl+V continua funcionando, então a
      // interface não promete o que não entrega — o botão só falha em silêncio.
    }
  }

  return (
    <form onSubmit={entrar} noValidate>
      <label htmlFor="room-code" className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
        {t.entrada.titulo}
      </label>
      {!compacto && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t.entrada.dica}
        </p>
      )}
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <Entrada
            ref={refEntrada}
            id="room-code"
            name="room"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              if (erro) setErro(null);
            }}
            placeholder={t.entrada.placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            invalido={Boolean(erro)}
            aria-describedby={erro ? "room-code-erro" : undefined}
            className={podeLerArea ? "pr-10" : undefined}
          />
          {podeLerArea && (
            <BotaoIcone
              rotulo={colado ? t.entrada.colado : t.entrada.colar}
              onClick={() => void colarDaArea()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              {colado ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className="text-emerald-600 dark:text-emerald-400">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="6" y="4" width="12" height="17" rx="2" />
                  <path d="M9 4.5V3h6v1.5" />
                </svg>
              )}
            </BotaoIcone>
          )}
        </div>
        <Botao
          type="submit"
          variant="primario"
          className="shrink-0"
          carregando={indo}
          rotuloCarregando={t.entrada.indoNaSala}
        >
          {t.comum.assistir}
        </Botao>
      </div>
      {/*
       * A saída do erro é animada: corrigir o texto apaga a mensagem com um
       * desvanecer curto, não com um corte que desloca o formulário inteiro.
       */}
      <AnimatePresence initial={false}>
        {erro && (
          <motion.p
            key="erro"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={MOLA_PEQUENA}
            id="room-code-erro"
            role="alert"
            className="mt-2 text-xs text-red-600 dark:text-red-400"
          >
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

/**
 * Cartão que cria uma transmissão.
 *
 * Leva para a página de preparação, onde o nome é confirmado e a sala é criada
 * de verdade — criar a sala aqui e só depois pedir o nome deixaria uma sala
 * vazia no servidor se a pessoa desistisse no meio.
 */
export function CartaoCriarTransmissao({ className }: { className?: string }) {
  const router = useRouter();
  const noAplicativo = useAplicativo();
  const t = useTexto();
  return (
    <div className={className}>
      <Botao
        variant="primario"
        size="lg"
        className="w-full"
        onClick={() => router.push("/transmitir")}
      >
        {t.comum.criarTransmissao}
      </Botao>
      <p className="mt-2.5 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {noAplicativo ? t.criarTransmissao.descricaoApp : t.criarTransmissao.descricaoWeb}
      </p>
    </div>
  );
}

/**
 * Aviso de contexto não seguro: sem HTTPS o navegador bloqueia a captura.
 *
 * A checagem vive numa fonte externa pelo mesmo motivo do suporte à captura: o
 * servidor não tem como saber, e responder durante a renderização faria o HTML
 * divergir do cliente.
 *
 * No aplicativo este aviso é impossível de aparecer — ele serve a interface por
 * `http://127.0.0.1`, que o Chromium trata como seguro. O texto abaixo, porém,
 * fala de "site" e de "abrir por https", o que não é instrução para quem está
 * dentro de um programa instalado; por isso o aplicativo não o exibe.
 */
export function AvisoContextoInseguro({ className }: { className?: string }) {
  const t = useTexto();
  const noAplicativo = useAplicativo();
  const inseguro = useSyncExternalStore(
    () => () => {},
    () => {
      // `localhost` é tratado como seguro pelos navegadores, então não avisa.
      const localhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      return !window.isSecureContext && !localhost;
    },
    () => false,
  );

  if (!inseguro || noAplicativo) return null;

  /*
    Os dois endereços são literais técnicos e continuam em `<strong>`. Como o
    dicionário só guarda texto, a frase é montada com marcadores e depois
    quebrada neles: o que muda entre idiomas é a ordem das partes, não a
    marcação — que segue aplicada a `https://` e a `localhost` em qualquer um.
  */
  const texto = preencher(t.entrada.avisoInseguroTexto, {
    https: "\u0000https\u0000",
    localhost: "\u0000localhost\u0000",
  });

  return (
    <Aviso tom="aviso" titulo={t.entrada.avisoInseguroTitulo} className={className}>
      {texto.split("\u0000").map((parte, i) =>
        i % 2 === 0 ? (
          parte
        ) : (
          <strong key={parte} className="font-semibold">
            {parte}
          </strong>
        ),
      )}
    </Aviso>
  );
}
