// =====================================================================
// === tests/admin-delete-user.smoke.js ================================
// Smoke estático para a Edge Function `admin-delete-user`.
//
// Fase: RAVATEX-TAPETES-AUTH-HARD-DELETE-USER-A
// Escopo: valida o código TypeScript local sem executar a função nem
// acessar Supabase real. Garante:
//   - arquivos esperados existem (index.ts, README.md, _shared/*);
//   - usa Deno.env.get para SUPABASE_URL, SUPABASE_ANON_KEY,
//     SUPABASE_SERVICE_ROLE_KEY;
//   - não contém segredo real hardcoded;
//   - aceita OPTIONS e exige POST;
//   - valida JWT e exige admin ATIVO server-side;
//   - valida UUID via regex;
//   - valida confirm_email (formato e match com alvo);
//   - bloqueia autoexclusão (SELF_DELETE_FORBIDDEN);
//   - bloqueia último admin ativo (LAST_ADMIN_FORBIDDEN);
//   - remove public.usuarios primeiro;
//   - usa auth.admin.deleteUser (NÃO usa updateUserById/ban_duration);
//   - retorna USER_HAS_REFERENCES se perfil tem FK/referência;
//   - compensa (reinsere perfil) se Auth delete falhar;
//   - retorna AUTH_DELETE_FAILED ou COMPENSATION_FAILED conforme compensação;
//   - não altera admin-create-user nem admin-disable-user.
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
  "admin-delete-user",
  "index.ts",
);
const readmePath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-delete-user",
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
const adminDisablePath = path.join(
  ROOT,
  "supabase",
  "functions",
  "admin-disable-user",
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
const adminDisableSrc = readOrFail(adminDisablePath);
const cadastrosSrc = readOrFail(cadastrosPath);
const indexHtmlSrc = readOrFail(indexHtmlPath);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test("admin-delete-user: arquivos esperados existem", () => {
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

test("index.ts: exige confirm_email", () => {
  assert.match(
    indexSrc,
    /confirm_email\s+obrigat[óo]rio/i,
    "mensagem de confirm_email obrigatório deve existir",
  );
});

test("index.ts: valida formato de confirm_email", () => {
  // Verifica que existe um regex de validação de e-mail no source.
  // O regex real do index.ts é:
  //   const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Procuramos padrões característicos (em source-level string).
  // No source file a regex literal é: [^\s@] (sem escape duplo)
  assert.match(
    indexSrc,
    /\[\^\\s@\]/,
    "regex de e-mail deve ter classe negada [^\\\\s@]",
  );
  assert.match(
    indexSrc,
    /EMAIL_RE\s*=\s*\//,
    "regex de e-mail deve estar atribuído a EMAIL_RE",
  );
  assert.match(
    indexSrc,
    /confirm_email\s+inv[áa]lido/i,
    "mensagem de e-mail inválido deve existir",
  );
});

test("index.ts: trata JSON inválido como VALIDATION_ERROR", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']VALIDATION_ERROR["']\s*,\s*["']JSON inv[áa]lido/,
  );
});

// ---------------------------------------------------------------------
// 6. Bloqueio de autoexclusão
// ---------------------------------------------------------------------

test("index.ts: bloqueia self-delete (SELF_DELETE_FORBIDDEN)", () => {
  assert.match(
    indexSrc,
    /targetId\s*===\s*callerId/,
    "comparação targetId === callerId deve existir",
  );
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']SELF_DELETE_FORBIDDEN["']/,
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
// 8. CONFIRM_EMAIL_MISMATCH
// ---------------------------------------------------------------------

test("index.ts: exige confirm_email igual ao email do alvo", () => {
  assert.match(
    indexSrc,
    /CONFIRM_EMAIL_MISMATCH/,
    "código CONFIRM_EMAIL_MISMATCH deve existir",
  );
  // A comparação deve ser case-insensitive (uso de toLowerCase em ambos
  // os lados) e o payload.confirm_email deve aparecer.
  assert.match(
    indexSrc,
    /targetProfile\.email[\s\S]{0,200}confirmEmail|confirmEmail[\s\S]{0,200}targetProfile\.email/,
    "comparação entre email do alvo e confirm_email deve existir",
  );
});

// ---------------------------------------------------------------------
// 9. Bloqueio de último admin ativo
// ---------------------------------------------------------------------

test("index.ts: bloqueia exclusão do último admin ativo", () => {
  const idx = indexSrc.indexOf("LAST_ADMIN_FORBIDDEN");
  assert.ok(idx > 0, "LAST_ADMIN_FORBIDDEN deve aparecer");
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
// 10. Remoção de perfil primeiro (profile-first delete)
// ---------------------------------------------------------------------

test("index.ts: remove public.usuarios primeiro (.delete())", () => {
  // O .delete() em public.usuarios é esperado e intencional.
  assert.match(
    indexSrc,
    /\.from\(["']usuarios["']\)\s*\.\s*delete\s*\(\s*\)/,
    "deve usar .delete() em public.usuarios como operação primária",
  );
});

test("index.ts: retorna USER_HAS_REFERENCES em falha de .delete() no perfil", () => {
  assert.match(
    indexSrc,
    /USER_HAS_REFERENCES/,
    "código USER_HAS_REFERENCES deve existir",
  );
  // A checagem de erro do .delete() deve vir antes do auth delete
  // (chamada real, com parêntese aberto — não comentário).
  const userRefsIdx = indexSrc.indexOf("USER_HAS_REFERENCES");
  const authDelCallIdx = indexSrc.indexOf("auth.admin.deleteUser(");
  assert.ok(userRefsIdx > 0, "USER_HAS_REFERENCES deve aparecer");
  assert.ok(
    authDelCallIdx > 0,
    "auth.admin.deleteUser( deve aparecer (chamada real)",
  );
  assert.ok(
    userRefsIdx < authDelCallIdx,
    "USER_HAS_REFERENCES deve ser checado ANTES da chamada auth.admin.deleteUser (profile-first)",
  );
});

// ---------------------------------------------------------------------
// 11. Hard delete via auth.admin.deleteUser
// ---------------------------------------------------------------------

test("index.ts: usa auth.admin.deleteUser (hard delete)", () => {
  assert.match(
    indexSrc,
    /auth\s*\.\s*admin\s*\.\s*deleteUser/,
    "auth.admin.deleteUser deve aparecer",
  );
});

test("index.ts: NÃO usa updateUserById/ban_duration (hard delete only)", () => {
  // Verifica que NÃO há CHAMADA real de updateUserById/ban_duration
  // (parêntese aberto). Comentários podem mencionar para documentar
  // que não são usados.
  assert.doesNotMatch(
    indexSrc,
    /updateUserById\s*\(/,
    "updateUserById(...) não pode ser chamado nesta função",
  );
  assert.doesNotMatch(
    indexSrc,
    /ban_duration\s*:/,
    "ban_duration: não pode ser passado como argumento",
  );
});

// ---------------------------------------------------------------------
// 12. Compensação se Auth delete falhar
// ---------------------------------------------------------------------

test("index.ts: compensa (reinsere perfil) se auth delete falhar", () => {
  assert.match(
    indexSrc,
    /AUTH_DELETE_FAILED/,
    "código AUTH_DELETE_FAILED deve existir",
  );
  // A compensação fica dentro do `if (authDelErr)`, ANTES do
  // `errorResponse("AUTH_DELETE_FAILED", ...)`. Procuramos o trecho
  // de compensação diretamente no source, que deve:
  //   - fazer .insert() com id, email, nome, tipo.
  const bloco = indexSrc.slice(indexSrc.indexOf("auth.admin.deleteUser"));
  assert.match(
    bloco,
    /if\s*\(\s*authDelErr\s*\)\s*\{[\s\S]*?\.from\(["']usuarios["']\)\s*\.\s*insert\(/,
    "compensação deve estar dentro de if (authDelErr) e usar .insert() em public.usuarios",
  );
});

test("index.ts: retorna COMPENSATION_FAILED se a reinserção também falhar", () => {
  assert.match(
    indexSrc,
    /errorResponse\(\s*["']COMPENSATION_FAILED["']/,
  );
});

// ---------------------------------------------------------------------
// 13. Resposta de sucesso
// ---------------------------------------------------------------------

test("index.ts: resposta de sucesso inclui ok=true, deleted=true, user_id, email", () => {
  assert.match(indexSrc, /jsonResponse\(\s*\{[\s\S]*?ok\s*:\s*true/);
  assert.match(indexSrc, /deleted\s*:\s*true/);
  assert.match(indexSrc, /user_id\s*:/);
  assert.match(indexSrc, /email\s*:/);
});

// ---------------------------------------------------------------------
// 14. README documenta
// ---------------------------------------------------------------------

test("README: documenta objetivo, contrato, env vars, segurança, bloqueios, compensação, deploy", () => {
  assert.match(readmeSrc, /Objetivo/i);
  assert.match(readmeSrc, /Contrato/i);
  assert.match(readmeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readmeSrc, /Seguran[çc]a/i);
  assert.match(readmeSrc, /SELF_DELETE_FORBIDDEN/);
  assert.match(readmeSrc, /LAST_ADMIN_FORBIDDEN/);
  assert.match(readmeSrc, /USER_HAS_REFERENCES/);
  assert.match(readmeSrc, /Compensa[çc][ãa]o/i);
  assert.match(readmeSrc, /Deploy/i);
  assert.match(readmeSrc, /nunca/i, "README deve reforçar proibição");
  // Deve enfatizar que NÃO usa updateUserById/ban_duration.
  assert.match(
    readmeSrc,
    /updateUserById|ban_duration/,
    "README deve documentar que NÃO usa updateUserById/ban_duration",
  );
});

// ---------------------------------------------------------------------
// 15. Não-regras
// ---------------------------------------------------------------------

test("index.ts: não referencia js/config.js", () => {
  assert.doesNotMatch(indexSrc, /js\/config\.js/);
});

test("index.ts: não referencia index.html", () => {
  assert.doesNotMatch(indexSrc, /index\.html/);
});

test("index.ts: não referencia outras Edge Functions (apenas _shared)", () => {
  // Pode referenciar '../_shared/cors.ts' e '../_shared/response.ts'
  // mas não deve referenciar caminhos de admin-create-user ou
  // admin-disable-user.
  assert.doesNotMatch(indexSrc, /admin-create-user/);
  assert.doesNotMatch(indexSrc, /admin-disable-user/);
});

test("admin-create-user/index.ts: não foi alterado por esta fase", () => {
  assert.ok(adminCreateSrc.length > 100, "admin-create-user/index.ts presente");
  assert.match(
    adminCreateSrc,
    /admin-create-user:.*[Vv]ari[áa]veis de ambiente/,
    "header esperado continua presente em admin-create-user",
  );
});

test("admin-disable-user/index.ts: não foi alterado por esta fase", () => {
  assert.ok(adminDisableSrc.length > 100, "admin-disable-user/index.ts presente");
  assert.match(
    adminDisableSrc,
    /admin-disable-user:.*[Vv]ari[áa]veis de ambiente/,
    "header esperado continua presente em admin-disable-user",
  );
});

// ---------------------------------------------------------------------
// 16. cadastros.js: invariantes gerais (não integra mais admin-delete-user
// — a tela de usuários foi removida deste arquivo em A3.4; a integração
// real vive em js/admin-usuarios-writes.js, coberta por
// tests/admin-usuarios.smoke.js)
// ---------------------------------------------------------------------

test("cadastros.js: NÃO usa auth.admin no front-end", () => {
  assert.doesNotMatch(
    cadastrosSrc,
    /auth\s*\.\s*admin/,
    "auth.admin não pode aparecer no front-end (apenas Edge Function)",
  );
});

test("cadastros.js: NÃO usa .from('usuarios').delete() direto no front", () => {
  assert.doesNotMatch(
    cadastrosSrc,
    /from\(\s*['"]usuarios['"]\s*\)\s*\.\s*delete\s*\(/,
    "cadastros.js não deve fazer .from('usuarios').delete() (apenas via Edge Function)",
  );
});

test("cadastros.js: NÃO contém service_role", () => {
  assert.doesNotMatch(
    cadastrosSrc,
    /service_role/i,
    "service_role não pode aparecer em cadastros.js",
  );
});

test("index.html: não foi alterado por esta fase (sem novo script)", () => {
  assert.doesNotMatch(
    indexHtmlSrc,
    /admin-delete-user/,
    "index.html não deve referenciar admin-delete-user",
  );
});

// ---------------------------------------------------------------------
// 17. Reuso de helpers _shared
// ---------------------------------------------------------------------

test("index.ts: importa corsHeaders e jsonResponse/errorResponse de _shared", () => {
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/cors\.ts["']/);
  assert.match(indexSrc, /from\s+["']\.\.\/_shared\/response\.ts["']/);
  assert.match(indexSrc, /corsHeaders/);
  assert.match(indexSrc, /errorResponse/);
  assert.match(indexSrc, /jsonResponse/);
});

// ---------------------------------------------------------------------
// A6.2 — audit trail wiring (usuarios_eventos explicit insert)
// ---------------------------------------------------------------------

test("index.ts: insere evento de auditoria em usuarios_eventos", () => {
  assert.match(indexSrc, /\.from\(["']usuarios_eventos["']\)\.insert/);
});

test("index.ts: evento de auditoria usa tipo_evento 'usuario_excluido'", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  assert.ok(idx > 0, "insert em usuarios_eventos não encontrado");
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /tipo_evento:\s*["']usuario_excluido["']/);
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

test("index.ts: insert de auditoria ocorre ANTES do delete do perfil (arquitect ruling, FK satisfeita no insert)", () => {
  const auditIdx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const deleteMatch = indexSrc.match(/\.from\(["']usuarios["']\)\s*\.delete\(\)/);
  assert.ok(auditIdx > 0, "insert de auditoria não encontrado");
  assert.ok(deleteMatch, "delete de usuarios não encontrado");
  assert.ok(auditIdx < deleteMatch.index, "insert de auditoria deve ocorrer antes do delete do perfil");
});

test("index.ts: nenhuma compensação (delete/rollback) é feita sobre usuarios_eventos nos caminhos de falha", () => {
  assert.doesNotMatch(
    indexSrc,
    /\.from\(["']usuarios_eventos["']\)\.delete/,
    "não deve haver DELETE em usuarios_eventos — nenhuma compensação de auditoria foi inventada, por decisão explícita do escopo"
  );
});

test("index.ts: falha no insert de auditoria é logada, sem abortar a exclusão", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 900);
  assert.match(bloco, /auditRecorded\s*=\s*false/);
  assert.match(bloco, /console\.error/);
  assert.doesNotMatch(bloco, /return errorResponse/, "falha de auditoria não deve retornar erro/abortar a exclusão");
});

test("index.ts: response final de sucesso inclui audit_recorded", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 400);
  assert.match(bloco, /audit_recorded:\s*auditRecorded/);
});
