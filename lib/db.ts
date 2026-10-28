/**
 * O banco de dados: contas, sessões e amizades.
 *
 * É `node:sqlite`, o SQLite que vem no próprio Node — nenhum módulo nativo
 * para compilar, nenhum serviço para subir — e por isso funciona igual no
 * servidor de desenvolvimento, na publicação e dentro do aplicativo instalado
 * (que roda Node por dentro do Electron). O arquivo mora em
 * `DANIELLIVE_DB` quando a variável existe; no aplicativo, o processo
 * principal aponta essa variável para a pasta de dados do usuário (dentro de
 * `AppData`, fora de `Program Files` — banco em pasta protegida falharia
 * silenciosamente). Sem a variável, cai em `./dados/daniellive.db`, a escolha
 * certa para quem hospeda o site.
 *
 * As tabelas são criadas na primeira abertura e versionadas por
 * `PRAGMA user_version`: subir uma versão nova do DanielLive em cima de um
 * banco velho traz as alterações junto, sem script de migração separado.
 *
 * Contrato IMPORTANTE: este módulo só pode ser importado no servidor (Server
 * Actions e Route Handlers). No cliente não há Node, nem `node:sqlite`.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** Guardada na variável de ambiente pelo aplicativo; `./dados` é o padrão web. */
function arquivoDoBanco(): string {
  return process.env.DANIELLIVE_DB || path.join(process.cwd(), "dados", "daniellive.db");
}

/**
 * As migrações, na ordem. Cada entrada roda uma única vez, numa transação, e
 * crava `user_version` ao final. Um deploy novo com migrações a mais aplica só
 * o que falta — derrubar o site para "atualizar o banco" não existe aqui.
 */
const MIGRACOES: Array<readonly string[]> = [
  [
    // v1 — contas, sessões e amizades.
    `CREATE TABLE usuarios (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nome TEXT NOT NULL,
      senha_hash TEXT,
      sal TEXT,
      provedor TEXT NOT NULL DEFAULT 'senha',
      criado_em TEXT NOT NULL
    )`,
    `CREATE TABLE sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_em TEXT NOT NULL,
      expira_em TEXT NOT NULL
    )`,
    `CREATE TABLE amizades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      de_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      para_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aceita')),
      criado_em TEXT NOT NULL,
      UNIQUE (de_id, para_id)
    )`,
    `CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id)`,
    `CREATE INDEX idx_amizades_para ON amizades(para_id, estado)`,
    `CREATE INDEX idx_amizades_de ON amizades(de_id, estado)`,
  ],
  [
    // v2 — perfil mais completo no cadastro: data de nascimento (para
    // calcular idade) e apelido (como a pessoa prefere ser chamada nas
    // amizades). Nulos para contas antigas e contas Google — o cadastro
    // clássico começa a exigi-las, e o próprio Perfil mostra o que falta.
    `ALTER TABLE usuarios ADD COLUMN nascimento TEXT`,
    `ALTER TABLE usuarios ADD COLUMN apelido TEXT`,
    `CREATE INDEX idx_usuarios_nome ON usuarios(apelido)`,
  ],
];

// ---------------------------------------------------------------------------

/**
 * Abre (e migra) o banco, uma vez por processo.
 *
 * A instância fica em `globalThis` e não num `let` do módulo: no modo de
 * desenvolvimento o Next recarrega módulos a cada arquivo salvo, e uma nova
 * instância a cada recarga deixava o arquivo bloqueado em Windows e
 * descartava transações no meio.
 */
export function banco(): DatabaseSync {
  const guarda = globalThis as Record<string, unknown>;
  if (guarda.__daniellive_sqlite) return guarda.__daniellive_sqlite as DatabaseSync;

  const arquivo = arquivoDoBanco();
  mkdirSync(path.dirname(arquivo), { recursive: true });

  const db = new DatabaseSync(arquivo);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  const versao =
    (db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined)
      ?.user_version ?? 0;

  for (let v = versao; v < MIGRACOES.length; v += 1) {
    const lote = MIGRACOES[v];
    db.exec("BEGIN");
    try {
      for (const sql of lote) db.exec(sql);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (erro) {
      db.exec("ROLLBACK");
      throw erro;
    }
  }

  guarda.__daniellive_sqlite = db;
  return db;
}

/**
 * Fecha a conexão atual — só para testes: o próximo `banco()` abre de novo.
 * Não chamar fora de testes; o processo normal simplesmente deixa o sistema
 * encerrar a conexão junto com ele.
 */
export function fecharBancoParaTeste(): void {
  const guarda = globalThis as Record<string, unknown>;
  if (!guarda.__daniellive_sqlite) return;
  try {
    (guarda.__daniellive_sqlite as DatabaseSync).close();
  } finally {
    delete guarda.__daniellive_sqlite;
  }
}
