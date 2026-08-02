// tests/pedido-alteracao-client-direct-select-acl.smoke.js
//
// PEDIDO-ALTERACAO-CLIENT-DIRECT-SELECT-INTERNAL-COLUMNS-R1 — structural proof
// of db/114_pedido_alteracao_client_direct_select_column_acl.sql and of the
// repository-side consumer boundary it depends on.
//
// This suite reads FILES ONLY. It connects to no database, local or remote.
// The runtime privilege behaviour is proved separately, on a disposable
// cluster, by tests/pedido-alteracao-client-direct-select-acl-invariant.mjs.
//
// The load-bearing repository fact here is the DIRECT-CONSUMER INVENTORY: the
// minimum authenticated column set is only correct while exactly one browser
// surface reads the request tables directly, with exactly those columns. If a
// new direct consumer appears — above all a Client surface reaching for an
// internal field — this suite fails and the ACL must be re-derived before the
// consumer ships.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB114_FILENAME = '114_pedido_alteracao_client_direct_select_column_acl.sql';
const DB114_PATH = path.join(REPO_ROOT, 'db', DB114_FILENAME);
const DB92_PATH = path.join(REPO_ROOT, 'db', '92_pedido_unified_edit_change_approval_foundation.sql');

const SOL = 'pedido_alteracao_solicitacoes';
const ITENS = 'pedido_alteracao_solicitacao_itens';

// The binding minimum, derived from the active direct-consumer call graph.
const APROVADAS = ['id', 'pedido_id', 'status', 'criado_em'];

// RAW COLUMN names that no browser surface may ever name, because each one is
// reachable legitimately ONLY through a sanctioned server payload under a
// DIFFERENT key. `base_snapshot` travels as `antes`; each `proposto_*` column
// travels under its bare field name (`prazo_entrega`, `referencia_cliente`,
// `tipo_recebimento`, `observacao`, `prioridade_proposta`). Naming the raw
// column is therefore, by construction, a direct table read.
//
// Deliberately NOT listed: `base_revisao`, `solicitante_id`,
// `solicitante_papel`, `decidido_por`, `decisao_motivo`, `falha_identificador`,
// `campos_alterados`, `itens_propostos` and `mensagem_cliente` are REAL keys of
// the admin_alteracao_comparacao / cliente_alteracao_resumo payloads, so a
// surface naming them is reading the sanctioned RPC, not the table. Also not
// listed: `atualizado_em` and `criado_em`, which exist on many other tables.
const COLUNAS_CRUAS_PROIBIDAS = [
  'base_snapshot', 'proposto_prazo_entrega', 'proposto_referencia_cliente',
  'proposto_tipo_recebimento', 'proposto_observacao', 'proposto_prioridade_habilitada',
];

const sql = fs.readFileSync(DB114_PATH, 'utf8');
const db92 = fs.readFileSync(DB92_PATH, 'utf8');

// Executable SQL only. Structural assertions must never be satisfied — or
// tripped — by commentary, and this migration's header deliberately QUOTES the
// db/92 grants it corrects.
const sqlCode = sql.replace(/^\s*--.*$/gmu, '');

// ---------------------------------------------------------------------------
// Repository JavaScript surface, walked once.
// ---------------------------------------------------------------------------
function walkJs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}
const JS_FILES = walkJs(path.join(REPO_ROOT, 'js'));

