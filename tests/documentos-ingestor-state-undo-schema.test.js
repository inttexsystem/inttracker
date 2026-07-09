const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '39_documentos_ingestor_state_undo.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');

function has(pattern, message) {
  assert.match(sql, pattern, message);
}

function lacks(pattern, message) {
  assert.doesNotMatch(sql, pattern, message);
}

function block(start, maxChars) {
  const match = sql.match(start);
  assert.ok(match, 'bloco nao encontrado');
  return sql.slice(match.index, match.index + maxChars);
}

test('migration 39 cria base canonica completa em document_candidates', function () {
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_status\s+TEXT/i);
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_state_at\s+TIMESTAMPTZ/i);
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_event_id\s+TEXT/i);
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_rejected_reason\s+TEXT/i);
  has(/document_candidates_ingestor_status_check[\s\S]*ingestor_status\s+IS\s+NULL\s+OR\s+ingestor_status\s+IN\s*\(\s*'pending'\s*,\s*'assigned'\s*,\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  has(/document_candidates_ingestor_base_complete_check[\s\S]*ingestor_status\s+IS\s+NULL[\s\S]*ingestor_state_at\s+IS\s+NULL[\s\S]*ingestor_event_id\s+IS\s+NULL[\s\S]*ingestor_status\s+IS\s+NOT\s+NULL[\s\S]*ingestor_state_at\s+IS\s+NOT\s+NULL[\s\S]*ingestor_event_id\s+IS\s+NOT\s+NULL/i);
  has(/document_candidates_ingestor_rejected_reason_check[\s\S]*ingestor_status\s*=\s*'rejected'[\s\S]*ingestor_rejected_reason[\s\S]*ingestor_status\s+IS\s+DISTINCT\s+FROM\s*'rejected'[\s\S]*ingestor_rejected_reason\s+IS\s+NULL/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_candidates_ingestor_event_idx[\s\S]*ingestor_event_id/i);
  lacks(/CREATE\s+UNIQUE\s+INDEX[\s\S]*ingestor_event_id/i, 'nao assume unicidade no backfill legado');
});

test('migration 39 adiciona auditoria de revogacao sem decisao pending', function () {
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+revogada_em\s+TIMESTAMPTZ/i);
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+revogada_por\s+UUID\s+REFERENCES\s+auth\.users\(id\)/i);
  has(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+revogada_motivo\s+TEXT/i);
  has(/document_decisions_revogada_ativa_check[\s\S]*revogada_em\s+IS\s+NOT\s+NULL[\s\S]*ativo\s+IS\s+FALSE/i);
  lacks(/INSERT\s+INTO\s+public\.document_decisions[\s\S]{0,250}['"]pending['"]/i, 'undo nao cria decisao pending');
});

test('RPC desfazer revoga decisao e restaura somente base canonica', function () {
  const undo = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento/i, 7600);
  assert.match(undo, /p_document_id\s+TEXT/i);
  assert.match(undo, /p_motivo\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(undo, /SECURITY\s+DEFINER/i);
  assert.match(undo, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(undo, /admin_required/i);
  assert.match(undo, /candidate_not_found/i);
  assert.match(undo, /no_active_decision/i);
  assert.match(undo, /base_status_unavailable/i);
  assert.match(undo, /FROM\s+public\.document_candidates[\s\S]*FOR\s+UPDATE/i);
  assert.match(undo, /FROM\s+public\.document_decisions[\s\S]*ativo\s+IS\s+TRUE[\s\S]*FOR\s+UPDATE/i);
  assert.match(undo, /SET\s+ativo\s*=\s*FALSE[\s\S]*revogada_em\s*=\s*now\(\)[\s\S]*revogada_por\s*=\s*auth\.uid\(\)/i);
  assert.match(undo, /SET\s+status\s*=\s*v_candidate\.ingestor_status/i);
  assert.match(undo, /restored_status/i);
  assert.match(undo, /revoked_decision_id/i);
});

test('grants do undo excluem anon e writer exclui browser', function () {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.desfazer_decisao_documento\(TEXT,\s*TEXT\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.desfazer_decisao_documento\(TEXT,\s*TEXT\)\s+FROM\s+anon/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.desfazer_decisao_documento\(TEXT,\s*TEXT\)\s+TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.desfazer_decisao_documento\(TEXT,\s*TEXT\)\s+TO\s+anon/i);
  has(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state/i);
  has(/auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state[\s\S]*FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state[\s\S]*FROM\s+authenticated/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state[\s\S]*TO\s+service_role/i);
});

test('writer atomico atualiza base e preserva estado efetivo com decisao ativa', function () {
  const writer = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state/i, 12000);
  assert.match(writer, /ingestor_status\s*=\s*v_status/i);
  assert.match(writer, /ingestor_state_at\s*=\s*p_ingestor_state_at/i);
  assert.match(writer, /ingestor_event_id\s*=\s*v_event_id/i);
  assert.match(writer, /ingestor_rejected_reason\s*=\s*v_reason/i);
  assert.match(writer, /v_active_decision_id\s+IS\s+NULL\s+THEN\s+v_status/i);
  assert.match(writer, /WHEN\s+v_active_decision_id\s+IS\s+NOT\s+NULL\s+THEN\s+accepted_at/i);
  assert.match(writer, /WHEN\s+v_active_decision_id\s+IS\s+NOT\s+NULL\s+THEN\s+rejected_reason/i);
  assert.match(writer, /SELECT\s+id,\s*status,\s*motivo,\s*decidido_em/i);
  assert.match(writer, /WHEN\s+v_active_status\s*=\s*'rejected'\s+THEN\s+v_active_motivo/i);
  lacks(/INSERT\s+INTO\s+public\.document_decisions/i, 'writer nao cria decisoes');
});

test('migration deixa backfill como diagnostico conservador e recarrega PostgREST', function () {
  has(/Nao\s+ha\s+backfill\s+automatico/i);
  has(/base_status_unavailable/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});
