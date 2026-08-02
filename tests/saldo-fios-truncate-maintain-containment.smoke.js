// tests/saldo-fios-truncate-maintain-containment.smoke.js
//
// SALDO-FIOS-TRUNCATE-AND-MAINTAIN-SURVIVE — structural proof of
// db/117_saldo_fios_truncate_maintain_contencao_simetrica.sql and of the
// repository-side facts the correction rests on.
//
// This suite reads FILES ONLY. It connects to no database, local or remote,
// and it never truncates anything anywhere. The live privilege state was
// measured directly on the production project during the authorized
// application and is recorded in that order's evidence; it is deliberately
// NOT restated here, because the live catalogue owns it.
//
// The load-bearing repository facts here are (1) that the correction is
// exactly six table-level REVOKEs of exactly TRUNCATE and MAINTAIN across
// both containment tables and the three client roles, granting nothing back
// and touching no other privilege, and (2) that no versioned caller depends
// on either privilege under a client role. If such a caller ever appears,
// this suite fails and the ACL must be re-derived before it ships.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DB117_FILENAME = '117_saldo_fios_truncate_maintain_contencao_simetrica.sql';
const DB117_PATH = path.join(REPO_ROOT, 'db', DB117_FILENAME);
const DB106B_PATH = path.join(REPO_ROOT, 'db', '106b_contencao_dml.sql');
const DB116_PATH = path.join(REPO_ROOT, 'db', '116_saldo_fios_contencao_dml_simetrica.sql');
const DB_DIR = path.join(REPO_ROOT, 'db');

const TABELAS = ['saldo_fios', 'saldo_fios_op'];
const PAPEIS = ['anon', 'authenticated', 'service_role'];
const ALVO = ['TRUNCATE', 'MAINTAIN'];

const sql = fs.readFileSync(DB117_PATH, 'utf8');
const db106b = fs.readFileSync(DB106B_PATH, 'utf8');
const db116 = fs.readFileSync(DB116_PATH, 'utf8');

// Executable SQL only. Structural assertions must never be satisfied — or
// tripped — by commentary, and this migration's header deliberately QUOTES
// the recovery GRANT it must never execute.
const sqlCode = sql.replace(/^\s*--.*$/gmu, '');

// Executable STATEMENTS only: `sqlCode` with every single-quoted literal
// emptied. An absence assertion must not be tripped by a privilege name that
// merely appears inside a RAISE message or a TEXT[] of privileges to check —
// naming `TRUNCATE` in an assertion is not truncating anything.
const sqlStatements = sqlCode.replace(/'(?:[^']|'')*'/gu, "''");

// ---------------------------------------------------------------------------
// The migration itself
// ---------------------------------------------------------------------------

test('db/117 exists, is forward-only and rewrites no accepted migration', () => {
  assert.ok(fs.existsSync(DB117_PATH), `${DB117_FILENAME} must exist`);
  assert.equal(/CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|TRIGGER|INDEX|POLICY|SEQUENCE)/iu.test(sqlCode), false,
    'db/117 is an ACL correction: it creates no table, function, trigger, index, policy or sequence');
  assert.equal(/ALTER\s+TABLE/iu.test(sqlCode), false, 'db/117 alters no table structure');
  assert.equal(/DROP\s+/iu.test(sqlCode), false, 'db/117 drops nothing');
});

test('db/117 executes no TRUNCATE and mutates no business row', () => {
  // The whole point of the order: prove the property WITHOUT ever truncating.
  assert.equal(/\bTRUNCATE\s+(TABLE\s+|ONLY\s+)?(public\.)?saldo_fios/iu.test(sqlStatements), false,
    'db/117 must never execute TRUNCATE against either target table');
  assert.equal(/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)/iu.test(sqlStatements), false,
    'db/117 writes, changes and removes no row; the five historical balances are preserved');
});

