const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '38_documentos_schema.sql');
const sql = readOrFail(SQL);
const executableSql = sql.replace(/--.*$/gm, '');

function readOrFail(file) {
  assert.ok(fs.existsSync(file), 'arquivo nao encontrado: ' + file);
  return fs.readFileSync(file, 'utf8');
}

function assertHas(pattern, message) {
  assert.match(sql, pattern, message);
}

function assertNot(pattern, message) {
  assert.doesNotMatch(sql, pattern, message);
}

function blockFrom(startPattern, maxChars = 5000) {
  const match = sql.match(startPattern);
  assert.ok(match, 'bloco nao encontrado: ' + startPattern);
  return sql.slice(match.index, match.index + maxChars);
}

test('arquivo de migration existe e usa numero 38', () => {
  assert.ok(fs.existsSync(SQL));
  assertHas(/RAVATEX-DOCUMENTS-G23-B-B-DOCUMENTS-SCHEMA-MIGRATION-PATCH/i);
  assertHas(/Nao aplicar nesta fase/i);
});

test('cria as quatro tabelas de documentos', () => {
  for (const table of [
    'document_candidates',
    'document_events',
    'document_decisions',
    'document_scan_runs',
  ]) {
    assertHas(new RegExp('CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.' + table, 'i'));
    assertHas(new RegExp('ALTER\\s+TABLE\\s+public\\.' + table + '\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY', 'i'));
    assertHas(new RegExp('COMMENT\\s+ON\\s+TABLE\\s+public\\.' + table, 'i'));
  }
});

