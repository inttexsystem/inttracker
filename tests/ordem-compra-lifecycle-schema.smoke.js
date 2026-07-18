// Migration smoke for db/65_ordem_compra_lifecycle_schema.sql — phase
// ORDEM-COMPRA-LIFECYCLE Phase A (schema + config).
// Spec: docs/architecture/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED.md
// (RATIFIED, ORDEM-COMPRA-LIFECYCLE-SPEC-RATIFICATION-R1).
// Static assertions on the SQL file (no DB access).
//
// Intent: the three dimension columns + audit columns land on
// ordens_compra_fio exactly as specced (§3.1); the new ledger/events/
// config tables carry the op_eventos/usuarios_eventos admin-only-read
// ACL shape (db/57/63 standard); the legacy backfill runs inside the
// same explicit transaction as the ALTER TABLE (binding gap 1); and
// nothing in this file reaches into Phase B/C/D scope (no RPC, no
// trigger, no REVOKE of the dimension columns' write access).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '65_ordem_compra_lifecycle_schema.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/^\s*--.*$/gm, '');

function has(pattern, message) {
  assert.match(sql, pattern, message);
}

function lacks(pattern, message) {
  assert.doesNotMatch(sql, pattern, message);
}

function block(start, maxChars) {
  const match = sql.match(start);
  assert.ok(match, 'block not found: ' + start);
  return sql.slice(match.index, match.index + maxChars);
}

test('migration 65 exists and references the ratified spec', () => {
  assert.ok(fs.existsSync(SQL_PATH));
  has(/ORDEM_COMPRA_LIFECYCLE_SPEC_PROPOSED\.md/i);
  has(/RATIFIED/i);
});

test('single explicit transaction wraps the ALTER TABLE and the backfill (binding gap 1)', () => {
  const beginIdx = executableSql.search(/^\s*BEGIN\s*;/im);
  const alterIdx = executableSql.search(/ALTER\s+TABLE\s+public\.ordens_compra_fio/i);
  const updateIdx = executableSql.search(/UPDATE\s+public\.ordens_compra_fio/i);
  const commitIdx = executableSql.search(/^\s*COMMIT\s*;/im);
  assert.ok(beginIdx >= 0, 'no explicit BEGIN found');
  assert.ok(commitIdx > updateIdx && updateIdx > alterIdx && alterIdx > beginIdx,
    'expected order BEGIN < ALTER TABLE < backfill UPDATE < COMMIT');
  // Exactly one BEGIN/COMMIT pair — no nested top-level transaction.
  assert.equal((executableSql.match(/^\s*BEGIN\s*;/gim) || []).length, 1);
  assert.equal((executableSql.match(/^\s*COMMIT\s*;/gim) || []).length, 1);
});

test('ordens_compra_fio gains the three dimension columns + audit columns, all additive', () => {
  const t = block(/ALTER\s+TABLE\s+public\.ordens_compra_fio/i, 2200);
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_administrativo\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'rascunho'/i);
  assert.match(t, /CHECK\s*\(status_administrativo\s+IN\s*\(\s*'rascunho'\s*,\s*'emitida'\s*,\s*'cancelada'\s*\)\)/i);
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_aceite\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'nao_aplicavel'/i);
  assert.match(t, /CHECK\s*\(status_aceite\s+IN\s*\(\s*'nao_aplicavel'\s*,\s*'pendente'\s*,\s*'aceita'\s*,\s*'rejeitada'\s*\)\)/i);
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_recebimento\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'nao_recebido'/i);
  assert.match(t, /CHECK\s*\(status_recebimento\s+IN\s*\(\s*'nao_recebido'\s*,\s*'parcial'\s*,\s*'recebido'\s*\)\)/i);
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+aceite_exigido_na_emissao\s+BOOLEAN\s*,/i);
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+legado_recebimento_automatico\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i);
  for (const col of ['emitida_em', 'cancelada_em', 'aceite_decidida_em']) {
    assert.match(t, new RegExp('ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+' + col + '\\s+TIMESTAMPTZ', 'i'));
  }
  for (const col of ['emitida_por', 'cancelada_por', 'aceite_decidida_por']) {
    assert.match(t, new RegExp(
      'ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+' + col + '\\s+UUID\\s+REFERENCES\\s+auth\\.users\\(id\\)\\s+ON\\s+DELETE\\s+SET\\s+NULL', 'i'
    ));
  }
  assert.match(t, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+aceite_motivo\s+TEXT/i);
});

