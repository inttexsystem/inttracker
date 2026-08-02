// tests/saldo-fios-direct-grant-containment.smoke.js
//
// NATIVE-RECEIPT-SALDO-FIOS-DIRECT-GRANT-DEFENSE-IN-DEPTH-GAP — structural
// proof of db/116_saldo_fios_contencao_dml_simetrica.sql and of the
// repository-side writer boundary the correction rests on.
//
// This suite reads FILES ONLY. It connects to no database, local or remote.
// The live privilege state was measured directly on the production project
// during the authorized application and is recorded in that order's evidence;
// it is deliberately NOT restated here, because the live catalogue owns it.
//
// The load-bearing repository fact here is the WRITER BOUNDARY: revoking the
// direct grant is only correct while the sole writer of public.saldo_fios is a
// server-owned SECURITY DEFINER object and no browser surface issues direct
// DML. If a direct consumer ever appears, this suite fails and the ACL must be
// re-derived before that consumer ships.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB116_FILENAME = '116_saldo_fios_contencao_dml_simetrica.sql';
const DB116_PATH = path.join(REPO_ROOT, 'db', DB116_FILENAME);
const DB106B_PATH = path.join(REPO_ROOT, 'db', '106b_contencao_dml.sql');
const DB70_PATH = path.join(REPO_ROOT, 'db', '70_ordem_compra_native_receipt_foundation.sql');

const TABELA = 'saldo_fios';
const REFERENCIA = 'saldo_fios_op';
const PAPEIS = ['anon', 'authenticated', 'service_role'];
const MUTACAO = ['INSERT', 'UPDATE', 'DELETE'];

const sql = fs.readFileSync(DB116_PATH, 'utf8');
const db106b = fs.readFileSync(DB106B_PATH, 'utf8');
const db70 = fs.readFileSync(DB70_PATH, 'utf8');

// Executable SQL only. Structural assertions must never be satisfied — or
// tripped — by commentary, and this migration's header deliberately QUOTES the
// recovery GRANT it must never execute.
const sqlCode = sql.replace(/^\s*--.*$/gmu, '');

// Executable STATEMENTS only: `sqlCode` with every single-quoted literal
// emptied. An absence assertion must not be tripped by a privilege name that
// merely appears inside a RAISE message or a TEXT[] of privileges to check —
// naming `TRUNCATE` in an assertion is not truncating anything.
const sqlStatements = sqlCode.replace(/'(?:[^']|'')*'/gu, "''");

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

// ---------------------------------------------------------------------------
// The migration itself
// ---------------------------------------------------------------------------

test('db/116 exists, is forward-only and rewrites no accepted migration', () => {
  assert.ok(fs.existsSync(DB116_PATH), `${DB116_FILENAME} must exist`);
  assert.equal(/CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|TRIGGER|INDEX|POLICY|SEQUENCE)/iu.test(sqlCode), false,
    'db/116 is an ACL correction: it creates no table, function, trigger, index, policy or sequence');
  assert.equal(/ALTER\s+TABLE/iu.test(sqlCode), false, 'db/116 alters no table structure');
  assert.equal(/DROP\s+/iu.test(sqlCode), false, 'db/116 drops nothing');
  // No business-row mutation of any kind.
  assert.equal(/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+)/iu.test(sqlStatements), false,
    'db/116 writes, changes and removes no row; the five historical balances are preserved');
});

test('db/116 revokes exactly INSERT, UPDATE and DELETE, at table level, from the three client roles', () => {
  const revokes = [...sqlCode.matchAll(/REVOKE\s+([^;]*?)\s+ON\s+TABLE\s+public\.(\w+)\s+FROM\s+(\w+);/gu)];
  assert.equal(revokes.length, 3, 'exactly three REVOKE statements are expected, one per client role');

  const seen = new Set();
  for (const [, privs, table, role] of revokes) {
    assert.equal(table, TABELA, 'the only target table is public.saldo_fios');
    assert.deepEqual(privs.split(',').map((p) => p.trim().toUpperCase()), MUTACAO,
      'each REVOKE names exactly INSERT, UPDATE, DELETE — in that order and nothing else');
    assert.ok(PAPEIS.includes(role), `${role} is not one of the three client roles`);
    assert.equal(seen.has(role), false, `${role} is revoked more than once`);
    seen.add(role);
  }
  assert.deepEqual([...seen].sort(), [...PAPEIS].sort(), 'all three client roles must be covered');
});

test('db/116 grants nothing back and never executes its own recovery block', () => {
  assert.equal(/\bGRANT\b/iu.test(sqlStatements), false,
    'the recovery GRANT lives in the inert commentary block only; executing it would defeat the containment');
  // The recovery path must still be RECORDED, so the way back is not lost.
  assert.match(sql, /GRANT INSERT, UPDATE, DELETE ON TABLE public\.saldo_fios/u,
    'the exact recovery statement must be recorded in the migration');
});

test('db/116 touches no RLS policy, no RLS enabled state and no non-mutating privilege', () => {
  assert.equal(/CREATE POLICY|DROP POLICY|ALTER POLICY/iu.test(sqlCode), false,
    'RLS owns row scope and is not edited here');
  assert.equal(/ENABLE ROW LEVEL SECURITY|DISABLE ROW LEVEL SECURITY/iu.test(sqlCode), false,
    'db/116 does not touch the RLS enabled state');
  for (const priv of ['SELECT', 'REFERENCES', 'TRIGGER', 'TRUNCATE']) {
    assert.equal(new RegExp(`REVOKE[^;]*\\b${priv}\\b[^;]*ON TABLE`, 'iu').test(sqlStatements), false,
      `${priv} is a non-mutating privilege and must survive the correction`);
  }
});

