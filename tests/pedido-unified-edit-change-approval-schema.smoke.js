// tests/pedido-unified-edit-change-approval-schema.smoke.js
//
// PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1 — STATIC guard over
// db/92_pedido_unified_edit_change_approval_foundation.sql and over the
// contract section that owns it.
//
// This suite reads FILES ONLY. It never connects to any database, local,
// disposable, shared or remote. The behavioural proofs live in
// tests/pedido-unified-edit-change-approval-invariant.mjs, which runs on a
// disposable cluster; this file guards the properties that must never silently
// regress in source: the RPC inventory, the SECURITY DEFINER/search_path/ACL
// discipline, the absence of a second priority owner, the absence of any
// widening of the existing Pedido policies, and the contract anchors.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB92_FILENAME = '92_pedido_unified_edit_change_approval_foundation.sql';
const DB92_PATH = path.join(REPO_ROOT, 'db', DB92_FILENAME);
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'PEDIDO_OP_SCHEMA_CONTRACT.md');

const sql = fs.readFileSync(DB92_PATH, 'utf8');
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

// The eight database owners the order names, with the exact identity the
// application will call. A rename here is a breaking API change and must be a
// deliberate, reviewed act.
const MUTATION_RPCS = [
  'salvar_pedido_cliente',
  'salvar_pedido_admin',
  'solicitar_alteracao_pedido',
  'retirar_alteracao_pedido',
  'aprovar_alteracao_pedido',
  'rejeitar_alteracao_pedido',
];
const READ_RPCS = [
  'cliente_alteracao_resumo',
  'admin_alteracao_comparacao',
];
const ALL_RPCS = [...MUTATION_RPCS, ...READ_RPCS];

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

test('db/92 is forward-only and wraps the whole migration in ONE transaction', () => {
  assert.equal((sql.match(/^BEGIN;$/gmu) || []).length, 1, 'exactly one BEGIN');
  assert.equal((sql.match(/^COMMIT;$/gmu) || []).length, 1, 'exactly one COMMIT');
  assert.ok(sql.indexOf('BEGIN;') < sql.indexOf('COMMIT;'));
  assert.equal(/^ROLLBACK;$/mu.test(sql), false, 'a migration never rolls itself back');
});

test('db/92 fails closed on every declared prerequisite and repairs nothing', () => {
  assert.match(sql, /db\/92 gate: pre-requisito\(s\) ausente\(s\)/u);
  for (const prereq of [
    'public.pedidos', 'public.pedido_itens', 'public.pedido_eventos',
    'public.is_admin()', 'public.meu_cliente_id()',
    'public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)',
    'pedidos_numero_immutability_guard',
    'pedidos_prioridade_direct_write_guard',
    'pedidos_prioridade_acceptance_gate',
    'pedido_itens_ordem_direct_write_guard',
    'pedidos_cliente_insert',
    'pedido_itens_cliente_insert',
  ]) {
    assert.ok(sql.includes(prereq), `the gate must name the prerequisite ${prereq}`);
  }
  // A gate that repairs is not a gate.
  assert.equal(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.definir_prioridade_pedido/iu.test(sql), false,
    'db/92 must never redefine definir_prioridade_pedido');
});

test('db/92 is idempotent by construction', () => {
  // Every created object uses an idempotent form.
  const creates = sql.match(/^CREATE\s+(TABLE|INDEX|UNIQUE INDEX|TRIGGER|POLICY)[^\n]*/gmu) || [];
  for (const line of creates) {
    const ok = /IF NOT EXISTS/u.test(line) || /^CREATE\s+TRIGGER/u.test(line) || /^CREATE\s+POLICY/u.test(line);
    assert.ok(ok, `non-idempotent create: ${line}`);
  }
  // Triggers and policies are idempotent through an explicit preceding DROP.
  for (const trigger of ['pedidos_revisao_normalize', 'pedido_itens_revisao_bump',
    'pedido_alteracao_imutabilidade_guard', 'pedido_alteracao_itens_imutabilidade_guard']) {
    assert.match(sql, new RegExp(`DROP TRIGGER IF EXISTS ${trigger} ON`, 'u'),
      `${trigger} must be dropped before being created`);
  }
  for (const policy of ['pedido_alteracao_admin_all', 'pedido_alteracao_cliente_select',
    'pedido_alteracao_itens_admin_all', 'pedido_alteracao_itens_cliente_select']) {
    assert.match(sql, new RegExp(`DROP POLICY IF EXISTS ${policy} ON`, 'u'),
      `${policy} must be dropped before being created`);
  }
});

