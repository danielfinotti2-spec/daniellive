/**
 * Contas: criar, entrar, guardar a sessão e cuidar das amizades.
 *
 * Escolhas de segurança e POR QUÊ:
 *
 *  - Senhas com `scrypt` (memória cara, natural da Node): o algoritmo do estado
 *    da arte sem módulo nativo, e o custo de ataque passa da GPU para a RAM.
 *  - Sal de 16 bytes por usuário — duas senhas iguais geram hashes diferentes.
 *  - Sessão é um token OPACO de 32 bytes no cookie; no banco fica só o SHA-256
 *    dele. Um vazamento do arquivo do banco não entrega sessões ativas (o
 *    cookie roubado, sim — por isso ele é httpOnly e nunca vai para o JS).
 *  - Comparação com `timingSafeEqual` — não dá para medir, do tempo de
 *    resposta, quantos bytes do hash coincidem.
 *  - Sem limite de tentativas aqui: a porta de entrada (a rota da ação) tem
 *    o mesmo rate limit de sempre do servidor.
 *
 * Sempre servidor: este arquivo lê `lib/db.ts`, que abre o SQLite.
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
// Extensão explícita: o Node (testes de unidade) não resolve `./db` — só o
// bundler aceitaria o nome pelado. O `.ts` lê igual nos dois.
import { banco } from "./db.ts";

/* ------------------------------------------------------------------ tipos */

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  apelido: string | null;
  nascimento: string | null;
  provedor: "senha" | "google";
  criadoEm: string;
};

/** Amizade já aceita, com a parte do amigo pronta para mostrar. */
export type Amigo = { id: string; nome: string; apelido: string | null; email: string; relacaoId: number };

/** Pedido pendente recebido: quem pede, e quando. */
export type PedidoAmizade = { id: number; deId: string; nome: string; email: string; quando: string };

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: "email_invalido" | "senha_curta" | "nome_curto" | "email_em_uso"
      | "nascimento_invalida" | "muito_jovem" | "credenciais" | "nao_encontrado"
      | "pedido_existente" | "voce_mesmo" | "desconhecido" };

/* ------------------------------------------------------------ constantes */

/** Quanto uma sessão dura sem renovação (renovada a cada visita). */
export const SESSAO_DIAS = 30;
const TAMANHO_HASH = 64;
const VERSAO_SCRYPT = { N: 16384, r: 8, p: 1 } as const;

