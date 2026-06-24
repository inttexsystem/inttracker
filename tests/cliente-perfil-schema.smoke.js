// =====================================================================
// === tests/cliente-perfil-schema.smoke.js =============================
// Smoke estatico para a migration db/14_cliente_perfil_schema.sql.
//
// Fase: RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1
// Escopo: valida que o SQL versionado esta correto e pronto para ser
// aplicado em staging em fase posterior. Nao executa o SQL.
//
// Verifica (sem aplicar no Supabase):
//   - arquivo SQL novo existe e menciona a fase;
//   - atualiza CHECK constraint de usuarios.tipo para incluir 'cliente';
//   - adiciona usuarios.cliente_id (FK → public.clientes);
//   - cria constraint de vinculacao exclusiva admin/fornecedor/cliente;
//   - cria public.meu_cliente_id();
//   - meu_cliente_id() exige tipo = 'cliente';
//   - meu_cliente_id() exige ativo IS TRUE;
//   - meu_cliente_id() retorna NULL em falhas (EXCEPTION);
//   - grants da funcao para anon/authenticated existem;
//   - ha policy cliente SELECT em clientes;
//   - ha policy cliente SELECT em pedidos;
//   - ha policy cliente INSERT em pedidos;
//   - pedidos cliente INSERT exige cliente_id = public.meu_cliente_id();
//   - pedidos cliente INSERT limita status a rascunho/recebido;
//   - NAO ha policy cliente UPDATE em pedidos;
//   - NAO ha policy cliente DELETE em pedidos;
//   - ha policy cliente SELECT em pedido_itens;
//   - ha policy cliente INSERT em pedido_itens;
//   - pedido_itens cliente INSERT valida pedido pertencente ao cliente;
//   - pedido_itens cliente INSERT valida pedido em status editavel;
//   - NAO ha policy cliente UPDATE em pedido_itens;
//   - NAO ha policy cliente DELETE em pedido_itens;
//   - pedido_eventos permanece sem policy de cliente;
//   - nao ha policy publica por token;
//   - nao ha public: true;
//   - nao ha token_acesso usado para RLS;
//   - nao ha service_role/secrets;
//   - nao ha DROP destrutivo de tabela;
//   - script e idempotente onde aplicavel;
//   - nao ha policy anon.
// =====================================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SQL = path.join(ROOT, "db", "14_cliente_perfil_schema.sql");
const FASE_09 = path.join(ROOT, "db", "09_fase6_cliente_lote.sql");
const FASE_13 = path.join(ROOT, "db", "13_pedidos_schema.sql");

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo nao encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const sql = readOrFail(SQL);
const fase09 = readOrFail(FASE_09);
const fase13 = readOrFail(FASE_13);

// ---------------------------------------------------------------------
// 1. Existencia e estrutura basica
// ---------------------------------------------------------------------

test("arquivo db/14_cliente_perfil_schema.sql existe", () => {
  assert.ok(fs.existsSync(SQL), "db/14_cliente_perfil_schema.sql ausente");
});

test("SQL: tem header com nome da fase", () => {
  assert.match(
    sql,
    /RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1/,
    "header deve mencionar a fase RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1"
  );
});

test("SQL: documenta que NAO deve ser aplicado nesta fase", () => {
  assert.match(
    sql,
    /N[ÃA]O[-\s]*(aplicar|implementado)[\s\S]{0,200}(SQL|nesta fase)/i,
    "header deve indicar que o SQL nao deve ser aplicado nesta fase"
  );
});

// ---------------------------------------------------------------------
// 2. CHECK constraint de usuarios.tipo com 'cliente'
// ---------------------------------------------------------------------

test("SQL: atualiza CHECK constraint de usuarios.tipo para incluir 'cliente'", () => {
  // Deve ter uma ADD CONSTRAINT ou ALTER que define tipo IN com 'cliente'
  assert.match(
    sql,
    /tipo\s+IN\s+\([^)]*'cliente'[^)]*\)/i,
    "CHECK constraint de tipo deve incluir 'cliente'"
  );
  assert.match(
    sql,
    /usuarios_tipo_check/,
    "constraint deve ser nomeada usuarios_tipo_check"
  );
});

