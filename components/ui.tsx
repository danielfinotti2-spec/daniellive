"use client";

/**
 * Blocos de interface do ScreenLive.
 *
 * Tudo aqui é escrito à mão sobre utilitários Tailwind, sem biblioteca de
 * componentes — a mesma escolha de arquitetura da referência, e o que mantém
 * o pacote pequeno e o comportamento previsível.
 *
 * Convenção de cor: as superfícies usam `bg-white dark:bg-zinc-950` e
 * `border-zinc-200 dark:border-zinc-800`. A escala `zinc` do escuro é
 * repintada em `app/globals.css`, então essas classes rendem as camadas
 * corretas sem nenhum `dark:` extra.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* -------------------------------------------------------------- utilidade */

/** Junta classes condicionais. Evita a dependência de clsx para tão pouco. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ botão */

type ButtonVariant = "primario" | "secundario" | "discreto" | "perigo" | "sucesso";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTE: Record<ButtonVariant, string> = {
  primario:
    "bg-broadcast text-white shadow-sm hover:bg-broadcast-strong disabled:hover:bg-broadcast",
  secundario:
    "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
  discreto:
    "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
  perigo:
    "border border-red-300 bg-white text-red-700 hover:border-red-400 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:border-red-800 dark:hover:bg-red-950/40",
  sucesso:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
};

const TAMANHO: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-2.5 py-1.5 text-xs",
  md: "gap-2 px-3.5 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-sm",
};

export function Botao({
  variant = "secundario",
  size = "md",
  carregando = false,
  rotuloCarregando,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  carregando?: boolean;
  /** Texto que substitui o conteúdo enquanto `carregando` — dizer o que está
   *  sendo esperado ("Abrindo a captura…") é mais útil que um giro mudo. */
  rotuloCarregando?: string;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTE[variant],
        TAMANHO[size],
        className,
      )}
    >
      {carregando && <Spinner className="h-3.5 w-3.5" />}
      {carregando && rotuloCarregando ? rotuloCarregando : children}
    </button>
  );
}

/** Botão que é um link: mesma aparência, semântica de navegação. */
export function BotaoLink({
  variant = "secundario",
  size = "md",
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <a
      {...rest}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors",
        VARIANTE[variant],
        TAMANHO[size],
        className,
      )}
    >
      {children}
    </a>
  );
}

