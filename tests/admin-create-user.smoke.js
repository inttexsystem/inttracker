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

// ---------------------------------------------------------------------
// A4.1 — CAMADA2-USUARIOS-SPEC-PROPOSED — política de senha 8+dígito
// e marcação de senha_temporaria/senha_gerada_em
// ---------------------------------------------------------------------

test("index.ts: PASSWORD_MIN_LENGTH é 8", () => {
  const m = indexSrc.match(/PASSWORD_MIN_LENGTH\s*=\s*(\d+)/);
  assert.ok(m, "PASSWORD_MIN_LENGTH não encontrado");
  assert.strictEqual(Number(m[1]), 8);
});

test("index.ts: exige ao menos 1 dígito via PASSWORD_DIGIT_RE", () => {
  assert.match(indexSrc, /PASSWORD_DIGIT_RE\s*=\s*\/\[0-9\]\//);
  assert.match(indexSrc, /PASSWORD_DIGIT_RE\.test\(password\)/);
  assert.match(indexSrc, /deve conter ao menos 1 dígito/i);
});

test("política de senha: payloads inválidos (7 chars, 8 sem dígito) e válido (8+ com dígito)", () => {
  // Extrai PASSWORD_MIN_LENGTH e PASSWORD_DIGIT_RE reais do source e
  // aplica a mesma lógica de validação (comprimento então dígito) do
  // index.ts, sem executar o runtime Deno.
  const minLenMatch = indexSrc.match(/PASSWORD_MIN_LENGTH\s*=\s*(\d+)/);
  const digitReMatch = indexSrc.match(/PASSWORD_DIGIT_RE\s*=\s*(\/\[0-9\]\/)/);
  assert.ok(minLenMatch && digitReMatch, "constantes de política de senha não encontradas");

  const minLength = Number(minLenMatch[1]);
  const digitRe = new Function(`return ${digitReMatch[1]};`)();

  function validate(password) {
    if (!password || password.length < minLength) {
      return "VALIDATION_ERROR:min_length";
    }
    if (!digitRe.test(password)) {
      return "VALIDATION_ERROR:digit";
    }
    return "OK";
  }

  assert.strictEqual(validate("abcdefg"), "VALIDATION_ERROR:min_length", "7 chars deve falhar por comprimento");
  assert.strictEqual(validate("abcdefgh"), "VALIDATION_ERROR:digit", "8 chars sem dígito deve falhar por dígito");
  assert.strictEqual(validate("abcdefg1"), "OK", "8 chars com 1 dígito deve passar");
});

test("index.ts: insert em usuarios marca senha_temporaria=true e senha_gerada_em", () => {
  const idx = indexSrc.indexOf('.from("usuarios").insert');
  assert.ok(idx > 0, "insert em usuarios não encontrado");
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /senha_temporaria:\s*true/);
  assert.match(bloco, /senha_gerada_em:\s*new Date\(\)\.toISOString\(\)/);
});

// ---------------------------------------------------------------------
// A6.2 — audit trail wiring (usuarios_eventos explicit insert)
// ---------------------------------------------------------------------

test("index.ts: insere evento de auditoria em usuarios_eventos", () => {
  assert.match(indexSrc, /\.from\(["']usuarios_eventos["']\)\.insert/);
});

test("index.ts: evento de auditoria usa tipo_evento 'usuario_criado'", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  assert.ok(idx > 0, "insert em usuarios_eventos não encontrado");
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /tipo_evento:\s*["']usuario_criado["']/);
});

test("index.ts: ator_id do evento vem de callerId (JWT validado), nunca auth.uid()", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /ator_id:\s*callerId/);
  assert.doesNotMatch(bloco, /ator_id:\s*.*auth\.uid\(\)/);
});

test("index.ts: evento de auditoria popula snapshot de identidade (email/nome/tipo)", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /usuario_email:\s*email/);
  assert.match(bloco, /usuario_nome:\s*nome/);
  assert.match(bloco, /usuario_tipo:\s*tipo/);
});

test("index.ts: payload do evento não contém a senha", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  const payloadMatch = bloco.match(/payload:\s*\{[^}]*\}/);
  assert.ok(payloadMatch, "payload do evento não encontrado");
  assert.doesNotMatch(payloadMatch[0], /password/i);
});

test("index.ts: falha no insert de auditoria é logada e sinalizada, sem abortar a ação", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 900);
  assert.match(bloco, /auditRecorded\s*=\s*false/);
  assert.match(bloco, /console\.error/);
  assert.doesNotMatch(bloco, /return errorResponse/, "falha de auditoria não deve retornar erro/abortar a ação");
});

test("index.ts: response final inclui audit_recorded", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 400);
  assert.match(bloco, /audit_recorded:\s*auditRecorded/);
});