test('db/116 fails closed on every precondition it depends on', () => {
  for (const anchor of [
    'db/116 gate: pre-requisito(s) ausente(s)',
    'db/116 gate: papel de aplicacao ausente',
    'db/116 gate: o dono de public.saldo_fios deixou de ser postgres',
    'db/116 gate: ROW LEVEL SECURITY',
    'db/116 gate: trg_c3c_protected_mutation_guard ausente ou desabilitado',
    'db/116 gate: escritor canonico',
    'db/116 gate: papel-cliente alcanca o escritor canonico',
    'db/116 gate: a postura de referencia de db/106b nao esta em vigor',
    'db/116 gate: public.saldo_fios tem',
    'db/116 gate: productive_receipt_started_at nao e NULL',
  ]) {
    assert.ok(sql.includes(anchor), `the gate must be able to refuse with: ${anchor}`);
  }
});

test('db/116 refuses to apply after the PONR', () => {
  assert.match(sqlCode, /productive_receipt_started_at/u,
    'the gate must read the PONR marker from public.ordem_compra_cutover');
  assert.ok(sql.includes('o PONR ja foi cruzado'),
    'crossing the PONR must be an explicit, named refusal');
  // And the verification re-asserts it afterwards.
  assert.ok(sql.includes('productive_receipt_started_at deixou de ser NULL'),
    'the verification must re-prove that the PONR is still uncrossed');
});

test('db/116 never names the unauthorized db/110 slot', () => {
  assert.equal(/\bdb\/110\b/u.test(sqlCode), false, 'db/110 must not appear in executable SQL');
  // The header may only mention it to restate that it stays absent.
  const mentions = sql.match(/^.*db\/110.*$/gmu) || [];
  for (const line of mentions) {
    assert.match(line, /^\s*--/u, 'db/110 may appear in commentary only');
    assert.match(line, /AUSENTE|NAO AUTORIZADA/u,
      'the only permitted mention of db/110 is that it remains absent and unauthorized');
  }
});

test('db/116 verifies its own result, positively and negatively', () => {
  assert.ok(sql.includes('db/116 verify:'), 'the migration must prove its own result');
  assert.ok(sqlCode.includes('has_table_privilege'), 'table privilege must be measured, not deduced');
  assert.ok(sqlCode.includes('has_any_column_privilege'),
    'PostgreSQL unions table and column grants, so the column layer must be measured too');
  assert.ok(sqlCode.includes('attacl'),
    'an independent column ACL must be detected by pg_attribute.attacl, which is NULL-safe');
  assert.equal(/aclexplode/u.test(sqlCode), false,
    'aclexplode refuses an empty ACL and must not be used to measure privilege');
  // The symmetry with the accepted reference posture is the debt's own wording.
  assert.ok(sql.includes('assimetria remanescente'),
    'the verification must prove the effective privilege sets are equal across both tables');
});

// ---------------------------------------------------------------------------
// The accepted reference posture this correction mirrors
// ---------------------------------------------------------------------------

test('db/106b is the accepted reference posture and stays untouched', () => {
  assert.match(db106b, new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${REFERENCIA} FROM authenticated;`, 'u'));
  assert.match(db106b, new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${REFERENCIA} FROM anon;`, 'u'));
  assert.match(db106b, new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${REFERENCIA} FROM service_role;`, 'u'));
  // db/106b deliberately did NOT cover saldo_fios; that omission is the debt.
  assert.equal(new RegExp(`REVOKE[^;]*ON TABLE public\\.${TABELA}\\s+FROM`, 'u').test(db106b), false,
    'db/106b never narrowed saldo_fios; db/116 is the forward correction, not a rewrite');
  // db/116 asserts that reference posture at runtime rather than assuming it.
  assert.match(sqlCode, new RegExp(`to_regclass\\('public\\.${REFERENCIA}'\\)`, 'u'));
});

// ---------------------------------------------------------------------------
// The writer boundary the revoke rests on
// ---------------------------------------------------------------------------

test('the sole writer of saldo_fios is the server-owned native ledger trigger', () => {
  // db/70 owns the only INSERT/UPDATE of saldo_fios in the migration corpus.
  assert.match(db70, /INSERT INTO public\.saldo_fios\(/u);
  assert.match(db70, /UPDATE public\.saldo_fios/u);
  // db/116 names it and asserts its security posture rather than trusting it.
  assert.ok(sqlCode.includes('public.trg_native_lancamento_derive_state()'),
    'the gate must name the canonical writer it depends on');
  assert.ok(sqlCode.includes('prosecdef'), 'the writer must be proved SECURITY DEFINER');
  assert.ok(sqlCode.includes('has_function_privilege'),
    'the writer must be proved unreachable by every client role');
});

test('no browser surface issues direct DML against saldo_fios', () => {
  const offenders = [];
  for (const file of JS_FILES) {
    const body = fs.readFileSync(file, 'utf8');
    const re = /\.from\(\s*['"`]saldo_fios['"`]\s*\)([\s\S]{0,200})/gu;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (/\.(insert|update|upsert|delete)\s*\(/u.test(m[1])) {
        offenders.push(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a direct browser writer would be broken by this revoke and the ACL must be re-derived first');
});

test('no browser surface reaches saldo_fios as a table at all', () => {
  const consumers = [];
  for (const file of JS_FILES) {
    const body = fs.readFileSync(file, 'utf8');
    if (/\.from\(\s*['"`]saldo_fios['"`]\s*\)/u.test(body)) {
      consumers.push(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
    }
  }
  assert.deepEqual(consumers, [],
    'saldo_fios has no direct browser consumer; SELECT is preserved for compatibility, not for a caller');
});
