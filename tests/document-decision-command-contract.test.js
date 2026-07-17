const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '50_document_decision_command.sql');

// This will throw if file doesn't exist — clear RED signal
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/--.*$/gm, '');

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

test('migration 50 header: versioned, unapplied, no scope creep', function () {
  has(/RAVATEX-DOCUMENTS-G28-B5-B1/i);
  has(/Nao aplicar nesta fase/i);
  has(/Sem apply, sem dados reais, sem secrets/i);
  has(/Sem alteracoes B6\/B8/i, 'header declara sem B6/B8');
});

test('migration 50 adiciona command_id UUID nullable a document_decisions', function () {
  has(/ALTER\s+TABLE\s+public\.document_decisions\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+command_id\s+UUID/i);

  const alters = sql.match(/ALTER\s+TABLE\s+public\.document_decisions\s+ADD\s+COLUMN/g);
  assert.equal(alters ? alters.length : 0, 1, 'apenas um ADD COLUMN em document_decisions');

  const alterBlock = sql.slice(sql.indexOf('ALTER TABLE'), sql.indexOf('CREATE UNIQUE INDEX'));
  assert.doesNotMatch(alterBlock, /NOT\s+NULL/i, 'command_id nao pode ter NOT NULL');
  assert.doesNotMatch(alterBlock, /DEFAULT\b/i, 'command_id nao pode ter DEFAULT');
});

test('migration 50: partial unique index sobre command_id nao-nulo preserva active_uidx', function () {
  has(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_decisions_command_id_uidx[\s\S]*WHERE\s+command_id\s+IS\s+NOT\s+NULL/i);

  const db38 = fs.readFileSync(path.join(ROOT, 'db', '38_documentos_schema.sql'), 'utf8');
  assert.match(db38, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_decisions_active_uidx[\s\S]*WHERE\s+ativo\s+IS\s+TRUE/i,
    'indice active_uidx existente em 38 deve ser preservado');
});

test('RPC registrar_decisao_documento existe com assinatura e seguranca corretas', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 8000);

  assert.match(rpc, /p_document_id\s+TEXT/i);
  assert.match(rpc, /p_decision\s+TEXT/i);
  assert.match(rpc, /p_motivo\s+TEXT(?!\s+DEFAULT)/i);
  assert.match(rpc, /p_command_id\s+UUID(?!\s+DEFAULT)/i);
  assert.match(rpc, /p_expected_active_decision_id\s+UUID\s+DEFAULT\s+NULL/i);
  assert.match(rpc, /RETURNS\s+JSONB/i);
  assert.match(rpc, /LANGUAGE\s+plpgsql/i);
  assert.match(rpc, /SECURITY\s+DEFINER/i);
  assert.match(rpc, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(rpc, /public\.is_admin\(\)/i);
  assert.match(rpc, /auth\.uid\(\)/i);
  assert.match(rpc, /admin_required/i);

  assert.doesNotMatch(rpc, /p_actor\b/i, 'nao aceita actor');
  assert.doesNotMatch(rpc, /p_timestamp\b|p_decidido_em\b/i, 'nao aceita timestamp');
  assert.doesNotMatch(rpc, /p_source\b/i, 'nao aceita source');
});

