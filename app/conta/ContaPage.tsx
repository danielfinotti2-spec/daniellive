"use client";

/**
 * O corpo da conta (cliente): formulários e listas.
 *
 * Sem sessão, a tela é o par "criar conta / entrar" — lado a lado no desktop,
 * empilhado no celular, com o Google como opção extra quando o servidor está
 * configurado para ele. Com sessão, a tela vira o perfil: quem é, e as
 * amizades (adicionar, pedidos recebidos, a lista).
 *
 * As ações devolvem códigos; os textos vivem no dicionário — é o que mantém
 * tudo traduzido igual ao resto do app.
 */

import { useActionState, useState } from "react";
import {
  BotaoLink,
  Campo,
  Cartao,
  CartaoSecao,
  Aviso,
  Entrada,
} from "@/components/ui";
import { BotaoEnvio } from "@/components/BotaoEnvio";
import { VoltarAoInicio } from "@/components/VoltarAoInicio";
import { Aparecer, ListaViva, ItemVivo, AnimatePresence } from "@/components/animacao";
import { preencher, useTexto, useIdioma, type Dicionario } from "@/lib/idioma";
import { idadeDe, formatoDeNascimento } from "@/lib/idade";
import type { Amigo, PedidoAmizade, Usuario } from "@/lib/auth";
import {
  acaoCadastrar,
  acaoEntrar,
  acaoSair,
  acaoAdicionarAmigo,
  acaoAceitarPedido,
  acaoDesfazer,
  type EstadoAutenticacao,
  type EstadoAmizades,
} from "./acoes";

type DadosConta = { usuario: Usuario; amigos: Amigo[]; pedidos: PedidoAmizade[] };

const ACAO_VAZIA: EstadoAutenticacao = { erro: null };
const AMIZ_VAZIA: EstadoAmizades = { erro: null, mensagem: null };

/** Dicionário -> texto do código que a ação devolveu. */
function textoErro(t: Dicionario, codigo: string | null): string | null {
  if (!codigo) return null;
  return (t.conta.erros as Record<string, string>)[codigo] ?? t.conta.erros.desconhecido;
}

function textoMsg(t: Dicionario, codigo: string | null): string | null {
  if (!codigo) return null;
  return (t.conta.mensagens as Record<string, string>)[codigo] ?? null;
}

export function ContaPage({
  dados,
  googleHabilitado,
  erroEntrada,
}: {
  dados: DadosConta | null;
  googleHabilitado: boolean;
  erroEntrada: string | null;
}) {
  const t = useTexto();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <VoltarAoInicio />
      <header className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t.conta.tituloPagina}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t.conta.subtitulo}
        </p>
      </header>

      {erroEntrada && (
        <div className="mt-6">
          <Aviso tom="erro" titulo={t.conta.erros.googleFalhou} />
        </div>
      )}

      {dados === null ? (
        <EntradaECadastro googleHabilitado={googleHabilitado} />
      ) : (
        <PerfilComAmigos dados={dados} />
      )}
    </div>
  );
}

/* ------------------------------------------------- sem sessão: entrar/criar */

type Aba = "entrar" | "criar";

/**
 * As duas portas de entrada em abas: "Criar conta" e "Entrar". Um só cartão,
 * troca instantânea de formulário — o visitante de primeira viagem cai na
 * criação (a falta de conta é o motivo de ter chegado aqui), e a aba lembrada
 * fica para o próximo acesso.
 */
