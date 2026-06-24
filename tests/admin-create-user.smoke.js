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

// ---------------------------------------------------------------------
// RAVATEX-TAPETES-PEDIDOS-CLIENTE-PROV-A — suporte a tipo 'cliente'
// ---------------------------------------------------------------------

test("index.ts: ALLOWED_TIPOS contém 'cliente'", () => {
  // The set uses double quotes in TypeScript: Set(["admin", "fornecedor", "cliente"])
  assert.match(indexSrc, /["']cliente["']/);
  const setMatch = indexSrc.match(/ALLOWED_TIPOS\s*=\s*new\s+Set\(\[([^\]]+)\]\)/);
  assert.ok(setMatch, "ALLOWED_TIPOS não encontrado como Set literal");
  assert.match(setMatch[1], /cliente/);
});

test("index.ts: payload aceita cliente_id", () => {
  assert.match(indexSrc, /payload\.cliente_id/);
});

test("index.ts: cliente exige cliente_id (rejeita ausente/vazio)", () => {
  assert.match(indexSrc, /Usuário cliente precisa de cliente_id/);
});

test("index.ts: cliente rejeita fornecedor_id", () => {
  assert.match(indexSrc, /Usuário cliente não pode ter fornecedor_id/);
});

test("index.ts: admin rejeita cliente_id", () => {
  assert.match(indexSrc, /Usuário admin não pode ter cliente_id/);
});

test("index.ts: fornecedor rejeita cliente_id", () => {
  assert.match(indexSrc, /Usuário fornecedor não pode ter cliente_id/);
});

test("index.ts: valida existência de cliente em public.clientes", () => {
  assert.match(indexSrc, /\.from\(["']clientes["']\)/);
  assert.match(indexSrc, /cliente_id não existe em public\.clientes/);
});

test("index.ts: insert em usuarios inclui cliente_id", () => {
  // O insert deve ter cliente_id como campo
  const idx = indexSrc.indexOf('.from("usuarios").insert');
  assert.ok(idx > 0, "insert em usuarios não encontrado");
  const bloco = indexSrc.slice(idx, idx + 200);
  assert.match(bloco, /cliente_id/);
});

test("index.ts: response inclui cliente_id", () => {
  // The first jsonResponse is in the import. Find the one in the return statement.
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  assert.ok(returnIdx > 0, "return jsonResponse não encontrado");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 400);
  assert.match(bloco, /cliente_id/);
});

test("index.ts: user_metadata inclui cliente_id", () => {
  assert.match(indexSrc, /user_metadata:\s*\{[^}]*cliente_id/);
});

test("index.ts: mensagem de erro de tipo menciona 'cliente'", () => {
  // Check both the english/portuguese variants. The message is in the VALIDATION_ERROR block.
  const tipoErrPattern = indexSrc.match(
    /Tipo deve ser[^"]*['"][^'"]+['"]\s*[^)]*\)/
  );
  assert.ok(tipoErrPattern, "mensagem de erro de tipo não encontrada");
  assert.match(tipoErrPattern[0], /cliente/);
});
