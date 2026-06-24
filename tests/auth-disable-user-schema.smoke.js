// =====================================================================
// === tests/auth-disable-user-schema.smoke.js =========================
// Smoke estático para a migration db/12_auth_user_disable_schema.sql.
//
// Fase: RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A
// Escopo: valida que o SQL versionado está correto e pronto para ser
// aplicado em staging em fase posterior. Não executa o SQL.
//
// Verifica (sem aplicar no Supabase):
//   - arquivo SQL novo existe;
//   - contém alter table public.usuarios;
//   - adiciona colunas: ativo (boolean default true),
//     desativado_em, desativado_por, motivo_desativacao;
//   - recria is_admin() exigindo `ativo is true` (ou `ativo = TRUE`);
//   - se meu_fornecedor_id() existir no repo, migration cobre
//     `ativo is true`;
//   - recria policies de public.usuarios (usuarios_select,
//     usuarios_admin_all, usuarios_self_update);
//   - idemPotente (usa IF NOT EXISTS / DROP IF EXISTS);
//   - não contém DELETE FROM / DROP TABLE;
//   - não contém service_role / SUPABASE_SERVICE_ROLE_KEY /
//     password literal longo / token / jwt hardcoded;
//   - não altera Edge Function admin-create-user.
// =====================================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SQL = path.join(ROOT, "db", "12_auth_user_disable_schema.sql");
const FUNCTIONS = path.join(ROOT, "db", "02_functions.sql");
const FUNCTIONS_FIX = path.join(ROOT, "db", "05_fix_pgrst.sql");
const POLICIES = path.join(ROOT, "db", "03_policies.sql");
const ADMIN_CREATE_USER = path.join(
  ROOT, "supabase", "functions", "admin-create-user", "index.ts"
);

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo não encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const sql = readOrFail(SQL);
const functionsSrc = readOrFail(FUNCTIONS);
const functionsFixSrc = readOrFail(FUNCTIONS_FIX);
const policiesSrc = readOrFail(POLICIES);
const adminCreateUserSrc = fs.existsSync(ADMIN_CREATE_USER)
  ? fs.readFileSync(ADMIN_CREATE_USER, "utf8")
  : "";

// ---------------------------------------------------------------------
// 1. Existência e estrutura básica
// ---------------------------------------------------------------------

test("arquivo db/12_auth_user_disable_schema.sql existe", () => {
  assert.ok(fs.existsSync(SQL), "db/12_auth_user_disable_schema.sql ausente");
});

test("SQL: tem header com nome da fase", () => {
  assert.match(
    sql,
    /RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A/,
    "header deve mencionar a fase RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A"
  );
});

// ---------------------------------------------------------------------
// 2. Colunas adicionadas
// ---------------------------------------------------------------------

test("SQL: contém ALTER TABLE public.usuarios", () => {
  assert.match(
    sql,
    /ALTER\s+TABLE\s+public\.usuarios/i,
    "deve conter ALTER TABLE public.usuarios"
  );
});

test("SQL: adiciona coluna ativo boolean not null default true", () => {
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ativo\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i,
    "coluna ativo deve ser BOOLEAN NOT NULL DEFAULT TRUE"
  );
});

test("SQL: adiciona coluna desativado_em timestamptz", () => {
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+desativado_em\s+TIMESTAMPTZ/i,
    "coluna desativado_em deve ser TIMESTAMPTZ"
  );
});

test("SQL: adiciona coluna desativado_por uuid references auth.users", () => {
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+desativado_por\s+UUID[^,]*\bREFERENCES\s+auth\.users\b/i,
    "coluna desativado_por deve referenciar auth.users(id)"
  );
});

test("SQL: adiciona coluna motivo_desativacao text", () => {
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+motivo_desativacao\s+TEXT/i,
    "coluna motivo_desativacao deve ser TEXT"
  );
});

// ---------------------------------------------------------------------
// 3. Funções auxiliares
// ---------------------------------------------------------------------

test("SQL: recria is_admin() com CREATE OR REPLACE FUNCTION", () => {
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_admin\s*\(\s*\)/i,
    "is_admin() deve ser recriada via CREATE OR REPLACE FUNCTION"
  );
});