test('no DROP or type change touches ordens_compra_fio\'s existing columns (status, kg_recebido)', () => {
  lacks(/ALTER\s+TABLE\s+public\.ordens_compra_fio\s+DROP\b/i);
  lacks(/ALTER\s+TABLE\s+public\.ordens_compra_fio\s+ALTER\s+COLUMN\s+(status|kg_recebido)\b/i);
});

test('ordem_compra_fio_lancamentos ledger table: shape, index, admin-only RLS, no trigger', () => {
  const t = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.ordem_compra_fio_lancamentos/i, 700);
  assert.match(t, /ordem_compra_fio_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+public\.ordens_compra_fio\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(t, /kg_recebido\s+NUMERIC\(10,3\)\s+NOT\s+NULL\s+CHECK\s*\(kg_recebido\s*>\s*0\)/i);
  assert.match(t, /data_recebimento\s+DATE\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_DATE/i);
  assert.match(t, /criado_por\s+UUID\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);

  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+ordem_compra_fio_lancamentos_ordem_idx[\s\S]{0,80}ON\s+public\.ordem_compra_fio_lancamentos\(ordem_compra_fio_id\)/i);
  has(/ALTER\s+TABLE\s+public\.ordem_compra_fio_lancamentos\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/CREATE\s+POLICY\s+ordem_compra_fio_lancamentos_admin_select\s+ON\s+public\.ordem_compra_fio_lancamentos[\s\S]{0,80}FOR\s+SELECT[\s\S]{0,40}USING\s*\(is_admin\(\)\)/i);

  // Phase A ships this table empty/unused — no trigger yet (Phase C's job).
  lacks(/CREATE\s+TRIGGER[\s\S]{0,200}ordem_compra_fio_lancamentos/i);
  lacks(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION[\s\S]{0,80}(recompute|trigger).*lancament/i);
});

test('ordem_compra_eventos audit table: shape, dimensao enum, index, admin-only RLS', () => {
  const t = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.ordem_compra_eventos/i, 700);
  assert.match(t, /ordem_compra_fio_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+public\.ordens_compra_fio\(id\)\s+ON\s+DELETE\s+CASCADE/i);
  assert.match(t, /dimensao\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(dimensao\s+IN\s*\(\s*'administrativo'\s*,\s*'aceite'\s*,\s*'recebimento'\s*\)\)/i);
  assert.match(t, /tipo_evento\s+TEXT\s+NOT\s+NULL/i);
  assert.match(t, /payload\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  assert.match(t, /criado_por\s+UUID\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);

  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+ordem_compra_eventos_ordem_idx[\s\S]{0,80}ON\s+public\.ordem_compra_eventos\(ordem_compra_fio_id\)/i);
  has(/ALTER\s+TABLE\s+public\.ordem_compra_eventos\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/CREATE\s+POLICY\s+ordem_compra_eventos_admin_select\s+ON\s+public\.ordem_compra_eventos[\s\S]{0,80}FOR\s+SELECT[\s\S]{0,40}USING\s*\(is_admin\(\)\)/i);

  // No writer for any client role — no INSERT/UPDATE/DELETE/ALL policy.
  lacks(/CREATE\s+POLICY[\s\S]{0,200}public\.ordem_compra_eventos[\s\S]{0,40}FOR\s+(ALL|INSERT|UPDATE|DELETE)/i);
});

