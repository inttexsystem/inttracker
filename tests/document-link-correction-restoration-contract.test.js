'use strict';

// =====================================================================
// === tests/document-link-correction-restoration-contract.test.js =====
// Static contract test for the G28-B8 migration db/52. Asserts the
// additive evolution of the single canonical link writer (reason +
// restored_from provenance) and the restoration RPC that reuses it,
// without a live database (regex over the migration text, like the
// db/51 contract test).
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '52_document_link_correction_revocation_restoration.sql');

// Throws if the file doesn't exist — clear RED signal.
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/--.*$/gm, '');

function has(pattern, message) { assert.match(sql, pattern, message); }
function lacks(pattern, message) { assert.doesNotMatch(sql, pattern, message); }

function fnBlock(name) {
  const re = new RegExp(
    'CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.' + name + '[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$'
  );
  const m = sql.match(re);
  assert.ok(m, 'funcao ' + name + ' encontrada');
  return { full: m[0], body: m[1], execBody: m[1].replace(/--.*$/gm, '') };
}

test('migration 52 header: versionada, aditiva, staging-only, sem secrets/backfill', function () {
  has(/RAVATEX-DOCUMENTS-G28-B8/i);
  has(/staging\s+ucrjtfswnfdlxwtmxnoo/i, 'declara staging alvo');
  has(/bhgifjrfagkzubpyqpew[\s\S]*?proibida/i, 'declara producao proibida');
  has(/sem\s+backfill/i);
  has(/sem\s+DROP\s+TABLE/i);
  has(/sem\s+secrets/i);
});

test('migration 52: coluna aditiva restored_from_revision_id + FK + indice', function () {
  has(/ALTER\s+TABLE\s+public\.document_link_revisions\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+restored_from_revision_id\s+UUID/i);
  has(/document_link_revisions_restored_from_fkey[\s\S]*REFERENCES\s+public\.document_link_revisions\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_link_revisions_restored_from_idx/i);
  has(/COMMENT\s+ON\s+COLUMN\s+public\.document_link_revisions\.restored_from_revision_id/i);
});

