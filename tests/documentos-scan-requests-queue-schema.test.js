const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL_PATH = path.join(ROOT, 'db', '41_document_scan_requests_queue.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');
const executableSql = sql.replace(/--.*$/gm, '');

const DB38 = path.join(ROOT, 'db', '38_documentos_schema.sql');
const DB39 = path.join(ROOT, 'db', '39_documentos_ingestor_state_undo.sql');
const DB40 = path.join(ROOT, 'db', '40_document_scan_runs_stale_recovery.sql');

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

test('migration 41 declara fase R1, advertencia de nao aplicar e idempotencia', function () {
  has(/RAVATEX-DOCUMENTS-G24-B1-R1-DOCUMENT-SCAN-REQUEST-QUEUE-HARDENING-CLOSEOUT/i);
  has(/Nao aplicar nesta fase/i);
  has(/Sem apply, sem dados reais, sem secrets/i);
  has(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.solicitar_document_scan/i);
  has(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.claim_next_document_scan_request/i);
  has(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.mark_document_scan_request_running/i);
  has(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finish_document_scan_request/i);
});

test('tabela document_scan_requests tem colunas renomeadas e CHECK de status com cancelled', function () {
  const blockT = block(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_scan_requests/i, 3500);
  assert.match(blockT, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  assert.match(blockT, /source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'gmail'/i);
  assert.match(blockT, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'requested'/i);
  assert.match(blockT, /requested_by_user_id\s+UUID\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i);
  assert.doesNotMatch(blockT, /\brequested_by\s+UUID\s+REFERENCES\s+auth\.users\(id\)/i,
    'coluna antiga requested_by nao pode voltar a existir no CREATE TABLE');
  assert.match(blockT, /requested_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  assert.match(blockT, /claimed_at\s+TIMESTAMPTZ/i);
  assert.match(blockT, /started_at\s+TIMESTAMPTZ/i);
  assert.match(blockT, /finished_at\s+TIMESTAMPTZ/i);
  assert.match(blockT, /scan_run_id\s+UUID/i);
  assert.match(blockT, /error_message\s+TEXT/i);
  assert.match(blockT, /criado_em\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);

  // CHECK de status inclui cancelled em R1.
  has(/document_scan_requests_status_check[\s\S]*'requested'\s*,\s*'claimed'\s*,\s*'running'\s*,\s*'completed'\s*,\s*'failed'\s*,\s*'cancelled'/i);
  has(/document_scan_requests_terminal_times_check/i);
  has(/document_scan_requests_running_started_check/i);
  has(/document_scan_requests_claimed_consistency_check/i);
  has(/document_scan_requests_failed_reason_check[\s\S]*status\s*=\s*'failed'[\s\S]*error_message/i);
});

test('cancelled e estado terminal, exige finished_at e nao exige error_message', function () {
  // terminal_times_check deve listar 'cancelled' junto de completed/failed
  // como estado que exige finished_at.
  has(/document_scan_requests_terminal_times_check[\s\S]*'completed'\s*,\s*'failed'\s*,\s*'cancelled'[\s\S]*finished_at\s+IS\s+NOT\s+NULL/i);
  has(/document_scan_requests_terminal_times_check[\s\S]*'completed'\s*,\s*'failed'\s*,\s*'cancelled'[\s\S]*finished_at\s+IS\s+NULL/i);

  // claimed_consistency_check deve exigir claimed_at em todos os estados
  // a partir de claimed, inclusive cancelled.
  has(/document_scan_requests_claimed_consistency_check[\s\S]*'claimed'\s*,\s*'running'\s*,\s*'completed'\s*,\s*'failed'\s*,\s*'cancelled'[\s\S]*claimed_at\s+IS\s+NOT\s+NULL/i);

  // failed_reason_check NAO deve exigir error_message para cancelled
  // (cancelled nao e failed, entao a disjuncao (status IS DISTINCT FROM
  // 'failed' AND error_message IS NULL) ja cobre cancelled sem error_message).
  // Verificamos tambem que nao existe um ramo que imponha error_message a cancelled.
  assert.doesNotMatch(
    sql,
    /status\s*=\s*'cancelled'[\s\S]*error_message\s+IS\s+NOT\s+NULL/i,
    'cancelled nao pode exigir error_message'
  );
  // E a documentacao do error_message deve explicitar que cancelled nao exige.
  has(/error_message[\s\S]*Nao exigido quando status\s*=\s*'cancelled'/i);

  // Indice de requests ativas NAO pode incluir cancelled.
  assert.doesNotMatch(
    executableSql,
    /document_scan_requests_active_source_uidx[\s\S]*'cancelled'/i,
    'cancelled nao pode permanecer no indice de requests ativas'
  );
  // Documentacao explicita de que cancelled sai do indice.
  has(/cancelled[\s\S]*NAO permanece no[\s\S]*indice de requests ativas/i);
});

test('scan_run_id documenta ausencia intencional de foreign key', function () {
  has(/scan_run_id\s+UUID/i);
  has(/Sem foreign key intencionalmente/i);
  has(/auditoria da request deve sobreviver a cleanup manual de runs/i);
  // Garantia adicional: nenhuma FK para document_scan_runs no schema.
  assert.doesNotMatch(
    executableSql,
    /REFERENCES\s+public\.document_scan_runs/i,
    'nenhuma FK para document_scan_runs pode existir'
  );
  assert.doesNotMatch(
    executableSql,
    /FOREIGN\s+KEY[\s\S]*document_scan_runs/i,
    'nenhuma FOREIGN KEY envolvendo document_scan_runs pode existir'
  );
});

test('documentacao de requested_by_user_id confirma renomeacao R1', function () {
  has(/COMMENT\s+ON\s+COLUMN\s+public\.document_scan_requests\.requested_by_user_id\s+IS/i);
  has(/Renomeado em R1/i);
  // Nenhuma ocorrencia de "COMMENT ON COLUMN ... requested_by IS" (coluna antiga)
  assert.doesNotMatch(
    sql,
    /COMMENT\s+ON\s+COLUMN\s+public\.document_scan_requests\.requested_by\s+IS/i,
    'documentacao da coluna antiga requested_by nao pode permanecer'
  );
});

test('indice unico parcial impede duas requests ativas da mesma source', function () {
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_scan_requests_status_requested_idx[\s\S]*WHERE\s+status\s*=\s*'requested'/i);
  has(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_scan_requests_source_requested_idx/i);
  has(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_scan_requests_active_source_uidx[\s\S]*WHERE\s+status\s+IN\s*\(\s*'requested'\s*,\s*'claimed'\s*,\s*'running'\s*\)/i);
  // Cobertura explicita: o comentario explica que o indice protege contra
  // TOCTOU entre SELECT previo e INSERT, reforcando o contrato.
  assert.match(sql, /TOCTOU/i);
});

test('RLS admin-only e grants da tabela excluem anon/escrita direta', function () {
  has(/ALTER\s+TABLE\s+public\.document_scan_requests\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  has(/DROP\s+POLICY\s+IF\s+EXISTS\s+document_scan_requests_admin_all\s+ON\s+public\.document_scan_requests/i);
  has(/CREATE\s+POLICY\s+document_scan_requests_admin_all\s+ON\s+public\.document_scan_requests[\s\S]*FOR\s+ALL[\s\S]*USING\s*\(public\.is_admin\(\)\)[\s\S]*WITH\s+CHECK\s*\(public\.is_admin\(\)\)/i);
  has(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.document_scan_requests\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.document_scan_requests\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.document_scan_requests\s+FROM\s+authenticated/i);
  has(/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.document_scan_requests\s+TO\s+authenticated/i);
  // Verifica apenas em SQL executavel (sem comentarios) para nao conflitar
  // com texto de documentacao que cita nomes de privilegios.
  assert.doesNotMatch(
    executableSql,
    /GRANT\s+[^;]*(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*public\.document_scan_requests[^;]*TO\s+anon/i
  );
  assert.doesNotMatch(
    executableSql,
    /GRANT\s+[^;]*(INSERT|UPDATE|DELETE|TRUNCATE)[^;]*public\.document_scan_requests[^;]*TO\s+authenticated/i
  );
});

test('RPC solicitar_document_scan e admin-only e idempotente por source', function () {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.solicitar_document_scan/i, 6000);
  assert.match(r, /p_source\s+TEXT\s+DEFAULT\s+'gmail'/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /IF\s+NOT\s+public\.is_admin\(\)\s+THEN/i);
  assert.match(r, /admin_required/i);
  // Reuso: ja existe ativa -> devolve a existente.
  assert.match(r, /status\s+IN\s*\(\s*'requested'\s*,\s*'claimed'\s*,\s*'running'\s*\)/i);
  assert.match(r, /reused[\s\S]*TRUE/i);
  // Caminho de criacao com UNIQUE parcial protegendo contra corrida.
  assert.match(r, /INSERT\s+INTO\s+public\.document_scan_requests/i);
  assert.match(r, /RETURNING\s+id\s*,\s*status/i);
  assert.match(r, /EXCEPTION[\s\S]*WHEN\s+unique_violation/i);
  // Contrato explicito: nunca cria document_scan_run e nunca usa service_role.
  assert.match(r, /Nao cria document_scan_run\./i);

  // O corpo da funcao (entre AS $$ e END; $$;) nao pode referenciar
  // service_role. Extraimos apenas o corpo para que a string 'NAO usa
  // service_role' da documentacao COMMENT nao seja considerada.
  const bodyMatch = r.match(/AS\s+\$\$([\s\S]*?)\$\$/);
  assert.ok(bodyMatch, 'corpo da funcao nao encontrado');
  const body = bodyMatch[1];
  assert.doesNotMatch(body, /service_role/i, 'corpo da funcao nao pode mencionar service_role');
  // O default 'gmail' e o source canonico da fila; ele pode aparecer como
  // valor literal. O que precisa ficar fora do corpo da UI sao as
  // integracoes externas (gmail API, drive, edge function).
  assert.doesNotMatch(body, /gmail\s+api|drive\s+api|edge\s+function/i, 'corpo da UI nao chama integracoes externas');
  assert.doesNotMatch(body, /INSERT\s+INTO\s+public\.document_scan_runs/i);
  // R1: nome renomeado na lista de colunas do INSERT e em todo o corpo.
  assert.match(body, /requested_by_user_id/i, 'INSERT deve usar requested_by_user_id');
  assert.doesNotMatch(body, /\brequested_by\b\s*[,)]/i,
    'corpo da funcao nao pode usar o nome antigo requested_by na lista de colunas');
});

test('RPC claim usa FOR UPDATE SKIP LOCKED e devolve fila vazia estavel', function () {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.claim_next_document_scan_request/i, 6000);
  assert.match(r, /p_source\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  assert.match(r, /service_role_required/i);
  // FOR UPDATE SKIP LOCKED impede que duas instâncias peguem a mesma request.
  assert.match(r, /FOR\s+UPDATE\s+SKIP\s+LOCKED/i);
  // Apenas status='requested' pode ser claimado.
  assert.match(r, /status\s*=\s*'requested'/i);
  // Transicao atomica requested -> claimed.
  assert.match(r, /SET\s+status\s*=\s*'claimed'/i);
  assert.match(r, /claimed_at\s*=\s*now\(\)/i);
  // Fila vazia: contrato explicito empty=true.
  assert.match(r, /'empty'\s*,\s*TRUE/i);
  assert.match(r, /request_id[\s\S]*NULL/i);
  assert.match(r, /status[\s\S]*NULL/i);
  lacks(/INSERT\s+INTO\s+public\.document_scan_runs/i, 'claim nao cria document_scan_runs');
});

test('RPC mark_running transita claimed -> running e associa scan_run_id', function () {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.mark_document_scan_request_running/i, 5000);
  assert.match(r, /p_request_id\s+UUID/i);
  assert.match(r, /p_scan_run_id\s+UUID/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  assert.match(r, /service_role_required/i);
  assert.match(r, /request_id_required/i);
  assert.match(r, /scan_run_id_required/i);
  // Transicao estrita: WHERE status = 'claimed'.
  assert.match(r, /WHERE\s+id\s*=\s*p_request_id\s*AND\s*status\s*=\s*'claimed'/i);
  // Preenche started_at e scan_run_id.
  assert.match(r, /started_at\s*=\s*now\(\)/i);
  assert.match(r, /scan_run_id\s*=\s*p_scan_run_id/i);
  // Estado invalido e linha inexistente sao diagnosticados.
  assert.match(r, /invalid_transition/i);
  assert.match(r, /request_not_found/i);
  lacks(/INSERT\s+INTO\s+public\.document_scan_runs/i, 'mark_running nao cria document_scan_runs');
});

test('RPC finish aceita completed/failed, e idempotente em estado terminal', function () {
  const r = block(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finish_document_scan_request/i, 8000);
  assert.match(r, /p_request_id\s+UUID/i);
  assert.match(r, /p_status\s+TEXT/i);
  assert.match(r, /p_error_message\s+TEXT\s+DEFAULT\s+NULL/i);
  assert.match(r, /RETURNS\s+JSONB/i);
  assert.match(r, /SECURITY\s+DEFINER/i);
  assert.match(r, /SET\s+search_path\s*=\s*public\s*,\s*auth/i);
  assert.match(r, /auth\.role\(\)\s+IS\s+DISTINCT\s+FROM\s+'service_role'/i);
  assert.match(r, /service_role_required/i);
  assert.match(r, /request_id_required/i);
  assert.match(r, /v_status_in\s+NOT\s+IN\s*\(\s*'completed'\s*,\s*'failed'\s*\)/i);
  assert.match(r, /invalid_status/i);
  assert.match(r, /error_message_required/i);
  // Transicao SOMENTE a partir de claimed/running.
  assert.match(r, /v_current\s+NOT\s+IN\s*\(\s*'claimed'\s*,\s*'running'\s*\)/i);
  assert.match(r, /invalid_transition/i);
  // Idempotencia: chamada repetida em estado terminal nao corrompe.
  assert.match(r, /v_current\s+IN\s*\(\s*'completed'\s*,\s*'failed'\s*\)/i);
  assert.match(r, /idempotent[\s\S]*TRUE/i);
  // finished_at sempre preenchido em transicao terminal.
  assert.match(r, /finished_at\s*=\s*now\(\)/i);
  // Auditoria: error_message persistido apenas quando status='failed'.
  assert.match(r, /error_message\s*=\s*CASE\s+WHEN\s+v_status_in\s*=\s*'failed'\s+THEN\s+v_error_in\s+ELSE\s+NULL\s+END/i);
});

test('grants das RPCs seguem o principio de menor privilegio', function () {
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.solicitar_document_scan\(TEXT\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.claim_next_document_scan_request\(TEXT\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_document_scan_request_running\(UUID,\s*UUID\)\s+FROM\s+PUBLIC/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finish_document_scan_request\(UUID,\s*TEXT,\s*TEXT\)\s+FROM\s+PUBLIC/i);

  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.solicitar_document_scan\(TEXT\)\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.claim_next_document_scan_request\(TEXT\)\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_document_scan_request_running\(UUID,\s*UUID\)\s+FROM\s+anon/i);
  has(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.finish_document_scan_request\(UUID,\s*TEXT,\s*TEXT\)\s+FROM\s+anon/i);

  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.solicitar_document_scan\(TEXT\)\s+TO\s+authenticated/i);

  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_next_document_scan_request\(TEXT\)\s+TO\s+service_role/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_document_scan_request_running\(UUID,\s*UUID\)\s+TO\s+service_role/i);
  has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finish_document_scan_request\(UUID,\s*TEXT,\s*TEXT\)\s+TO\s+service_role/i);

  // Nao ha grant EXECUTE das RPCs do runner para authenticated.
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.claim_next_document_scan_request[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_document_scan_request_running[\s\S]*TO\s+authenticated/i);
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.finish_document_scan_request[\s\S]*TO\s+authenticated/i);

  // Nenhum grant de EXECUTE para anon em qualquer das quatro.
  lacks(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(solicitar_document_scan|claim_next_document_scan_request|mark_document_scan_request_running|finish_document_scan_request)[\s\S]*TO\s+anon/i);
});