test('db/117 revokes exactly TRUNCATE and MAINTAIN, at table level, from the three client roles on BOTH tables', () => {
  const revokes = [...sqlCode.matchAll(/REVOKE\s+([^;]*?)\s+ON\s+TABLE\s+public\.(\w+)\s+FROM\s+(\w+);/gu)];
  assert.equal(revokes.length, 6, 'exactly six REVOKE statements are expected: two tables x three client roles');

  const seen = new Set();
  for (const [, privs, table, role] of revokes) {
    assert.ok(TABELAS.includes(table), `${table} is not one of the two containment tables`);
    assert.deepEqual(privs.split(',').map((p) => p.trim().toUpperCase()), ALVO,
      'each REVOKE names exactly TRUNCATE, MAINTAIN — in that order and nothing else');
    assert.ok(PAPEIS.includes(role), `${role} is not one of the three client roles`);
    const key = `${table}/${role}`;
    assert.equal(seen.has(key), false, `${key} is revoked more than once`);
    seen.add(key);
  }
  // Symmetry is the property the debt names: every table x role pair covered.
  const expected = TABELAS.flatMap((t) => PAPEIS.map((r) => `${t}/${r}`)).sort();
  assert.deepEqual([...seen].sort(), expected,
    'the correction must be symmetric across both tables and all three client roles');
});

test('db/117 grants nothing back and never executes its own recovery block', () => {
  assert.equal(/\bGRANT\b/iu.test(sqlStatements), false,
    'the recovery GRANT lives in the inert commentary block only; executing it would defeat the containment');
  // The recovery path must still be RECORDED, so the way back is not lost.
  assert.match(sql, /GRANT TRUNCATE, MAINTAIN ON TABLE public\.saldo_fios, public\.saldo_fios_op/u,
    'the exact recovery statement must be recorded in the migration');
  assert.match(sql, /TO anon, authenticated, service_role;/u,
    'the recovery statement must name the exact three roles it restores');
});