test('RPC valida e normaliza inputs', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 8000);

  assert.match(rpc, /lower\(NULLIF\(btrim\(p_decision/i, 'normaliza decision');
  assert.match(rpc, /NULLIF\(btrim\(p_motivo/i, 'normaliza motivo');
  assert.match(rpc, /NULLIF\(btrim\(p_document_id/i, 'normaliza document_id');

  assert.match(rpc, /NOT\s+IN\s*\(\s*'accepted'\s*,\s*'rejected'\s*\)/i);
  assert.match(rpc, /invalid_decision/i);

  assert.match(rpc, /'rejected'[\s\S]*motivo_required/i);
  assert.match(rpc, /'accepted'[\s\S]*v_motivo\s*:=\s*NULL/i);

  assert.match(rpc, /command_id_required/i);
});

test('RPC: advisory lock, candidate FOR UPDATE, seis outcomes', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);

  assert.match(rpc, /pg_advisory_xact_lock/i, 'advisory lock para command_id');

  assert.match(rpc, /FROM\s+public\.document_candidates[\s\S]*FOR\s+UPDATE/i);
  assert.match(rpc, /candidate_not_found/i);

  assert.match(rpc, /'replayed'/i);
  assert.match(rpc, /'command_conflict'/i);
  assert.match(rpc, /'active_decision_exists'/i);
  assert.match(rpc, /'stale_active_decision'/i);
  assert.match(rpc, /'created'/i);

  const outcomes = sql.match(/'candidate_not_found'/g);
  assert.ok(outcomes, 'candidate_not_found presente');
});

test('RPC: replay idempotente sem writes, command_conflict sem mutacao', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);

  assert.match(rpc, /'replayed'\s*,\s*TRUE/i);
  assert.match(rpc, /'command_conflict'/i);

  assert.match(rpc, /replayed[\s\S]*?'ok', TRUE[\s\S]*?replayed[\s\S]*?END IF[\s\S]*?command_conflict/i,
    'replay retorna imediatamente antes de command_conflict');

  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const body = bodyMatch[1];

  const beforeInsert = body.slice(0, body.indexOf('INSERT'));
  assert.match(beforeInsert, /'replayed'\s*,\s*TRUE/i,
    'replay branch existe antes do INSERT');
  assert.match(beforeInsert, /'command_conflict'/i,
    'command_conflict branch existe antes do INSERT');
  assert.match(beforeInsert, /'active_decision_exists'/i,
    'active_decision_exists existe antes do INSERT');
  assert.match(beforeInsert, /'stale_active_decision'/i,
    'stale_active_decision existe antes do INSERT');
});

test('RPC: active decision FOR UPDATE com expected_active_decision_id', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);

  assert.match(rpc, /FROM\s+public\.document_decisions[\s\S]*ativo\s+IS\s+TRUE[\s\S]*FOR\s+UPDATE/i);

  assert.match(rpc, /active_decision_exists/i);
  assert.match(rpc, /stale_active_decision/i);
});

test('RPC: created insere decisao ativa e atualiza candidate', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);

  assert.match(rpc, /INSERT\s+INTO\s+public\.document_decisions[\s\S]*command_id/i);
  assert.match(rpc, /UPDATE\s+public\.document_candidates[\s\S]*accepted_at[\s\S]*rejected_at[\s\S]*rejected_reason/i);
  assert.match(rpc, /atualizado_em\s*=\s*now\(\)/i);
  assert.match(rpc, /'created'/i);

  assert.doesNotMatch(rpc, /SET\s+ativo\s*=\s*FALSE/i, 'nao desativa decisoes existentes');
});

test('RPC: resultado contem todos os campos operacionais', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);

  assert.match(rpc, /\boutcome\b/i);
  assert.match(rpc, /\bcommand_id\b/i);
  assert.match(rpc, /\bdecision_id\b/i);
  assert.match(rpc, /\bactive_decision_id\b/i);
  assert.match(rpc, /\bdecision_status\b/i);
  assert.match(rpc, /\bcandidate_status\b/i);
  assert.match(rpc, /\breplayed\b/i);
  assert.match(rpc, /\bok\b/i);
});

test('grants: revoke PUBLIC e anon, grant authenticated', function () {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.registrar_decisao_documento[\s\S]*FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.registrar_decisao_documento[\s\S]*FROM\s+anon/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_decisao_documento[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.registrar_decisao_documento[\s\S]*TO\s+anon/i);
});

test('RPC body sem vocabulario proibido (dominio B5-B1)', function () {
  const rpcMatch = sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento[\s\S]*?\$\$/);
  assert.ok(rpcMatch, 'RPC encontrado');
  const rpcBody = rpcMatch[0].replace(/--.*$/gm, '');

  assert.doesNotMatch(rpcBody, /\bpedido_id\b/i, 'sem pedido_id');
  assert.doesNotMatch(rpcBody, /\bop_id\b/i, 'sem op_id');
  assert.doesNotMatch(rpcBody, /\bpedido_manual\b/i, 'sem pedido_manual');
  assert.doesNotMatch(rpcBody, /\bcnpj\b/i, 'sem CNPJ');
  assert.doesNotMatch(rpcBody, /\bduplicate\b/i, 'sem duplicate');
  assert.doesNotMatch(rpcBody, /\btechnical_evidence\b|\bevidence\b/i, 'sem evidence');
  assert.doesNotMatch(rpcBody, /\blocalStorage\b/i, 'sem localStorage');
  assert.doesNotMatch(rpcBody, /\bstatusOverrides\b/i, 'sem statusOverrides');
  assert.doesNotMatch(rpcBody, /\bsaveDocumentDecision\b/i, 'sem saveDocumentDecision');
  assert.doesNotMatch(rpcBody, /\bremoveDocumentDecision\b/i, 'sem removeDocumentDecision');
});