test('migration 52: evolui a assinatura do escritor unico (DROP + recreate)', function () {
  // Drops exactly the old 5-arg signature and recreates the writer.
  has(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.registrar_vinculos_documento\(TEXT,\s*UUID,\s*BIGINT\[\],\s*UUID,\s*UUID\)/i);
  const { full } = fnBlock('registrar_vinculos_documento');
  assert.match(full, /p_document_id\s+TEXT/i);
  assert.match(full, /p_pedido_id\s+UUID/i);
  assert.match(full, /p_op_ids\s+BIGINT\[\]/i);
  assert.match(full, /p_command_id\s+UUID/i);
  assert.match(full, /p_expected_active_revision_id\s+UUID\s+DEFAULT\s+NULL/i);
  assert.match(full, /p_reason\s+TEXT\s+DEFAULT\s+NULL/i, 'novo parametro p_reason default null');
  assert.match(full, /p_restored_from_revision_id\s+UUID\s+DEFAULT\s+NULL/i, 'novo parametro p_restored_from default null');
  assert.match(full, /SECURITY\s+DEFINER/i);
  assert.match(full, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
});

test('registrar_vinculos_documento: reason grava revocation_reason; restored_from carimbado', function () {
  const { body, execBody } = fnBlock('registrar_vinculos_documento');
  // reason -> revocation_reason of the superseded revision, defaulting to 'superseded'
  assert.match(body, /revocation_reason\s*=\s*COALESCE\(\s*v_reason\s*,\s*'superseded'\s*\)/i);
  // restored_from column present in BOTH inserts (replace branch + first-revision branch)
  const inserts = execBody.match(/INSERT\s+INTO\s+public\.document_link_revisions\s*\([\s\S]*?\)\s*VALUES/gi) || [];
  assert.equal(inserts.length, 2, 'dois INSERTs de revisao (replace + primeira)');
  for (const ins of inserts) {
    assert.match(ins, /restored_from_revision_id/i, 'INSERT carimba restored_from_revision_id');
  }
  assert.match(execBody, /v_restored_from\s+UUID\s*:=\s*p_restored_from_revision_id/i);
  assert.match(execBody, /v_reason\s+TEXT\s*:=\s*NULLIF\(btrim\(p_reason\)/i);
});

test('registrar_vinculos_documento: preserva revogacao sem apagar e mantem outcomes', function () {
  const { body, execBody } = fnBlock('registrar_vinculos_documento');
  assert.match(execBody, /UPDATE\s+public\.document_link_revisions\s+SET\s+active\s*=\s*FALSE[\s\S]*revoked_by\s*=\s*auth\.uid\(\)/i);
  assert.doesNotMatch(execBody, /\bDELETE\b/i, 'sem DELETE (preserva auditoria append-only)');
  // Bounded outcomes preserved from B6.
  const outcomes = [
    'created', 'updated', 'no_change', 'replayed',
    'active_revision_exists', 'stale_active_revision', 'command_conflict',
    'candidate_not_found', 'duplicate_op', 'pedido_not_found', 'pedido_not_linkable',
    'op_not_found', 'op_not_linkable', 'op_pedido_mismatch', 'op_not_avulsa',
    'input_error', 'auth_error',
  ];
  for (const o of outcomes) {
    assert.match(body, new RegExp("'outcome',\\s*'" + o + "'", 'i'), 'outcome ' + o + ' presente');
  }
});

test('registrar_vinculos_documento: NAO muta candidate/decision nem infere vinculo', function () {
  const { execBody } = fnBlock('registrar_vinculos_documento');
  assert.doesNotMatch(execBody, /UPDATE\s+public\.document_candidates/i);
  assert.doesNotMatch(execBody, /INSERT\s+INTO\s+public\.document_candidates/i);
  assert.doesNotMatch(execBody, /UPDATE\s+public\.document_decisions/i);
  assert.doesNotMatch(execBody, /pedido_manual/i, 'nao infere por pedido_manual');
  assert.doesNotMatch(execBody, /\bcnpj\b/i, 'nao infere por CNPJ');
  const inserts = execBody.match(/INSERT\s+INTO\s+(\S+)/gi) || [];
  for (const ins of inserts) {
    assert.match(ins, /public\.document_link_revisions|public\.document_link_revision_ops/i,
      'INSERT apenas nas tabelas de link: ' + ins);
  }
});

test('restaurar_vinculos_documento: assinatura e seguranca', function () {
  const { full } = fnBlock('restaurar_vinculos_documento');
  assert.match(full, /p_document_id\s+TEXT/i);
  assert.match(full, /p_source_revision_id\s+UUID/i);
  assert.match(full, /p_command_id\s+UUID/i);
  assert.match(full, /p_expected_active_revision_id\s+UUID\s+DEFAULT\s+NULL/i);
  assert.match(full, /p_reason\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(full, /RETURNS\s+JSONB/i);
  assert.match(full, /LANGUAGE\s+plpgsql/i);
  assert.match(full, /SECURITY\s+DEFINER/i);
  assert.match(full, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(full, /public\.is_admin\(\)/i);
});

test('restaurar_vinculos_documento: le origem read-only e delega ao escritor unico', function () {
  const { body, execBody } = fnBlock('restaurar_vinculos_documento');
  // Reads the historical source revision.
  assert.match(body, /SELECT\s+\*\s+INTO\s+v_source[\s\S]*FROM\s+public\.document_link_revisions[\s\S]*WHERE\s+id\s*=\s*p_source_revision_id/i);
  // Copies the normalized OP set of the source.
  assert.match(body, /array_agg\(op_id\s+ORDER\s+BY\s+op_id\)[\s\S]*FROM\s+public\.document_link_revision_ops[\s\S]*WHERE\s+revision_id\s*=\s*v_source\.id/i);
  // Delegates to the single canonical writer, passing source pedido/ops + provenance.
  assert.match(body, /public\.registrar_vinculos_documento\s*\([\s\S]*v_source\.pedido_id[\s\S]*v_source_op_ids[\s\S]*v_source\.id\s*\)/i);
  // Restoration itself performs NO direct write to the revision tables and never
  // mutates the historical row (single-writer; no duplicated compatibility logic).
  assert.doesNotMatch(execBody, /INSERT\s+INTO\s+public\.document_link_revision/i, 'restauracao nao insere diretamente');
  assert.doesNotMatch(execBody, /UPDATE\s+public\.document_link_revision/i, 'restauracao nao muta linhas de revisao');
  assert.doesNotMatch(execBody, /\bDELETE\b/i, 'restauracao nunca apaga');
  assert.doesNotMatch(execBody, /LEFT\s+JOIN\s+public\.lotes/i, 'nao duplica a logica de compatibilidade Pedido/OP');
});

test('restaurar_vinculos_documento: outcomes de origem e proveniencia', function () {
  const { body } = fnBlock('restaurar_vinculos_documento');
  assert.match(body, /restore_source_not_found/i, 'origem inexistente rejeitada');
  assert.match(body, /restore_source_mismatch/i, 'origem de outro documento rejeitada');
  assert.match(body, /v_source\.document_id\s+IS\s+DISTINCT\s+FROM\s+v_document_id/i, 'valida documento da origem');
  // Annotates the response with the restored source revision.
  assert.match(body, /jsonb_build_object\(\s*'restored_from_revision_id'\s*,\s*v_source\.id\s*\)/i);
});

test('grants das RPCs: revoke PUBLIC/anon, grant authenticated, sem anon', function () {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento\(TEXT,\s*UUID,\s*BIGINT\[\],\s*UUID,\s*UUID,\s*TEXT,\s*UUID\)[\s\S]*FROM\s+PUBLIC/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_vinculos_documento\(TEXT,\s*UUID,\s*BIGINT\[\],\s*UUID,\s*UUID,\s*TEXT,\s*UUID\)[\s\S]*TO\s+authenticated/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.restaurar_vinculos_documento[\s\S]*FROM\s+PUBLIC/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.restaurar_vinculos_documento[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.restaurar_vinculos_documento[\s\S]*TO\s+anon/i);
});

test('migration 52: aditiva — sem DROP TABLE, sem tocar candidates/events/decisions', function () {
  assert.doesNotMatch(executableSql, /DROP\s+TABLE\b/i, 'sem DROP TABLE');
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_candidates/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_events/i);
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE\s+public\.document_decisions/i);
  // Does not redefine the B5 decision RPCs nor the legacy one.
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento\b/i);
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento\b/i);
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento\b/i);
  // Only the canonical link writer signature is dropped (function, not table/data).
  const drops = executableSql.match(/DROP\s+FUNCTION[^;]*/gi) || [];
  assert.equal(drops.length, 1, 'exatamente um DROP FUNCTION (evolucao de assinatura)');
  assert.match(drops[0], /registrar_vinculos_documento/i);
});

test('migration 52: exatamente duas RPCs redefinidas e notifica PostgREST', function () {
  const rpcs = executableSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.\w+/gi) || [];
  assert.equal(rpcs.length, 2, 'registrar_vinculos_documento (evoluida) + restaurar_vinculos_documento');
  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('baseline 51 inalterada (gate de nao-regressao): db/52 nao reescreve db/51', function () {
  const p51 = path.join(ROOT, 'db', '51_document_canonical_links.sql');
  assert.ok(fs.existsSync(p51), 'db/51 existe');
  const s51 = fs.readFileSync(p51, 'utf8');
  // db/51 keeps its original 5-arg signature (historical migration, untouched).
  assert.match(s51, /p_expected_active_revision_id\s+UUID\s+DEFAULT\s+NULL\s*\)/i);
  assert.doesNotMatch(s51, /p_restored_from_revision_id/i, 'db/51 nao contem o parametro B8');
  assert.doesNotMatch(s51, /restaurar_vinculos_documento/i, 'db/51 nao contem a RPC de restauracao');
});