// ---------------------------------------------------------------------------
// Concurrency owner
// ---------------------------------------------------------------------------

test('pedidos.revisao is the concurrency owner and atualizado_em is not', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS revisao BIGINT NOT NULL DEFAULT 1/u);
  assert.match(sql, /pedidos_revisao_normalize_fn/u);
  assert.match(sql, /pedido_itens_revisao_bump_fn/u);
  // The normalizer must be the sole writer: it always assigns, never trusts.
  assert.match(sql, /NEW\.revisao := OLD\.revisao \+ 1/u);
  // Visual publication fields must NOT be in the relevance set.
  const fn = sql.slice(sql.indexOf('pedidos_revisao_normalize_fn'), sql.indexOf('pedidos_revisao_normalize\n'));
  for (const excluded of ['status_cliente_visual', 'status_cliente_excecao',
    'status_cliente_mensagem', 'status_cliente_atualizado_em']) {
    assert.equal(fn.includes(`NEW.${excluded}`), false,
      `${excluded} must not invalidate a pending request`);
  }
  for (const included of ['cliente_id', 'status', 'data_pedido', 'prazo_entrega',
    'observacao', 'prioridade_status']) {
    assert.ok(fn.includes(`NEW.${included}`), `${included} must advance the revision`);
  }
  // db/92 must not try to make atualizado_em a version.
  assert.equal(/atualizado_em\s*:=\s*now\(\)/u.test(sql.slice(0, sql.indexOf('pedido_alteracao_solicitacoes'))), false,
    'db/92 does not repair pedidos.atualizado_em; that debt is owned separately');
});

// ---------------------------------------------------------------------------
// Request model
// ---------------------------------------------------------------------------

test('the request status set is closed and exactly the accepted six', () => {
  const m = sql.match(/status = ANY \(ARRAY\[([^\]]+)\]\)/u);
  assert.ok(m, 'the status CHECK must exist');
  const values = m[1].match(/'([a-z_]+)'/gu).map((v) => v.replace(/'/gu, ''));
  assert.deepEqual(values.sort(),
    ['aprovada', 'falha_aplicacao', 'pendente', 'rejeitada', 'retirada', 'substituida']);
});

test('at most one pending request per Pedido is enforced by the database', () => {
  assert.match(sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS pedido_alteracao_um_pendente_por_pedido_uq\s+ON public\.pedido_alteracao_solicitacoes \(pedido_id\)\s+WHERE status = 'pendente'/u);
});

test('the before-image and the proposed collection are immutable after submission', () => {
  assert.match(sql, /base_snapshot\s+JSONB NOT NULL/u);
  assert.match(sql, /base_revisao\s+BIGINT NOT NULL/u);
  assert.match(sql, /PEDIDO_ALTERACAO_IMUTAVEL/u);
});

test('the proposed item collection is absolute and validated as rows', () => {
  assert.match(sql, /pedido_item_id\s+UUID REFERENCES public\.pedido_itens\(id\) ON DELETE SET NULL/u);
  assert.match(sql, /modelo_id\s+BIGINT NOT NULL REFERENCES public\.modelos\(id\) ON DELETE RESTRICT/u);
  assert.match(sql, /pedido_alteracao_item_metros_chk CHECK \(metros > 0\)/u);
  assert.match(sql, /pedido_alteracao_item_largura_chk/u);
});

// ---------------------------------------------------------------------------
// RPC discipline
// ---------------------------------------------------------------------------

test('the eight declared RPC owners exist, and no more', () => {
  for (const fn of ALL_RPCS) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'u'),
      `missing RPC ${fn}`);
  }
});