test('document_candidates preserva document_id e usa FKs/tipos reais', () => {
  const block = blockFrom(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_candidates/i, 3500);
  assert.match(block, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(block, /document_id\s+TEXT\s+NOT\s+NULL/i);
  assert.match(block, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i);
  assert.match(block, /pedido_id\s+UUID\s+REFERENCES\s+public\.pedidos\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(block, /fornecedor_id\s+BIGINT\s+REFERENCES\s+public\.fornecedores\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(block, /raw_payload\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  assert.match(block, /criado_em\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  assert.match(block, /atualizado_em\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  assertHas(/ADD\s+CONSTRAINT\s+document_candidates_document_id_key\s+UNIQUE\s*\(\s*document_id\s*\)/i);
});

test('document_candidates tem checks e indices minimos', () => {
  assertHas(/document_candidates_status_check[\s\S]*status\s+IN\s*\(\s*'pending'\s*,\s*'assigned'\s*,\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  assertHas(/document_candidates_rejected_reason_check[\s\S]*status\s*<>\s*'rejected'[\s\S]*rejected_reason/i);
  for (const idx of [
    'document_candidates_pedido_idx',
    'document_candidates_fornecedor_idx',
    'document_candidates_status_idx',
    'document_candidates_sha256_idx',
    'document_candidates_gmail_message_idx',
  ]) {
    assertHas(new RegExp('CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+' + idx, 'i'));
  }
});

test('document_events preserva ingestion_event_id e eventos permitidos', () => {
  const block = blockFrom(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_events/i, 2500);
  assert.match(block, /document_id\s+TEXT\s+NOT\s+NULL/i);
  assert.match(block, /ingestion_event_id\s+TEXT\s+NOT\s+NULL/i);
  assert.match(block, /pedido_id\s+UUID\s+REFERENCES\s+public\.pedidos\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(block, /payload\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  assertHas(/ADD\s+CONSTRAINT\s+document_events_ingestion_event_id_key\s+UNIQUE\s*\(\s*ingestion_event_id\s*\)/i);
  assertHas(/document_events_event_type_check[\s\S]*'document\.detected'[\s\S]*'document\.linked'[\s\S]*'document\.accepted'[\s\S]*'document\.rejected'/i);
  assertHas(/document_events_status_check[\s\S]*status\s+IS\s+NULL\s+OR\s+status\s+IN\s*\(\s*'pending'\s*,\s*'assigned'\s*,\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  assertHas(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_events_document_criado_idx\s+ON\s+public\.document_events\s*\(\s*document_id\s*,\s*criado_em\s+DESC\s*\)/i);
});

test('document_decisions modela uma decisao ativa por documento', () => {
  const block = blockFrom(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_decisions/i, 2500);
  assert.match(block, /document_id\s+TEXT\s+NOT\s+NULL/i);
  assert.match(block, /status\s+TEXT\s+NOT\s+NULL/i);
  assert.match(block, /ativo\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  assert.match(block, /decidido_por\s+UUID\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(block, /source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'manual'/i);
  assertHas(/document_decisions_status_check[\s\S]*status\s+IN\s*\(\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  assertHas(/document_decisions_source_check[\s\S]*source\s+IN\s*\(\s*'manual'\s*,\s*'auto'\s*,\s*'migration'\s*\)/i);
  assertHas(/document_decisions_rejected_motivo_check[\s\S]*status\s*<>\s*'rejected'[\s\S]*motivo/i);
  assertHas(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_decisions_active_uidx[\s\S]*WHERE\s+ativo\s+IS\s+TRUE/i);
});

test('document_scan_runs impede scan concorrente por source', () => {
  const block = blockFrom(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_scan_runs/i, 2500);
  assert.match(block, /source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'gmail'/i);
  assert.match(block, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'running'/i);
  assert.match(block, /documents_processed\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assert.match(block, /documents_new\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assertHas(/document_scan_runs_status_check[\s\S]*status\s+IN\s*\(\s*'running'\s*,\s*'completed'\s*,\s*'failed'\s*\)/i);
  assertHas(/document_scan_runs_documents_processed_check[\s\S]*documents_processed\s*>=\s*0/i);
  assertHas(/document_scan_runs_documents_new_check[\s\S]*documents_new\s*>=\s*0/i);
  assertHas(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_scan_runs_running_source_uidx[\s\S]*WHERE\s+status\s*=\s*'running'/i);
});

test('RLS e policies sao admin-only', () => {
  for (const table of [
    'document_candidates',
    'document_events',
    'document_decisions',
    'document_scan_runs',
  ]) {
    assertHas(new RegExp('DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+' + table + '_admin_all\\s+ON\\s+public\\.' + table, 'i'));
    assertHas(new RegExp('CREATE\\s+POLICY\\s+' + table + '_admin_all\\s+ON\\s+public\\.' + table + '[\\s\\S]*FOR\\s+ALL[\\s\\S]*USING\\s*\\(public\\.is_admin\\(\\)\\)[\\s\\S]*WITH\\s+CHECK\\s*\\(public\\.is_admin\\(\\)\\)', 'i'));
  }
  assertNot(/CREATE\s+POLICY[\s\S]{0,160}(fornecedor|cliente)/i, 'nao deve criar policy fornecedor/cliente nesta fase');
});

test('grants sao para authenticated e nao expoem anon', () => {
  for (const table of [
    'document_candidates',
    'document_events',
    'document_decisions',
    'document_scan_runs',
  ]) {
    assertHas(new RegExp('REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.' + table + '\\s+FROM\\s+anon', 'i'));
    assertHas(new RegExp('GRANT\\s+SELECT\\s*,\\s*INSERT\\s*,\\s*UPDATE\\s*,\\s*DELETE\\s+ON\\s+TABLE\\s+public\\.' + table + '\\s+TO\\s+authenticated', 'i'));
    assertNot(new RegExp('GRANT\\s+[^;]*(INSERT|UPDATE|DELETE)[^;]*public\\.' + table + '[^;]*TO\\s+anon', 'i'));
  }
});

test('RPC decidir_documento segue contrato minimo', () => {
  const block = blockFrom(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento/i, 7000);
  assert.match(block, /p_document_id\s+TEXT/i);
  assert.match(block, /p_status\s+TEXT/i);
  assert.match(block, /p_motivo\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(block, /RETURNS\s+JSONB/i);
  assert.match(block, /SECURITY\s+DEFINER/i);
  assert.match(block, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(block, /IF\s+NOT\s+public\.is_admin\(\)\s+THEN/i);
  assert.match(block, /v_status\s+NOT\s+IN\s*\(\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  assert.match(block, /v_status\s*=\s*'rejected'[\s\S]*v_motivo\s+IS\s+NULL/i);
  assert.match(block, /UPDATE\s+public\.document_decisions[\s\S]*SET\s+ativo\s*=\s*FALSE[\s\S]*document_id\s*=\s*v_document_id/i);
  assert.match(block, /INSERT\s+INTO\s+public\.document_decisions/i);
  assert.match(block, /auth\.uid\(\)/i);
  assert.match(block, /UPDATE\s+public\.document_candidates[\s\S]*status\s*=\s*v_status[\s\S]*accepted_at[\s\S]*rejected_at[\s\S]*rejected_reason/i);
  assert.match(block, /jsonb_build_object\([\s\S]*'ok'\s*,\s*TRUE[\s\S]*'document_id'[\s\S]*'status'/i);
});

test('RPCs de scan validam concorrencia e finalizacao', () => {
  const startBlock = blockFrom(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.iniciar_document_scan_run/i, 6500);
  assert.match(startBlock, /SECURITY\s+DEFINER/i);
  assert.match(startBlock, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(startBlock, /IF\s+NOT\s+public\.is_admin\(\)\s+THEN/i);
  assert.match(startBlock, /status\s*=\s*'running'/i);
  assert.match(startBlock, /scan_already_running/i);
  assert.match(startBlock, /WHEN\s+unique_violation\s+THEN/i);
  assert.match(startBlock, /INSERT\s+INTO\s+public\.document_scan_runs\s*\(\s*source\s*,\s*triggered_by\s*\)/i);

  const finishBlock = blockFrom(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finalizar_document_scan_run/i, 6500);
  assert.match(finishBlock, /SECURITY\s+DEFINER/i);
  assert.match(finishBlock, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(finishBlock, /IF\s+NOT\s+public\.is_admin\(\)\s+THEN/i);
  assert.match(finishBlock, /v_status\s+NOT\s+IN\s*\(\s*'completed'\s*,\s*'failed'\s*\)/i);
  assert.match(finishBlock, /v_documents_processed\s*<\s*0\s+OR\s+v_documents_new\s*<\s*0/i);
  assert.match(finishBlock, /UPDATE\s+public\.document_scan_runs[\s\S]*finished_at\s*=\s*now\(\)[\s\S]*status\s*=\s*'running'/i);
});

test('RPCs tem grants somente para authenticated', () => {
  for (const signature of [
    'decidir_documento\\(TEXT, TEXT, TEXT\\)',
    'iniciar_document_scan_run\\(TEXT, TEXT\\)',
    'finalizar_document_scan_run\\(UUID, TEXT, INTEGER, INTEGER, TEXT\\)',
  ]) {
    assertHas(new RegExp('REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.' + signature + '\\s+FROM\\s+PUBLIC', 'i'));
    assertHas(new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + signature + '\\s+TO\\s+authenticated', 'i'));
    assertNot(new RegExp('GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.' + signature + '\\s+TO\\s+anon', 'i'));
  }
});

test('migration nao cria FKs adiadas nem toca integrações fora de escopo', () => {
  assertNot(/REFERENCES\s+public\.(ops|entregas|expedicoes|expedicao_movimentos|expedicao_itens|pedido_itens)\b/i);
  assert.doesNotMatch(
    executableSql,
    /\b(edge\s+function|gmail\s+api|drive\s+api|scheduler|documents-ingestor|localStorage)\b/i
  );
});

test('migration evita comandos destrutivos e secrets', () => {
  assertNot(/^\s*DELETE\s+FROM\b/im);
  assertNot(/^\s*TRUNCATE\b/im);
  assertNot(/^\s*DROP\s+TABLE\b/im);
  assertNot(/service_role/i);
  assertNot(/SUPABASE_SERVICE_ROLE_KEY/i);
  assertNot(/postgres:\/\/|password\s*[:=]|eyJ[A-Za-z0-9_-]{10,}\.eyJ/i);
});

test('reload do PostgREST segue padrao do repo', () => {
  assertHas(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  assertHas(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});