function EntradaECadastro({ googleHabilitado }: { googleHabilitado: boolean }) {
  const t = useTexto();
  const [aba, setAba] = useState<Aba>("criar");
  return (
    <Aparecer>
      <Cartao className="mx-auto mt-8 w-full max-w-lg p-5">
        <div role="tablist" aria-label={t.conta.abasRotulo} className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {(
            [
              ["criar", t.conta.criarTitulo],
              ["entrar", t.conta.entrarTitulo],
            ] as const
          ).map(([valor, rotulo]) => {
            const ativa = aba === valor;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(valor)}
                className={
                  ativa
                    ? "rounded-md bg-white px-3 py-2 text-sm font-semibold text-zinc-950 shadow-sm transition-all dark:bg-zinc-800 dark:text-zinc-50"
                    : "rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200"
                }
              >
                {rotulo}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {aba === "criar" ? t.conta.criarDescricao : t.conta.entrarDescricao}
        </p>

        {aba === "criar" ? <FormularioCadastro /> : <FormularioEntrar />}

        {googleHabilitado && (
          <SeparadorGoogle rotulo={aba === "criar" ? t.conta.criarGoogle : t.conta.entrarGoogle} />
        )}
      </Cartao>
    </Aparecer>
  );
}

function FormularioCadastro() {
  const t = useTexto();
  const [estado, acao] = useActionState(acaoCadastrar, ACAO_VAZIA);
  const erro = textoErro(t, estado.erro);
  return (
    <form action={acao} className="mt-4 flex flex-1 flex-col justify-end gap-3">
      <AnimatePresence>
        {erro && (
          <Aviso
            key={erro}
            tom="erro"
            titulo={erro}
            className="py-2 text-xs"
        />
        )}
      </AnimatePresence>
      <Campo label={t.conta.nome} id="cad-nome">
        <Entrada
          id="cad-nome"
          name="nome"
          autoComplete="name"
          maxLength={64}
          required
          placeholder={t.conta.nomePlaceholder}
        />
      </Campo>
      <Campo label={t.conta.apelido} id="cad-apelido" dica={t.conta.apelidoDica}>
        <Entrada
          id="cad-apelido"
          name="apelido"
          autoComplete="nickname"
          maxLength={32}
          placeholder={t.conta.apelidoPlaceholder}
        />
      </Campo>
      <Campo label={t.conta.nascimento} id="cad-nascimento" dica={t.conta.nascimentoDica}>
        <Entrada
          id="cad-nascimento"
          name="nascimento"
          type="date"
          autoComplete="bday"
          required
        />
      </Campo>
      <Campo label={t.conta.email} id="cad-email">
        <Entrada
          id="cad-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          placeholder={t.conta.emailPlaceholder}
        />
      </Campo>
      <Campo label={t.conta.senha} id="cad-senha" dica={t.conta.senhaDica}>
        <Entrada
          id="cad-senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </Campo>
      <div className="mt-2 flex items-center gap-3">
        <BotaoEnvio
          variant="primario"
          rotulo={t.conta.criar}
          rotuloCarregando={t.conta.criando}
        />
      </div>
    </form>
  );
}

function FormularioEntrar() {
  const t = useTexto();
  const [estado, acao] = useActionState(acaoEntrar, ACAO_VAZIA);
  const erro = textoErro(t, estado.erro);
  return (
    <form action={acao} className="mt-4 flex flex-1 flex-col justify-end gap-3">
      <AnimatePresence>
        {erro && (
          <Aviso
            key={erro}
            tom="erro"
            titulo={erro}
            className="py-2 text-xs"
        />
        )}
      </AnimatePresence>
      <Campo label={t.conta.email} id="ent-email">
        <Entrada
          id="ent-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t.conta.emailPlaceholder}
        />
      </Campo>
      <Campo label={t.conta.senha} id="ent-senha">
        <Entrada id="ent-senha" name="senha" type="password" autoComplete="current-password" required />
      </Campo>
      <div className="mt-2 flex items-center gap-3">
        <BotaoEnvio
          variant="secundario"
          rotulo={t.conta.entrar}
          rotuloCarregando={t.conta.entrando}
        />
      </div>
    </form>
  );
}

function SeparadorGoogle({ rotulo }: { rotulo: string }) {
  const t = useTexto();
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        {t.conta.ou}
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <BotaoLink
        href="/api/auth/google"
        variant="secundario"
        size="sm"
        className="mt-3 h-10 w-full"
      >
        <IconeGoogle className="h-4 w-4" />
        {rotulo}
      </BotaoLink>
    </div>
  );
}

/* ------------------------------------------------- com sessão: seu perfil */

function PerfilComAmigos({ dados }: { dados: DadosConta }) {
  const t = useTexto();
  const idioma = useIdioma();
  const { usuario, amigos, pedidos } = dados;
  const dataEntrada = new Intl.DateTimeFormat(idioma, { dateStyle: "long" }).format(
    new Date(usuario.criadoEm),
  );
  const idade = idadeDe(usuario.nascimento);
  const formatoNasc = formatoDeNascimento(usuario.nascimento, idioma);

  return (
    <div className="mt-8 flex flex-col gap-4">
      <Aparecer>
        <Cartao className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-broadcast/15 text-lg font-bold text-broadcast">
                {usuario.nome.trim()[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {usuario.apelido ?? usuario.nome}
                </p>
                {usuario.apelido && usuario.apelido !== usuario.nome && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{usuario.nome}</p>
                )}
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{usuario.email}</p>
              </div>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <p>{preencher(t.conta.membroDesde, { data: dataEntrada })}</p>
              {formatoNasc && (
                <p>
                  {preencher(t.conta.nascidoEm, {
                    data: formatoNasc,
                    idade: idade !== null ? String(idade) : "",
                  })}
                </p>
              )}
              {usuario.provedor === "google" && (
                <p className="text-zinc-500 dark:text-zinc-500">{t.conta.provedorGoogle}</p>
              )}
            </dl>
          </div>
          <form action={acaoSair} className="shrink-0">
            <BotaoEnvio
              variant="discreto"
              rotulo={t.conta.sair}
              rotuloCarregando={t.conta.saindo}
        />
          </form>
        </Cartao>
      </Aparecer>

      {pedidos.length > 0 && (
        <Aparecer atraso={0.05}>
          <CartaoSecao titulo={t.conta.pedidosTitulo}>
            <ListaViva className={"mt-3 flex flex-col gap-2"}>
              {pedidos.map((p) => (
                <ItemVivo
                  key={p.id}
                  chave={String(p.id)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {p.nome}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{p.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <AcoesPedido pedidoId={p.id} />
                  </div>
                </ItemVivo>
              ))}
            </ListaViva>
          </CartaoSecao>
        </Aparecer>
      )}

      <Aparecer atraso={0.1}>
        <CartaoSecao titulo={t.conta.amigosTitulo} descricao={t.conta.amigosDescricao}>
          <FormularioAdicionar />
          {amigos.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t.conta.amigosVazio}</p>
          ) : (
              <ListaViva className="mt-3 flex flex-col gap-2">
              {amigos.map((a) => (
                <ItemVivoAmigo key={a.id} amigo={a} />
              ))}
            </ListaViva>
          )}
        </CartaoSecao>
      </Aparecer>
    </div>
  );
}

function AcoesPedido({ pedidoId }: { pedidoId: number }) {
  const t = useTexto();
  const [erroVerde, acaoVerde] = useActionState(acaoAceitarPedido, AMIZ_VAZIA);
  const [erroGris, acaoGris] = useActionState(acaoDesfazer, AMIZ_VAZIA);
  const erro = textoErro(t, erroVerde.erro ?? erroGris.erro);
  return (
    <>
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
      <form action={acaoGris}>
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <BotaoEnvio
          variant="discreto"
          rotulo={t.conta.recusar}
          rotuloCarregando="â€¦"
        />
      </form>
      <form action={acaoVerde}>
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <BotaoEnvio
          variant="primario"
          rotulo={t.conta.aceitar}
          rotuloCarregando="â€¦"
        />
      </form>
    </>
  );
}

function ItemVivoAmigo({ amigo }: { amigo: Amigo }) {
  const t = useTexto();
  const [estado, acao] = useActionState(acaoDesfazer, AMIZ_VAZIA);
  const erro = textoErro(t, estado.erro);
  const exibicao = amigo.apelido ?? amigo.nome;
  return (
    <ItemVivo chave={amigo.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{exibicao}</p>
        {exibicao !== amigo.nome && (
          <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{amigo.nome}</p>
        )}
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{amigo.email}</p>
        {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
      </div>
      <form action={acao} className="shrink-0">
        <input type="hidden" name="pedidoId" value={amigo.relacaoId} />
        <BotaoEnvio
          variant="discreto"
          rotulo={t.conta.remover}
          rotuloCarregando="â€¦"
        />
      </form>
    </ItemVivo>
  );
}

function FormularioAdicionar() {
  const t = useTexto();
  const [estado, acao] = useActionState(acaoAdicionarAmigo, AMIZ_VAZIA);
  const erro = textoErro(t, estado.erro);
  const msg = textoMsg(t, estado.mensagem);
  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.conta.adicionarTitulo}</p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.conta.adicionarDescricao}</p>
      <form action={acao} className="mt-2.5 flex gap-2">
        <Entrada
          name="email"
          type="email"
          required
          placeholder={t.conta.emailPlaceholder}
          aria-label={t.conta.email}
          maxLength={254}
        />
        <BotaoEnvio
          variant="secundario"
          size="sm"
          rotulo={t.conta.adicionar}
          rotuloCarregando={t.conta.adicionando}
          className="h-10 shrink-0 self-center"
        />
      </form>
      <AnimatePresence>
        {erro && <p key={erro} className="mt-2 text-xs text-red-600 dark:text-red-400">{erro}</p>}
        {msg && <p key={msg} className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
      </AnimatePresence>
    </div>
  );
}

/** O "G" do Google, desenhado à mão para o botão de provedor. */
function IconeGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v2.9h5.1c-.5 2-2.1 3.4-5.1 3.4a5.7 5.7 0 1 1 0-11.4c1.5 0 2.8.5 3.8 1.4l2.2-2.2A8 8 0 1 0 12 20a8 8 0 0 0 7.9-6.5V11H12Z"
        />
    </svg>
  );
}