test('migrations baseline 38-49 inalteradas (gate de nao-regressao)', function () {
  const baselines = [
    { num: 38, file: '38_documentos_schema.sql',
      markers: [/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_candidates/i,
                /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento/i] },
    { num: 39, file: '39_documentos_ingestor_state_undo.sql',
      markers: [/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_status\s+TEXT/i,
                /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento/i] },
    { num: 40, file: '40_document_scan_runs_stale_recovery.sql',
      markers: [/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.recuperar_document_scan_runs_travados/i] },
    { num: 41, file: '41_document_scan_requests_queue.sql',
      markers: [/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.solicitar_document_scan/i] },
    { num: 49, file: '49_document_technical_evidences.sql',
      markers: [/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_technical_evidences/i] },
  ];

  for (const m of baselines) {
    const p = path.join(ROOT, 'db', m.file);
    assert.ok(fs.existsSync(p), 'migration ' + m.num + ' existe');
    const content = fs.readFileSync(p, 'utf8');
    for (const marker of m.markers) {
      assert.match(content, marker, 'migration ' + m.num + ' contem marcador');
    }
  }
});

test('migration notifica PostgREST', function () {
  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('git baseline: B5-B1 technical-commit manifest (b247e435)', function () {
  const { execFileSync } = require('node:child_process');

  const raw = execFileSync('git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', 'b247e43504c0afcc0d25e95f8012f93a09eb0692'],
    { encoding: 'utf8', cwd: ROOT });

  const manifest = raw
    .split('\n')
    .map(f => f.replace(/\\/g, '/'))
    .filter(Boolean)
    .sort();

  const EXPECTED = [
    'db/50_document_decision_command.sql',
    'tests/document-decision-command-contract.test.js',
  ];

  assert.deepEqual(manifest, EXPECTED,
    'B5-B1 technical-commit manifest mismatch — ' +
    'b247e435 deve conter exatamente ' + EXPECTED.join(', '));

  const statusOut = execFileSync('git', ['status', '--porcelain', 'db/'], { encoding: 'utf8', cwd: ROOT }).trim();
  const dbStatus = statusOut ? statusOut.split('\n').filter(Boolean) : [];

  // B5-B1 introduced db/50; G28-B6 adds db/51; G28-B8 adds db/52; A4.1 +
  // CAMADA2-LAST-ACCESS-RPC add db/58/db/59; A6.1 adds db/60 as the next
  // migration. All are allowed working-tree entries; anything else is an
  // unexpected db/ change.
  const ALLOWED_DB = [
    'db/50_document_decision_command.sql',
    'db/51_document_canonical_links.sql',
    'db/52_document_link_correction_revocation_restoration.sql',
    'db/58_admin_usuarios_senha_temporaria.sql',
    'db/59_admin_last_sign_in_readmodel.sql',
    'db/60_usuarios_auditoria_schema.sql',
  ];
  for (const line of dbStatus) {
    const file = line.trim().slice(3);
    assert.ok(ALLOWED_DB.includes(file), 'db/ nao pode ter alteracao extra: ' + line);
  }
});

test('migration 50: apenas tabela/indices autorizados', function () {
  const exec = sql.replace(/--.*$/gm, '');

  assert.doesNotMatch(exec, /CREATE\s+TABLE\b/i, 'nao cria tabelas');
  assert.doesNotMatch(exec, /DROP\s+TABLE\b/i, 'nao droppa tabelas');

  const alterTables = exec.match(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)/gi);
  if (alterTables) {
    for (const a of alterTables) {
      assert.match(a, /document_decisions/i, 'ALTER TABLE apenas em document_decisions: ' + a);
    }
  }

  const indices = exec.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\S+)/gi);
  if (indices) {
    for (const ix of indices) {
      assert.match(ix, /document_decisions_command_id_uidx/i,
        'unico indice criado e o command_id_uidx: ' + ix);
    }
  }
});

test('migration 50: exatamente uma nova RPC, sem redefinir existentes', function () {
  const rpcs = executableSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.\w+/gi);
  assert.ok(rpcs, 'ao menos uma RPC encontrada');
  assert.equal(rpcs.length, 1, 'exatamente uma nova RPC');
  assert.match(rpcs[0], /registrar_decisao_documento/i, 'RPC e registrar_decisao_documento');

  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.decidir_documento/i,
    'nao redefine decidir_documento');
  assert.doesNotMatch(executableSql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento/i,
    'nao redefine desfazer_decisao_documento');
});

