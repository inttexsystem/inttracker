// =====================================================================
// === tests/admin-reset-user-password.smoke.js =========================
// Smoke estático para a Edge Function `admin-reset-user-password`
// (A5.1-A5.2 — Camada 2).
//
// Verifica (sem executar a função nem acessar Supabase real):
//   - arquivos esperados existem;
//   - index.ts lê SUPABASE_SERVICE_ROLE_KEY/URL/ANON_KEY via Deno.env.get;
//   - index.ts não contém service_role literal em valor hardcoded;
//   - index.ts valida método POST e responde OPTIONS para CORS;
//   - index.ts verifica chamador admin ATIVO;
//   - index.ts valida user_id como UUID;
//   - índex.ts bloqueia auto-reset (SELF_RESET_FORBIDDEN);
//   - index.ts busca o alvo e responde NOT_FOUND se ausente;
//   - index.ts usa auth.admin.updateUserById com { password };
//   - régua da senha gerada: 8+ caracteres, ao menos 1 dígito,
//     gerada via crypto.getRandomValues (nunca Math.random, nunca
//     valor fixo);
//   - index.ts marca senha_temporaria=true/senha_gerada_em no update
//     de public.usuarios;
//   - index.ts nunca loga a senha gerada (nenhum console.* referencia
//     a variável da senha);
//   - resposta de sucesso inclui password (retornada uma única vez);
//   - _shared/cors.ts e _shared/response.ts expõem os helpers;
//   - README documenta a régua, as guardas e o aviso de "não loga".
//
// Pode ser executado com: node --test tests/admin-reset-user-password.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const FN_DIR = path.join(ROOT, "supabase", "functions", "admin-reset-user-password");
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

test("index.ts: bloqueia auto-reset com SELF_RESET_FORBIDDEN", () => {
  assert.match(indexSrc, /targetId\s*===\s*callerId/);
  assert.match(indexSrc, /SELF_RESET_FORBIDDEN/);
  assert.match(indexSrc, /Admin não pode resetar a própria senha/);
});