test("SQL: constraint usuarios_tipo_check cobre admin, fornecedor e cliente", () => {
  for (const role of ["'admin'", "'fornecedor'", "'cliente'"]) {
    const bloco = sql.slice(
      sql.indexOf("usuarios_tipo_check") - 200,
      sql.indexOf("usuarios_tipo_check") + 500
    );
    assert.match(
      bloco,
      new RegExp(role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      "tipo CHECK deve conter " + role
    );
  }
});

// ---------------------------------------------------------------------
// 3. usuarios.cliente_id
// ---------------------------------------------------------------------

test("SQL: adiciona usuarios.cliente_id BIGINT", () => {
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+cliente_id\s+BIGINT/i,
    "deve adicionar usuarios.cliente_id BIGINT com IF NOT EXISTS"
  );
});

test("SQL: usuarios.cliente_id FK referencia public.clientes(id)", () => {
  assert.match(
    sql,
    /FOREIGN\s+KEY\s*\(\s*cliente_id\s*\)\s*REFERENCES\s+public\.clientes\s*\(\s*id\s*\)/i,
    "cliente_id deve ter FK → public.clientes(id)"
  );
});

test("SQL: FK usuarios.cliente_id tem ON DELETE SET NULL", () => {
  const bloco = sql.slice(
    sql.indexOf("usuarios_cliente_id_fkey") - 100,
    sql.indexOf("usuarios_cliente_id_fkey") + 300
  );
  assert.match(
    bloco,
    /ON\s+DELETE\s+SET\s+NULL/i,
    "FK cliente_id deve ter ON DELETE SET NULL"
  );
});

// ---------------------------------------------------------------------
// 4. Constraint de vinculacao exclusiva
// ---------------------------------------------------------------------

test("SQL: cria constraint de exclusividade admin/fornecedor/cliente", () => {
  assert.match(
    sql,
    /usuarios_vinculo_exclusivo_check/i,
    "deve criar constraint nomeada usuarios_vinculo_exclusivo_check"
  );
});

test("SQL: constraint exige admin com ambos IDs NULL", () => {
  const bloco = sql.slice(
    sql.indexOf("usuarios_vinculo_exclusivo_check") - 100,
    sql.indexOf("usuarios_vinculo_exclusivo_check") + 600
  );
  assert.match(
    bloco,
    /tipo\s*=\s*'admin'.*fornecedor_id\s+IS\s+NULL.*cliente_id\s+IS\s+NULL/i,
    "admin deve ter ambos IDs NULL"
  );
});

test("SQL: constraint exige fornecedor com cliente_id NULL e fornecedor_id NOT NULL", () => {
  const bloco = sql.slice(
    sql.indexOf("usuarios_vinculo_exclusivo_check") - 100,
    sql.indexOf("usuarios_vinculo_exclusivo_check") + 600
  );
  assert.match(
    bloco,
    /tipo\s*=\s*'fornecedor'.*fornecedor_id\s+IS\s+NOT\s+NULL.*cliente_id\s+IS\s+NULL/i,
    "fornecedor deve ter fornecedor_id NOT NULL e cliente_id NULL"
  );
});

test("SQL: constraint exige cliente com fornecedor_id NULL e cliente_id NOT NULL", () => {
  const bloco = sql.slice(
    sql.indexOf("usuarios_vinculo_exclusivo_check") - 100,
    sql.indexOf("usuarios_vinculo_exclusivo_check") + 600
  );
  assert.match(
    bloco,
    /tipo\s*=\s*'cliente'.*fornecedor_id\s+IS\s+NULL.*cliente_id\s+IS\s+NOT\s+NULL/i,
    "cliente deve ter fornecedor_id NULL e cliente_id NOT NULL"
  );
});

