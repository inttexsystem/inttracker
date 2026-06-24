// =====================================================================
// === tests/admin-disable-user.smoke.js ================================
// Smoke estático para a Edge Function `admin-disable-user`.
//
// Fase: RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A
// Escopo: valida o código TypeScript local sem executar a função nem
// acessar Supabase real. Garante:
//   - arquivos esperados existem (index.ts, README.md, _shared/*);
//   - usa Deno.env.get para SUPABASE_URL, SUPABASE_ANON_KEY,
//     SUPABASE_SERVICE_ROLE_KEY;
//   - não contém segredo real hardcoded;
//   - aceita OPTIONS e exige POST;
//   - valida JWT e exige admin ATIVO server-side;
//   - valida UUID via regex;
//   - bloqueia auto-desativação;
//   - bloqueia último admin ativo;
//   - atualiza public.usuarios (não usa .delete());
//   - preenche desativado_em, desativado_por, motivo_desativacao;
//   - usa auth.admin.updateUserById com ban_duration;
//   - não usa auth.admin.deleteUser;
//   - tem compensação (reverte perfil se ban falhar);
//   - não altera js/** nem index.html nem admin-create-user.
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
  "admin-disable-user",
  "index.ts",
);
const readmePath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-disable-user",
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
const adminCreatePath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-create-user",
  "index.ts",
);
const cadastrosPath = path.join(
  ROOT,
  "js",
  "screens",
  "cadastros.js",
);
const indexHtmlPath = path.join(ROOT, "index.html");

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo não encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const indexSrc = readOrFail(indexPath);
const readmeSrc = readOrFail(readmePath);
const corsSrc = readOrFail(corsPath);
const respSrc = readOrFail(respPath);
const adminCreateSrc = readOrFail(adminCreatePath);
const cadastrosSrc = readOrFail(cadastrosPath);
const indexHtmlSrc = readOrFail(indexHtmlPath);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test("admin-disable-user: arquivos esperados existem", () => {
  assert.ok(fs.existsSync(indexPath), "index.ts ausente");
  assert.ok(fs.existsSync(readmePath), "README.md ausente");
  assert.ok(fs.existsSync(corsPath), "_shared/cors.ts ausente");
  assert.ok(fs.existsSync(respPath), "_shared/response.ts ausente");
});

// ---------------------------------------------------------------------
// 2. Variáveis de ambiente (sem segredo hardcoded)
// ---------------------------------------------------------------------

