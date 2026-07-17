// Migration smoke for db/64_backup_runs_schema.sql — phase BK4.1
// (Camada 3 backup contract: docs/architecture/CAMADA3_BACKUP_CONTRACT.md).
// Static assertions on the SQL file (no DB access).
//
// Intent: public.backup_runs / public.backup_run_destinations must be
// append-only (admin-only SELECT, no client write policy on either
// table), the writer path must be exactly the two service_role-only
// RPCs (iniciar_backup_run / finalizar_backup_run, gated the db/49 way),
// destination must stay an open/extensible field while scope stays
// locked to the single ratified value, and the migration must state a
// complete ACL (not a delta) exactly per the db/57/db/63 standard.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '64_backup_runs_schema.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/^\s*--.*$/gm, '');

const DB62 = path.join(ROOT, 'db', '62_admin_nivel_acesso_schema.sql');
const DB63 = path.join(ROOT, 'db', '63_is_admin_full_grants.sql');

function has(pattern, message) {
  assert.match(sql, pattern, message);
}

function lacks(pattern, message) {
  assert.doesNotMatch(sql, pattern, message);
}

function block(start, maxChars) {
  const match = sql.match(start);
  assert.ok(match, 'bloco nao encontrado: ' + start);
  return sql.slice(match.index, match.index + maxChars);
}

test('migration 64 existe e referencia a fase BK4.1 e o contrato Camada 3', () => {
  assert.ok(fs.existsSync(SQL_PATH));
  has(/BK4\.1/);
  has(/CAMADA3_BACKUP_CONTRACT\.md/i);
});