test('ordem_compra_config singleton: seeded false, admin-only RLS, no writer', () => {
  const t = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.ordem_compra_config/i, 400);
  assert.match(t, /id\s+SMALLINT\s+PRIMARY\s+KEY\s+DEFAULT\s+1\s+CHECK\s*\(id\s*=\s*1\)/i);
  assert.match(t, /exige_aceite\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i);

  has(/INSERT\s+INTO\s+public\.ordem_compra_config\s*\(id,\s*exige_aceite\)[\s\S]{0,60}VALUES\s*\(1,\s*FALSE\)/i);
  has(/ON\s+CONFLICT\s*\(id\)\s+DO\s+NOTHING/i);

  has(/ALTER\s+TABLE\s+public\.ordem_compra_config\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/CREATE\s+POLICY\s+ordem_compra_config_admin_select\s+ON\s+public\.ordem_compra_config[\s\S]{0,80}FOR\s+SELECT[\s\S]{0,40}USING\s*\(is_admin\(\)\)/i);
  lacks(/CREATE\s+POLICY[\s\S]{0,200}public\.ordem_compra_config[\s\S]{0,40}FOR\s+(ALL|INSERT|UPDATE|DELETE)/i);
});

test('grants on all three new tables revoke PUBLIC/anon/authenticated, grant only SELECT to authenticated (db/57/63 standard)', () => {
  for (const t of ['ordem_compra_fio_lancamentos', 'ordem_compra_eventos', 'ordem_compra_config']) {
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+PUBLIC', 'i'));
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+anon', 'i'));
    has(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+FROM\\s+authenticated', 'i'));
    has(new RegExp('GRANT\\s+SELECT\\s+ON\\s+TABLE\\s+public\\.' + t + '\\s+TO\\s+authenticated', 'i'));
  }
  assert.doesNotMatch(
    executableSql,
    /GRANT\s+[^;]*(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*public\.(ordem_compra_fio_lancamentos|ordem_compra_eventos|ordem_compra_config)[^;]*;/i
  );
});

test('legacy backfill maps status -> status_recebimento exactly, marks emitida/nao_aplicavel/legado, no kg_recebido rewrite', () => {
  const u = block(/UPDATE\s+public\.ordens_compra_fio/i, 700);
  assert.match(u, /status_administrativo\s*=\s*'emitida'/i);
  assert.match(u, /status_aceite\s*=\s*'nao_aplicavel'/i);
  assert.match(u, /WHEN\s+'pendente'\s+THEN\s+'nao_recebido'/i);
  assert.match(u, /WHEN\s+'recebido_parcial'\s+THEN\s+'parcial'/i);
  assert.match(u, /WHEN\s+'recebido_total'\s+THEN\s+'recebido'/i);
  assert.match(u, /legado_recebimento_automatico\s*=\s*TRUE/i);
  assert.match(u, /WHERE\s+status_administrativo\s*=\s*'rascunho'/i);
  assert.doesNotMatch(u, /kg_recebido\s*=/i);
});

test('scope guard: no RPC, no trigger on ordens_compra_fio, no REVOKE of dimension-column write access (Phase B/C, out of scope)', () => {
  lacks(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.(emitir|cancelar|decidir_aceite|registrar_recebimento)_ordem_compra_fio/i);
  lacks(/CREATE\s+TRIGGER[\s\S]{0,200}ON\s+public\.ordens_compra_fio\b/i);
  lacks(/REVOKE[\s\S]{0,120}(status_administrativo|status_aceite|status_recebimento|kg_recebido)[\s\S]{0,80}FROM\s+authenticated/i);
});

test('no destructive commands, no secrets, no production/UI/JS surface touched, reloads PostgREST', () => {
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
  assert.doesNotMatch(sql, /^\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(executableSql, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(executableSql, /postgres:\/\/|password\s*[:=]|eyJ[A-Za-z0-9_-]{10,}\.eyJ/i);
  assert.doesNotMatch(executableSql, /\bbhgifjrfagkzubpyqpew\b|\bgqmpsxkxynrjvidfmojk\b/i);

  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('migrations 63 and 64 were not altered (non-regression gate)', () => {
  const DB63 = path.join(ROOT, 'db', '63_is_admin_full_grants.sql');
  const DB64 = path.join(ROOT, 'db', '64_backup_runs_schema.sql');
  assert.ok(fs.existsSync(DB63), 'db/63_is_admin_full_grants.sql missing');
  assert.ok(fs.existsSync(DB64), 'db/64_backup_runs_schema.sql missing');

  const db63 = fs.readFileSync(DB63, 'utf8');
  const db64 = fs.readFileSync(DB64, 'utf8');

  assert.match(db63, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_admin_full\(\)\s+TO\s+authenticated/i);
  assert.match(db64, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.backup_runs/i);
});
