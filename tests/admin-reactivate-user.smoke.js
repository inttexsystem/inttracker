// =====================================================================
// === tests/admin-reactivate-user.smoke.js ==============================
// Smoke estático para a Edge Function `admin-reactivate-user`
// (A5.3-A5.4 — Camada 2). Contraparte simétrica de
// tests/admin-disable-user.smoke.js.
//
// Verifica (sem executar a função nem acessar Supabase real):
//   - arquivos esperados existem;
//   - index.ts lê SUPABASE_SERVICE_ROLE_KEY/URL/ANON_KEY via Deno.env.get;
//   - index.ts não contém service_role literal em valor hardcoded;
//   - index.ts valida método POST e responde OPTIONS para CORS;
//   - index.ts verifica chamador admin ATIVO;
//   - index.ts valida user_id como UUID;
//   - index.ts bloqueia auto-reativação (SELF_REACTIVATE_FORBIDDEN);
//   - index.ts busca o alvo e responde NOT_FOUND se ausente;
//   - index.ts exige alvo inativo (REACTIVATE_NOT_INACTIVE), sem
//     idempotência (diferente de admin-disable-user);
//   - index.ts atualiza public.usuarios (ativo=true, limpa
//     desativado_em/por/motivo), sem .delete();
//   - index.ts usa auth.admin.updateUserById com { ban_duration: 'none' };
//   - index.ts NÃO usa auth.admin.deleteUser/createUser;
//   - index.ts tem compensação (reverte para o estado inativo anterior
//     exato se a remoção do ban falhar);
//   - resposta de sucesso inclui user_id/email/tipo/ativo=true/
//     auth_banned=false;
//   - _shared/cors.ts e _shared/response.ts expõem os helpers;
//   - README documenta objetivo, contrato, guardas, compensação, deploy.
//
// Pode ser executado com: node --test tests/admin-reactivate-user.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FN_DIR = path.join(ROOT, "supabase", "functions", "admin-reactivate-user");
const indexPath = path.join(FN_DIR, "index.ts");
const readmePath = path.join(FN_DIR, "README.md");
const corsPath = path.join(ROOT, "supabase", "functions", "_shared", "cors.ts");
const respPath = path.join(ROOT, "supabase", "functions", "_shared", "response.ts");

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