/** Botão só de ícone. O rótulo vira `title` e `aria-label`. */
export function BotaoIcone({
  rotulo,
  variant = "discreto",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  rotulo: string;
  variant?: ButtonVariant;
}) {
  return (
    <button
      {...rest}
      title={rotulo}
      aria-label={rotulo}
      className={cx(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTE[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ cartão */

export function Cartao({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cartão com cabeçalho e corpo separados por uma borda. */
export function CartaoSecao({
  titulo,
  descricao,
  acao,
  children,
  className,
  icone,
  contagem,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  icone?: React.ReactNode;
  /** Número ao lado do título — evita escrever a contagem dentro da descrição. */
  contagem?: number;
}) {
  return (
    <Cartao className={className}>
      <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        {icone && (
          <span className="mt-0.5 text-zinc-400 dark:text-zinc-500" aria-hidden>
            {icone}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {titulo}
            {contagem !== undefined && contagem > 0 && (
              <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {contagem}
              </span>
            )}
          </h2>
          {descricao && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{descricao}</p>
          )}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Cartao>
  );
}

/* ------------------------------------------------------------------ campos */

export function Campo({
  label,
  dica,
  erro,
  id,
  className,
  children,
}: {
  label: string;
  dica?: string;
  erro?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
      >
        {label}
      </label>
      {dica && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{dica}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const CAMPO_BASE =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors " +
  "placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:bg-zinc-900 dark:placeholder:text-zinc-500";

/**
 * Campo de texto.
 *
 * O `ref` é repassado porque quem usa o campo costuma precisar focá-lo — ao
 * abrir um diálogo, ao voltar de um erro ou ao receber um código colado.
 */
export function Entrada({
  invalido,
  className,
  ref,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalido?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      {...rest}
      ref={ref}
      aria-invalid={invalido || undefined}
      className={cx(
        CAMPO_BASE,
        invalido
          ? "border-red-400 focus:border-red-500 dark:border-red-800"
          : "border-zinc-300 focus:border-broadcast dark:border-zinc-700",
        className,
      )}
    />
  );
}

export function Selecao({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        CAMPO_BASE,
        "cursor-pointer border-zinc-300 focus:border-broadcast dark:border-zinc-700",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Interruptor de liga/desliga, com estado lido por leitor de tela. */
export function Interruptor({
  checked,
  onChange,
  label,
  descricao,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descricao?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex items-start gap-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          "disabled:cursor-not-allowed",
          checked ? "bg-broadcast" : "bg-zinc-300 dark:bg-zinc-700",
        )}
      >
        <span
          aria-hidden
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
          {label}
        </span>
        {descricao && (
          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
            {descricao}
          </span>
        )}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ avisos */

type TomAviso = "erro" | "aviso" | "info" | "sucesso";

const TOM_AVISO: Record<TomAviso, { caixa: string; icone: React.ReactNode }> = {
  erro: {
    caixa:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    icone: <IconeAlerta />,
  },
  aviso: {
    caixa:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    icone: <IconeAlerta />,
  },
  info: {
    caixa:
      "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    icone: <IconeInfo />,
  },
  sucesso: {
    caixa:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    icone: <IconeCheck />,
  },
};

export function Aviso({
  tom,
  titulo,
  children,
  acao,
  className,
  aoFechar,
}: {
  tom: TomAviso;
  titulo?: string;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  /** Quando presente, acrescenta o botão de dispensar. */
  aoFechar?: () => void;
}) {
  const { caixa, icone } = TOM_AVISO[tom];
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", caixa, className)}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Dispensar aviso"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-full p-1 leading-none opacity-60 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ selos */

export function Selo({
  tom = "neutro",
  className,
  children,
  pulsante,
}: {
  tom?: "neutro" | "ao-vivo" | "sucesso" | "aviso" | "erro" | "info";
  className?: string;
  children: React.ReactNode;
  pulsante?: boolean;
}) {
  const tons = {
    neutro: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
    "ao-vivo": "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
    sucesso:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    aviso: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    erro: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Ponto de "ao vivo", com o pulso lento definido em globals.css. */
export function PontoAoVivo({ ativo }: { ativo: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "h-1.5 w-1.5 rounded-full",
        ativo ? "live-dot bg-red-500" : "bg-zinc-400 dark:bg-zinc-600",
      )}
    />
  );
}

/* ------------------------------------------------------------- carregamento */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("skeleton rounded-lg bg-zinc-200 dark:bg-zinc-800", className)}
    />
  );
}

/** Tela de carregamento de página inteira, centralizada. */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="h-5 w-5 text-zinc-400" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{texto}</p>
    </div>
  );
}

/** Estado vazio: ícone, título, explicação e uma saída. */
export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {icone && (
        <span
          aria-hidden
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
        >
          {icone}
        </span>
      )}
      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{titulo}</p>
      {descricao && (
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{descricao}</p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ diálogo */

/**
 * Janela modal.
 *
 * Fecha com Esc, com clique no fundo e com o botão próprio. O foco entra no
 * diálogo ao abrir e volta para o elemento anterior ao fechar, e o conteúdo
 * atrás fica inerte para leitores de tela e para o Tab.
 */
export function Dialogo({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
}) {
  const idTitulo = useId();
  const idDescricao = useId();
  const caixaRef = useRef<HTMLDivElement>(null);
  const anteriorRef = useRef<HTMLElement | null>(null);
  // O portal só existe no cliente; sem esta guarda o SSR quebraria.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;

    anteriorRef.current = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
        return;
      }
      // Mantém o Tab dentro do diálogo: fora dele o conteúdo está bloqueado.
      if (e.key !== "Tab" || !caixaRef.current) return;
      const focaveis = caixaRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onTecla);
    // O foco entra no primeiro controle, que é onde a ação está.
    const alvo = caixaRef.current?.querySelector<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    alvo?.focus();

    return () => {
      document.removeEventListener("keydown", onTecla);
      document.body.style.overflow = overflowAnterior;
      anteriorRef.current?.focus?.();
    };
  }, [aberto, onFechar]);

  if (!montado || !aberto) return null;

  const larguras = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="dialog-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onFechar}
        aria-hidden
      />
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        className={cx(
          "dialog-card relative w-full rounded-t-2xl border border-zinc-200 bg-white shadow-2xl",
          "dark:border-zinc-800 dark:bg-zinc-950",
          "sm:rounded-2xl",
          larguras[largura],
        )}
      >
        <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2
              id={idTitulo}
              className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              {titulo}
            </h2>
            {descricao && (
              <p id={idDescricao} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {descricao}
              </p>
            )}
          </div>
          <BotaoIcone rotulo="Fechar" onClick={onFechar} className="-mr-1 -mt-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </BotaoIcone>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- menu */

/**
 * Menu suspenso.
 *
 * Fecha ao clicar fora e com Esc. A navegação por setas não é decorativa: um
 * menu que só responde ao mouse deixa de existir para quem usa teclado.
 */
export function Menu({
  rotulo,
  icone,
  children,
  alinhamento = "direita",
  className,
  gatilho,
}: {
  /** Rótulo acessível. Obrigatório mesmo com `gatilho`: o visual pode ser só
   *  um ícone, mas o nome precisa existir para leitores de tela. */
  rotulo: string;
  icone?: React.ReactNode;
  children: (fechar: () => void) => React.ReactNode;
  alinhamento?: "esquerda" | "direita";
  className?: string;
  /**
   * Substitui o botão padrão.
   *
   * Recebe o estado para poder desenhar o próprio visual — um gatilho que não
   * muda quando o menu abre deixa a pessoa sem saber se o clique pegou.
   */
  gatilho?: (estado: { aberto: boolean }) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const itensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onCliqueFora = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false);
    };
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const itens = Array.from(
        itensRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (itens.length === 0) return;
      e.preventDefault();
      const atual = itens.indexOf(document.activeElement as HTMLElement);
      const proximo =
        e.key === "ArrowDown"
          ? (atual + 1) % itens.length
          : e.key === "ArrowUp"
            ? (atual - 1 + itens.length) % itens.length
            : e.key === "Home"
              ? 0
              : itens.length - 1;
      itens[proximo].focus();
    };
    document.addEventListener("mousedown", onCliqueFora);
    document.addEventListener("keydown", onTecla);
    return () => {
      document.removeEventListener("mousedown", onCliqueFora);
      document.removeEventListener("keydown", onTecla);
    };
  }, [aberto]);

  return (
    <div ref={raizRef} className={cx("relative", className)}>
      {gatilho ? (
        <span
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={aberto}
          aria-label={rotulo}
          onClick={() => setAberto((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAberto((v) => !v);
            }
          }}
          className="inline-flex"
        >
          {gatilho({ aberto })}
        </span>
      ) : (
        <Botao
          variant="secundario"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          {icone}
          <span>{rotulo}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
            className={cx("transition-transform", aberto && "rotate-180")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Botao>
      )}

      {aberto && (
        <div
          ref={itensRef}
          role="menu"
          aria-label={rotulo}
          className={cx(
            "fade-in absolute z-40 mt-1.5 min-w-44 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg",
            "dark:border-zinc-800 dark:bg-zinc-950",
            alinhamento === "direita" ? "right-0" : "left-0",
          )}
        >
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icone,
  children,
  onClick,
  tom = "neutro",
  selecionado,
}: {
  icone?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  tom?: "neutro" | "perigo";
  selecionado?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        tom === "perigo"
          ? "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
        selecionado && "font-medium text-zinc-950 dark:text-zinc-50",
      )}
    >
      {icone && (
        <span aria-hidden className="shrink-0 text-zinc-400 dark:text-zinc-500">
          {icone}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selecionado && <IconeCheck className="h-3.5 w-3.5 shrink-0 text-broadcast" />}
    </button>
  );
}

export function MenuSeparador() {
  return <div role="separator" className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />;
}

/* ------------------------------------------------------------------ abas */

export function Abas<T extends string>({
  valor,
  onChange,
  itens,
  className,
}: {
  valor: T;
  onChange: (v: T) => void;
  itens: Array<{ valor: T; rotulo: string; contagem?: number }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      {itens.map((item) => {
        const ativo = item.valor === valor;
        return (
          <button
            key={item.valor}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(item.valor)}
            className={cx(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              ativo
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50",
            )}
          >
            {item.rotulo}
            {typeof item.contagem === "number" && (
              <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {item.contagem}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- tooltip */

/** Dica curta ao passar o mouse ou focar. CSS puro, sem posicionamento por JS. */
export function Dica({
  texto,
  children,
  className,
}: {
  texto: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap",
          "rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-50 opacity-0 shadow-lg transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "dark:bg-zinc-700",
        )}
      >
        {texto}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ ícones */

export function IconeCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconeAlerta({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function IconeInfo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