// ---------------------------------------------------------------------
// 5. Funcao meu_cliente_id()
// ---------------------------------------------------------------------

test("SQL: cria funcao public.meu_cliente_id()", () => {
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.meu_cliente_id\s*\(\s*\)/i,
    "deve criar public.meu_cliente_id() via CREATE OR REPLACE"
  );
});

test("SQL: meu_cliente_id() e SECURITY DEFINER", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  assert.ok(idx > 0, "funcao meu_cliente_id nao encontrada");
  const bloco = sql.slice(idx, idx + 800);
  assert.match(bloco, /SECURITY\s+DEFINER/i, "meu_cliente_id deve ser SECURITY DEFINER");
});

test("SQL: meu_cliente_id() e STABLE", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 800);
  assert.match(bloco, /STABLE/i, "meu_cliente_id deve ser STABLE");
});

test("SQL: meu_cliente_id() usa search_path = public, auth", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 800);
  assert.match(
    bloco,
    /search_path\s*=\s*public\s*,\s*auth/i,
    "search_path deve ser public, auth"
  );
});

test("SQL: meu_cliente_id() exige tipo = 'cliente'", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 2000);
  assert.match(
    bloco,
    /v_tipo\s*<>\s*'cliente'/i,
    "meu_cliente_id deve verificar tipo = 'cliente' e retornar NULL se nao"
  );
});

test("SQL: meu_cliente_id() exige ativo IS TRUE", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 2000);
  assert.match(
    bloco,
    /v_ativo\s+IS\s+NOT\s+TRUE/,
    "meu_cliente_id deve verificar ativo e retornar NULL se nao TRUE"
  );
});

test("SQL: meu_cliente_id() retorna NULL em EXCEPTION", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 2000);
  assert.match(
    bloco,
    /EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+RETURN\s+NULL/i,
    "meu_cliente_id deve ter EXCEPTION WHEN OTHERS THEN RETURN NULL"
  );
});

test("SQL: meu_cliente_id() valida cliente_id IS NOT NULL antes de retornar", () => {
  const idx = sql.indexOf("CREATE OR REPLACE FUNCTION public.meu_cliente_id");
  const bloco = sql.slice(idx, idx + 2000);
  assert.match(
    bloco,
    /v_cliente_id\s+IS\s+NULL\s+THEN\s+RETURN\s+NULL/i,
    "meu_cliente_id deve retornar NULL se cliente_id IS NULL"
  );
});

// ---------------------------------------------------------------------
// 6. GRANTs da funcao
// ---------------------------------------------------------------------

test("SQL: GRANT EXECUTE em meu_cliente_id() para anon e authenticated", () => {
  assert.match(
    sql,
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.meu_cliente_id\s*\(\s*\)\s+TO\s+anon\s*,\s*authenticated/i,
    "deve ter GRANT EXECUTE ON FUNCTION meu_cliente_id() TO anon, authenticated"
  );
});

// ---------------------------------------------------------------------
// 7. RLS em clientes — policy cliente SELECT
// ---------------------------------------------------------------------

test("SQL: ha policy cliente SELECT em clientes", () => {
  assert.match(
    sql,
    /CREATE\s+POLICY\s+clientes_cliente_select\s+ON\s+public\.clientes/i,
    "deve criar policy clientes_cliente_select"
  );
  assert.match(
    sql,
    /clientes_cliente_select[\s\S]{0,300}FOR\s+SELECT/i,
    "clientes_cliente_select deve ser FOR SELECT"
  );
  assert.match(
    sql,
    /clientes_cliente_select[\s\S]{0,500}meu_cliente_id\s*\(\s*\)/i,
    "clientes_cliente_select deve usar meu_cliente_id()"
  );
});

// ---------------------------------------------------------------------
// 8. RLS em pedidos — policies cliente
// ---------------------------------------------------------------------

