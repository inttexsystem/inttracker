// Migration smoke for db/63_is_admin_full_grants.sql — phase A2.1-B
// (grants-only ACL correction over db/62; precedent db/57). Static
// assertions on the SQL file (no DB access).
//
// Intent: the file must state the COMPLETE intended ACL — EXECUTE for
// authenticated only; PUBLIC, anon and service_role denied — grants-only,
// with no schema/function/policy/DML change.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '63_is_admin_full_grants.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const sql = readOrFail(SQL);
const executableSql = sql.replace(/^\s*--.*$/gm, '');

test('SQL63: migration existe e referencia a fase A2.1-B', () => {
  assert.ok(fs.existsSync(SQL));
  assert.match(sql, /A2\.1-B/);
});

test('SQL63: revoga EXECUTE de PUBLIC, anon e service_role', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin_full\(\)\s+FROM PUBLIC/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin_full\(\)\s+FROM anon/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin_full\(\)\s+FROM service_role/i);
});

test('SQL63: concede EXECUTE apenas a authenticated', () => {
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_admin_full\(\)\s+TO authenticated/i);
  // não deve conceder a nenhum outro role — o grantee (após TO) é só authenticated
  const grants = executableSql.match(/GRANT\s+EXECUTE[^;]*/gi) || [];
  assert.equal(grants.length, 1, 'esperado exatamente um GRANT EXECUTE');
  const grantee = grants[0].replace(/^[\s\S]*\bTO\b/i, '').trim();
  assert.equal(grantee, 'authenticated', 'GRANT EXECUTE deve conceder apenas a authenticated: ' + grantee);
});

test('SQL63: grants-only — sem schema/função/policy/DML', () => {
  assert.doesNotMatch(executableSql, /ALTER\s+TABLE/i);
  assert.doesNotMatch(executableSql, /ADD\s+COLUMN/i);
  assert.doesNotMatch(executableSql, /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
  assert.doesNotMatch(executableSql, /CREATE\s+POLICY/i);
  assert.doesNotMatch(executableSql, /DROP\s+POLICY/i);
  assert.doesNotMatch(executableSql, /INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
});

test('SQL63: NÃO toca is_admin() (âncora RLS — apenas is_admin_full)', () => {
  assert.doesNotMatch(executableSql, /\bis_admin\s*\(\s*\)/i);
  // toda referência a função é a is_admin_full()
  const fns = executableSql.match(/FUNCTION\s+public\.\w+\(\)/gi) || [];
  assert.ok(fns.length >= 1, 'esperado ao menos uma referência a FUNCTION public.<fn>()');
  for (const f of fns) {
    assert.match(f, /is_admin_full/i, 'apenas is_admin_full deve ser alvo: ' + f);
  }
});

test('SQL63: termina com reload do schema cache', () => {
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+schema'/i);
});
