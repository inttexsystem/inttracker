// =====================================================================
// === tests/admin-create-user.smoke.js ================================
// Smoke estático para a Edge Function `admin-create-user`.
//
// Verifica (sem executar a função nem acessar Supabase real):
//   - arquivos esperados existem;
//   - index.ts lê SUPABASE_SERVICE_ROLE_KEY via Deno.env.get;
//   - index.ts não contém service_role literal em valor hardcoded;
//   - index.ts valida método POST e responde OPTIONS para CORS;
//   - index.ts usa auth.admin.createUser e auth.admin.deleteUser;
//   - index.ts insere em public.usuarios;
//   - index.ts valida tipo admin/fornecedor e fornecedor_id;
//   - index.ts normaliza email para lowercase;
//   - _shared/cors.ts e _shared/response.ts expõem os helpers;
//   - index.ts não referencia js/config.js nem index.html.
//
// Pode ser executado com: node --test tests/admin-create-user.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const indexPath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-create-user",
  "index.ts",
);
const readmePath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-create-user",
  "README.md",
);
const corsPath = path.join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "cors.ts",
);
const respPath = path.join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "response.ts",
);

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo não encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const indexSrc = readOrFail(indexPath);
const readmeSrc = readOrFail(readmePath);
const corsSrc = readOrFail(corsPath);
const respSrc = readOrFail(respPath);

test("arquivos da Edge Function existem", () => {
  assert.ok(fs.existsSync(indexPath), "index.ts ausente");
  assert.ok(fs.existsSync(readmePath), "README.md ausente");
  assert.ok(fs.existsSync(corsPath), "_shared/cors.ts ausente");
  assert.ok(fs.existsSync(respPath), "_shared/response.ts ausente");
});

test("index.ts: usa Deno.env.get para SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.match(
    indexSrc,
    /Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/,
  );
});

test("index.ts: usa Deno.env.get para SUPABASE_URL e SUPABASE_ANON_KEY", () => {
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_URL["']\)/);
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_ANON_KEY["']\)/);
});

test("index.ts: não contém service_role literal em valor hardcoded", () => {
  // Garante que não há um valor de chave/role atribuído diretamente.
  assert.doesNotMatch(
    indexSrc,
    /service_role["']\s*:\s*["'][^"']+["']/i,
    "service_role literal como valor detectado",
  );
  // Garante que não há JWT (eyJ...eyJ...) hardcoded.
  assert.doesNotMatch(
    indexSrc,
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./,
    "JWT hardcoded detectado",
  );
});

test("index.ts: valida método POST e rejeita outros métodos", () => {
  assert.match(indexSrc, /req\.method\s*!==\s*["']POST["']/);
  assert.match(indexSrc, /errorResponse\(\s*["']VALIDATION_ERROR["']/);
});

test("index.ts: responde OPTIONS para preflight CORS", () => {
  assert.match(indexSrc, /req\.method\s*===\s*["']OPTIONS["']/);
});

test("index.ts: usa auth.admin.createUser para criar auth user", () => {
  assert.match(indexSrc, /auth\s*\.\s*admin\s*\.\s*createUser/);
});

test("index.ts: usa auth.admin.deleteUser para compensação", () => {
  assert.match(indexSrc, /auth\s*\.\s*admin\s*\.\s*deleteUser/);
});

test("index.ts: insere em public.usuarios", () => {
  assert.match(indexSrc, /\.from\(["']usuarios["']\)\.insert/);
});

test("index.ts: valida tipo 'admin' e 'fornecedor'", () => {
  assert.match(indexSrc, /["']admin["']/);
  assert.match(indexSrc, /["']fornecedor["']/);
});

test("index.ts: normaliza email para lowercase", () => {
  assert.match(indexSrc, /\.toLowerCase\(\)/);
});

test("index.ts: valida fornecedor_id em public.fornecedores quando tipo = fornecedor", () => {
  assert.match(indexSrc, /\.from\(["']fornecedores["']\)/);
  assert.match(indexSrc, /\.eq\(["']id["']\s*,\s*[a-zA-Z_]+\)/);
});

test("index.ts: não referencia js/config.js", () => {
  assert.doesNotMatch(indexSrc, /js\/config\.js/);
});

test("index.ts: não referencia index.html", () => {
  assert.doesNotMatch(indexSrc, /index\.html/);
});

test("_shared/cors.ts: exporta corsHeaders", () => {
  assert.match(corsSrc, /export\s+const\s+corsHeaders/);
});

test("_shared/response.ts: exporta jsonResponse e errorResponse", () => {
  assert.match(respSrc, /export\s+function\s+jsonResponse/);
  assert.match(respSrc, /export\s+function\s+errorResponse/);
});

test("README: documenta env vars e proíbe service_role no front", () => {
  assert.match(readmeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readmeSrc, /nunca/i);
  assert.match(readmeSrc, /supabase\.functions\.invoke/);
});