test('db/117 revokes no privilege outside the two the debt names', () => {
  // SELECT, REFERENCES and TRIGGER are non-mutating and must survive.
  // INSERT, UPDATE and DELETE are already contained by db/106b and db/116 and
  // must not be re-revoked here: this migration continues that posture, it
  // does not redo it. Either would be unrelated ACL cleanup.
  for (const priv of ['SELECT', 'REFERENCES', 'TRIGGER', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.equal(new RegExp(`REVOKE[^;]*\\b${priv}\\b[^;]*ON TABLE`, 'iu').test(sqlStatements), false,
      `${priv} is outside this order's scope and must not appear in a REVOKE`);
  }
  // No table other than the two containment tables is touched.
  const targets = new Set([...sqlCode.matchAll(/ON\s+TABLE\s+public\.(\w+)/gu)].map((m) => m[1]));
  assert.deepEqual([...targets].sort(), [...TABELAS].sort(),
    'only public.saldo_fios and public.saldo_fios_op may appear as REVOKE targets');
});

test('db/117 narrows no role beyond the three client roles, and never PUBLIC', () => {
  const grantees = new Set([...sqlCode.matchAll(/ON\s+TABLE\s+public\.\w+\s+FROM\s+([^;]+);/gu)]
    .flatMap((m) => m[1].split(',').map((r) => r.trim())));
  assert.deepEqual([...grantees].sort(), [...PAPEIS].sort(),
    'only anon, authenticated and service_role are narrowed; postgres keeps TRUNCATE and MAINTAIN');
  // Anchored inside a REVOKE grantee list, and excluding `FROM public.<table>`,
  // which is the schema qualifier and not the PUBLIC pseudo-role.
  assert.equal(/REVOKE[^;]*\bFROM\b[^;]*\bPUBLIC\b(?!\s*\.)/iu.test(sqlStatements), false,
    'PUBLIC holds nothing on either table; the gate ASSERTS that absence instead of issuing a no-op REVOKE');
  // And that assertion must actually be present, or the bounded form is unproved.
  assert.ok(sql.includes('concessao(oes) a PUBLIC'),
    'the gate must refuse to apply if a PUBLIC grant ever appears');
});

test('db/117 fails closed on every precondition it depends on', () => {
  for (const anchor of [
    'db/117 gate: pre-requisito(s) ausente(s)',
    'db/117 gate: papel de aplicacao ausente',
    'db/117 gate: MAINTAIN exige PostgreSQL 17',
    'db/117 gate: o dono de public.% deixou de ser postgres',
    'db/117 gate: ROW LEVEL SECURITY',
    'db/117 gate: trg_c3c_protected_mutation_guard ausente ou desabilitado',
    'db/117 gate: escritor canonico',
    'db/117 gate: papel-cliente alcanca o escritor canonico',
    'db/117 gate: a contencao de db/106b/db/116 nao esta em vigor',
    'db/117 gate: papel-cliente e membro de',
    'db/117 gate: productive_receipt_started_at nao e NULL',
  ]) {
    assert.ok(sql.includes(anchor), `the gate must be able to refuse with: ${anchor}`);
  }
});

test('db/117 proves a table-level REVOKE is sufficient before it issues one', () => {
  // The three ways a table REVOKE could be incomplete, each measured:
  // PUBLIC, role inheritance, and an unexpected column ACL.
  assert.ok(sqlCode.includes('aclexplode'), 'a PUBLIC grantee must be detected structurally');
  assert.ok(sqlCode.includes('a.grantee = 0'), 'grantee 0 is PUBLIC and must be the tested condition');
  assert.ok(sqlCode.includes('pg_auth_members'), 'role inheritance must be measured, not assumed');
  assert.ok(sqlCode.includes('rolsuper'), 'a client role turning superuser must be refused');
  assert.ok(sqlCode.includes('attacl'), 'an independent column ACL must be detected by pg_attribute.attacl');
});

test('db/117 refuses to apply after the PONR', () => {
  assert.match(sqlCode, /productive_receipt_started_at/u,
    'the gate must read the PONR marker from public.ordem_compra_cutover');
  assert.ok(sql.includes('o PONR ja foi cruzado'),
    'crossing the PONR must be an explicit, named refusal');
  assert.ok(sql.includes('productive_receipt_started_at deixou de ser NULL'),
    'the verification must re-prove that the PONR is still uncrossed');
});

test('db/117 never names the unauthorized db/110 slot', () => {
  assert.equal(/\bdb\/110\b/u.test(sqlCode), false, 'db/110 must not appear in executable SQL');
  const mentions = sql.match(/^.*db\/110.*$/gmu) || [];
  for (const line of mentions) {
    assert.match(line, /^\s*--/u, 'db/110 may appear in commentary only');
    assert.match(line, /AUSENTE|NAO AUTORIZADA/u,
      'the only permitted mention of db/110 is that it remains absent and unauthorized');
  }
});

test('db/117 verifies its own result, positively and negatively', () => {
  assert.ok(sql.includes('db/117 verify:'), 'the migration must prove its own result');
  assert.ok(sqlCode.includes('has_table_privilege'), 'table privilege must be measured, not deduced');
  assert.ok(sql.includes('assimetria remanescente'),
    'the verification must prove the effective privilege sets are equal across both tables');
  // The containment it inherits must be re-proved, not assumed to survive.
  assert.ok(sql.includes('reganhou'),
    'the verification must prove no INSERT/UPDATE/DELETE was granted back');
  // The owner must keep what the client roles lose.
  assert.ok(sql.includes('postgres perdeu'),
    'the verification must prove postgres kept full access, TRUNCATE and MAINTAIN included');
});

test('db/117 proves business-data invariance rather than asserting it', () => {
  assert.ok(sqlCode.includes("set_config('db117.sf_fingerprint'"),
    'the gate must capture the saldo_fios fingerprint BEFORE the revoke');
  assert.ok(sqlCode.includes("set_config('db117.sfop_fingerprint'"),
    'the gate must capture the saldo_fios_op fingerprint BEFORE the revoke');
  assert.ok(sqlCode.includes("current_setting('db117.sf_fingerprint', true)"),
    'the verification must compare against the captured fingerprint');
  assert.ok(sql.includes('saldo_fios mudou: antes=%s depois=%s'),
    'a changed fingerprint must be an explicit, named failure');
});

// ---------------------------------------------------------------------------
// The accepted posture this correction continues
// ---------------------------------------------------------------------------

test('db/106b and db/116 are the accepted prior posture and stay untouched', () => {
  // Each removed exactly INSERT/UPDATE/DELETE, and neither touched TRUNCATE
  // or MAINTAIN — which is precisely why this debt existed.
  for (const [name, body, tabela] of [['db/106b', db106b, 'saldo_fios_op'], ['db/116', db116, 'saldo_fios']]) {
    const code = body.replace(/^\s*--.*$/gmu, '').replace(/'(?:[^']|'')*'/gu, "''");
    for (const role of PAPEIS) {
      assert.match(code, new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${tabela} FROM ${role};`, 'u'),
        `${name} must still carry its accepted REVOKE for ${role}`);
    }
    for (const priv of ALVO) {
      assert.equal(new RegExp(`REVOKE[^;]*\\b${priv}\\b[^;]*ON TABLE`, 'iu').test(code), false,
        `${name} deliberately never revoked ${priv}; that omission is the debt db/117 closes`);
    }
  }
  // db/117 asserts that inherited posture at runtime rather than assuming it.
  assert.ok(sql.includes('a contencao de db/106b/db/116 nao esta em vigor'),
    'db/117 must refuse to apply over a state that lacks the accepted containment');
});

// ---------------------------------------------------------------------------
// The caller boundary the revoke rests on
// ---------------------------------------------------------------------------

test('the only versioned TRUNCATE of either table is the owner-run development seed', () => {
  const offenders = [];
  for (const filename of fs.readdirSync(DB_DIR)) {
    if (!filename.endsWith('.sql') || filename === DB117_FILENAME) continue;
    const body = fs.readFileSync(path.join(DB_DIR, filename), 'utf8').replace(/^\s*--.*$/gmu, '');
    // A real TRUNCATE statement, not the word inside a REVOKE/GRANT or an array.
    const re = /(^|;)\s*TRUNCATE\s+(TABLE\s+|ONLY\s+)?([^;]*)/giu;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (TABELAS.some((t) => new RegExp(`\\b${t}\\b`, 'u').test(m[3]))) offenders.push(filename);
    }
  }
  assert.deepEqual([...new Set(offenders)], ['04_seed.sql'],
    'only db/04_seed.sql truncates these tables, and it runs in the SQL Editor as the owner, which keeps TRUNCATE');
});

test('no versioned caller depends on MAINTAIN for either table', () => {
  // MAINTAIN permits VACUUM, ANALYZE, REINDEX, CLUSTER and REFRESH
  // MATERIALIZED VIEW. If any of those ever appears under a client-role
  // caller, the revoke stops being free and must be re-derived.
  const offenders = [];
  for (const dir of ['db', 'js', 'scripts', 'tests']) {
    const root = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) { stack.push(full); continue; }
        if (!/\.(sql|js|mjs|cjs)$/u.test(entry.name)) continue;
        if (full === DB117_PATH || full === __filename) continue;
        const body = fs.readFileSync(full, 'utf8').replace(/^\s*--.*$/gmu, '');
        if (/\b(VACUUM|REINDEX|REFRESH\s+MATERIALIZED\s+VIEW)\b/iu.test(body)) {
          offenders.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    'no repository caller issues a maintenance command, so MAINTAIN has no legitimate client-role dependant');
});

// The browser surface reaches these tables through PostgREST, which exposes no
// TRUNCATE verb and no maintenance verb at all. So a browser consumer can never
// depend on the two privileges this migration removes. What IS worth pinning is
// the shape of that access: a SELECT consumer is legitimate and unaffected,
// while a mutating one would contradict the db/106b + db/116 containment this
// migration continues, and would mean the ACL was re-derived incorrectly.
function browserConsumers() {
  const found = [];
  const stack = [path.join(REPO_ROOT, 'js')];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const body = fs.readFileSync(full, 'utf8');
      const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
      for (const tabela of TABELAS) {
        const re = new RegExp(`\\.from\\(\\s*['"\`]${tabela}['"\`]\\s*\\)([\\s\\S]{0,200})`, 'gu');
        let m;
        while ((m = re.exec(body)) !== null) {
          found.push({ file: rel, tabela, mutating: /\.(insert|update|upsert|delete)\s*\(/u.test(m[1]) });
        }
      }
    }
  }
  return found;
}

test('no browser surface issues direct DML against either containment table', () => {
  const offenders = browserConsumers().filter((c) => c.mutating).map((c) => `${c.file}:${c.tabela}`);
  assert.deepEqual(offenders, [],
    'a direct browser writer would contradict the db/106b + db/116 containment and the ACL must be re-derived first');
});

test('the only browser consumer of either table is a pinned read-only one', () => {
  const consumers = [...new Set(browserConsumers().map((c) => `${c.file}:${c.tabela}`))].sort();
  // js/screens/op-nova.js reads the server-written per-OP leftover snapshot with
  // a pure .select(); public.saldo_fios itself has no browser consumer at all.
  // SELECT survives this migration untouched, so this read keeps working.
  assert.deepEqual(consumers, ['js/screens/op-nova.js:saldo_fios_op'],
    'a new direct consumer must be re-derived against the ACL before it ships');
});