test('migration nao toca integracoes fora de escopo, nao expoe segredos e reloada PostgREST', function () {
  // document_scan_runs: nao inserir, nao atualizar, nao deletar, sem FK.
  assert.doesNotMatch(executableSql, /INSERT\s+INTO\s+public\.document_scan_runs/i);
  assert.doesNotMatch(executableSql, /UPDATE\s+public\.document_scan_runs/i);
  assert.doesNotMatch(executableSql, /DELETE\s+FROM\s+public\.document_scan_runs/i);
  assert.doesNotMatch(executableSql, /REFERENCES\s+public\.document_scan_runs/i);
  assert.doesNotMatch(executableSql, /FOREIGN\s+KEY[\s\S]*document_scan_runs/i);

  // Integracoes fora de escopo (verificadas em SQL executavel, sem comentarios).
  assert.doesNotMatch(
    executableSql,
    /\b(edge\s+function|gmail\s+api|drive\s+api|scheduler|localStorage)\b/i
  );

  // Comandos destrutivos: considera qualquer linha, comentario ou nao.
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sql, /^\s*TRUNCATE\b/im);
  assert.doesNotMatch(sql, /^\s*DROP\s+TABLE\b/im);

  // Segredos: tambem conferidos em SQL executavel para cobrir GRANT
  // EXECUTE ... TO service_role, que aparece apenas em comentarios.
  assert.doesNotMatch(executableSql, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(executableSql, /postgres:\/\/|password\s*[:=]|eyJ[A-Za-z0-9_-]{10,}\.eyJ/i);

  has(/NOTIFY\s+pgrst\s*,\s*'reload schema'/i);
  has(/NOTIFY\s+pgrst\s*,\s*'reload config'/i);
});

