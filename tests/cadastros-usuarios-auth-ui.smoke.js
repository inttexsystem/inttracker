// =====================================================================
// === tests/cadastros-usuarios-auth-ui.smoke.js =======================
// Smoke estático para a adaptação da tela #/cadastros/usuarios
// à Edge Function `admin-create-user` (fase AUTH-ADMIN-UI-A).
//
// Verifica (sem executar o app nem Supabase real):
//   - cadastros.js chama functions.invoke('admin-create-user');
//   - fluxo principal não exige UID manual;
//   - payload contém email, password, nome, tipo, fornecedor_id;
//   - trata erro da Edge Function lendo error.context.json();
//   - não contém service_role, SUPABASE_SERVICE_ROLE_KEY, auth.admin;
//   - não referencia js/config.js nem supabase/functions;
//   - remove banner antigo e rótulo "+ Vincular usuário".
//
// Executar com: node --test tests/cadastros-usuarios-auth-ui.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const cadastrosPath = path.join(ROOT, "js", "screens", "cadastros.js");

const src = fs.readFileSync(cadastrosPath, "utf8");

test("cadastros.js: chama functions.invoke('admin-create-user') no fluxo de criação", () => {
  assert.match(
    src,
    /functions\.invoke\(\s*['"]admin-create-user['"]/,
  );
});

test("cadastros.js: botão principal rotula '+ Novo usuário' e remove '+ Vincular usuário'", () => {
  assert.match(src, /\+ Novo usu[áa]rio/);
  assert.doesNotMatch(src, /\+ Vincular usu[áa]rio/);
});

test("cadastros.js: remove banner antigo 'Como criar um usuário novo'", () => {
  assert.doesNotMatch(src, /Como criar um usu[áa]rio novo/);
  assert.doesNotMatch(src, /Supabase Studio/);
});

test("cadastros.js: título do modal de criação é 'Novo usuário' e 'Vincular usuário' foi removido", () => {
  assert.match(src, /'Novo usu[áa]rio'/);
  assert.doesNotMatch(src, /'Vincular usu[áa]rio'/);
});

test("cadastros.js: remove validação antiga que exigia UID manual", () => {
  assert.doesNotMatch(src, /Preencha UID, email, nome e tipo/);
  assert.doesNotMatch(src, /const\s+id\s*=\s*idInput\.value/);
});

test("cadastros.js: payload da Edge Function contém email, password, nome, tipo, fornecedor_id", () => {
  assert.match(src, /body:\s*\{[^}]*email/);
  assert.match(src, /body:\s*\{[^}]*password/);
  assert.match(src, /body:\s*\{[^}]*nome/);
  assert.match(src, /body:\s*\{[^}]*tipo/);
  assert.match(src, /body:\s*\{[^}]*fornecedor_id/);
});

test("cadastros.js: trata erro da Edge Function lendo error.context.json()", () => {
  assert.match(src, /error\.context/);
  assert.match(src, /error\.context\.json/);
  assert.match(src, /body\.error\.code/);
});

test("cadastros.js: não contém service_role", () => {
  assert.doesNotMatch(src, /service_role/i);
});

test("cadastros.js: não contém SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("cadastros.js: não chama auth.admin", () => {
  assert.doesNotMatch(src, /auth\.admin/);
});

test("cadastros.js: não referencia js/config.js", () => {
  assert.doesNotMatch(src, /js\/config\.js/);
});

test("cadastros.js: não referencia supabase/functions", () => {
  assert.doesNotMatch(src, /supabase\/functions/);
});