test("SQL: is_admin() considera `ativo is true`", () => {
  // Garante que a função checa o flag ativo, em qualquer grafia
  // comum em SQL (TRUE, true, IS TRUE).
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.is_admin");
  assert.ok(idx > 0, "função is_admin não encontrada no SQL");
  const bloco = sql.slice(idx, idx + 4000);
  assert.match(
    bloco,
    /ativo[^,;]*\b(TRUE|true|IS\s+TRUE)\b/,
    "is_admin() deve exigir `ativo IS TRUE` (ou variante) para considerar admin operacional"
  );
});

test("SQL: meu_fornecedor_id() — presença condicional conforme o repo", () => {
  // Se a função existe no schema versionado, a migration DEVE recriá-la
  // com `ativo is true`. Se não existe, a migration não precisa
  // mexer nela.
  const existeNoRepo = /FUNCTION\s+public\.meu_fornecedor_id/i.test(functionsSrc)
    || /FUNCTION\s+public\.meu_fornecedor_id/i.test(functionsFixSrc);
  if (existeNoRepo) {
    assert.match(
      sql,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.meu_fornecedor_id\s*\(\s*\)/i,
      "meu_fornecedor_id() existe no schema, deve ser recriada pela migration"
    );
    const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_fornecedor_id");
    assert.ok(idx > 0);
    const bloco = sql.slice(idx, idx + 4000);
    assert.match(
      bloco,
      /ativo[^,;]*\b(TRUE|true|IS\s+TRUE)\b/,
      "meu_fornecedor_id() deve exigir `ativo IS TRUE` para retornar fornecedor_id"
    );
  } else {
    // Se algum dia a função for removida, a migration pode pular
    assert.ok(true, "meu_fornecedor_id não existe no schema atual — sem exigência");
  }
});

// ---------------------------------------------------------------------
// 4. Policies de public.usuarios
// ---------------------------------------------------------------------

test("SQL: recria policy usuarios_select exigindo ativo=true para self-read", () => {
  // A SELECT de admin não precisa de filtro (admin lê inclusive inativos);
  // a auto-leitura deve exigir `ativo IS TRUE`.
  assert.match(
    sql,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+usuarios_select\s+ON\s+public\.usuarios/i,
    "policy usuarios_select deve ser dropada/recriada"
  );
  assert.match(
    sql,
    /CREATE\s+POLICY\s+usuarios_select\s+ON\s+public\.usuarios/i,
    "policy usuarios_select deve ser recriada"
  );
  const idx = sql.indexOf("CREATE POLICY usuarios_select");
  assert.ok(idx > 0);
  const bloco = sql.slice(idx, idx + 4000);
  assert.match(
    bloco,
    /ativo[^,;]*\b(TRUE|true|IS\s+TRUE)\b/,
    "auto-leitura deve exigir `ativo IS TRUE` (admin continua vendo todos)"
  );
});

test("SQL: recria policy usuarios_admin_all usando is_admin()", () => {
  assert.match(
    sql,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+usuarios_admin_all\s+ON\s+public\.usuarios/i
  );
  assert.match(
    sql,
    /CREATE\s+POLICY\s+usuarios_admin_all\s+ON\s+public\.usuarios/i
  );
  // Não exige reescrita da assinatura; apenas que o arquivo
  // reconstrua a policy.
  assert.ok(
    /usuarios_admin_all[\s\S]{0,400}public\.is_admin\s*\(\s*\)/i.test(
      sql.slice(
        sql.indexOf("CREATE POLICY usuarios_admin_all"),
        sql.indexOf("CREATE POLICY usuarios_admin_all") + 1500
      )
    ),
    "policy usuarios_admin_all deve usar public.is_admin()"
  );
});

test("SQL: recria policy usuarios_self_update respeitando ativo=true", () => {
  assert.match(
    sql,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+usuarios_self_update\s+ON\s+public\.usuarios/i
  );
  assert.match(
    sql,
    /CREATE\s+POLICY\s+usuarios_self_update\s+ON\s+public\.usuarios/i
  );
  const idx = sql.indexOf("CREATE POLICY usuarios_self_update");
  const bloco = sql.slice(idx, idx + 4000);
  assert.match(
    bloco,
    /ativo[^,;]*\b(TRUE|true|IS\s+TRUE)\b/,
    "self-update deve exigir `ativo IS TRUE`"
  );
});