test("index.ts: lê SUPABASE_URL via Deno.env.get", () => {
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_URL["']\)/);
});

test("index.ts: lê SUPABASE_ANON_KEY via Deno.env.get", () => {
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_ANON_KEY["']\)/);
});

test("index.ts: lê SUPABASE_SERVICE_ROLE_KEY via Deno.env.get", () => {
  assert.match(indexSrc, /Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/);
});

test("index.ts: não contém service_role literal como valor hardcoded", () => {
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

// ---------------------------------------------------------------------
// 3. Método e CORS
// ---------------------------------------------------------------------

test("index.ts: aceita OPTIONS (preflight CORS)", () => {
  assert.match(indexSrc, /req\.method\s*===\s*["']OPTIONS["']/);
});

test("index.ts: exige POST e rejeita outros métodos", () => {
  assert.match(indexSrc, /req\.method\s*!==\s*["']POST["']/);
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']VALIDATION_ERROR["']/,
    "método não POST deve retornar VALIDATION_ERROR",
  );
});

// ---------------------------------------------------------------------
// 4. Validação de chamador (JWT + admin ativo)
// ---------------------------------------------------------------------

test("index.ts: lê header Authorization", () => {
  assert.match(indexSrc, /headers\.get\(["']Authorization["']\)/i);
});

test("index.ts: valida o JWT via auth.getUser", () => {
  assert.match(indexSrc, /callerClient\.auth\.getUser\(/);
});

test("index.ts: retorna UNAUTHORIZED quando sem token ou sessão inválida", () => {
  assert.match(indexSrc, /errorResponse\(\s*["']UNAUTHORIZED["']/);
});

test("index.ts: consulta public.usuarios para o chamador", () => {
  assert.match(indexSrc, /\.from\(["']usuarios["']\)/);
  assert.match(
    indexSrc,
    /callerProfile/,
    "perfil do chamador deve ser lido em variável",
  );
});

test("index.ts: exige tipo = 'admin' E ativo = true para o chamador", () => {
  const callerIdx = indexSrc.indexOf("callerProfile");
  assert.ok(callerIdx > 0, "trecho callerProfile não encontrado");
  const bloco = indexSrc.slice(callerIdx, callerIdx + 1200);
  assert.match(
    bloco,
    /tipo\s*!==\s*["']admin["']/,
    "deve comparar tipo com 'admin'",
  );
  assert.match(
    bloco,
    /ativo\s*!==\s*true/,
    "deve exigir ativo === true",
  );
  assert.match(
    bloco,
    /errorResponse\(\s*["']FORBIDDEN["']/,
    "deve retornar FORBIDDEN se não for admin ativo",
  );
});

// ---------------------------------------------------------------------
// 5. Validação de payload
// ---------------------------------------------------------------------

test("index.ts: valida user_id obrigatório", () => {
  assert.match(
    indexSrc,
    /user_id\s+obrigat[óo]rio/i,
    "mensagem de user_id obrigatório deve existir",
  );
});

test("index.ts: valida formato UUID do user_id", () => {
  // Procura pelo regex literal `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-...`
  // que aparece como string no source do index.ts.
  assert.match(
    indexSrc,
    /\[0-9a-fA-F\]\{8\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{4\}-\[0-9a-fA-F\]\{12\}/,
    "regex UUID deve estar presente como literal no source",
  );
  assert.match(
    indexSrc,
    /user_id\s+inv[áa]lido\s*\(UUID\)/i,
    "mensagem de UUID inválido deve existir",
  );
});

test("index.ts: valida e normaliza reason (trim + limite 500)", () => {
  assert.match(
    indexSrc,
    /REASON_MAX_LENGTH\s*=\s*500/,
    "limite de 500 caracteres deve estar definido",
  );
  assert.match(indexSrc, /payload\.reason\.trim\(\)/);
  assert.match(
    indexSrc,
    /excede o limite/i,
    "mensagem de limite excedido deve existir",
  );
});

test("index.ts: trata JSON inválido como VALIDATION_ERROR", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']VALIDATION_ERROR["']\s*,\s*["']JSON inv[áa]lido/,
  );
});

// ---------------------------------------------------------------------
// 6. Bloqueio de auto-desativação
// ---------------------------------------------------------------------

test("index.ts: bloqueia self-disable (SELF_DISABLE_FORBIDDEN)", () => {
  assert.match(
    indexSrc,
    /targetId\s*===\s*callerId/,
    "comparação targetId === callerId deve existir",
  );
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']SELF_DISABLE_FORBIDDEN["']/,
  );
});

// ---------------------------------------------------------------------
// 7. NOT_FOUND quando alvo não existe
// ---------------------------------------------------------------------

test("index.ts: retorna NOT_FOUND se usuário alvo não existe", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']NOT_FOUND["']/,
  );
});

// ---------------------------------------------------------------------
// 8. Idempotência (already disabled)
// ---------------------------------------------------------------------

test("index.ts: idempotente para alvo já inativo (already_disabled)", () => {
  assert.match(
    indexSrc,
    /already_disabled/i,
    "flag already_disabled deve ser emitida",
  );
  assert.match(
    indexSrc,
    /targetProfile\.ativo\s*===\s*false/,
    "deve checar ativo === false no alvo",
  );
});

// ---------------------------------------------------------------------
// 9. Bloqueio de último admin ativo
// ---------------------------------------------------------------------

test("index.ts: bloqueia desativação do último admin ativo", () => {
  const idx = indexSrc.indexOf("LAST_ADMIN_FORBIDDEN");
  assert.ok(idx > 0, "LAST_ADMIN_FORBIDDEN deve aparecer");
  assert.match(
    indexSrc,
    /["']admin["']/,
    "deve comparar tipo = 'admin'",
  );
  assert.match(
    indexSrc,
    /tipo\s*===\s*["']admin["']/,
    "trecho do alvo deve comparar tipo === 'admin'",
  );
  // contagem de admins ativos
  assert.match(
    indexSrc,
    /activeAdmins/,
    "deve contar admins ativos",
  );
  assert.match(
    indexSrc,
    /\(activeAdmins\s*\?\?\s*0\)\s*<=\s*1/,
    "deve recusar quando activeAdmins <= 1",
  );
});

// ---------------------------------------------------------------------
// 10. Soft delete no perfil (sem .delete())
// ---------------------------------------------------------------------

test("index.ts: atualiza public.usuarios (sem .delete())", () => {
  assert.match(
    indexSrc,
    /\.from\(["']usuarios["']\)\s*\.update\(/,
    "deve usar .update() em public.usuarios",
  );
  assert.match(
    indexSrc,
    /ativo\s*:\s*false/,
    "update deve setar ativo: false",
  );
  assert.doesNotMatch(
    indexSrc,
    /\.from\(["']usuarios["']\)\s*\.\s*delete\s*\(/,
    ".from('usuarios').delete() não pode aparecer (soft delete only)",
  );
});

test("index.ts: preenche desativado_em com timestamp ISO", () => {
  assert.match(
    indexSrc,
    /desativado_em\s*:\s*new Date\(\)\.toISOString\(\)/,
    "desativado_em deve receber now() ISO",
  );
});

test("index.ts: preenche desativado_por com callerId", () => {
  assert.match(
    indexSrc,
    /desativado_por\s*:\s*callerId/,
  );
});

test("index.ts: preenche motivo_desativacao com reason normalizado", () => {
  assert.match(
    indexSrc,
    /motivo_desativacao\s*:\s*reason/,
  );
});

test("index.ts: retorna PROFILE_UPDATE_FAILED em falha de update", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']PROFILE_UPDATE_FAILED["']/,
  );
});

// ---------------------------------------------------------------------
// 11. Ban Auth via updateUserById com ban_duration
// ---------------------------------------------------------------------

test("index.ts: usa auth.admin.updateUserById para banir", () => {
  assert.match(
    indexSrc,
    /auth\s*\.\s*admin\s*\.\s*updateUserById/,
  );
});

test("index.ts: usa ban_duration no updateUserById", () => {
  assert.match(
    indexSrc,
    /ban_duration\s*:\s*["']876000h["']/,
    "ban_duration deve ser 876000h",
  );
});

test("index.ts: NÃO usa auth.admin.deleteUser (sem hard delete)", () => {
  assert.doesNotMatch(
    indexSrc,
    /auth\s*\.\s*admin\s*\.\s*deleteUser/,
    "deleteUser não pode ser usado nesta função",
  );
});

// ---------------------------------------------------------------------
// 12. Compensação se ban falhar
// ---------------------------------------------------------------------

test("index.ts: compensa (reativa perfil) se ban Auth falhar", () => {
  assert.match(
    indexSrc,
    /AUTH_BAN_FAILED/,
    "código AUTH_BAN_FAILED deve existir",
  );
  // A compensação fica dentro do `if (banErr)`, ANTES do
  // `errorResponse("AUTH_BAN_FAILED", ...)`. Procuramos o trecho
  // de compensação diretamente no source, que deve:
  //   - fazer .update() com ativo: true;
  //   - limpar desativado_em, desativado_por, motivo_desativacao (set null);
  //   - estar dentro do `if (banErr)`.
  assert.match(
    indexSrc,
    /if\s*\(\s*banErr\s*\)\s*\{[\s\S]*?\.update\(\s*\{[\s\S]*?ativo\s*:\s*true/,
    "compensação deve estar dentro de if (banErr) e usar .update() com ativo: true",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*banErr\s*\)\s*\{[\s\S]*?desativado_em\s*:\s*null/,
    "compensação deve limpar desativado_em",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*banErr\s*\)\s*\{[\s\S]*?desativado_por\s*:\s*null/,
    "compensação deve limpar desativado_por",
  );
  assert.match(
    indexSrc,
    /if\s*\(\s*banErr\s*\)\s*\{[\s\S]*?motivo_desativacao\s*:\s*null/,
    "compensação deve limpar motivo_desativacao",
  );
});

test("index.ts: retorna COMPENSATION_FAILED se a reversão também falhar", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']COMPENSATION_FAILED["']/,
  );
});

// ---------------------------------------------------------------------
// 13. Resposta de sucesso
// ---------------------------------------------------------------------

test("index.ts: resposta de sucesso inclui user_id, email, tipo, ativo, auth_banned", () => {
  assert.match(indexSrc, /jsonResponse\(\s*\{[\s\S]*?user_id\s*:/);
  assert.match(indexSrc, /email\s*:/);
  assert.match(indexSrc, /tipo\s*:/);
  assert.match(indexSrc, /ativo\s*:\s*false/);
  assert.match(indexSrc, /auth_banned\s*:\s*true/);
});

// ---------------------------------------------------------------------
// 14. README documenta
// ---------------------------------------------------------------------

test("README: documenta objetivo, contrato, env vars, segurança, bloqueios, compensação, deploy", () => {
  assert.match(readmeSrc, /Objetivo/i);
  assert.match(readmeSrc, /Contrato/i);
  assert.match(readmeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readmeSrc, /Seguran[çc]a/i);
  assert.match(readmeSrc, /SELF_DISABLE_FORBIDDEN/);
  assert.match(readmeSrc, /LAST_ADMIN_FORBIDDEN/);
  assert.match(readmeSrc, /Compensa[çc][ãa]o/i);
  assert.match(readmeSrc, /Deploy/i);
  assert.match(readmeSrc, /nunca/i, "README deve reforçar proibição");
});

// ---------------------------------------------------------------------
// 15. Não-regras (sem alteração em outros artefatos)
// ---------------------------------------------------------------------

test("index.ts: não referencia js/config.js", () => {
  assert.doesNotMatch(indexSrc, /js\/config\.js/);
});

test("index.ts: não referencia index.html", () => {
  assert.doesNotMatch(indexSrc, /index\.html/);
});

test("index.ts: não referencia supabase/functions (apenas o próprio)", () => {
  // Pode haver '../_shared/cors.ts' e '../_shared/response.ts' mas
  // não deve referenciar caminhos de admin-create-user.
  assert.doesNotMatch(indexSrc, /admin-create-user/);
});

test("admin-create-user/index.ts: não foi alterado por esta fase", () => {
  // A função admin-create-user deve permanecer intocada.
  // Esta fase pode apenas referenciá-la no README do
  // admin-disable-user; o arquivo index.ts não deve mudar.
  assert.ok(adminCreateSrc.length > 100, "admin-create-user/index.ts presente");
  // Conferimos uma assinatura estável (mesma string da última versão).
  assert.match(
    adminCreateSrc,
    /admin-create-user:.*[Vv]ari[áa]veis de ambiente/,
    "header esperado continua presente em admin-create-user",
  );
});

test("cadastros.js: não foi alterado por esta fase (UI guard intacto)", () => {
  // A UI continua com placeholder "Em breve" para exclusão; esta
  // fase NÃO toca UI.
  assert.match(cadastrosSrc, /'Em breve'/);
  assert.match(
    cadastrosSrc,
    /Exclus[ãa]o\/desativa[çc][ãa]o de usu[áa]rios est[áa] temporariamente bloqueada/,
  );
  assert.doesNotMatch(
    cadastrosSrc,
    /functions\.invoke\(\s*['"]admin-disable-user['"]/,
    "cadastros.js não deve chamar admin-disable-user nesta fase",
  );
});

test("index.html: não foi alterado por esta fase (sem novo script)", () => {
  assert.doesNotMatch(
    indexHtmlSrc,
    /admin-disable-user/,
    "index.html não deve referenciar admin-disable-user",
  );
});

// ---------------------------------------------------------------------
// 16. Reuso de helpers _shared
// ---------------------------------------------------------------------

test("index.ts: importa corsHeaders e jsonResponse/errorResponse de _shared", () => {
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/cors\.ts["']/);
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/response\.ts["']/);
  assert.match(indexSrc, /corsHeaders/);
  assert.match(indexSrc, /errorResponse/);
  assert.match(indexSrc, /jsonResponse/);
});