// A direct table consumer is a `.from('<table>')` chain. Returns the files that
// contain one for either request table, with the `.select(...)` list found in
// the same chain.
function directConsumers(table) {
  const found = [];
  for (const file of JS_FILES) {
    const body = fs.readFileSync(file, 'utf8');
    const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)([\\s\\S]{0,400})`, 'g');
    let m;
    while ((m = re.exec(body)) !== null) {
      const tail = m[1];
      const sel = /\.select\(\s*['"`]([^'"`]*)['"`]/.exec(tail);
      found.push({
        file: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
        columns: sel ? sel[1].split(',').map((c) => c.trim()).filter(Boolean) : null,
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The migration itself
// ---------------------------------------------------------------------------

test('db/114 exists, is forward-only and leaves db/92 untouched', () => {
  assert.ok(fs.existsSync(DB114_PATH), `${DB114_FILENAME} must exist`);
  // It must not rewrite the accepted foundation.
  assert.equal(/CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|TRIGGER)/iu.test(sqlCode), false,
    'db/114 is an ACL correction: it creates no table, function or trigger');
  assert.equal(/ALTER\s+TABLE/iu.test(sqlCode), false, 'db/114 alters no table structure');
  assert.equal(/DROP\s+/iu.test(sqlCode), false, 'db/114 drops nothing');
  // The db/92 grant it corrects is still the accepted historical text.
  assert.match(db92, new RegExp(`GRANT SELECT ON public\\.${SOL}\\s+TO authenticated;`, 'u'));
  assert.match(db92, new RegExp(`GRANT SELECT ON public\\.${ITENS} TO authenticated;`, 'u'));
});

test('db/114 revokes the table-level SELECT from authenticated on BOTH request tables', () => {
  for (const t of [SOL, ITENS]) {
    assert.match(sqlCode, new RegExp(`REVOKE SELECT ON public\\.${t}\\s+FROM authenticated;`, 'u'),
      `${t} must lose the table-level SELECT; a table grant cannot coexist with a column restriction`);
  }
});

test('db/114 grants back exactly the four approved columns, and only on the header table', () => {
  const grants = [...sqlCode.matchAll(/GRANT SELECT\s*\(([^)]*)\)\s*\n?\s*ON public\.(\w+)\s+TO (\w+);/gu)];
  assert.equal(grants.length, 1, 'exactly one column-level GRANT is expected');
  const [, cols, table, role] = grants[0];
  assert.equal(table, SOL);
  assert.equal(role, 'authenticated');
  assert.deepEqual(cols.split(',').map((c) => c.trim()), APROVADAS);
  // Nothing is granted back on the proposed item collection.
  assert.equal(new RegExp(`GRANT SELECT[^;]*ON public\\.${ITENS}`, 'u').test(sqlCode), false,
    'the proposed item collection has no direct browser consumer and gets nothing back');
});

test('db/114 introduces no write privilege, no anon access and no RLS change', () => {
  assert.equal(/GRANT\s+(ALL|INSERT|UPDATE|DELETE|TRUNCATE)/iu.test(sqlCode), false,
    'no mutation privilege may be introduced');
  assert.equal(/GRANT[^;]*\bTO\b[^;]*\banon\b/iu.test(sqlCode), false, 'anon gains nothing');
  assert.equal(/CREATE POLICY|DROP POLICY|ALTER POLICY/iu.test(sqlCode), false,
    'ACL owns column scope; RLS owns row scope and is not edited here');
  assert.equal(/ENABLE ROW LEVEL SECURITY|DISABLE ROW LEVEL SECURITY/iu.test(sqlCode), false,
    'db/114 does not touch the RLS enabled state');
});

test('db/114 fails closed on every precondition it depends on', () => {
  for (const anchor of [
    'db/114 gate: pre-requisito(s) ausente(s)',
    'db/114 gate: coluna(s) do consumidor direto ausente(s)',
    'db/114 gate: ROW LEVEL SECURITY',
    'db/114 gate: politica(s) RLS de db/92 ausente(s) ou divergente(s)',
    'db/114 gate: dono servidor ausente ou divergente',
    'db/114 gate: authenticated tem privilegio nao-SELECT',
    'db/114 gate: anon ou PUBLIC ja possui privilegio',
    'db/114 gate: forma de ACL inesperada',
  ]) {
    assert.ok(sql.includes(anchor), `the gate must be able to refuse with: ${anchor}`);
  }
  // It names the server-owned functions it must not break.
  for (const fn of [
    'public.cliente_alteracao_resumo(uuid)',
    'public.admin_alteracao_comparacao(uuid)',
    'public.solicitar_alteracao_pedido(uuid,jsonb,jsonb,boolean,text)',
    'public.retirar_alteracao_pedido(uuid)',
    'public.aprovar_alteracao_pedido(uuid,boolean,text)',
    'public.rejeitar_alteracao_pedido(uuid,text)',
  ]) {
    assert.ok(sql.includes(fn), `the gate must assert the server owner ${fn}`);
  }
});

test('db/114 verifies its own result, positively and negatively', () => {
  assert.ok(sql.includes('db/114 verify:'), 'the migration must prove its own result');
  // Every internal column named by the accepted debt is denied explicitly.
  for (const col of ['base_snapshot', 'base_revisao', 'falha_identificador', 'solicitante_id']) {
    assert.ok(sql.includes(`'${col}'`), `the verification must name the internal column ${col}`);
  }
  assert.ok(sql.includes('has_column_privilege'),
    'denial must be measured per column, not deduced from the table grant');
});

// ---------------------------------------------------------------------------
// The consumer boundary the minimum column set rests on
// ---------------------------------------------------------------------------

test('exactly one browser surface reads pedido_alteracao_solicitacoes directly', () => {
  const consumers = directConsumers(SOL);
  assert.equal(consumers.length, 1,
    `expected exactly one direct consumer, found: ${consumers.map((c) => c.file).join(', ') || 'none'}`);
  assert.equal(consumers[0].file, 'js/screens/pedido-detail-data.js');
});

test('that consumer selects exactly the approved projection', () => {
  const [consumer] = directConsumers(SOL);
  assert.deepEqual(consumer.columns, ['id', 'status', 'criado_em'],
    'the bounded admin discovery projection is part of the ACL derivation');
  const body = fs.readFileSync(path.join(REPO_ROOT, 'js', 'screens', 'pedido-detail-data.js'), 'utf8');
  // Its two filters are the remaining half of the derivation: a column used in
  // WHERE also needs SELECT, which is why pedido_id is in the granted set.
  assert.match(body, /\.eq\(\s*['"]pedido_id['"]/u);
  assert.match(body, /\.eq\(\s*['"]status['"]\s*,\s*['"]pendente['"]\s*\)/u);
  for (const col of ['id', 'status', 'criado_em', 'pedido_id']) {
    assert.ok(APROVADAS.includes(col), `${col} must be in the approved set`);
  }
});

test('no browser surface reads pedido_alteracao_solicitacao_itens directly', () => {
  const consumers = directConsumers(ITENS);
  assert.deepEqual(consumers.map((c) => c.file), [],
    'the proposed item collection has no direct consumer; its minimum column set is empty');
});

test('no Client surface reads the request tables directly at all', () => {
  const clientFiles = JS_FILES.filter((f) => /cliente[-\w]*\.js$/u.test(path.basename(f)));
  assert.ok(clientFiles.length > 0, 'the Client surfaces must be discoverable');
  for (const file of clientFiles) {
    const body = fs.readFileSync(file, 'utf8');
    for (const t of [SOL, ITENS]) {
      assert.equal(new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]`, 'u').test(body), false,
        `${path.relative(REPO_ROOT, file)} must reach change requests only through cliente_alteracao_resumo()`);
    }
  }
});

test('no browser surface names a raw server-internal request column', () => {
  const offenders = [];
  for (const file of JS_FILES) {
    const body = fs.readFileSync(file, 'utf8');
    for (const col of COLUNAS_CRUAS_PROIBIDAS) {
      if (new RegExp(`['"\`]${col}['"\`]`, 'u').test(body)) {
        offenders.push(`${path.relative(REPO_ROOT, file).split(path.sep).join('/')}:${col}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'each of these columns reaches the browser only under a different sanctioned payload key, '
    + 'so naming the raw column is a direct table read and the ACL must be re-derived first');
});

test('the admin review screen reads the sanctioned payload keys, not the raw columns', () => {
  const review = fs.readFileSync(path.join(REPO_ROOT, 'js', 'screens', 'pedido-alteracao-review.js'), 'utf8');
  // `solicitante_id` / `solicitante_papel` ARE keys of admin_alteracao_comparacao,
  // so their presence here is the sanctioned RPC path and must not be mistaken
  // for direct table access. This pins that distinction so a future reader does
  // not "tighten" the guard above into a false positive.
  assert.match(review, /sol\.solicitante_papel/u);
  assert.match(review, /sol\.solicitante_id/u);
  assert.equal(new RegExp(`\\.from\\(\\s*['"\`]${SOL}['"\`]`, 'u').test(review), false,
    'the review screen must reach the request only through admin_alteracao_comparacao');
  assert.match(db92, /'solicitante_id', v_sol\.solicitante_id, 'solicitante_papel', v_sol\.solicitante_papel/u);
});

test('the sanctioned readers remain the Client and Admin paths in the runtime', () => {
  const cliDetail = fs.readFileSync(path.join(REPO_ROOT, 'js', 'screens', 'cliente-pedido-detail.js'), 'utf8');
  const cliEdit = fs.readFileSync(path.join(REPO_ROOT, 'js', 'screens', 'cliente-pedido-edit.js'), 'utf8');
  const review = fs.readFileSync(path.join(REPO_ROOT, 'js', 'screens', 'pedido-alteracao-review.js'), 'utf8');
  assert.match(cliDetail, /rpc\(\s*['"]cliente_alteracao_resumo['"]/u);
  assert.match(cliEdit, /rpc\(\s*['"]cliente_alteracao_resumo['"]/u);
  assert.match(review, /rpc\(\s*['"]admin_alteracao_comparacao['"]/u);
});