test('cada um dos seis outcomes tem as 9 chaves minimas', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const body = bodyMatch[1];

  const MIN_KEYS = ['ok', 'outcome', 'command_id', 'document_id',
    'decision_id', 'active_decision_id', 'decision_status', 'candidate_status', 'replayed'];

  const outcomes = ['created', 'replayed', 'command_conflict',
    'active_decision_exists', 'stale_active_decision', 'candidate_not_found'];

  for (const outcome of outcomes) {
    assert.match(body, new RegExp("'outcome'\\s*,\\s*'" + outcome + "'", 'i'),
      'outcome ' + outcome + ' presente');
  }

  for (const outcome of outcomes) {
    let pos = -1;
    let count = 0;
    while ((pos = body.indexOf("'outcome', '" + outcome + "'", pos + 1)) !== -1) {
      count++;
      const chunkStart = Math.max(0, pos - 80);
      const chunk = body.slice(chunkStart, pos + 1000);
      for (const key of MIN_KEYS) {
        assert.match(chunk, new RegExp("'" + key + "'", 'i'),
          outcome + ' #' + count + ' contem ' + key);
      }
    }
    assert.ok(count >= 1, outcome + ' tem ao menos 1 ocorrencia');
  }
});

test('candidate update ocorre apos decision INSERT', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const body = bodyMatch[1];

  const insertPos = body.indexOf('INSERT INTO public.document_decisions');
  const updatePos = body.indexOf('UPDATE public.document_candidates');
  assert.ok(insertPos >= 0, 'INSERT decision existe');
  assert.ok(updatePos >= 0, 'UPDATE candidate existe');
  assert.ok(insertPos < updatePos, 'INSERT decision antes de UPDATE candidate');
});

test('outcomes replayed e command_conflict nao contem expected_active_decision_id ou existing_document_id', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const body = bodyMatch[1];

  const beforeInsert = body.slice(0, body.indexOf('INSERT'));

  assert.doesNotMatch(beforeInsert, /existing_document_id/i,
    'nenhum resultado usa existing_document_id');
  assert.doesNotMatch(beforeInsert, /existing_decision/i,
    'nenhum resultado usa existing_decision');
});

test('stale_active_decision outcomes nao contem expected_active_decision_id', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const body = bodyMatch[1];
  assert.doesNotMatch(body, /'expected_active_decision_id'/i,
    'nenhum resultado inclui expected_active_decision_id no corpo');
});

test('RPC body sem comportamento B8 (revocacao/correcao)', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const execBody = bodyMatch[1].replace(/--.*$/gm, '');

  assert.doesNotMatch(execBody, /\bDELETE\b/i, 'sem DELETE');
  assert.doesNotMatch(execBody, /UPDATE\s+public\.document_decisions\b/i,
    'sem UPDATE em document_decisions');
  assert.doesNotMatch(execBody, /SET\s+ativo\s*=\s*FALSE/i,
    'sem SET ativo = FALSE');
  assert.doesNotMatch(execBody, /desfazer_decisao_documento/i,
    'sem referencia a desfazer_decisao_documento');
  assert.doesNotMatch(execBody, /\brevog/i, 'sem revogacao');
  assert.doesNotMatch(execBody, /\bcorrig\b|\bcorrecao\b/i, 'sem correcao');
});

test('RPC body: DML alvo restrito a document_decisions e document_candidates', function () {
  const rpc = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.registrar_decisao_documento/i, 15000);
  const bodyMatch = rpc.match(/\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao encontrado');
  const execBody = bodyMatch[1].replace(/--.*$/gm, '');

  const inserts = execBody.match(/INSERT\s+INTO\s+(\S+)/gi);
  if (inserts) {
    for (const ins of inserts) {
      assert.match(ins, /public\.document_decisions\b/i,
        'INSERT apenas em document_decisions: ' + ins);
    }
  }

  const updates = execBody.match(/\bUPDATE\s+(\S+)/gi);
  if (updates) {
    for (const upd of updates) {
      assert.match(upd, /public\.document_candidates\b/i,
        'UPDATE apenas em document_candidates: ' + upd);
    }
  }

  assert.doesNotMatch(execBody, /\bDELETE\b/i, 'DELETE proibido');

  const tableRefs = execBody.match(/(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+public\.(\w+)/gi);
  if (tableRefs) {
    for (const ref of tableRefs) {
      assert.match(ref, /public\.document_candidates\b|public\.document_decisions\b/i,
        'tabela public.* apenas document_candidates ou document_decisions: ' + ref);
    }
  }
});
