"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { Aviso, Botao, Entrada } from "@/components/ui";

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
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = normalizeRoomCode(valor);
    if (!codigo || !isValidRoomCode(codigo)) {
      setErro("Código inválido. Ele tem 9 caracteres, como K7M2PQR4T.");
      return;
    }
    setErro(null);
    router.push(`/assistir/${codigo}`);
  }

  return (
    <form onSubmit={entrar} noValidate>
      <label htmlFor="room-code" className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Já tem um link ou código?
      </label>
      {!compacto && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Cole o link que você recebeu ou digite o código da sala.
        </p>
      )}
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <Entrada
          id="room-code"
          name="room"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            if (erro) setErro(null);
          }}
          placeholder="Cole o link ou o código da sala"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          autoFocus={autoFoco}
          invalido={Boolean(erro)}
          aria-describedby={erro ? "room-code-erro" : undefined}
        />
        <Botao type="submit" variant="primario" className="shrink-0">
          Assistir
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
  return (
    <div className={className}>
      <Botao
        variant="primario"
        size="lg"
        className="w-full"
        onClick={() => router.push("/transmitir")}
      >
        Criar transmissão
      </Botao>
      <p className="mt-2.5 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Sem conta, sem instalar nada. Você escolhe o que compartilhar.
      </p>
    </div>
  );
}

/** Aviso de contexto não seguro: sem HTTPS o navegador bloqueia a captura. */
export function AvisoContextoInseguro() {
  if (typeof window === "undefined") return null;
  const seguro = window.isSecureContext;
  const localhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (seguro || localhost) return null;

  return (
    <Aviso tom="aviso" titulo="Esta página não está em HTTPS">
      Os navegadores só permitem compartilhar a tela em conexões seguras. Aqui a captura vai
      falhar. Abra o site por <strong className="font-semibold">https://</strong> ou por{" "}
      <strong className="font-semibold">localhost</strong>.
    </Aviso>
  );
}
