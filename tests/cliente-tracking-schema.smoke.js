// =====================================================================
// === tests/cliente-tracking-schema.smoke.js ===========================
// Smoke estatico para a migration db/15_status_cliente_visual.sql.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A
// Escopo: valida que o SQL versionado esta correto e pronto para ser
// aplicado em staging em fase posterior. Nao executa o SQL.
// =====================================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SQL = path.join(ROOT, "db", "15_status_cliente_visual.sql");
const FASE_13 = path.join(ROOT, "db", "13_pedidos_schema.sql");
const FASE_14 = path.join(ROOT, "db", "14_cliente_perfil_schema.sql");

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo nao encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const sql = readOrFail(SQL);
const fase13 = readOrFail(FASE_13);
const fase14 = readOrFail(FASE_14);

function blockAround(src, marker, extra = 1200) {
  const idx = src.indexOf(marker);
  assert.ok(idx >= 0, "marcador nao encontrado: " + marker);
  return src.slice(Math.max(0, idx - 200), idx + extra);
}

// ---------------------------------------------------------------------
// 1. Existencia e header
// ---------------------------------------------------------------------

test("arquivo db/15_status_cliente_visual.sql existe", () => {
  assert.ok(fs.existsSync(SQL), "db/15_status_cliente_visual.sql ausente");
});

test("SQL: tem header com nome da fase", () => {
  assert.match(sql, /RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A/);
});

test("SQL: documenta que nao aplica SQL no Supabase nesta fase", () => {
  assert.match(
    sql,
    /Nao implementado nesta fase:[\s\S]*Aplicacao do SQL no Supabase/i
  );
});

// ---------------------------------------------------------------------
// 2. Novas colunas em public.pedidos
// ---------------------------------------------------------------------

for (const [label, pattern] of [
  ["status_cliente_visual", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_cliente_visual\s+TEXT/i],
  ["status_cliente_excecao", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_cliente_excecao\s+TEXT/i],
  ["status_cliente_mensagem", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_cliente_mensagem\s+TEXT/i],
  ["status_cliente_atualizado_em", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_cliente_atualizado_em\s+TIMESTAMPTZ/i],
  ["referencia_cliente", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+referencia_cliente\s+TEXT/i],
  ["prazo_desejado", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+prazo_desejado\s+DATE/i],
  ["tipo_recebimento", /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+tipo_recebimento\s+TEXT/i],
]) {
  test(`SQL: adiciona coluna ${label}`, () => {
    assert.match(sql, pattern);
  });
}

// ---------------------------------------------------------------------
// 3. Taxonomia principal / excecoes / tipo_recebimento
// ---------------------------------------------------------------------