test("SQL: ha policy cliente SELECT em pedidos", () => {
  assert.match(
    sql,
    /CREATE\s+POLICY\s+pedidos_cliente_select\s+ON\s+public\.pedidos/i,
    "deve criar policy pedidos_cliente_select"
  );
  assert.match(
    sql,
    /pedidos_cliente_select[\s\S]{0,300}FOR\s+SELECT/i,
    "pedidos_cliente_select deve ser FOR SELECT"
  );
  assert.match(
    sql,
    /pedidos_cliente_select[\s\S]{0,500}meu_cliente_id\s*\(\s*\)/i,
    "pedidos_cliente_select deve usar meu_cliente_id()"
  );
});

test("SQL: ha policy cliente INSERT em pedidos", () => {
  assert.match(
    sql,
    /CREATE\s+POLICY\s+pedidos_cliente_insert\s+ON\s+public\.pedidos/i,
    "deve criar policy pedidos_cliente_insert"
  );
  assert.match(
    sql,
    /pedidos_cliente_insert[\s\S]{0,300}FOR\s+INSERT/i,
    "pedidos_cliente_insert deve ser FOR INSERT"
  );
});

test("SQL: pedidos cliente INSERT exige cliente_id = public.meu_cliente_id()", () => {
  const idx = sql.indexOf("CREATE POLICY pedidos_cliente_insert");
  const bloco = sql.slice(idx, idx + 600);
  assert.match(
    bloco,
    /cliente_id\s*=\s*public\.meu_cliente_id\s*\(\s*\)/i,
    "pedidos_cliente_insert deve exigir cliente_id = meu_cliente_id()"
  );
});

test("SQL: pedidos cliente INSERT limita status a rascunho/recebido", () => {
  const idx = sql.indexOf("CREATE POLICY pedidos_cliente_insert");
  const bloco = sql.slice(idx, idx + 600);
  assert.match(
    bloco,
    /status\s+IN\s+\([^)]*'rascunho'[^)]*'recebido'[^)]*\)/i,
    "pedidos_cliente_insert deve limitar status a ('rascunho', 'recebido')"
  );
});

test("SQL: NAO ha policy cliente UPDATE em pedidos", () => {
  // Na sintaxe CREATE POLICY pedidos_cliente_update
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY\s+pedidos_cliente_(update|delete)\s+ON\s+public\.pedidos/i,
    "nao deve existir pedidos_cliente_update ou pedidos_cliente_delete"
  );
  // Tambem verifica que comentario confirma a ausencia
  assert.match(
    sql,
    /N[ÃA]O\s+h[aá]\s+pedidos_cliente_update/i,
    "comentario deve documentar que NAO ha pedidos_cliente_update"
  );
  assert.match(
    sql,
    /N[ÃA]O\s+h[aá]\s+pedidos_cliente_delete/i,
    "comentario deve documentar que NAO ha pedidos_cliente_delete"
  );
});

test("SQL: NAO ha policy cliente DELETE em pedidos", () => {
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY\s+pedidos_cliente_delete\s+ON\s+public\.pedidos/i,
    "nao deve existir pedidos_cliente_delete"
  );
});

// ---------------------------------------------------------------------
// 9. RLS em pedido_itens — policies cliente
// ---------------------------------------------------------------------

test("SQL: ha policy cliente SELECT em pedido_itens", () => {
  assert.match(
    sql,
    /CREATE\s+POLICY\s+pedido_itens_cliente_select\s+ON\s+public\.pedido_itens/i,
    "deve criar policy pedido_itens_cliente_select"
  );
  assert.match(
    sql,
    /pedido_itens_cliente_select[\s\S]{0,300}FOR\s+SELECT/i,
    "pedido_itens_cliente_select deve ser FOR SELECT"
  );
  assert.match(
    sql,
    /pedido_itens_cliente_select[\s\S]{0,800}meu_cliente_id\s*\(\s*\)/i,
    "pedido_itens_cliente_select deve usar meu_cliente_id()"
  );
});

