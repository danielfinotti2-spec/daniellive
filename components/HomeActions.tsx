"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { supportsDisplayCapture } from "@/lib/webrtc";
import { useAplicativo } from "@/lib/desktop";
import { Aviso, Botao, Entrada } from "@/components/ui";
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
  const refEntrada = useRef<HTMLInputElement>(null);

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

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = normalizeRoomCode(valor);
    if (!codigo || !isValidRoomCode(codigo)) {
      setErro(t.entrada.codigoInvalido);
      return;
    }
    setErro(null);
    router.push(`/assistir/${codigo}`);
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
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
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
        />
        <Botao type="submit" variant="primario" className="shrink-0">
          {t.comum.assistir}
        </Botao>
      </div>
      {erro && (
        <p id="room-code-erro" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
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
