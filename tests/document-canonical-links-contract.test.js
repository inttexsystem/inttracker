const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '51_document_canonical_links.sql');

// Throws if file doesn't exist — clear RED signal.
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/--.*$/gm, '');

function has(pattern, message) {
  assert.match(sql, pattern, message);
}

function lacks(pattern, message) {
  assert.doesNotMatch(sql, pattern, message);
}

function fnBlock(name) {
  const re = new RegExp(
    'CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + name + '[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$'
  );
  const m = sql.match(re);
  assert.ok(m, 'funcao ' + name + ' encontrada');
  return { full: m[0], body: m[1], execBody: m[1].replace(/--.*$/gm, '') };
}

test('migration 51 header: versionada, aditiva, staging-only, sem secrets/backfill', function () {
  has(/RAVATEX-DOCUMENTS-G28-B6/i);
  has(/staging\s+ucrjtfswnfdlxwtmxnoo/i, 'declara staging alvo');
  has(/bhgifjrfagkzubpyqpew[\s\S]*?proibida/i, 'declara producao proibida');
  has(/sem\s+backfill/i);
  has(/sem\s+migracao\s+destrutiva/i);
  has(/sem\s+secrets/i);
});

test('migration 51: ownership boundary documentada', function () {
  has(/document_candidates\.pedido_id[\s\S]*NAO\s+os\s+promove/i,
    'declara que candidate/event pedido_id nao sao o vinculo canonico');
  has(/pedido_manual\s+permanece\s+somente\s+sugestao/i);
});

test('tabela document_link_revisions: colunas e tipos exatos', function () {
  const t = sql.slice(
    sql.indexOf('CREATE TABLE IF NOT EXISTS public.document_link_revisions'),
    sql.indexOf('CREATE TABLE IF NOT EXISTS public.document_link_revision_ops')
  );
  assert.match(t, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(t, /document_id\s+TEXT\s+NOT\s+NULL[\s\S]*REFERENCES\s+public\.document_candidates\(document_id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(t, /pedido_id\s+UUID[\s\S]*REFERENCES\s+public\.pedidos\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(t, /version\s+INTEGER\s+NOT\s+NULL/i);
  assert.match(t, /active\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  assert.match(t, /command_id\s+UUID\s+NOT\s+NULL/i);
  assert.match(t, /created_by\s+UUID[\s\S]*REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(t, /created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  assert.match(t, /revoked_by\s+UUID[\s\S]*REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(t, /revoked_at\s+TIMESTAMPTZ/i);
  assert.match(t, /revocation_reason\s+TEXT/i);
  // pedido_id nao pode ser NOT NULL (0..1)
  assert.doesNotMatch(t, /pedido_id\s+UUID\s+NOT\s+NULL/i, 'pedido_id e nullable (0..1)');
});

test('document_link_revisions: constraints de unicidade, versao e revogacao', function () {
  has(/document_link_revisions_version_check[\s\S]*CHECK\s*\(\s*version\s*>=\s*1\s*\)/i);
  has(/document_link_revisions_document_version_key[\s\S]*UNIQUE\s*\(document_id,\s*version\)/i);
  has(/document_link_revisions_command_id_key[\s\S]*UNIQUE\s*\(command_id\)/i);
  has(/document_link_revisions_active_revocation_check[\s\S]*CHECK/i);
  // consistencia active/revocation
  has(/active\s+IS\s+TRUE\s+AND\s+revoked_at\s+IS\s+NULL/i);
  has(/active\s+IS\s+FALSE\s+AND\s+revoked_at\s+IS\s+NOT\s+NULL/i);
});

test('document_link_revisions: partial unique de revisao ativa por documento', function () {
  has(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_link_revisions_active_uidx[\s\S]*ON\s+public\.document_link_revisions\(document_id\)[\s\S]*WHERE\s+active\s+IS\s+TRUE/i);
});

test('tabela document_link_revision_ops: tipos e PK sem OP duplicada', function () {
  const t = sql.slice(
    sql.indexOf('CREATE TABLE IF NOT EXISTS public.document_link_revision_ops'),
    sql.indexOf('-- 3. Indices')
  );
  assert.match(t, /revision_id\s+UUID\s+NOT\s+NULL[\s\S]*REFERENCES\s+public\.document_link_revisions\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(t, /op_id\s+BIGINT\s+NOT\s+NULL[\s\S]*REFERENCES\s+public\.ops\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(t, /PRIMARY\s+KEY\s*\(revision_id,\s*op_id\)/i);
});

test('indices reverso e RLS admin-only + grants', function () {
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_link_revisions_document_idx/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_link_revisions_pedido_idx[\s\S]*WHERE\s+pedido_id\s+IS\s+NOT\s+NULL/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_link_revision_ops_op_idx/i);

  has(/ALTER\s+TABLE\s+public\.document_link_revisions\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/ALTER\s+TABLE\s+public\.document_link_revision_ops\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/CREATE\s+POLICY\s+document_link_revisions_admin_all[\s\S]*USING\s*\(public\.is_admin\(\)\)[\s\S]*WITH\s+CHECK\s*\(public\.is_admin\(\)\)/i);
  has(/CREATE\s+POLICY\s+document_link_revision_ops_admin_all[\s\S]*USING\s*\(public\.is_admin\(\)\)/i);

  has(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.document_link_revisions\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.document_link_revisions\s+FROM\s+authenticated/i);
  has(/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.document_link_revisions\s+TO\s+authenticated/i);
  has(/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.document_link_revision_ops\s+TO\s+authenticated/i);
});

test('comments documentam propriedade e cardinalidades', function () {
  has(/COMMENT\s+ON\s+TABLE\s+public\.document_link_revisions[\s\S]*0\.\.1/i);
  has(/COMMENT\s+ON\s+TABLE\s+public\.document_link_revision_ops[\s\S]*0\.\.N/i);
});

test('RPC registrar_vinculos_documento: assinatura e seguranca', function () {
  const { full } = fnBlock('registrar_vinculos_documento');
  assert.match(full, /p_document_id\s+TEXT/i);
  assert.match(full, /p_pedido_id\s+UUID(?!\s*\[)/i);
  assert.match(full, /p_op_ids\s+BIGINT\[\]/i);
  assert.match(full, /p_command_id\s+UUID(?!\s+DEFAULT)/i);
  assert.match(full, /p_expected_active_revision_id\s+UUID\s+DEFAULT\s+NULL/i);
  assert.match(full, /RETURNS\s+JSONB/i);
  assert.match(full, /LANGUAGE\s+plpgsql/i);
  assert.match(full, /SECURITY\s+DEFINER/i);
  assert.match(full, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(full, /public\.is_admin\(\)/i);
  assert.match(full, /auth\.uid\(\)/i);
});

test('RPC registrar_vinculos_documento: locks, idempotencia, normalizacao', function () {
  const { body } = fnBlock('registrar_vinculos_documento');
  assert.match(body, /FOR\s+UPDATE/i, 'lock de linhas');
  assert.match(body, /pg_advisory_xact_lock/i, 'advisory lock por command_id');
  assert.match(body, /FROM\s+public\.document_candidates[\s\S]*FOR\s+UPDATE/i, 'candidate FOR UPDATE');
  assert.match(body, /array_agg\(x\s+ORDER\s+BY\s+x\)/i, 'normaliza ordem das OPs');
  assert.match(body, /duplicate_op/i, 'rejeita OP duplicada');
});

test('RPC registrar_vinculos_documento: outcomes bounded', function () {
  const { body } = fnBlock('registrar_vinculos_documento');
  const outcomes = [
    'created', 'updated', 'no_change', 'replayed',
    'active_revision_exists', 'stale_active_revision', 'command_conflict',
    'candidate_not_found', 'duplicate_op',
    'pedido_not_found', 'pedido_not_linkable',
    'op_not_found', 'op_not_linkable', 'op_pedido_mismatch', 'op_not_avulsa',
    'input_error', 'auth_error',
  ];
  for (const o of outcomes) {
    assert.match(body, new RegExp("'outcome',\\s*'" + o + "'", 'i'), 'outcome ' + o + ' presente');
  }
});

test('RPC registrar_vinculos_documento: compatibilidade Pedido/OP via lotes', function () {
  const { body } = fnBlock('registrar_vinculos_documento');
  // resolve OP->Pedido via lotes.pedido_id
  assert.match(body, /LEFT\s+JOIN\s+public\.lotes\s+l\s+ON\s+l\.id\s*=\s*o\.lote_id/i);
  // pedido cancelado / op cancelada fail-closed
  assert.match(body, /'cancelado'/i, 'checa Pedido cancelado');
  assert.match(body, /'cancelada'/i, 'checa OP cancelada');
  // pedido presente -> OP deve resolver ao mesmo pedido
  assert.match(body, /op_pedido_mismatch/i);
  // sem pedido -> OP deve ser avulsa
  assert.match(body, /op_not_avulsa/i);
});

test('RPC registrar_vinculos_documento: replay/no_change antes de qualquer INSERT', function () {
  const { body } = fnBlock('registrar_vinculos_documento');
  const firstInsert = body.indexOf('INSERT INTO public.document_link_revisions');
  assert.ok(firstInsert > 0, 'INSERT de revisao existe');
  const before = body.slice(0, firstInsert);
  assert.match(before, /'replayed'/i, 'replay antes do INSERT');
  assert.match(before, /'command_conflict'/i, 'conflict antes do INSERT');
  assert.match(before, /'no_change'/i, 'no_change antes do INSERT');
});

test('RPC registrar_vinculos_documento: revoga anterior sem apagar; nao deleta', function () {
  const { execBody } = fnBlock('registrar_vinculos_documento');
  assert.match(execBody, /UPDATE\s+public\.document_link_revisions\s+SET\s+active\s*=\s*FALSE[\s\S]*revoked_by\s*=\s*auth\.uid\(\)[\s\S]*revoked_at\s*=\s*now\(\)/i,
    'revoga revisao anterior');
  assert.doesNotMatch(execBody, /\bDELETE\b/i, 'sem DELETE (preserva auditoria)');
});

test('RPC registrar_vinculos_documento: NAO muta document_candidates nem usa pedido_manual', function () {
  const { execBody } = fnBlock('registrar_vinculos_documento');
  assert.doesNotMatch(execBody, /UPDATE\s+public\.document_candidates/i, 'nao muta candidate');
  assert.doesNotMatch(execBody, /INSERT\s+INTO\s+public\.document_candidates/i, 'nao insere candidate');
  assert.doesNotMatch(execBody, /pedido_manual/i, 'nao infere por pedido_manual');
  assert.doesNotMatch(execBody, /\bcnpj\b/i, 'nao infere por CNPJ');
  assert.doesNotMatch(execBody, /technical_evidence|\bevidence\b/i, 'nao infere por evidencia');
  // DML alvo restrito as tabelas de link
  const inserts = execBody.match(/INSERT\s+INTO\s+(\S+)/gi) || [];
  for (const ins of inserts) {
    assert.match(ins, /public\.document_link_revisions|public\.document_link_revision_ops/i,
      'INSERT apenas nas tabelas de link: ' + ins);
  }
  const updates = execBody.match(/\bUPDATE\s+(\S+)/gi) || [];
  for (const upd of updates) {
    assert.match(upd, /public\.document_link_revisions/i, 'UPDATE apenas em document_link_revisions: ' + upd);
  }
});

test('RPC registrar_decisao_e_vinculos_documento: composicao atomica', function () {
  const { full, body, execBody } = fnBlock('registrar_decisao_e_vinculos_documento');
  assert.match(full, /p_document_id\s+TEXT/i);
  assert.match(full, /p_pedido_id\s+UUID/i);
  assert.match(full, /p_op_ids\s+BIGINT\[\]/i);
  assert.match(full, /p_link_command_id\s+UUID/i);
  assert.match(full, /p_expected_active_revision_id\s+UUID/i);
  assert.match(full, /p_decision\s+TEXT/i);
  assert.match(full, /p_motivo\s+TEXT/i);
  assert.match(full, /p_decision_command_id\s+UUID/i);
  assert.match(full, /p_expected_active_decision_id\s+UUID\s+DEFAULT\s+NULL/i);
  assert.match(full, /SECURITY\s+DEFINER/i);
  assert.match(full, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);

  // compoe as duas funcoes canonicas
  assert.match(body, /public\.registrar_vinculos_documento\s*\(/i, 'chama registrar_vinculos_documento');
  assert.match(body, /public\.registrar_decisao_documento\s*\(/i, 'chama registrar_decisao_documento');
  // rollback via exception
  assert.match(body, /RAISE\s+EXCEPTION/i, 'aborta em falha para rollback atomico');
  assert.match(body, /EXCEPTION\s+WHEN\s+OTHERS\s+THEN/i, 'captura para retorno estruturado');
  // nao funde dados de vinculo em document_decisions
  assert.doesNotMatch(execBody, /INSERT\s+INTO\s+public\.document_decisions/i, 'nao insere em document_decisions');
  assert.doesNotMatch(execBody, /INSERT\s+INTO\s+public\.document_link_revisions/i, 'nao duplica regra de link');
  // is_admin guard
  assert.match(body, /public\.is_admin\(\)/i);
});

test('grants das RPCs: revoke PUBLIC/anon, grant authenticated, sem anon', function () {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento[\s\S]*FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento[\s\S]*FROM\s+anon/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento[\s\S]*TO\s+authenticated/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_decisao_e_vinculos_documento[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento[\s\S]*TO\s+anon/i);
});

test('migration 51: aditiva — sem DROP TABLE, sem tocar candidates/events/decisions schema', function () {
  assert.doesNotMatch(executableSql, /DROP\s+TABLE\b/i, 'sem DROP TABLE');
  // Nao altera colunas historicas de candidate/event/decision
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_candidates/i, 'nao altera document_candidates');
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_events/i, 'nao altera document_events');
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_decisions/i, 'nao altera document_decisions');
  // Nao redefine as RPCs canonicas de decisao nem a legada
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento\b/i, 'nao redefine registrar_decisao_documento');
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento\b/i, 'nao redefine desfazer_decisao_documento');
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento\b/i, 'nao redefine decidir_documento');
});

test('migration 51: exatamente duas novas RPCs e duas novas tabelas', function () {
  const rpcs = executableSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.\w+/gi) || [];
  assert.equal(rpcs.length, 2, 'exatamente duas RPCs novas');
  const tables = executableSql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.\w+/gi) || [];
  assert.equal(tables.length, 2, 'exatamente duas tabelas novas');
});

test('migration 51: notifica PostgREST', function () {
  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('baseline 38/39/50 inalteradas (gate de nao-regressao)', function () {
  const baselines = [
    { file: '38_documentos_schema.sql', markers: [/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_candidates/i, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento/i] },
    { file: '39_documentos_ingestor_state_undo.sql', markers: [/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento/i] },
    { file: '50_document_decision_command.sql', markers: [/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i] },
  ];
  for (const m of baselines) {
    const p = path.join(ROOT, 'db', m.file);
    assert.ok(fs.existsSync(p), 'migration ' + m.file + ' existe');
    const content = fs.readFileSync(p, 'utf8');
    for (const marker of m.markers) {
      assert.match(content, marker, m.file + ' contem marcador');
    }
  }
});