test("SQL: ha policy cliente INSERT em pedido_itens", () => {
  assert.match(
    sql,
    /CREATE\s+POLICY\s+pedido_itens_cliente_insert\s+ON\s+public\.pedido_itens/i,
    "deve criar policy pedido_itens_cliente_insert"
  );
  assert.match(
    sql,
    /pedido_itens_cliente_insert[\s\S]{0,300}FOR\s+INSERT/i,
    "pedido_itens_cliente_insert deve ser FOR INSERT"
  );
});

test("SQL: pedido_itens cliente INSERT valida pedido pertencente ao cliente", () => {
  const idx = sql.indexOf("CREATE POLICY pedido_itens_cliente_insert");
  const bloco = sql.slice(idx, idx + 800);
  assert.match(
    bloco,
    /pedidos\.cliente_id\s*=\s*public\.meu_cliente_id\s*\(\s*\)/i,
    "pedido_itens_cliente_insert deve verificar pedidos.cliente_id = meu_cliente_id()"
  );
});

test("SQL: pedido_itens cliente INSERT valida pedido em status editavel", () => {
  const idx = sql.indexOf("CREATE POLICY pedido_itens_cliente_insert");
  const bloco = sql.slice(idx, idx + 800);
  assert.match(
    bloco,
    /pedidos\.status\s+IN\s+\([^)]*'rascunho'[^)]*'recebido'[^)]*\)/i,
    "pedido_itens_cliente_insert deve limitar a pedidos.status IN ('rascunho','recebido')"
  );
});

test("SQL: NAO ha policy cliente UPDATE em pedido_itens", () => {
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY\s+pedido_itens_cliente_(update|delete)\s+ON\s+public\.pedido_itens/i,
    "nao deve existir pedido_itens_cliente_update ou pedido_itens_cliente_delete"
  );
  assert.match(
    sql,
    /N[ÃA]O\s+h[aá]\s+pedido_itens_cliente_update/i,
    "comentario deve documentar que NAO ha pedido_itens_cliente_update"
  );
  assert.match(
    sql,
    /N[ÃA]O\s+h[aá]\s+pedido_itens_cliente_delete/i,
    "comentario deve documentar que NAO ha pedido_itens_cliente_delete"
  );
});

test("SQL: NAO ha policy cliente DELETE em pedido_itens", () => {
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY\s+pedido_itens_cliente_delete\s+ON\s+public\.pedido_itens/i,
    "nao deve existir pedido_itens_cliente_delete"
  );
});

// ---------------------------------------------------------------------
// 10. pedido_eventos — admin-only confirmado
// ---------------------------------------------------------------------

test("SQL: pedido_eventos permanece sem policy de cliente", () => {
  // Nao deve ter CREATE POLICY com pedido_eventos e cliente
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY\s+pedido_eventos_cliente/i,
    "nao deve criar policy de cliente em pedido_eventos"
  );
  // Deve ter comentario indicando que e admin-only
  assert.match(
    sql,
    /pedido_eventos.*(admin.only|auditoria|interno)/i,
    "deve ter comentario sobre pedido_eventos continuar admin-only/auditoria"
  );
});

// ---------------------------------------------------------------------
// 11. Sem token publico, sem anon, sem public:true
// ---------------------------------------------------------------------