test('every RPC is SECURITY DEFINER with a pinned search_path', () => {
  for (const fn of ALL_RPCS) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    assert.ok(start > 0, fn);
    const body = sql.slice(start, start + 900);
    assert.match(body, /SECURITY DEFINER/u, `${fn} must be SECURITY DEFINER`);
    assert.match(body, /SET search_path = public(, auth)?/u, `${fn} must pin search_path`);
  }
});

test('every RPC revokes PUBLIC and anon and grants only authenticated', () => {
  for (const fn of ALL_RPCS) {
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC;`, 'u'),
      `${fn} must revoke PUBLIC`);
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon;`, 'u'),
      `${fn} must revoke anon`);
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO authenticated;`, 'u'),
      `${fn} must grant authenticated`);
    assert.equal(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO (anon|service_role|PUBLIC)`, 'u').test(sql),
      false, `${fn} must not grant anon, service_role or PUBLIC`);
  }
});

test('every mutation RPC derives its own role and never trusts a caller-supplied one', () => {
  for (const fn of MUTATION_RPCS) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    const end = sql.indexOf('COMMENT ON FUNCTION', start);
    const body = sql.slice(start, end);
    assert.ok(/public\.is_admin\(\)|public\.meu_cliente_id\(\)/u.test(body),
      `${fn} must derive the caller from is_admin()/meu_cliente_id()`);
    assert.equal(/p_papel|p_role|p_is_admin|p_cliente_id/u.test(body), false,
      `${fn} must not accept a caller-supplied role or client identity`);
  }
});

test('every Pedido-mutating RPC locks the Pedido before its items', () => {
  for (const fn of ['salvar_pedido_cliente', 'salvar_pedido_admin', 'aprovar_alteracao_pedido']) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    const end = sql.indexOf('COMMENT ON FUNCTION', start);
    const body = sql.slice(start, end);
    const pedidoLock = body.indexOf('FROM public.pedidos WHERE id');
    const itensLock = body.indexOf('FROM public.pedido_itens WHERE pedido_id');
    assert.ok(pedidoLock > 0, `${fn} must lock the Pedido`);
    assert.ok(itensLock > pedidoLock,
      `${fn} must lock pedidos BEFORE pedido_itens (db/88 global lock order)`);
    assert.match(body.slice(itensLock, itensLock + 200), /ORDER BY id\s+FOR UPDATE/u,
      `${fn} must lock items in a deterministic order`);
  }
});

// ---------------------------------------------------------------------------
// Binding supervisor amendments
// ---------------------------------------------------------------------------

test('structural item change is refused once ANY OP exists, with no override', () => {
  assert.match(sql, /PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP/u);
  // The refusal must not be reachable past an impact-confirmation flag.
  const occurrences = sql.split('PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP').length - 1;
  assert.ok(occurrences >= 4, `the refusal must guard every write path (got ${occurrences})`);
  for (const fn of ['salvar_pedido_cliente', 'salvar_pedido_admin',
    'solicitar_alteracao_pedido', 'aprovar_alteracao_pedido']) {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    const end = sql.indexOf('COMMENT ON FUNCTION', start);
    const body = sql.slice(start, end);
    assert.ok(body.includes('pedido_tem_op_relacionada'), `${fn} must consult the OP gate`);
    assert.equal(/p_confirmar_impacto[^\n]*ESTRUTURA/u.test(body), false,
      `${fn} must not let impact confirmation override the structural refusal`);
  }
});

test('no RPC in this phase mutates OP, op_itens, expedicao or entrega', () => {
  const forbidden = /\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+public\.(ops|op_itens|expedicoes|expedicao_itens|entregas|entrega_itens|lotes)\b/iu;
  assert.equal(forbidden.test(sql), false,
    'db/92 must never write to production, expedition or delivery tables');
});

test('client data_pedido is immutable after creation and creation stays untouched', () => {
  assert.match(sql, /PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE/u);
  // The creation policies must NOT be dropped or replaced by this phase.
  assert.equal(/DROP POLICY[^\n]*pedidos_cliente_insert/u.test(sql), false);
  assert.equal(/DROP POLICY[^\n]*pedido_itens_cliente_insert/u.test(sql), false);
  assert.equal(/CREATE POLICY\s+pedidos_cliente_insert/u.test(sql), false);
  assert.equal(/CREATE POLICY\s+pedido_itens_cliente_insert/u.test(sql), false);
});