test('migrations 38, 39 e 40 nao foram alteradas (gate de nao-regressao)', function () {
  assert.ok(fs.existsSync(DB38), 'db/38_documentos_schema.sql ausente');
  assert.ok(fs.existsSync(DB39), 'db/39_documentos_ingestor_state_undo.sql ausente');
  assert.ok(fs.existsSync(DB40), 'db/40_document_scan_runs_stale_recovery.sql ausente');

  const db38 = fs.readFileSync(DB38, 'utf8');
  const db39 = fs.readFileSync(DB39, 'utf8');
  const db40 = fs.readFileSync(DB40, 'utf8');

  // Assinaturas canonicas das migrations anteriores precisam continuar.
  assert.match(db38, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.document_candidates/i);
  assert.match(db38, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.iniciar_document_scan_run/i);
  assert.match(db38, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.finalizar_document_scan_run/i);
  assert.match(db38, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+document_scan_runs_running_source_uidx/i);

  assert.match(db39, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+ingestor_status\s+TEXT/i);
  assert.match(db39, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.desfazer_decisao_documento/i);
  assert.match(db39, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state/i);

  assert.match(db40, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.recuperar_document_scan_runs_travados/i);
  assert.match(db40, /FOR\s+UPDATE\s+SKIP\s+LOCKED/i);
});