test("SQL: NAO ha policy publica por token_acesso", () => {
  assert.doesNotMatch(
    sql,
    /USING\s*\(\s*token_acesso/i,
    "token_acesso nao pode aparecer em USING (sem policy publica)"
  );
  assert.doesNotMatch(
    sql,
    /WITH\s+CHECK\s*\(\s*token_acesso/i,
    "token_acesso nao pode aparecer em WITH CHECK"
  );
});

test("SQL: NAO ha 'public: true'", () => {
  assert.doesNotMatch(
    sql,
    /public\s*:\s*true/i,
    "nao deve ter public: true no SQL"
  );
});

test("SQL: NAO cria policy para anon", () => {
  // For SELECT/FOR ALL TO anon (que daria acesso nao autenticado)
  assert.doesNotMatch(
    sql,
    /CREATE\s+POLICY[\s\S]{0,300}(FOR\s+ALL|FOR\s+SELECT).*TO\s+anon/i,
    "nao deve criar policy FOR SELECT/ALL TO anon"
  );
});

test("SQL: NAO ha service_role, secrets ou JWT hardcoded", () => {
  assert.doesNotMatch(sql, /service_role/i, "service_role nao pode aparecer");
  assert.doesNotMatch(sql, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./);
  assert.doesNotMatch(
    sql,
    /password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/i,
    "password literal longo nao pode aparecer"
  );
});

// ---------------------------------------------------------------------
// 12. Idempotencia e seguranca
// ---------------------------------------------------------------------

test("SQL: e idempotente (IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE)", () => {
  assert.match(sql, /IF\s+NOT\s+EXISTS/i, "deve usar IF NOT EXISTS em algum ponto");
  assert.match(sql, /CREATE\s+OR\s+REPLACE/i, "deve usar CREATE OR REPLACE");
  assert.match(sql, /DROP\s+POLICY\s+IF\s+EXISTS/i, "deve usar DROP POLICY IF EXISTS");
  assert.match(sql, /DROP\s+CONSTRAINT\s+IF\s+EXISTS/i, "deve usar DROP CONSTRAINT IF EXISTS");
});

test("SQL: NÃO contem DROP TABLE destrutivo", () => {
  assert.doesNotMatch(
    sql,
    /^\s*DROP\s+TABLE\b/im,
    "SQL nao pode conter DROP TABLE (idempotencia e por IF NOT EXISTS / OR REPLACE)"
  );
});

test("SQL: NAO contem DELETE FROM", () => {
  assert.doesNotMatch(
    sql,
    /^\s*DELETE\s+FROM\b/im,
    "SQL nao pode conter DELETE FROM"
  );
});

test("SQL: NAO contem TRUNCATE", () => {
  assert.doesNotMatch(sql, /TRUNCATE/i, "nao deve ter TRUNCATE");
});

// ---------------------------------------------------------------------
// 13. Nao toca migrations antigas / codigo / Edge Functions
// ---------------------------------------------------------------------

test("SQL: nao referencia js/ ou supabase/functions/", () => {
  assert.doesNotMatch(sql, /js\//i, "nao deve referenciar js/");
  assert.doesNotMatch(sql, /supabase\/functions\//i, "nao deve referenciar supabase/functions/");
});

test("SQL: termina com reload do schema cache (PostgREST)", () => {
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+schema'/i);
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+config'/i);
});

// ---------------------------------------------------------------------
// 14. Compatibilidade com migrations existentes
// ---------------------------------------------------------------------

test("fase 09 (cliente/lote) tem tabela clientes", () => {
  assert.match(
    fase09,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+clientes/i,
    "db/09 deve ter criado a tabela clientes (pré-requisito)"
  );
});

test("fase 13 (pedidos) tem tabelas pedidos e pedido_itens", () => {
  assert.match(
    fase13,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedidos/i,
    "db/13 deve ter criado pedidos"
  );
  assert.match(
    fase13,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.pedido_itens/i,
    "db/13 deve ter criado pedido_itens"
  );
});

// ---------------------------------------------------------------------
// 15. Comentarios e documentacao no SQL
// ---------------------------------------------------------------------

test("SQL: documenta que NAO libera UPDATE/DELETE de cliente", () => {
  assert.match(
    sql,
    /N[ÃA]O\s+(adicionar|liberar|haver[áa]|implementar).*(UPDATE|DELETE)/i,
    "SQL deve documentar que NAO ha UPDATE/DELETE de cliente"
  );
});

test("SQL: documenta que pedido_eventos continua admin-only", () => {
  assert.match(
    sql,
    /pedido_eventos.*(auditoria|interno|admin[- ]only)/i,
    "deve documentar que pedido_eventos e auditoria interna/admin-only"
  );
});