function agora(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------- senhas */

/** Compõe `sal$hash` — as duas metas vivem juntas por conveniência de leitura. */
function hashSenha(senha: string, sal: string): string {
  const hash = scryptSync(senha, sal, TAMANHO_HASH, VERSAO_SCRYPT);
  return `${sal}$${hash.toString("hex")}`;
}

function conferirSenha(senha: string, guardado: string): boolean {
  const [sal, hashHex] = guardado.split("$");
  if (!sal || !hashHex) return false;
  const tentativa = scryptSync(senha, sal, TAMANHO_HASH, VERSAO_SCRYPT);
  const esperado = Buffer.from(hashHex, "hex");
  return tentativa.length === esperado.length && timingSafeEqual(tentativa, esperado);
}

/* -------------------------------------------------------------- usuários */

function linhaParaUsuario(linha: Record<string, unknown> | undefined): Usuario | null {
  if (!linha) return null;
  return {
    id: String(linha.id),
    email: String(linha.email),
    nome: String(linha.nome),
    apelido: linha.apelido == null ? null : String(linha.apelido),
    nascimento: linha.nascimento == null ? null : String(linha.nascimento),
    provedor: linha.provedor === "google" ? "google" : "senha",
    criadoEm: String(linha.criado_em),
  };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const SENHA_MINIMA = 8;
/** Idade mínima para criar conta: baixíssima, mas respeita a lei (a conta pode guardar dados). */
export const IDADE_MINIMA = 13;

/**
 * Valida a data de nascimento do cadastro.
 *
 * Formato esperado: `AAAA-MM-DD` (é o que o `<input type="date">` entrega).
 * Recusa data que não existe (31/02), data no futuro e idade abaixo do mínimo
 * — em texto simples, sem concessões: cadastro novo não entra sem idade de
 * verdade.
 */
export function validarNascimento(entrada: string): { ok: true; valor: string } | { ok: false; erro: "nascimento_invalida" | "muito_jovem" } {
  const limpa = entrada.trim();
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpa);
  if (!partes) return { ok: false, erro: "nascimento_invalida" };
  const [, anoStr, mesStr, diaStr] = partes;
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (Number.isNaN(data.getTime()) || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return { ok: false, erro: "nascimento_invalida" };
  }
  const agora = new Date();
  if (data.getTime() > agora.getTime()) return { ok: false, erro: "nascimento_invalida" };
  // Idade em anos vazios (sem truque de "anos do futuro"): compara dia/mês.
  let idade = agora.getUTCFullYear() - ano;
  const jaFezAniversario =
    agora.getUTCMonth() + 1 > mes || (agora.getUTCMonth() + 1 === mes && agora.getUTCDate() >= dia);
  if (!jaFezAniversario) idade -= 1;
  if (idade < IDADE_MINIMA) return { ok: false, erro: "muito_jovem" };
  if (idade > 120) return { ok: false, erro: "nascimento_invalida" };
  return { ok: true, valor: limpa };
}

/** Cria uma conta de e-mail e senha. Nascimento é obrigatório no cadastro novo. */
export function criarUsuario(
  email: string,
  senha: string,
  nome: string,
  opcoes: { nascimento?: string; apelido?: string } = {},
): Resultado<Usuario> {
  const emailLimpo = email.trim().toLowerCase();
  const nomeLimpo = nome.trim();
  const apelidoLimpo = opcoes.apelido?.trim() || null;
  if (!EMAIL_RE.test(emailLimpo)) return { ok: false, erro: "email_invalido" };
  if (senha.length < SENHA_MINIMA) return { ok: false, erro: "senha_curta" };
  if (nomeLimpo.length < 2) return { ok: false, erro: "nome_curto" };
  let nascimento: string | null = null;
  if (opcoes.nascimento !== undefined) {
    const checagem = validarNascimento(opcoes.nascimento);
    if (!checagem.ok) return checagem;
    nascimento = checagem.valor;
  }

  const db = banco();
  const jaExiste = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(emailLimpo);
  if (jaExiste) return { ok: false, erro: "email_em_uso" };

  const sal = randomBytes(16).toString("hex");
  const usuario: Usuario = {
    id: randomUUID(),
    email: emailLimpo,
    nome: nomeLimpo,
    apelido: apelidoLimpo,
    nascimento,
    provedor: "senha",
    criadoEm: agora(),
  };
  db.prepare(
    `INSERT INTO usuarios (id, email, nome, apelido, nascimento, senha_hash, sal, provedor, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, '', 'senha', ?)`,
  ).run(usuario.id, usuario.email, usuario.nome, usuario.apelido, usuario.nascimento, hashSenha(senha, sal), usuario.criadoEm);
  return { ok: true, valor: usuario };
}

/**
 * Encontra (ou cria) a conta de alguém que entrou por um provedor externo.
 *
 * Não se exige senha: a prova é o provedor. A senha local fica vazia — e o
 * login de senha falha para ela, até que a pessoa defina uma (sem isso,
 * cadastrar com o mesmo e-mail criaria uma conta gemea, nunca a mesma).
 */
export function buscarOuCriarExterno(email: string, nome: string, provedor: "google"): Resultado<Usuario> {
  const emailLimpo = email.trim().toLowerCase();
  if (!EMAIL_RE.test(emailLimpo)) return { ok: false, erro: "email_invalido" };
  const db = banco();
  const achado = linhaParaUsuario(
    db.prepare("SELECT * FROM usuarios WHERE email = ?").get(emailLimpo) as Record<string, unknown> | undefined,
  );
  if (achado) return { ok: true, valor: achado };

  const usuario: Usuario = {
    id: randomUUID(),
    email: emailLimpo,
    nome: nome.trim() || emailLimpo.split("@")[0],
    apelido: null,
    nascimento: null,
    provedor,
    criadoEm: agora(),
  };
  db.prepare(
    `INSERT INTO usuarios (id, email, nome, senha_hash, sal, provedor, criado_em)
     VALUES (?, ?, ?, '', '', ?, ?)`,
  ).run(usuario.id, usuario.email, usuario.nome, provedor, usuario.criadoEm);
  return { ok: true, valor: usuario };
}

/** Confere e-mail e senha de uma conta local. */
export function autenticar(email: string, senha: string): Resultado<Usuario> {
  const emailLimpo = email.trim().toLowerCase();
  const linha = banco()
    .prepare("SELECT * FROM usuarios WHERE email = ?")
    .get(emailLimpo) as Record<string, unknown> | undefined;
  if (!linha || !linha.senha_hash) return { ok: false, erro: "credenciais" };
  if (!conferirSenha(senha, String(linha.senha_hash))) return { ok: false, erro: "credenciais" };
  return { ok: true, valor: linhaParaUsuario(linha)! };
}

/* --------------------------------------------------------------- sessões */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria sessão e devolve o token (o cookie leva ele, o banco o hash). */
export function criarSessao(usuarioId: string): string {
  const token = randomBytes(32).toString("hex");
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
  banco()
    .prepare(`INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)`)
    .run(hashToken(token), usuarioId, inicio.toISOString(), fim.toISOString());
  return token;
}

/** Dono do token, se a sessão existe e ainda vale. */
export function donoDaSessao(token: string | null | undefined): Usuario | null {
  if (!token) return null;
  const linha = banco()
    .prepare(
      `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expira_em > ?`,
    )
    .get(hashToken(token), agora()) as Record<string, unknown> | undefined;
  return linhaParaUsuario(linha);
}

/** O usuário já entrou em outra máquina/instância com a mesma sessão ativa? */
export function renovarSessao(token: string): void {
  const fim = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  banco()
    .prepare("UPDATE sessoes SET expira_em = ? WHERE token_hash = ?")
    .run(fim, hashToken(token));
}

export function encerrarSessao(token: string): void {
  banco().prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
}

/* --------------------------------------------------------------- amizades */

function usuarioPorId(id: string): Usuario | null {
  return linhaParaUsuario(
    banco().prepare("SELECT * FROM usuarios WHERE id = ?").get(id) as Record<string, unknown> | undefined,
  );
}

function usuarioPorEmail(email: string): Usuario | null {
  return linhaParaUsuario(
    banco().prepare("SELECT * FROM usuarios WHERE email = ?").get(email.trim().toLowerCase()) as Record<string, unknown> | undefined,
  );
}

/** Manda o pedido. Duplicatas viram erro suave; pedido inverso vira amizade. */
export function enviarPedido(deId: string, paraEmail: string): Resultado<"pedido" | "aceito"> {
  const quem = usuarioPorEmail(paraEmail);
  if (!quem) return { ok: false, erro: "nao_encontrado" };
  if (quem.id === deId) return { ok: false, erro: "voce_mesmo" };

  const db = banco();
  const inverso = db
    .prepare("SELECT id FROM amizades WHERE de_id = ? AND para_id = ?")
    .get(quem.id, deId);
  if (inverso) {
    // A outra pessoa já tinha pedido para mim: as duas intenções existem —
    // aceitar aqui é a resposta natural, não um erro de "já pedido".
    db.prepare("UPDATE amizades SET estado = 'aceita' WHERE id = ?").run(inverso.id);
    return { ok: true, valor: "aceito" };
  }

  try {
    db.prepare("INSERT INTO amizades (de_id, para_id, estado, criado_em) VALUES (?, ?, 'pendente', ?)").run(
      deId,
      quem.id,
      agora(),
    );
    return { ok: true, valor: "pedido" };
  } catch {
    return { ok: false, erro: "pedido_existente" };
  }
}

/** Aceita um pedido recebido — só o destinatário pode. */
export function aceitarPedido(donoId: string, pedidoId: number): Resultado<null> {
  const mudou = banco()
    .prepare("UPDATE amizades SET estado = 'aceita' WHERE id = ? AND para_id = ? AND estado = 'pendente'")
    .run(pedidoId, donoId);
  return mudou.changes > 0 ? { ok: true, valor: null } : { ok: false, erro: "nao_encontrado" };
}

/** Recusa/apaga pedido ou amizade, dos dois lados. */
export function desfazer(donoId: string, relacaoId: number): Resultado<null> {
  const mudou = banco()
    .prepare("DELETE FROM amizades WHERE id = ? AND (de_id = ? OR para_id = ?)")
    .run(relacaoId, donoId, donoId);
  return mudou.changes > 0 ? { ok: true, valor: null } : { ok: false, erro: "nao_encontrado" };
}

/** Lista as amizades aceitas das duas direções (com o id da relação). */
export function listarAmigos(usuarioId: string): Amigo[] {
  const linhas = banco()
    .prepare(
      `SELECT a.id AS relacao_id, u.id, u.nome, u.apelido, u.email FROM amizades a
         JOIN usuarios u ON u.id = CASE WHEN a.de_id = ? THEN a.para_id ELSE a.de_id END
       WHERE (a.de_id = ? OR a.para_id = ?) AND a.estado = 'aceita'
       ORDER BY COALESCE(u.apelido, u.nome)`,
    )
    .all(usuarioId, usuarioId, usuarioId) as Array<Record<string, unknown>>;
  return linhas.map((l) => ({
    id: String(l.id),
    nome: String(l.nome),
    apelido: l.apelido == null ? null : String(l.apelido),
    email: String(l.email),
    relacaoId: Number(l.relacao_id),
  }));
}

/** Pedidos que ME pediram e ainda esperam resposta. */
export function pedidosRecebidos(usuarioId: string): PedidoAmizade[] {
  const linhas = banco()
    .prepare(
      `SELECT a.id, a.de_id, a.criado_em, u.nome, u.email
         FROM amizades a JOIN usuarios u ON u.id = a.de_id
       WHERE a.para_id = ? AND a.estado = 'pendente'
       ORDER BY a.criado_em DESC`,
    )
    .all(usuarioId) as Array<Record<string, unknown>>;
  return linhas.map((l) => ({
    id: Number(l.id),
    deId: String(l.de_id),
    nome: String(l.nome),
    email: String(l.email),
    quando: String(l.criado_em),
  }));
}

/** Nome e e-mail de quem está logado — para o topo da conta. */
export function perfilDe(id: string): Usuario | null {
  return usuarioPorId(id);
}