test("index.ts: usa Deno.env.get para as 3 env vars esperadas", () => {
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_URL["']\)/);
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_ANON_KEY["']\)/);
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/);
});

test("index.ts: não contém service_role literal nem JWT hardcoded", () => {
  assert.doesNotMatch(
    indexSrc,
    /service_role["']\s*:\s*["'][^"']+["']/i,
    "service_role literal como valor detectado",
  );
  assert.doesNotMatch(
    indexSrc,
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./,
    "JWT hardcoded detectado",
  );
});

test("index.ts: valida método POST e responde OPTIONS para preflight CORS", () => {
  assert.match(indexSrc, /req\.method\s*!==\s*["']POST["']/);
  assert.match(indexSrc, /req\.method\s*===\s*["']OPTIONS["']/);
  assert.match(indexSrc, /errorResponse\(\s*["']VALIDATION_ERROR["']/);
});

test("index.ts: verifica chamador admin ATIVO (tipo E ativo, não só tipo)", () => {
  const guardMatch = indexSrc.match(/if\s*\(\s*\n?\s*!callerProfile[\s\S]*?\)\s*\{[\s\S]*?FORBIDDEN[\s\S]*?\}/);
  assert.ok(guardMatch, "bloco de guarda admin não encontrado");
  assert.match(guardMatch[0], /callerProfile\.tipo\s*!==\s*["']admin["']/);
  assert.match(guardMatch[0], /callerProfile\.ativo\s*!==\s*true/);
});

test("index.ts: valida user_id como UUID", () => {
  assert.match(indexSrc, /UUID_RE\s*=\s*\/\^/);
  assert.match(indexSrc, /UUID_RE\.test\(targetIdRaw\)/);
});

test("index.ts: bloqueia auto-reativação com SELF_REACTIVATE_FORBIDDEN", () => {
  assert.match(indexSrc, /targetId\s*===\s*callerId/);
  assert.match(indexSrc, /SELF_REACTIVATE_FORBIDDEN/);
});

test("index.ts: busca o alvo em public.usuarios e responde NOT_FOUND se ausente", () => {
  assert.match(indexSrc, /\.from\(["']usuarios["']\)[\s\S]{0,120}\.select\(["']id, email, nome, tipo, ativo, desativado_em, desativado_por, motivo_desativacao["']\)/);
  assert.match(indexSrc, /if\s*\(\s*!targetProfile\s*\)[\s\S]{0,60}NOT_FOUND/);
});

test("index.ts: exige alvo inativo (REACTIVATE_NOT_INACTIVE), sem idempotência", () => {
  assert.match(indexSrc, /targetProfile\.ativo\s*!==\s*false/);
  assert.match(indexSrc, /REACTIVATE_NOT_INACTIVE/);
  // Diferente de admin-disable-user: não deve emitir uma flag tipo
  // "already_reactivated" — reativar um alvo já ativo é sempre erro.
  assert.doesNotMatch(indexSrc, /already_reactivated/i);
});

test("index.ts: atualiza public.usuarios (ativo=true, limpa campos de desativação), sem .delete()", () => {
  assert.match(indexSrc, /\.from\(["']usuarios["']\)\s*\.update\(/);
  assert.match(indexSrc, /ativo\s*:\s*true/);
  assert.match(indexSrc, /desativado_em\s*:\s*null/);
  assert.match(indexSrc, /desativado_por\s*:\s*null/);
  assert.match(indexSrc, /motivo_desativacao\s*:\s*null/);
  assert.doesNotMatch(
    indexSrc,
    /\.from\(["']usuarios["']\)\s*\.\s*delete\s*\(/,
    ".from('usuarios').delete() não pode aparecer",
  );
});

test("index.ts: retorna PROFILE_UPDATE_FAILED em falha de update", () => {
  assert.match(indexSrc, /errorResponse\(\s*["']PROFILE_UPDATE_FAILED["']/);
});

test("index.ts: remove o ban via auth.admin.updateUserById(targetId, { ban_duration: 'none' })", () => {
  assert.match(
    indexSrc,
    /auth\s*\.\s*admin\s*\.\s*updateUserById\(\s*\n?\s*targetId,\s*\n?\s*\{\s*ban_duration:\s*UNBAN_DURATION\s*\}/,
  );
  assert.match(indexSrc, /UNBAN_DURATION\s*=\s*["']none["']/);
});

test("index.ts: NÃO usa auth.admin.deleteUser/createUser (fora de escopo)", () => {
  assert.doesNotMatch(indexSrc, /auth\s*\.\s*admin\s*\.\s*deleteUser\s*\(/);
  assert.doesNotMatch(indexSrc, /auth\s*\.\s*admin\s*\.\s*createUser\s*\(/);
});

test("index.ts: compensa (reverte para o estado inativo anterior exato) se a remoção do ban falhar", () => {
  assert.match(indexSrc, /AUTH_UNBAN_FAILED/);
  assert.match(
    indexSrc,
    /if\s*\(\s*unbanErr\s*\)\s*\{[\s\S]*?\.update\(\s*\{[\s\S]*?ativo\s*:\s*false/,
    "compensação deve estar dentro de if (unbanErr) e usar .update() com ativo: false",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*unbanErr\s*\)\s*\{[\s\S]*?desativado_em\s*:\s*previousDesativadoEm/,
    "compensação deve restaurar desativado_em anterior (não um now() novo)",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*unbanErr\s*\)\s*\{[\s\S]*?desativado_por\s*:\s*previousDesativadoPor/,
    "compensação deve restaurar desativado_por anterior",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*unbanErr\s*\)\s*\{[\s\S]*?motivo_desativacao\s*:\s*previousMotivoDesativacao/,
    "compensação deve restaurar motivo_desativacao anterior",
  );
});

test("index.ts: retorna COMPENSATION_FAILED se a reversão também falhar", () => {
  assert.match(indexSrc, /errorResponse\(\s*["']COMPENSATION_FAILED["']/);
});

test("index.ts: resposta de sucesso inclui user_id, email, tipo, ativo=true, auth_banned=false", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  assert.ok(returnIdx > 0, "return jsonResponse não encontrado");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 300);
  assert.match(bloco, /user_id\s*:/);
  assert.match(bloco, /email\s*:/);
  assert.match(bloco, /tipo\s*:/);
  assert.match(bloco, /ativo\s*:\s*true/);
  assert.match(bloco, /auth_banned\s*:\s*false/);
});

test("index.ts: não referencia js/config.js nem index.html", () => {
  assert.doesNotMatch(indexSrc, /js\/config\.js/);
  assert.doesNotMatch(indexSrc, /index\.html/);
});

test("index.ts: não invoca/importa outras Edge Functions (admin-create-user/admin-delete-user)", () => {
  // admin-disable-user pode ser citado em comentário (documenta a
  // simetria) — o que não pode existir é invocação/import real de
  // outra função.
  assert.doesNotMatch(indexSrc, /from\s+["'].*admin-(create|delete)-user/);
  assert.doesNotMatch(indexSrc, /invoke\(\s*["']admin-(create|delete)-user["']/);
});

test("_shared/cors.ts: exporta corsHeaders", () => {
  assert.match(corsSrc, /export\s+const\s+corsHeaders/);
});

test("_shared/response.ts: exporta jsonResponse e errorResponse", () => {
  assert.match(respSrc, /export\s+function\s+jsonResponse/);
  assert.match(respSrc, /export\s+function\s+errorResponse/);
});

test("index.ts: importa corsHeaders e jsonResponse/errorResponse de _shared", () => {
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/cors\.ts["']/);
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/response\.ts["']/);
  assert.match(indexSrc, /corsHeaders/);
  assert.match(indexSrc, /errorResponse/);
  assert.match(indexSrc, /jsonResponse/);
});

test("README: documenta objetivo, contrato, guardas, compensação, deploy", () => {
  assert.match(readmeSrc, /Objetivo/i);
  assert.match(readmeSrc, /Contrato/i);
  assert.match(readmeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readmeSrc, /SELF_REACTIVATE_FORBIDDEN/);
  assert.match(readmeSrc, /REACTIVATE_NOT_INACTIVE/);
  assert.match(readmeSrc, /Compensa[çc][ãa]o/i);
  assert.match(readmeSrc, /Deploy/i);
});

// ---------------------------------------------------------------------
// A6.2 — audit trail wiring (usuarios_eventos explicit insert)
// ---------------------------------------------------------------------

test("index.ts: insere evento de auditoria em usuarios_eventos", () => {
  assert.match(indexSrc, /\.from\(["']usuarios_eventos["']\)\.insert/);
});

test("index.ts: evento de auditoria usa tipo_evento 'usuario_reativado'", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  assert.ok(idx > 0, "insert em usuarios_eventos não encontrado");
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /tipo_evento:\s*["']usuario_reativado["']/);
});

test("index.ts: ator_id do evento vem de callerId (JWT validado), nunca auth.uid()", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /ator_id:\s*callerId/);
  assert.doesNotMatch(bloco, /ator_id:\s*.*auth\.uid\(\)/);
});

test("index.ts: evento de auditoria popula snapshot de identidade a partir de targetProfile", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /usuario_email:\s*targetProfile\.email/);
  assert.match(bloco, /usuario_nome:\s*targetProfile\.nome/);
  assert.match(bloco, /usuario_tipo:\s*targetProfile\.tipo/);
});

test("index.ts: insert de auditoria fica após o unban Auth (só no caminho de sucesso total)", () => {
  const auditIdx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const unbanIdx = indexSrc.indexOf("auth.admin.updateUserById");
  assert.ok(auditIdx > unbanIdx, "insert de auditoria deve ocorrer após o unban Auth ter sucesso");
});

test("index.ts: falha no insert de auditoria é logada e sinalizada, sem abortar a ação", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 900);
  assert.match(bloco, /auditRecorded\s*=\s*false/);
  assert.match(bloco, /console\.error/);
});

test("index.ts: response final inclui audit_recorded", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 400);
  assert.match(bloco, /audit_recorded:\s*auditRecorded/);
});