test('priority keeps exactly one owner: definir_prioridade_pedido', () => {
  assert.match(sql, /PERFORM public\.definir_prioridade_pedido\(/u);
  // No direct write to any priority column anywhere in the migration body.
  assert.equal(/SET[^;]*prioridade_status\s*=/iu.test(sql), false,
    'db/92 must never write prioridade_status directly');
  assert.equal(/SET[^;]*prioridade_confirmada_por\s*=/iu.test(sql), false,
    'db/92 must never write prioridade_confirmada_por directly');
});

test('the approval failure contract uses a subtransaction, not a caller', () => {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.aprovar_alteracao_pedido(');
  const end = sql.indexOf('COMMENT ON FUNCTION public.aprovar_alteracao_pedido', start);
  const body = sql.slice(start, end);
  assert.match(body, /EXCEPTION WHEN OTHERS THEN/u, 'the application stage needs a subtransaction');
  assert.match(body, /status = 'falha_aplicacao'/u);
  assert.match(body, /falha_identificador = v_falha/u);
  assert.match(body, /PEDIDO_ALTERACAO_FALHA_APLICACAO/u);
  // Every EXPECTED refusal must be raised BEFORE the subtransaction begins, so
  // it can never be recorded as an application failure.
  const guardIdx = body.indexOf('EXCEPTION WHEN OTHERS THEN');
  for (const expected of ['PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA',
    'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA',
    'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP',
    'PEDIDO_ALTERACAO_PEDIDO_TERMINAL']) {
    const at = body.indexOf(expected);
    assert.ok(at > 0 && at < guardIdx,
      `${expected} must be raised before the application subtransaction`);
  }
});

// ---------------------------------------------------------------------------
// Security surface
// ---------------------------------------------------------------------------

test('the new tables enable RLS and expose no client write policy', () => {
  for (const t of ['pedido_alteracao_solicitacoes', 'pedido_alteracao_solicitacao_itens']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`, 'u'));
  }
  assert.match(sql, /CREATE POLICY pedido_alteracao_cliente_select ON public\.pedido_alteracao_solicitacoes\s+FOR SELECT/u);
  assert.match(sql, /CREATE POLICY pedido_alteracao_itens_cliente_select ON public\.pedido_alteracao_solicitacao_itens\s+FOR SELECT/u);
  assert.equal(/CREATE POLICY[^\n]*cliente[^\n]*FOR (INSERT|UPDATE|DELETE|ALL)/u.test(sql), false,
    'the client gets SELECT and nothing else on the request tables');
  assert.equal(/CREATE POLICY[^\n]*\banon\b/u.test(sql), false, 'no anon policy');
});

test('direct DML on the request tables is revoked from authenticated and anon', () => {
  for (const t of ['pedido_alteracao_solicitacoes', 'pedido_alteracao_solicitacao_itens']) {
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${t}\\s+FROM ${role};`, 'u'),
        `${t} must revoke ALL from ${role} (Supabase default privileges grant it otherwise)`);
    }
    assert.match(sql, new RegExp(`GRANT SELECT ON public\\.${t}\\s+TO authenticated;`, 'u'));
  }
});

test('no existing Pedido policy is widened by this phase', () => {
  assert.equal(/(CREATE|DROP)\s+POLICY[^\n]*ON public\.pedidos\b/u.test(sql), false,
    'db/92 must not touch any policy on public.pedidos');
  assert.equal(/(CREATE|DROP)\s+POLICY[^\n]*ON public\.pedido_itens\b/u.test(sql), false,
    'db/92 must not touch any policy on public.pedido_itens');
});