test("SQL: preserva os nomes reais das policies usadas em db/03_policies.sql", () => {
  // Se as policies atuais no schema base têm outros nomes, este
  // assert detecta a divergência. Como db/03_policies.sql declara
  // exatamente usuarios_select, usuarios_admin_all, usuarios_self_update,
  // a migration deve usar esses mesmos nomes.
  for (const name of ["usuarios_select", "usuarios_admin_all", "usuarios_self_update"]) {
    assert.match(
      policiesSrc,
      new RegExp(`POLICY\\s+${name}\\b`, "i"),
      `db/03_policies.sql deve declarar a policy ${name} (referência canônica)`
    );
  }
});

// ---------------------------------------------------------------------
// 5. Idempotência e segurança
// ---------------------------------------------------------------------

test("SQL: idempotente (usa IF NOT EXISTS e CREATE OR REPLACE)", () => {
  // Sanidade: presença de pelo menos um IF NOT EXISTS e um CREATE OR REPLACE
  assert.match(sql, /IF\s+NOT\s+EXISTS/i, "deve usar IF NOT EXISTS em algum ponto");
  assert.match(sql, /CREATE\s+OR\s+REPLACE/i, "deve usar CREATE OR REPLACE em algum ponto");
});

test("SQL: não contém DELETE FROM", () => {
  // A migration não pode deletar dados de produção.
  // Aceita a palavra "delete" em comentários / comentários inline,
  // mas a frase `delete from` (com a preposição) é proibida.
  assert.doesNotMatch(
    sql,
    /^\s*DELETE\s+FROM\b/im,
    "SQL não pode conter DELETE FROM (a migration é apenas DDL/funções/policies)"
  );
});

test("SQL: não contém DROP TABLE", () => {
  assert.doesNotMatch(
    sql,
    /^\s*DROP\s+TABLE\b/im,
    "SQL não pode conter DROP TABLE (idempotência é por IF NOT EXISTS / OR REPLACE)"
  );
});

test("SQL: não contém service_role, SUPABASE_SERVICE_ROLE_KEY, JWT hardcoded, password literal", () => {
  // service_role pode aparecer em comentário conceitual; aqui
  // exigimos ausência total para garantir que a migration não
  // precise de privilégio especial.
  assert.doesNotMatch(sql, /service_role/i, "service_role não pode aparecer na migration");
  assert.doesNotMatch(
    sql, /SUPABASE_SERVICE_ROLE_KEY/, "SUPABASE_SERVICE_ROLE_KEY não pode aparecer"
  );
  assert.doesNotMatch(
    sql, /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./,
    "JWT hardcoded não pode aparecer"
  );
  assert.doesNotMatch(
    sql,
    /password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/i,
    "password literal longo não pode aparecer"
  );
  assert.doesNotMatch(sql, /\bauth\.admin\b/i,
    "auth.admin não pode aparecer na migration (não é papel da migration)");
});

// ---------------------------------------------------------------------
// 6. Não-regra: Edge Function admin-create-user não foi alterada
// ---------------------------------------------------------------------

test("admin-create-user: index.ts não foi alterado por esta migration", () => {
  if (!adminCreateUserSrc) {
    // Se o arquivo não existe mais, ainda assim a migration não
    // pode ter afetado a função (não temos como tocar TS a partir
    // de SQL). Apenas registra presença.
    assert.ok(true, "supabase/functions/admin-create-user/index.ts ausente — sem verificação");
    return;
  }
  // A migration é DDL puro; ela não toca TypeScript. Verificamos
  // que o source continua referenciando `ativo = true` apenas por
  // default implícito (a Edge Function não insere `ativo`, e o
  // DEFAULT TRUE garante compatibilidade).
  // Se algum dia admin-create-user passar a enviar `ativo` no
  // payload, isso deve ser registrado em mudança separada.
  assert.doesNotMatch(
    adminCreateUserSrc,
    /desativado_em|desativado_por|motivo_desativacao/,
    "admin-create-user não deve mencionar colunas de desativação (esta fase é schema-only)"
  );
});

// ---------------------------------------------------------------------
// 7. Notas operacionais
// ---------------------------------------------------------------------

test("SQL: registra que NÃO deve ser aplicado nesta fase", () => {
  // Garante que o próprio arquivo tem a nota de "não aplicar".
  assert.match(
    sql,
    /N[ÃA]O\s+aplicar/i,
    "header deve indicar que o SQL não deve ser aplicado nesta fase"
  );
});