test('tabela backup_runs tem as colunas do escopo e defaults corretos', () => {
  const t = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.backup_runs/i, 1200);
  assert.match(t, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(t, /started_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  assert.match(t, /finished_at\s+TIMESTAMPTZ/i);
  assert.match(t, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'running'/i);
  assert.match(t, /scope\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'public\+auth'/i);
  assert.match(t, /bytes\s+BIGINT/i);
  assert.match(t, /sha256\s+TEXT/i);
  assert.match(t, /row_count_manifest\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  assert.match(t, /triggered_by\s+TEXT\s+NOT\s+NULL/i);
  assert.match(t, /retention_class\s+TEXT\s+NOT\s+NULL/i);
  assert.match(t, /error\s+TEXT/i);
});

test('backup_runs CHECK constraints cobrem status/scope/triggered_by/retention_class', () => {
  has(/backup_runs_status_check[\s\S]{0,80}CHECK\s*\(status\s+IN\s*\(\s*'running'\s*,\s*'completed'\s*,\s*'failed'\s*\)\)/i);
  has(/backup_runs_scope_check[\s\S]{0,80}CHECK\s*\(scope\s+IN\s*\(\s*'public\+auth'\s*\)\)/i);
  has(/backup_runs_triggered_by_check[\s\S]{0,80}CHECK\s*\(triggered_by\s+IN\s*\(\s*'scheduled'\s*,\s*'manual'\s*\)\)/i);
  has(/backup_runs_retention_class_check[\s\S]{0,80}CHECK\s*\(retention_class\s+IN\s*\(\s*'gfs'\s*,\s*'manual'\s*\)\)/i);
});

test('backup_runs CHECK constraints cobrem integridade de bytes/sha256/manifest/tempos/erro', () => {
  has(/backup_runs_bytes_check[\s\S]{0,60}CHECK\s*\(bytes\s+IS\s+NULL\s+OR\s+bytes\s*>=\s*0\)/i);
  has(/backup_runs_sha256_check[\s\S]{0,80}\^\[0-9a-f\]\{64\}\$/i);
  has(/backup_runs_row_count_manifest_object_check[\s\S]{0,80}jsonb_typeof\(row_count_manifest\)\s*=\s*'object'/i);
  has(/backup_runs_terminal_times_check/i);
  has(/status\s*=\s*'running'\s+AND\s+finished_at\s+IS\s+NULL/i);
  has(/status\s+IN\s*\(\s*'completed'\s*,\s*'failed'\s*\)\s+AND\s+finished_at\s+IS\s+NOT\s+NULL/i);
  has(/backup_runs_failed_reason_check[\s\S]{0,120}status\s*<>\s*'failed'\s+OR\s+NULLIF\(btrim\(COALESCE\(error/i);
});

test('scope fica travado a public+auth (contrato SS1) e nao vira campo livre', () => {
  // A unica ocorrencia de "scope IN (" no arquivo deve listar exatamente
  // um valor: 'public+auth'.
  const scopeChecks = executableSql.match(/scope\s+IN\s*\([^)]*\)/gi) || [];
  assert.equal(scopeChecks.length, 1, 'esperado exatamente um CHECK de scope');
  assert.match(scopeChecks[0], /^scope\s+IN\s*\(\s*'public\+auth'\s*\)$/i);
});

test('tabela backup_run_destinations tem as colunas do escopo e FK CASCADE', () => {
  const t = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.backup_run_destinations/i, 700);
  assert.match(t, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(t, /run_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.backup_runs\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(t, /destination\s+TEXT\s+NOT\s+NULL/i);
  assert.match(t, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
  assert.match(t, /uploaded_at\s+TIMESTAMPTZ/i);
  assert.match(t, /error\s+TEXT/i);
});

test('destination fica aberto/extensivel (contrato SS4) — sem CHECK de enumeracao', () => {
  has(/backup_run_destinations_destination_check[\s\S]{0,120}destination\s*=\s*lower\(destination\)\s+AND\s+char_length\(btrim\(destination\)\)\s*>\s*0/i);
  // Garantia negativa: nenhum CHECK restringe destination a uma lista
  // fechada de valores (ex.: destination IN (...)).
  lacks(/destination\s+IN\s*\(/i, 'destination nao pode ser um enum fechado');
});

test('backup_run_destinations CHECK constraints cobrem status/uploaded_at/erro', () => {
  has(/backup_run_destinations_status_check[\s\S]{0,80}CHECK\s*\(status\s+IN\s*\(\s*'pending'\s*,\s*'ok'\s*,\s*'failed'\s*,\s*'skipped'\s*\)\)/i);
  has(/backup_run_destinations_ok_uploaded_check[\s\S]{0,100}status\s*<>\s*'ok'\s+OR\s+uploaded_at\s+IS\s+NOT\s+NULL/i);
  has(/backup_run_destinations_failed_reason_check[\s\S]{0,120}status\s*<>\s*'failed'\s+OR\s+NULLIF\(btrim\(COALESCE\(error/i);
});

test('indice unico impede duas linhas de destino para a mesma corrida', () => {
  has(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+backup_run_destinations_run_destination_uidx[\s\S]{0,120}ON\s+public\.backup_run_destinations\(run_id,\s*destination\)/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+backup_run_destinations_run_idx[\s\S]{0,80}ON\s+public\.backup_run_destinations\(run_id\)/i);
});

test('RLS admin-only SELECT e nenhuma policy de escrita em nenhuma das duas tabelas', () => {
  has(/ALTER\s+TABLE\s+public\.backup_runs\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/ALTER\s+TABLE\s+public\.backup_run_destinations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);

  has(/CREATE\s+POLICY\s+backup_runs_admin_select\s+ON\s+public\.backup_runs[\s\S]{0,80}FOR\s+SELECT[\s\S]{0,40}USING\s*\(public\.is_admin\(\)\)/i);
  has(/CREATE\s+POLICY\s+backup_run_destinations_admin_select\s+ON\s+public\.backup_run_destinations[\s\S]{0,80}FOR\s+SELECT[\s\S]{0,40}USING\s*\(public\.is_admin\(\)\)/i);

  // Nenhuma policy FOR ALL / FOR INSERT / FOR UPDATE / FOR DELETE em
  // qualquer uma das duas tabelas — leitura admin e a UNICA policy.
  lacks(/CREATE\s+POLICY[\s\S]{0,200}public\.backup_runs[\s\S]{0,40}FOR\s+(ALL|INSERT|UPDATE|DELETE)/i);
  lacks(/CREATE\s+POLICY[\s\S]{0,200}public\.backup_run_destinations[\s\S]{0,40}FOR\s+(ALL|INSERT|UPDATE|DELETE)/i);
});

test('grants das tabelas revogam tudo de PUBLIC/anon/authenticated/service_role e concedem so SELECT a authenticated', () => {
  for (const t of ['backup_runs', 'backup_run_destinations']) {
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+PUBLIC', 'i'));
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+anon', 'i'));
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+authenticated', 'i'));
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+service_role', 'i'));
    has(new RegExp('GRANT\\s+SELECT\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+TO\\s+authenticated', 'i'));
  }
  // Nenhum GRANT de INSERT/UPDATE/DELETE nas tabelas, para nenhuma role.
  assert.doesNotMatch(
    executableSql,
    /GRANT\s+[^;]*(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*public\.backup_run(_destinations)?[^;]*;/i
  );
});

test('RPC iniciar_backup_run e service_role-only e valida os 3 campos', () => {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.iniciar_backup_run/i, 2500);
  assert.match(r, /p_scope\s+TEXT\s+DEFAULT\s+'public\+auth'/i);
  assert.match(r, /p_triggered_by\s+TEXT\s+DEFAULT\s+'manual'/i);
  assert.match(r, /p_retention_class\s+TEXT\s+DEFAULT\s+'gfs'/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  assert.match(r, /writer_required/i);
  assert.match(r, /invalid_scope/i);
  assert.match(r, /invalid_triggered_by/i);
  assert.match(r, /invalid_retention_class/i);
  assert.match(r, /INSERT\s+INTO\s+public\.backup_runs/i);
  assert.match(r, /RETURNING\s+id\s+INTO\s+v_run_id/i);
});

test('RPC finalizar_backup_run e service_role-only, transicao estrita e grava destinos', () => {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finalizar_backup_run/i, 5000);
  assert.match(r, /p_run_id\s+UUID/i);
  assert.match(r, /p_status\s+TEXT/i);
  assert.match(r, /p_bytes\s+BIGINT\s+DEFAULT\s+NULL/i);
  assert.match(r, /p_sha256\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(r, /p_row_count_manifest\s+JSONB\s+DEFAULT\s+'\{\}'::jsonb/i);
  assert.match(r, /p_error\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(r, /p_destinations\s+JSONB\s+DEFAULT\s+'\[\]'::jsonb/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  assert.match(r, /writer_required/i);
  assert.match(r, /run_id_required/i);
  assert.match(r, /invalid_status/i);
  assert.match(r, /error_required_when_failed/i);
  assert.match(r, /row_count_manifest_invalid/i);
  assert.match(r, /destinations_invalid/i);
  // Transicao SOMENTE a partir de running.
  assert.match(r, /WHERE\s+id\s*=\s*p_run_id\s*AND\s*status\s*=\s*'running'/i);
  assert.match(r, /run_not_running_or_not_found/i);
  // Loop de destinos: um INSERT por elemento do array.
  assert.match(r, /FOR\s+v_dest\s+IN\s+SELECT\s+\*\s+FROM\s+jsonb_array_elements\(p_destinations\)/i);
  assert.match(r, /INSERT\s+INTO\s+public\.backup_run_destinations/i);
  assert.match(r, /destinations_recorded/i);
});

test('finalizar_backup_run so aceita completed/failed (running nao e status terminal valido)', () => {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finalizar_backup_run/i, 5000);
  assert.match(r, /v_status\s+NOT\s+IN\s*\(\s*'completed'\s*,\s*'failed'\s*\)/i);
});

test('grants das RPCs seguem o principio de menor privilegio (service_role apenas)', () => {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.iniciar_backup_run\(TEXT,\s*TEXT,\s*TEXT\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.iniciar_backup_run\(TEXT,\s*TEXT,\s*TEXT\)\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.iniciar_backup_run\(TEXT,\s*TEXT,\s*TEXT\)\s+FROM\s+authenticated/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.iniciar_backup_run\(TEXT,\s*TEXT,\s*TEXT\)\s+TO\s+service_role/i);

  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finalizar_backup_run\(UUID,\s*TEXT,\s*BIGINT,\s*TEXT,\s*JSONB,\s*TEXT,\s*JSONB\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finalizar_backup_run\(UUID,\s*TEXT,\s*BIGINT,\s*TEXT,\s*JSONB,\s*TEXT,\s*JSONB\)\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finalizar_backup_run\(UUID,\s*TEXT,\s*BIGINT,\s*TEXT,\s*JSONB,\s*TEXT,\s*JSONB\)\s+FROM\s+authenticated/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finalizar_backup_run\(UUID,\s*TEXT,\s*BIGINT,\s*TEXT,\s*JSONB,\s*TEXT,\s*JSONB\)\s+TO\s+service_role/i);

  // Nenhum GRANT EXECUTE para authenticated/anon em nenhuma das duas RPCs.
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.iniciar_backup_run[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finalizar_backup_run[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(iniciar_backup_run|finalizar_backup_run)[\s\S]*TO\s+anon/i);
});

test('migracao nao toca o exportador/UI/CI/producao, nao expoe segredos e reloada PostgREST', () => {
  // Fora de escopo desta fase — apenas mencionado em comentarios de
  // limite, nunca como codigo executavel.
  assert.doesNotMatch(
    executableSql,
    /\b(pg_dump|pg_cron|pg_net|github\s+actions|vercel|onedrive\s+api|drive\.files\.create|scheduler)\b/i
  );

  // Comandos destrutivos.
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
  assert.doesNotMatch(sql, /^\s*DROP\s+TABLE\b/im);

  // Segredos — checados em SQL executavel para cobrir GRANT ... TO
  // service_role, que tambem aparece em comentarios.
  assert.doesNotMatch(executableSql, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(executableSql, /postgres:\/\/|password\s*[:=]|eyJ[A-Za-z0-9_-]{10,}\.eyJ/i);

  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('migrations 62 e 63 nao foram alteradas (gate de nao-regressao)', () => {
  assert.ok(fs.existsSync(DB62), 'db/62_admin_nivel_acesso_schema.sql ausente');
  assert.ok(fs.existsSync(DB63), 'db/63_is_admin_full_grants.sql ausente');

  const db62 = fs.readFileSync(DB62, 'utf8');
  const db63 = fs.readFileSync(DB63, 'utf8');

  assert.match(db62, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+nivel_acesso\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'completo'/i);
  assert.match(db62, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_admin_full\(\)/i);

  assert.match(db63, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_admin_full\(\)\s+TO\s+authenticated/i);
  assert.match(db63, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.is_admin_full\(\)\s+FROM\s+service_role/i);
});