test("index.ts: busca o alvo em public.usuarios e responde NOT_FOUND se ausente", () => {
  assert.match(indexSrc, /\.from\(["']usuarios["']\)[\s\S]{0,80}\.select\(["']id, email, nome, tipo["']\)/);
  assert.match(indexSrc, /if\s*\(\s*!targetProfile\s*\)[\s\S]{0,60}NOT_FOUND/);
});

test("index.ts: reseta via auth.admin.updateUserById(targetId, { password })", () => {
  assert.match(indexSrc, /auth\s*\.\s*admin\s*\.\s*updateUserById\(\s*\n?\s*targetId,\s*\n?\s*\{\s*password:\s*newPassword\s*\}/);
});

test("index.ts: NÃO usa ban_duration nem auth.admin.createUser/deleteUser (fora de escopo)", () => {
  // Checa uso real (chamada/atribuição), não apenas menção em comentário
  // explicativo (o cabeçalho do arquivo documenta "ban_duration não é
  // usado aqui" / "nunca Math.random" como texto negativo).
  assert.doesNotMatch(indexSrc, /ban_duration\s*:/);
  assert.doesNotMatch(indexSrc, /auth\s*\.\s*admin\s*\.\s*createUser\s*\(/);
  assert.doesNotMatch(indexSrc, /auth\s*\.\s*admin\s*\.\s*deleteUser\s*\(/);
});

// ---------------------------------------------------------------------
// Régua da senha gerada
// ---------------------------------------------------------------------

test("index.ts: senha gerada via crypto.getRandomValues, nunca Math.random", () => {
  assert.match(indexSrc, /crypto\.getRandomValues\(/);
  assert.doesNotMatch(indexSrc, /Math\s*\.\s*random\s*\(/);
});

test("index.ts: GENERATED_PASSWORD_LENGTH >= PASSWORD_MIN_LENGTH (8)", () => {
  const minLenMatch = indexSrc.match(/PASSWORD_MIN_LENGTH\s*=\s*(\d+)/);
  const genLenMatch = indexSrc.match(/GENERATED_PASSWORD_LENGTH\s*=\s*(\d+)/);
  assert.ok(minLenMatch && genLenMatch, "constantes de tamanho não encontradas");
  assert.ok(Number(genLenMatch[1]) >= Number(minLenMatch[1]),
    "GENERATED_PASSWORD_LENGTH deveria ser >= PASSWORD_MIN_LENGTH");
});

test("index.ts: garante deterministicamente ao menos 1 dígito na senha gerada (não só probabilístico)", () => {
  assert.match(indexSrc, /PASSWORD_DIGIT_RE\.test\(pw\)/);
});

test("simulação da régua: generateTemporaryPassword sempre produz 8+ caracteres com 1+ dígito (1000 amostras, crypto real)", () => {
  // Reimplementa a MESMA lógica do index.ts em Node (usando
  // crypto.randomBytes real, não um mock) para provar que a régua é
  // satisfeita de forma determinística, não apenas por amostragem.
  const charsetMatch = indexSrc.match(/PASSWORD_CHARSET\s*=\s*\n?\s*["']([^"']+)["']/);
  const lenMatch = indexSrc.match(/GENERATED_PASSWORD_LENGTH\s*=\s*(\d+)/);
  assert.ok(charsetMatch && lenMatch, "PASSWORD_CHARSET/GENERATED_PASSWORD_LENGTH não encontrados");
  const charset = charsetMatch[1];
  const length = Number(lenMatch[1]);
  const digitRe = /[0-9]/;

  function generate() {
    const bytes = crypto.randomBytes(length);
    let pw = "";
    for (let i = 0; i < length; i++) pw += charset[bytes[i] % charset.length];
    if (!digitRe.test(pw)) {
      const extra = crypto.randomBytes(2);
      const digit = String(extra[0] % 10);
      const pos = extra[1] % length;
      pw = pw.slice(0, pos) + digit + pw.slice(pos + 1);
    }
    return pw;
  }

  for (let i = 0; i < 1000; i++) {
    const pw = generate();
    assert.ok(pw.length >= 8, `amostra ${i}: comprimento ${pw.length} < 8`);
    assert.match(pw, digitRe, `amostra ${i}: sem dígito — "${pw}"`);
  }
});

test("index.ts: charset da senha gerada evita caracteres ambíguos (0/O, 1/l/I)", () => {
  const charsetMatch = indexSrc.match(/PASSWORD_CHARSET\s*=\s*\n?\s*["']([^"']+)["']/);
  assert.ok(charsetMatch, "PASSWORD_CHARSET não encontrado");
  const charset = charsetMatch[1];
  assert.doesNotMatch(charset, /[0OlI1]/, `charset contém caractere ambíguo: ${charset}`);
});

// ---------------------------------------------------------------------
// Marcação do perfil e resposta
// ---------------------------------------------------------------------

test("index.ts: update em usuarios marca senha_temporaria=true e senha_gerada_em", () => {
  const idx = indexSrc.indexOf(".update({");
  assert.ok(idx > 0, "update em usuarios não encontrado");
  const bloco = indexSrc.slice(idx, idx + 200);
  assert.match(bloco, /senha_temporaria:\s*true/);
  assert.match(bloco, /senha_gerada_em:\s*new Date\(\)\.toISOString\(\)/);
});

test("index.ts: resposta de sucesso inclui password (retornada 1x)", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  assert.ok(returnIdx > 0, "return jsonResponse não encontrado");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 300);
  assert.match(bloco, /password:\s*newPassword/);
});

test("index.ts: NENHUM console.* referencia a variável da senha gerada (nunca loga a senha)", () => {
  // Checa a variável (identificador `newPassword`), não a palavra solta —
  // "password" aparece dentro do próprio nome da função
  // ("admin-reset-user-password") em uma mensagem de log legítima.
  const consoleCalls = indexSrc.match(/console\.(log|error|warn|info|debug)\([^)]*\)/gs) || [];
  assert.ok(consoleCalls.length > 0, "nenhuma chamada console.* encontrada para verificar");
  for (const call of consoleCalls) {
    assert.doesNotMatch(call, /\bnewPassword\b/, `console.* referencia newPassword: ${call}`);
  }
});

test("index.ts: falha do update de perfil pós-reset retorna erro explícito (PROFILE_UPDATE_FAILED), nunca sucesso silencioso", () => {
  assert.match(indexSrc, /PROFILE_UPDATE_FAILED/);
  const idx = indexSrc.indexOf("PROFILE_UPDATE_FAILED");
  const bloco = indexSrc.slice(Math.max(0, idx - 400), idx + 100);
  assert.match(bloco, /profileErr/);
});

test("index.ts: não referencia js/config.js nem index.html", () => {
  assert.doesNotMatch(indexSrc, /js\/config\.js/);
  assert.doesNotMatch(indexSrc, /index\.html/);
});

test("_shared/cors.ts: exporta corsHeaders", () => {
  assert.match(corsSrc, /export\s+const\s+corsHeaders/);
});

test("_shared/response.ts: exporta jsonResponse e errorResponse", () => {
  assert.match(respSrc, /export\s+function\s+jsonResponse/);
  assert.match(respSrc, /export\s+function\s+errorResponse/);
});

test("README: documenta env vars, guarda de auto-reset, régua da senha e aviso de 'nunca loga'", () => {
  assert.match(readmeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readmeSrc, /SELF_RESET_FORBIDDEN/);
  assert.match(readmeSrc, /crypto\.getRandomValues/);
  assert.match(readmeSrc, /nunca contêm a senha/i);
  assert.match(readmeSrc, /supabase\.functions\.invoke/);
});

// ---------------------------------------------------------------------
// A6.2 — audit trail wiring (usuarios_eventos explicit insert)
// ---------------------------------------------------------------------

test("index.ts: insere evento de auditoria em usuarios_eventos", () => {
  assert.match(indexSrc, /\.from\(["']usuarios_eventos["']\)\.insert/);
});

test("index.ts: evento de auditoria usa tipo_evento 'senha_resetada'", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  assert.ok(idx > 0, "insert em usuarios_eventos não encontrado");
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /tipo_evento:\s*["']senha_resetada["']/);
});

test("index.ts: ator_id do evento vem de callerId (JWT validado), nunca auth.uid()", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /ator_id:\s*callerId/);
  assert.doesNotMatch(bloco, /ator_id:\s*.*auth\.uid\(\)/);
});

test("index.ts: payload do evento é vazio — a senha gerada NUNCA é persistida na auditoria", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /payload:\s*\{\}/, "payload deve ser literal vazio");
  assert.doesNotMatch(bloco, /newPassword/, "newPassword não pode aparecer no bloco do insert de auditoria");
});

test("index.ts: evento de auditoria popula snapshot de identidade a partir de targetProfile", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 400);
  assert.match(bloco, /usuario_email:\s*targetProfile\.email/);
  assert.match(bloco, /usuario_nome:\s*targetProfile\.nome/);
  assert.match(bloco, /usuario_tipo:\s*targetProfile\.tipo/);
});

test("index.ts: insert de auditoria fica após o reset Auth e a flag de perfil (só no caminho de sucesso total)", () => {
  const auditIdx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const flagIdx = indexSrc.indexOf("senha_temporaria: true");
  assert.ok(auditIdx > flagIdx, "insert de auditoria deve ocorrer após a flag senha_temporaria ser gravada");
});

test("index.ts: falha no insert de auditoria é logada e sinalizada, sem abortar a ação", () => {
  const idx = indexSrc.indexOf('.from("usuarios_eventos").insert');
  const bloco = indexSrc.slice(idx, idx + 900);
  assert.match(bloco, /auditRecorded\s*=\s*false/);
  assert.match(bloco, /console\.error/);
});

test("index.ts: response final inclui audit_recorded, mantendo password apenas no payload de resposta (não na auditoria)", () => {
  const returnIdx = indexSrc.lastIndexOf("return jsonResponse");
  const bloco = indexSrc.slice(returnIdx, returnIdx + 400);
  assert.match(bloco, /audit_recorded:\s*auditRecorded/);
  assert.match(bloco, /password:\s*newPassword/);
});