test("SQL: contem os 8 status principais", () => {
  for (const value of [
    "'recebido'",
    "'confirmado'",
    "'insumos'",
    "'tecelagem'",
    "'acabamento'",
    "'expedicao'",
    "'transporte'",
    "'concluido'",
  ]) {
    assert.match(sql, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("SQL: contem as 4 excecoes", () => {
  for (const value of [
    "'aguardando_definicao'",
    "'aguardando_insumo'",
    "'pausado'",
    "'cancelado'",
  ]) {
    assert.match(sql, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("SQL: contem check para tipo_recebimento", () => {
  const bloco = blockAround(sql, "pedidos_tipo_recebimento_check", 700);
  assert.match(bloco, /tipo_recebimento\s+IS\s+NULL/i);
  assert.match(bloco, /'retirada'/i);
  assert.match(bloco, /'entrega'/i);
});

test("SQL: usa TEXT + CHECK versionado, sem enum PostgreSQL", () => {
  assert.doesNotMatch(sql, /CREATE\s+TYPE[\s\S]*ENUM/i);
  assert.doesNotMatch(sql, /ALTER\s+TYPE/i);
});

// ---------------------------------------------------------------------
// 4. Constraints idempotentes
// ---------------------------------------------------------------------

test("SQL: usa bloco idempotente para as constraints de public.pedidos", () => {
  for (const constraint of [
    "pedidos_status_cliente_visual_check",
    "pedidos_status_cliente_excecao_check",
    "pedidos_tipo_recebimento_check",
  ]) {
    const idx = sql.indexOf(constraint);
    assert.ok(idx >= 0, "constraint nao encontrada: " + constraint);
    const bloco = sql.slice(Math.max(0, idx - 900), idx + 900);
    assert.match(bloco, /DO\s+\$\$/i);
    assert.match(bloco, /IF\s+NOT\s+EXISTS/i);
    assert.match(bloco, /ALTER\s+TABLE\s+public\.pedidos/i);
    assert.match(bloco, /ADD\s+CONSTRAINT/i);
  }
});

// ---------------------------------------------------------------------
// 5. Tabela public.pedido_cliente_eventos
// ---------------------------------------------------------------------

test("SQL: cria public.pedido_cliente_eventos", () => {
  assert.match(
    sql,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedido_cliente_eventos/i
  );
});

test("SQL: usa uuid para id, pedido_id e criado_por", () => {
  const bloco = blockAround(sql, "CREATE TABLE IF NOT EXISTS public.pedido_cliente_eventos", 1200);
  assert.match(bloco, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(bloco, /pedido_id\s+UUID\s+NOT\s+NULL/i);
  assert.match(bloco, /criado_por\s+UUID\s+REFERENCES\s+auth\.users/i);
});

test("SQL: pedido_id referencia public.pedidos(id)", () => {
  assert.match(
    sql,
    /pedido_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.pedidos\(id\)\s+ON\s+DELETE\s+CASCADE/i
  );
});

test("SQL: criado_por referencia auth.users(id)", () => {
  assert.match(
    sql,
    /criado_por\s+UUID\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i
  );
});

test("SQL: cria check de origem com manual, automatico e sistema", () => {
  const bloco = blockAround(sql, "pedido_cliente_eventos_origem_check", 700);
  assert.match(bloco, /'manual'/i);
  assert.match(bloco, /'automatico'/i);
  assert.match(bloco, /'sistema'/i);
});

test("SQL: cria indice (pedido_id, criado_em DESC)", () => {
  assert.match(
    sql,
    /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_pedido_cliente_eventos_pedido_criado[\s\S]{0,200}\(\s*pedido_id\s*,\s*criado_em\s+DESC\s*\)/i
  );
});

// ---------------------------------------------------------------------
// 6. RLS e policy admin-only
// ---------------------------------------------------------------------

test("SQL: habilita RLS em public.pedido_cliente_eventos", () => {
  assert.match(
    sql,
    /ALTER\s+TABLE\s+public\.pedido_cliente_eventos\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
  );
});

test("SQL: cria policy admin-only em pedido_cliente_eventos", () => {
  const bloco = blockAround(sql, "pedido_cliente_eventos_admin_all", 700);
  assert.match(bloco, /CREATE\s+POLICY\s+pedido_cliente_eventos_admin_all/i);
  assert.match(bloco, /FOR\s+ALL/i);
  assert.match(bloco, /USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
  assert.match(bloco, /WITH\s+CHECK\s*\(\s*public\.is_admin\(\)\s*\)/i);
});

test("SQL: NAO cria policy cliente em pedido_cliente_eventos", () => {
  assert.doesNotMatch(sql, /CREATE\s+POLICY\s+pedido_cliente_eventos_cliente/i);
  assert.doesNotMatch(sql, /pedido_cliente_eventos[\s\S]{0,400}FOR\s+SELECT[\s\S]{0,400}meu_cliente_id/i);
});

// ---------------------------------------------------------------------
// 7. Trigger guard de insert em public.pedidos
// ---------------------------------------------------------------------

test("SQL: cria funcao public.normalizar_pedido_cliente_visual_insert()", () => {
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.normalizar_pedido_cliente_visual_insert\s*\(\s*\)/i
  );
});

test("SQL: trigger de insert guard existe em public.pedidos", () => {
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+pedidos_cliente_visual_insert_guard/i);
  assert.match(sql, /CREATE\s+TRIGGER\s+pedidos_cliente_visual_insert_guard/i);
  assert.match(sql, /BEFORE\s+INSERT\s+ON\s+public\.pedidos/i);
  assert.match(sql, /EXECUTE\s+FUNCTION\s+public\.normalizar_pedido_cliente_visual_insert\s*\(\s*\)/i);
});

test("SQL: insert guard forca campos visuais para NULL quando nao-admin", () => {
  const bloco = blockAround(sql, "CREATE OR REPLACE FUNCTION public.normalizar_pedido_cliente_visual_insert", 2200);
  assert.match(bloco, /IF\s+public\.is_admin\(\)\s+THEN/i);
  assert.match(bloco, /NEW\.status_cliente_visual\s*:=\s*NULL/i);
  assert.match(bloco, /NEW\.status_cliente_excecao\s*:=\s*NULL/i);
  assert.match(bloco, /NEW\.status_cliente_mensagem\s*:=\s*NULL/i);
  assert.match(bloco, /NEW\.status_cliente_atualizado_em\s*:=\s*NULL/i);
});

test("SQL: insert guard toca timestamp para admin quando campo visual vier preenchido", () => {
  const bloco = blockAround(sql, "CREATE OR REPLACE FUNCTION public.normalizar_pedido_cliente_visual_insert", 2200);
  assert.match(bloco, /NEW\.status_cliente_visual\s+IS\s+NOT\s+NULL/i);
  assert.match(bloco, /NEW\.status_cliente_excecao\s+IS\s+NOT\s+NULL/i);
  assert.match(bloco, /NEW\.status_cliente_mensagem\s+IS\s+NOT\s+NULL/i);
  assert.match(bloco, /NEW\.status_cliente_atualizado_em\s+IS\s+NULL/i);
  assert.match(bloco, /NEW\.status_cliente_atualizado_em\s*:=\s*now\(\)/i);
});

// ---------------------------------------------------------------------
// 8. Trigger de update para timestamp visual
// ---------------------------------------------------------------------

test("SQL: cria funcao public.touch_pedido_cliente_visual_update()", () => {
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.touch_pedido_cliente_visual_update\s*\(\s*\)/i
  );
});

test("SQL: cria trigger de timestamp visual em update", () => {
  assert.match(sql, /DROP\s+TRIGGER\s+IF\s+EXISTS\s+pedidos_cliente_visual_touch/i);
  assert.match(sql, /CREATE\s+TRIGGER\s+pedidos_cliente_visual_touch/i);
  assert.match(sql, /BEFORE\s+UPDATE\s+ON\s+public\.pedidos/i);
  assert.match(sql, /EXECUTE\s+FUNCTION\s+public\.touch_pedido_cliente_visual_update\s*\(\s*\)/i);
});

test("SQL: update touch usa IS DISTINCT FROM nos 3 campos visuais", () => {
  const bloco = blockAround(sql, "CREATE OR REPLACE FUNCTION public.touch_pedido_cliente_visual_update", 1800);
  assert.match(bloco, /NEW\.status_cliente_visual\s+IS\s+DISTINCT\s+FROM\s+OLD\.status_cliente_visual/i);
  assert.match(bloco, /NEW\.status_cliente_excecao\s+IS\s+DISTINCT\s+FROM\s+OLD\.status_cliente_excecao/i);
  assert.match(bloco, /NEW\.status_cliente_mensagem\s+IS\s+DISTINCT\s+FROM\s+OLD\.status_cliente_mensagem/i);
  assert.match(bloco, /NEW\.status_cliente_atualizado_em\s*:=\s*now\(\)/i);
});

// ---------------------------------------------------------------------
// 9. Seguranca / ausencia de conteudo proibido
// ---------------------------------------------------------------------

test("SQL: nao contem DROP TABLE", () => {
  assert.doesNotMatch(sql, /^\s*DROP\s+TABLE\b/im);
});

test("SQL: nao contem DELETE FROM", () => {
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\b/im);
});

test("SQL: nao contem service_role", () => {
  assert.doesNotMatch(sql, /service_role/i);
});

test("SQL: nao referencia supabase/functions", () => {
  assert.doesNotMatch(sql, /supabase\/functions\//i);
});

test("SQL: nao referencia OP/lote/fornecedor/NF/romaneio na comunicacao cliente", () => {
  assert.doesNotMatch(sql, /\bOP\b/);
  assert.doesNotMatch(sql, /\blote\b/i);
  assert.doesNotMatch(sql, /fornecedor/i);
  assert.doesNotMatch(sql, /\bNF\b/);
  assert.doesNotMatch(sql, /romaneio/i);
});

// ---------------------------------------------------------------------
// 10. Compatibilidade com db/13 e db/14
// ---------------------------------------------------------------------

test("db/13 continua sendo a base de pedidos", () => {
  assert.match(fase13, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i);
  assert.match(fase13, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedido_eventos/i);
});

test("db/14 continua com INSERT cliente em pedidos", () => {
  assert.match(fase14, /CREATE\s+POLICY\s+pedidos_cliente_insert\s+ON\s+public\.pedidos/i);
  assert.match(fase14, /status\s+IN\s+\([^)]*'rascunho'[^)]*'recebido'[^)]*\)/i);
});

// ---------------------------------------------------------------------
// 11. Sanidade final
// ---------------------------------------------------------------------

test("SQL: termina com reload do schema cache (PostgREST)", () => {
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+schema'/i);
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+config'/i);
});