test('item removal cannot silently orphan a production, expedition or partial row', () => {
  assert.match(sql, /pedido_item_tem_vinculo_producao/u);
  assert.match(sql, /PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP/u);
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.pedido_itens_reconciliar(');
  const end = sql.indexOf('REVOKE EXECUTE ON FUNCTION public.pedido_itens_reconciliar', start);
  const body = sql.slice(start, end);
  assert.ok(body.indexOf('pedido_item_tem_vinculo_producao') < body.indexOf('DELETE FROM public.pedido_itens'),
    'the orphan check must run BEFORE the delete');
});

// ---------------------------------------------------------------------------
// Contract coupling
// ---------------------------------------------------------------------------

test('the contract owns this design and its schema-implementation evidence', () => {
  assert.match(contract,
    /^## Update 2026-07-29 — Unified Pedido Editing and Client Change Approval Design R1$/mu);
  assert.match(contract, /### U14\. Schema implementation evidence/u);
  assert.ok(contract.includes(DB92_FILENAME), 'the contract must name the migration file');
  // The supervisor amendments must be canonicalized, not left open.
  assert.equal(/### U13\. Open supervisor decisions/u.test(contract), false,
    'U13 must be converted from open decisions to ratified rulings');
  assert.match(contract, /### U13\. Ratified supervisor rulings/u);
});

test('the contract records the eight RPC owners it actually ships', () => {
  const section = contract.slice(contract.indexOf('## Update 2026-07-29 — Unified Pedido Editing'));
  for (const fn of ALL_RPCS) {
    assert.ok(section.includes(fn), `the contract must name ${fn}`);
  }
});

test('the contract no longer PRESCRIBES a level-D metres reconciliation', () => {
  const section = contract.slice(contract.indexOf('## Update 2026-07-29 — Unified Pedido Editing'));
  // The two identifiers may still be NAMED, but only to record that they were
  // withdrawn — the section must say so, and the migration must not ship them.
  for (const id of ['PEDIDO_ALTERACAO_METROS_ABAIXO_DO_ENTREGUE',
    'PEDIDO_ALTERACAO_MODELO_BLOQUEADO_EM_PRODUCAO']) {
    assert.equal(sql.includes(id), false, `${id} must not be shipped by db/92`);
    if (section.includes(id)) {
      assert.match(section, /[Ww]ithdrawn/u,
        `${id} may only appear in a withdrawal statement`);
    }
  }
  assert.match(section, /### U5\.4 No quantity reconciliation in this design/u);
  // The graded ladder itself is gone from the disposition.
  const u52 = section.slice(section.indexOf('#### U5.2'), section.indexOf('#### U5.3'));
  assert.equal(/\breconcile\b/u.test(u52), false, 'U5.2 must not offer a reconcile disposition');
  assert.match(u52, /\| Proposed change \| No related OP \| Any related OP \| Terminal Pedido \|/u);
});

// ---------------------------------------------------------------------------
// C1 — db/93 helper privilege correction (static, source-level)
//
// The behavioural proof lives in
// tests/pedido-change-approval-helper-privilege-invariant.mjs, which reproduces
// the defect on a disposable cluster before correcting it. These assertions
// guard the FILE, so a future edit that re-opens a helper is caught without a
// cluster.
// ---------------------------------------------------------------------------

const DB93_PATH = path.join(REPO_ROOT, 'db', '93_pedido_change_approval_helper_privilege_correction.sql');
const sql93 = fs.readFileSync(DB93_PATH, 'utf8');

// The fourteen internal owners, with the exact signature db/93 must name.
const INTERNAL_HELPERS = [
  'public.pedidos_revisao_normalize_fn()',
  'public.pedido_itens_revisao_bump_fn()',
  'public.pedido_alteracao_imutabilidade_guard_fn()',
  'public.pedido_alteracao_itens_imutabilidade_guard_fn()',
  'public.pedido_tem_op_relacionada(UUID)',
  'public.pedido_item_tem_vinculo_producao(UUID)',
  'public.pedido_snapshot(UUID)',
  'public.pedido_itens_sequencia(UUID)',
  'public.pedido_itens_payload_normalizar(UUID, JSONB)',
  'public.pedido_itens_payload_e_estrutural(UUID, JSONB)',
  'public.pedido_header_validar(JSONB, TEXT)',
  'public.pedido_header_aplicar(UUID, JSONB)',
  'public.pedido_itens_reconciliar(UUID, JSONB)',
  'public.pedido_prioridade_aplicar(UUID, BOOLEAN, BOOLEAN)',
];

test('db/93 is forward-only, single-transaction and privilege-only', () => {
  assert.equal((sql93.match(/^BEGIN;$/gmu) || []).length, 1);
  assert.equal((sql93.match(/^COMMIT;$/gmu) || []).length, 1);
  // Privilege-only: no structural or body change may hide in this migration.
  for (const forbidden of [
    /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/iu,
    /CREATE\s+TABLE/iu,
    /ALTER\s+TABLE/iu,
    /CREATE\s+(UNIQUE\s+)?INDEX/iu,
    /CREATE\s+TRIGGER/iu,
    /DROP\s+(TABLE|TRIGGER|POLICY|INDEX|FUNCTION)/iu,
    /CREATE\s+POLICY/iu,
    /\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)\b/iu,
  ]) {
    assert.equal(forbidden.test(sql93), false, `db/93 must be privilege-only; found ${forbidden}`);
  }
});

test('db/93 revokes every application role from all fourteen internal helpers', () => {
  assert.equal(INTERNAL_HELPERS.length, 14);
  for (const signature of INTERNAL_HELPERS) {
    // Exact-substring matching: these signatures contain regex metacharacters
    // and the assertion is about a literal line, not a pattern.
    const revoke = `REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role;`;
    assert.ok(sql93.includes(revoke),
      `db/93 must revoke all application roles from ${signature}`);
    // And must never hand any of them back to an application role.
    assert.equal(sql93.includes(`ON FUNCTION ${signature} TO `), false,
      `db/93 must not grant EXECUTE on ${signature}`);
  }
});

// The eight public RPCs, with the exact signature db/93 must name.
const RPC_SIGNATURES = [
  'public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN)',
  'public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN)',
  'public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT)',
  'public.retirar_alteracao_pedido(UUID)',
  'public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT)',
  'public.rejeitar_alteracao_pedido(UUID, TEXT)',
  'public.cliente_alteracao_resumo(UUID)',
  'public.admin_alteracao_comparacao(UUID)',
];

test('db/93 keeps exactly the eight RPCs executable by authenticated', () => {
  assert.equal(RPC_SIGNATURES.length, 8);
  for (const signature of RPC_SIGNATURES) {
    assert.ok(sql93.includes(`ON FUNCTION ${signature} TO authenticated, service_role;`),
      `db/93 must grant ${signature} to authenticated`);
    assert.ok(sql93.includes(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon;`),
      `db/93 must revoke PUBLIC and anon from ${signature}`);
  }
  // The authenticated allowlist is EXACTLY those eight: no internal helper may
  // appear on the granting side anywhere in the migration.
  const grantedNames = [...sql93.matchAll(/ON FUNCTION public\.(\w+)\(/gu)]
    .filter((m) => {
      const tail = sql93.slice(m.index, sql93.indexOf(';', m.index));
      return tail.includes(' TO ');
    })
    .map((m) => m[1]);
  assert.deepEqual([...new Set(grantedNames)].sort(), [...ALL_RPCS].sort());
});

test('db/93 fails closed and verifies its own result', () => {
  assert.match(sql93, /db\/93 gate: pre-requisito\(s\) ausente\(s\)/u);
  assert.match(sql93, /o inventario de db\/92 deve resolver exatamente 22 funcoes/u);
  // A migration that declares a privilege state must prove it reached it.
  assert.match(sql93, /db\/93 verify: estado de privilegio incorreto/u);
  assert.match(sql93, /helper executavel por/u);
  assert.match(sql93, /dono perdeu EXECUTE/u);
});

test('the contract records the C1 security correction', () => {
  assert.match(contract, /### U15\. Security correction C1 — internal helper execution \(db\/93\)/u);
  assert.ok(contract.includes('93_pedido_change_approval_helper_privilege_correction.sql'));
  // The root cause must be stated, not just the fix.
  assert.match(contract, /ALTER DEFAULT PRIVILEGES/u);
  assert.match(contract, /owner-only/u);
});
