// Migration smoke for db/62_admin_nivel_acesso_schema.sql — phase A2.1
// (nivel_acesso schema). Static assertions on the SQL file (no DB access).
//
// Allow-list note (§20 / STRUCTURAL POLICY COMPLIANCE): unlike db/58's smoke
// (which forbids CREATE FUNCTION), this migration legitimately creates the
// is_admin_full() helper — the allow-list is extended to permit exactly that
// one function, while still forbidding any touch to usuarios.tipo, is_admin(),
// RLS policies, and destructive DDL/DML.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SQL = path.join(ROOT, 'db', '62_admin_nivel_acesso_schema.sql');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const sql = readOrFail(SQL);
const executableSql = sql.replace(/^\s*--.*$/gm, '');

test('SQL62: migration existe e referencia a fase A2.1', () => {
  assert.ok(fs.existsSync(SQL));
  assert.match(sql, /A2\.1/);
});

test('SQL62: adiciona usuarios.nivel_acesso TEXT NOT NULL DEFAULT completo', () => {
  assert.match(
    sql,
    /ADD COLUMN IF NOT EXISTS nivel_acesso\s+TEXT\s+NOT NULL DEFAULT 'completo'/i,
  );
});

test('SQL62: CHECK restringe a completo/somente_leitura (expansível, nomeada, idempotente)', () => {
  assert.match(
    sql,
    /CHECK\s*\(\s*nivel_acesso\s+IN\s*\(\s*'completo'\s*,\s*'somente_leitura'\s*\)\s*\)/i,
  );
  assert.match(sql, /ADD CONSTRAINT usuarios_nivel_acesso_check/i);
  // adicionada só quando ainda não existe (pg_constraint) — idempotente
  assert.match(sql, /IF NOT EXISTS[\s\S]*pg_constraint[\s\S]*usuarios_nivel_acesso_check/i);
});

test('SQL62: NÃO altera a coluna tipo nem sua CHECK (âncora das RLS)', () => {
  // is_admin_full() LÊ tipo num SELECT interno — isso é permitido. O que a
  // decisão ratificada proíbe é DDL sobre a coluna tipo.
  assert.doesNotMatch(executableSql, /ADD\s+COLUMN[^;]*\btipo\b/i);
  assert.doesNotMatch(executableSql, /DROP\s+COLUMN[^;]*\btipo\b/i);
  assert.doesNotMatch(executableSql, /ALTER\s+COLUMN\s+tipo/i);
  assert.doesNotMatch(executableSql, /DROP\s+CONSTRAINT[^;]*tipo/i);
  assert.doesNotMatch(executableSql, /usuarios_tipo_check/i);
});

test('SQL62: NÃO redefine is_admin() (mantém a âncora RLS intacta)', () => {
  assert.doesNotMatch(executableSql, /FUNCTION\s+(public\.)?is_admin\s*\(\s*\)/i);
});

test('SQL62: cria helper is_admin_full() SECURITY DEFINER STABLE com a regra completa', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_admin_full\s*\(\s*\)/i);
  const fnBlock = sql.match(/CREATE OR REPLACE FUNCTION public\.is_admin_full[\s\S]*?\$\$;/i);
  assert.ok(fnBlock, 'corpo de is_admin_full não encontrado');
  assert.match(fnBlock[0], /SECURITY DEFINER/i);
  assert.match(fnBlock[0], /\bSTABLE\b/i);
  assert.match(fnBlock[0], /SET search_path\s*=\s*public,\s*auth/i);
  assert.match(fnBlock[0], /ativo IS TRUE/i);
  assert.match(fnBlock[0], /tipo\s*=\s*'admin'/i);
  // reads the nivel_acesso column and requires the 'completo' level (the
  // comparison is on the local variable it is read into).
  assert.match(fnBlock[0], /\bnivel_acesso\b/i);
  assert.match(fnBlock[0], /=\s*'completo'/i);
});

test('SQL62: ACL explícita em is_admin_full (revoke PUBLIC/anon, grant authenticated)', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin_full\(\)\s+FROM PUBLIC/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_admin_full\(\)\s+FROM anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_admin_full\(\)\s+TO authenticated/i);
});

test('SQL62: alveja exclusivamente public.usuarios em ALTER TABLE', () => {
  const alterTables = executableSql.match(/ALTER\s+TABLE\s+(\S+)/gi) || [];
  assert.ok(alterTables.length >= 1, 'esperado ao menos um ALTER TABLE');
  for (const a of alterTables) {
    assert.match(a, /public\.usuarios/i, 'ALTER TABLE apenas em public.usuarios: ' + a);
  }
});

test('SQL62: sem DDL/DML destrutivo (allow-list: apenas CREATE FUNCTION de is_admin_full)', () => {
  assert.doesNotMatch(executableSql, /DROP\s+TABLE/i);
  assert.doesNotMatch(executableSql, /DROP\s+COLUMN/i);
  assert.doesNotMatch(executableSql, /DELETE\s+FROM/i);
  assert.doesNotMatch(executableSql, /TRUNCATE/i);
  assert.doesNotMatch(executableSql, /DROP\s+POLICY/i);
  assert.doesNotMatch(executableSql, /CREATE\s+POLICY/i);
  const createFns = executableSql.match(/CREATE OR REPLACE FUNCTION\s+(\S+)/gi) || [];
  assert.equal(createFns.length, 1, 'exatamente uma função deve ser criada');
  assert.match(createFns[0], /is_admin_full/i, 'a única função criada deve ser is_admin_full');
});

test('SQL62: idempotente — ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE', () => {
  const alterBlock = sql.match(/ALTER TABLE public\.usuarios\s+ADD COLUMN[\s\S]*?;/i);
  assert.ok(alterBlock, 'bloco ALTER TABLE ADD COLUMN não encontrado');
  assert.doesNotMatch(alterBlock[0], /ADD COLUMN(?! IF NOT EXISTS)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION/i);
});

test('SQL62: termina com reload do schema cache', () => {
  assert.match(sql, /NOTIFY\s+pgrst,\s*'reload\s+schema'/i);
});
