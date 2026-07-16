// =====================================================================
// === scripts/staging/trocar-senha-obrigatoria-e2e.mjs =================
// Runner local automatizado para verificacao pos-implementacao da
// guarda de troca de senha obrigatoria (A4.2), Supabase staging
// `ucrjtfswnfdlxwtmxnoo`.
//
// Mesmo esqueleto de scripts/staging/admin-create-user-password-policy-e2e.mjs
// (setup/run, HTTP cru, sem SQL manual, sem chamar auth.admin.* fora
// das Edge Functions existentes, nunca imprime segredo).
//
// Comandos:
//
//   node scripts/staging/trocar-senha-obrigatoria-e2e.mjs setup
//     Coleta admin_email, admin_password e (opcionalmente) fornecedor_id
//     uma unica vez e salva em
//     .ravatex-local/trocar-senha-obrigatoria-e2e.config.json
//     (gitignored). Descobre staging URL e anon key via js/config.js.
//     Bloqueia se detectar producao.
//
//   node scripts/staging/trocar-senha-obrigatoria-e2e.mjs run
//     Carrega o config e executa a verificacao completa em staging:
//       1) login admin (loginExpectSuccess - fatal se falhar)
//       2) confirma admin ativo em public.usuarios
//       3) escolhe fornecedor_id (config ou autodetect)
//       4) cria usuario sintetico via admin-create-user (senha temporaria
//          gerada pelo proprio script, nunca digitada por humano)
//       5) confirma em public.usuarios: senha_temporaria=true e
//          senha_gerada_em preenchido (mesma checagem de A4.1)
//       6) login AUTOSSERVICO como o usuario sintetico com a senha
//          temporaria (exercita o mesmo caminho que o app real percorre
//          apos o login: sessao autenticada, senha_temporaria=true)
//       7) confirma que o proprio token do usuario sintetico le
//          senha_temporaria=true no seu perfil (o que o boot.js real
//          leria de CURRENT_USER para acionar a guarda)
//       8) PATCH /auth/v1/user com nova senha usando o token do usuario
//          sintetico (exercita exatamente supabase.auth.updateUser
//          self-service, sem Admin API)
//       9) PATCH /rest/v1/usuarios?id=eq.<id> com senha_temporaria=false
//          usando o MESMO token (exercita a RLS usuarios_self_update e
//          o segundo passo de trocarSenhaObrigatoria)
//      10) confirma via SELECT (token admin) que senha_temporaria=false
//      11) login autosservico NOVAMENTE com a NOVA senha - confirma
//          sucesso e senha_temporaria=false (equivalente a "proximo
//          login entra direto", sem a guarda)
//      12) cleanup via admin-delete-user (fluxo existente)
//      13) confirma cleanup zero
//      14) imprime resumo sanitizado
//
// Nao cobre (fora do alcance de um script HTTP): renderizacao da tela
// (verificado por tests/trocar-senha-obrigatoria.smoke.js) e reacao do
// checklist a tecla (idem) - este runner cobre exclusivamente o
// contrato de dados/Auth/RLS por tras da tela.
//
// Garantias:
//   - Bloqueia execucao se a URL for producao `bhgifjrfagkzubpyqpew`.
//   - Exige URL contendo o ref de staging `ucrjtfswnfdlxwtmxnoo`.
//   - Nao usa SQL manual, .delete() direto, nem chama auth.admin.*
//     fora das Edge Functions ja existentes e aceitas
//     (admin-create-user, admin-delete-user).
//   - A senha "nova" definida pelo usuario sintetico e gerada
//     aleatoriamente pelo proprio script - nenhum humano nem agente a
//     digita em lugar nenhum.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role.
//   - Salva config em .ravatex-local/ (gitignored).
//
// IMPORTANTE: este runner faz login com senha real de admin. Deve ser
// executado por um humano com as credenciais de admin de staging, nao
// pelo agente IA (que nao entra senha/token em nenhum campo, regra
// permanente).
// =====================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..", "..");
const CONFIG_DIR = resolve(ROOT, ".ravatex-local");
const CONFIG_PATH = resolve(CONFIG_DIR, "trocar-senha-obrigatoria-e2e.config.json");
const STAGING_REF = "ucrjtfswnfdlxwtmxnoo";
const PRODUCTION_REF = "bhgifjrfagkzubpyqpew";

function log(msg) {
  process.stdout.write(String(msg) + "\n");
}

function die(msg, code = 1) {
  log("ERROR: " + msg);
  process.exit(code);
}

function sanitize(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/(password|service_role|anon[_-]?key|access[_-]?token|refresh[_-]?token)["'\s:=]+[^\s"',}]+/gi, "$1=[REDACTED]");
}

function detectStagingFromConfigJs() {
  const configPath = resolve(ROOT, "js", "config.js");
  if (!existsSync(configPath)) return null;
  const src = readFileSync(configPath, "utf8");
  const m = src.match(
    /staging\s*:\s*\{[\s\S]*?supabaseUrl\s*:\s*['"]([^'"]+)['"][\s\S]*?supabaseAnonKey\s*:\s*['"]([^'"]+)['"]/,
  );
  if (!m) return null;
  return { supabaseUrl: m[1], supabaseAnonKey: m[2] };
}

function assertStagingUrl(url) {
  if (typeof url !== "string" || !url) {
    die("URL do Supabase ausente ou invalida.");
  }
  if (url.includes(PRODUCTION_REF)) {
    die(
      "URL aponta para PRODUCAO (" + PRODUCTION_REF + "). " +
        "Este runner e exclusivo para staging (" + STAGING_REF + "). Abortando.",
    );
  }
  if (!url.includes(STAGING_REF)) {
    die(
      "URL nao contem o ref de staging esperado (" + STAGING_REF + "). " +
        "URL recebida: " + sanitize(url),
    );
  }
}

function promptLine(question) {
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolvePrompt(answer);
    });
  });
}

function maskSecret(s) {
  if (!s) return "";
  if (s.length <= 2) return "*".repeat(s.length);
  return s[0] + "*".repeat(Math.max(0, s.length - 2)) + s[s.length - 1];
}

// Senha temporaria/nova gerada pelo proprio script - nunca digitada por
// humano ou agente. 8+ chars, 1+ digito (politica de A4.1).
function generateSyntheticPassword() {
  return "E2eSynth" + randomBytes(4).toString("hex") + Math.floor(Math.random() * 90 + 10);
}

async function postSupabaseLogin(supabaseUrl, anonKey, email, password) {
  const url = supabaseUrl.replace(/\/+$/, "") + "/auth/v1/token?grant_type=password";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": anonKey },
    body: JSON.stringify({ email, password }),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

function extractLoginErrorText(body, fallback) {
  if (body && typeof body === "object") {
    return body.error_description || body.msg || body.message || body.error || fallback || "";
  }
  return fallback || "";
}

async function loginExpectSuccess(supabaseUrl, anonKey, email, password, label) {
  const labelStr = label || "login";
  const { status, body } = await postSupabaseLogin(supabaseUrl, anonKey, email, password);
  if (status < 200 || status >= 300) {
    die(labelStr + " failed: HTTP " + status + " " + sanitize(extractLoginErrorText(body, "(sem corpo)")));
  }
  if (!body || !body.access_token || !body.user || !body.user.id) {
    die("Resposta de login inesperada (sem access_token/user.id) em " + labelStr + ".");
  }
  return { accessToken: body.access_token, userId: body.user.id, email: body.user.email };
}

async function restSelect(supabaseUrl, anonKey, accessToken, table, query) {
  const url = supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + table + "?" + query;
  const res = await fetch(url, {
    method: "GET",
    headers: { "apikey": anonKey, "Authorization": "Bearer " + accessToken },
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    die("GET " + table + " falhou: HTTP " + res.status + " " + sanitize(JSON.stringify(body)));
  }
  return body;
}

async function restPatch(supabaseUrl, anonKey, accessToken, table, query, payload) {
  const url = supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + table + "?" + query;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json", "apikey": anonKey,
      "Authorization": "Bearer " + accessToken, "Prefer": "return=representation",
    },
    body: JSON.stringify(payload),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, ok: res.ok, body };
}

// Self-service: PATCH /auth/v1/user com o token do PROPRIO usuario -
// exatamente o caminho de supabase.auth.updateUser({password}).
async function authUpdateUserPassword(supabaseUrl, anonKey, accessToken, newPassword) {
  const url = supabaseUrl.replace(/\/+$/, "") + "/auth/v1/user";
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "apikey": anonKey, "Authorization": "Bearer " + accessToken },
    body: JSON.stringify({ password: newPassword }),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, ok: res.ok, body };
}

async function callEdgeFunction(supabaseUrl, anonKey, accessToken, name, payload) {
  const url = supabaseUrl.replace(/\/+$/, "") + "/functions/v1/" + name;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": anonKey, "Authorization": "Bearer " + accessToken },
    body: JSON.stringify(payload),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function cmdSetup() {
  log("RAVATEX trocar-senha-obrigatoria (A4.2) E2E - setup");
  log("");

  const cfg = detectStagingFromConfigJs();
  let supabaseUrl, anonKey;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    supabaseUrl = cfg.supabaseUrl;
    anonKey = cfg.supabaseAnonKey;
    log("Detectado staging do app (js/config.js): " + sanitize(supabaseUrl));
  } else {
    die("Nao foi possivel detectar staging do app via js/config.js.");
  }
  assertStagingUrl(supabaseUrl);

  const adminEmail = (await promptLine("Admin email (staging): ")).trim();
  if (!adminEmail) die("Admin email obrigatorio.");
  const adminPassword = (await promptLine("Admin password (staging, sera salvo local e gitignored): ")).trim();
  if (!adminPassword) die("Admin password obrigatorio.");

  const autoForn = (await promptLine("Auto-detectar primeiro fornecedor no run? (s/N): ")).trim().toLowerCase();
  const autoDetect = autoForn === "s" || autoForn === "sim" || autoForn === "y" || autoForn === "yes";

  let fornecedorId = null;
  if (!autoDetect) {
    const raw = (await promptLine("fornecedor_id (numero) ou vazio para autodetect no run: ")).trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) die("fornecedor_id invalido.");
      fornecedorId = n;
    }
  }

  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });

  const config = {
    supabaseUrl, anonKey, adminEmail, adminPassword,
    autoDetectFornecedor: autoDetect, fornecedorId,
    createdAt: new Date().toISOString(),
    note: "Arquivo local, gitignored (.ravatex-local/). Nao versionar. Nao commitar.",
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  log("");
  log("Configuracao salva em: " + CONFIG_PATH);
  log("  project_ref:   " + STAGING_REF);
  log("  supabaseUrl:   " + sanitize(supabaseUrl));
  log("  adminEmail:    " + adminEmail);
  log("  adminPassword: " + maskSecret(adminPassword));
  log("  autoDetect:    " + String(autoDetect));
  log("  fornecedorId:  " + (fornecedorId === null ? "(autodetect no run)" : fornecedorId));
  log("");
  log("Para rodar a verificacao: node scripts/staging/trocar-senha-obrigatoria-e2e.mjs run");
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die("Config nao encontrado em " + CONFIG_PATH + ". Rode antes: node scripts/staging/trocar-senha-obrigatoria-e2e.mjs setup");
  }
  let raw;
  try { raw = readFileSync(CONFIG_PATH, "utf8"); } catch (e) { die("Falha ao ler " + CONFIG_PATH + ": " + sanitize(e.message)); }
  let cfg;
  try { cfg = JSON.parse(raw); } catch (e) { die("Config invalido (JSON.parse falhou): " + sanitize(e.message)); }
  for (const k of ["supabaseUrl", "anonKey", "adminEmail", "adminPassword"]) {
    if (!cfg[k] || typeof cfg[k] !== "string") die("Campo obrigatorio ausente/invalido no config: " + k);
  }
  assertStagingUrl(cfg.supabaseUrl);
  return cfg;
}

function generateTestEmail() {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return "trocar-senha-e2e-" + ts + "@tapetes.test";
}

async function resolveFornecedorId(cfg, adminAccess) {
  if (cfg.fornecedorId && Number.isInteger(cfg.fornecedorId) && cfg.fornecedorId > 0) return cfg.fornecedorId;
  if (cfg.autoDetectFornecedor === true) {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, adminAccess.accessToken, "fornecedores", "select=id,nome&order=id&limit=1");
    if (!Array.isArray(rows) || rows.length === 0) die("autoDetect habilitado mas nenhum fornecedor encontrado.");
    return rows[0].id;
  }
  die("fornecedor_id ausente no config e autoDetect=false.");
}

function expectSuccess(resp, expectedFields, label) {
  if (resp.status < 200 || resp.status >= 300) {
    die((label || "") + ": esperava sucesso 2xx, recebi HTTP " + resp.status + " body=" + sanitize(JSON.stringify(resp.body)));
  }
  if (!resp.body || !resp.body.data) {
    die((label || "") + ": resposta de sucesso sem envelope { data: ... }: " + sanitize(JSON.stringify(resp.body)));
  }
  for (const f of expectedFields) {
    if (!(f in resp.body.data)) die((label || "") + ": campo obrigatorio ausente em data: " + f);
  }
  return resp.body.data;
}

async function cmdRun() {
  const cfg = loadConfig();
  const summary = { project_ref: STAGING_REF, test_email: null, test_user_id: null, steps: {}, result: "FAIL" };

  log("RAVATEX trocar-senha-obrigatoria (A4.2) E2E staging");
  log("project_ref: " + STAGING_REF);
  log("");

  let admin;
  try {
    admin = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, cfg.adminEmail, cfg.adminPassword, "admin_login");
    summary.steps.admin_login = "OK";
    log("[OK] admin_login: " + cfg.adminEmail);
  } catch (e) { die("Falha no login admin: " + sanitize(e.message)); }

  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios", "select=id,tipo,ativo&limit=1&id=eq." + encodeURIComponent(admin.userId));
    const prof = rows && rows[0];
    if (!prof || prof.tipo !== "admin" || prof.ativo !== true) die("Chamador nao e admin ativo.");
    summary.steps.admin_active = "OK";
    log("[OK] admin_active: tipo=admin, ativo=true");
  } catch (e) { die("Falha ao verificar admin ativo: " + sanitize(e.message)); }

  let fornecedorId;
  try {
    fornecedorId = await resolveFornecedorId(cfg, admin);
    summary.steps.fornecedor_resolved = "OK";
    log("[OK] fornecedor_resolved: id=" + fornecedorId);
  } catch (e) { die("Falha ao resolver fornecedor_id: " + sanitize(e.message)); }

  const testEmail = generateTestEmail();
  summary.test_email = testEmail;
  const tempPassword = generateSyntheticPassword();

  // 4. Cria usuario sintetico com senha temporaria gerada pelo script.
  let createdData;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-create-user", {
      email: testEmail, password: tempPassword, nome: "Trocar Senha E2E", tipo: "fornecedor", fornecedor_id: fornecedorId,
    });
    createdData = expectSuccess(resp, ["user_id", "email", "tipo", "fornecedor_id"], "create_synthetic_user");
    summary.test_user_id = createdData.user_id;
    summary.steps.create_synthetic_user = "OK";
    log("[OK] create_synthetic_user: user_id=" + createdData.user_id);
  } catch (e) { die("Falha ao criar usuario sintetico: " + sanitize(e.message)); }

  // 5. Confirma senha_temporaria=true, senha_gerada_em preenchido (admin token).
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id,senha_temporaria,senha_gerada_em&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    const prof = rows && rows[0];
    if (!prof) die("Perfil do usuario sintetico nao encontrado.");
    if (prof.senha_temporaria !== true) die("senha_temporaria != true apos criacao: " + sanitize(JSON.stringify(prof)));
    if (!prof.senha_gerada_em) die("senha_gerada_em nao preenchido apos criacao: " + sanitize(JSON.stringify(prof)));
    summary.steps.initial_flag_true = "OK";
    log("[OK] initial_flag_true: senha_temporaria=true, senha_gerada_em=" + prof.senha_gerada_em);
  } catch (e) { die("Falha ao validar flag inicial: " + sanitize(e.message)); }

  // 6. Login autosservico como o usuario sintetico (senha temporaria).
  let synth;
  try {
    synth = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, tempPassword, "synthetic_login_temp_password");
    summary.steps.synthetic_login_temp_password = "OK";
    log("[OK] synthetic_login_temp_password: user_id=" + synth.userId);
  } catch (e) { die("Falha no login do usuario sintetico com a senha temporaria: " + sanitize(e.message)); }

  // 7. Confirma que o proprio token do usuario sintetico le senha_temporaria=true
  // (o que CURRENT_USER teria apos loadCurrentUser() no app real - aciona a guarda).
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(synth.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== true) die("perfil proprio (token sintetico) nao mostra senha_temporaria=true: " + sanitize(JSON.stringify(prof)));
    summary.steps.self_read_flag_true = "OK";
    log("[OK] self_read_flag_true: CURRENT_USER.senha_temporaria=true (a guarda dispararia aqui no app real)");
  } catch (e) { die("Falha ao ler o proprio perfil com o token sintetico: " + sanitize(e.message)); }

  // 8. Self-service: PATCH /auth/v1/user com nova senha (supabase.auth.updateUser).
  const newPassword = generateSyntheticPassword();
  try {
    const resp = await authUpdateUserPassword(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, newPassword);
    if (!resp.ok) die("auth.updateUser (self-service) falhou: HTTP " + resp.status + " " + sanitize(JSON.stringify(resp.body)));
    summary.steps.self_service_password_change = "OK";
    log("[OK] self_service_password_change: HTTP " + resp.status + " (sem Admin API)");
  } catch (e) { die("Falha no self-service auth.updateUser: " + sanitize(e.message)); }

  // 9. Self-service: PATCH /rest/v1/usuarios?id=eq.<id> senha_temporaria=false,
  // com o MESMO token (exercita a RLS usuarios_self_update).
  try {
    const resp = await restPatch(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, "usuarios",
      "id=eq." + encodeURIComponent(synth.userId), { senha_temporaria: false });
    if (!resp.ok) die("PATCH usuarios (self-service, zerar flag) falhou: HTTP " + resp.status + " " + sanitize(JSON.stringify(resp.body)));
    summary.steps.self_service_flag_clear = "OK";
    log("[OK] self_service_flag_clear: HTTP " + resp.status + " (RLS usuarios_self_update permitiu)");
  } catch (e) { die("Falha ao zerar a flag via self-service: " + sanitize(e.message)); }

  // 10. Confirma via SELECT (token admin) que senha_temporaria=false agora.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(synth.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== false) die("senha_temporaria != false apos a troca: " + sanitize(JSON.stringify(prof)));
    summary.steps.flag_cleared_confirmed = "OK";
    log("[OK] flag_cleared_confirmed: senha_temporaria=false (confirmado com token admin)");
  } catch (e) { die("Falha ao confirmar que a flag foi zerada: " + sanitize(e.message)); }

  // 11. Login autosservico NOVAMENTE com a NOVA senha - "proximo login entra direto".
  try {
    const relogin = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, newPassword, "synthetic_relogin_new_password");
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, relogin.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(relogin.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== false) die("relogin: senha_temporaria deveria ser false: " + sanitize(JSON.stringify(prof)));
    summary.steps.relogin_no_gate = "OK";
    log("[OK] relogin_no_gate: login com a NOVA senha ok, senha_temporaria=false (proximo login entra direto)");
  } catch (e) { die("Falha no relogin com a nova senha: " + sanitize(e.message)); }

  // 12. Cleanup: admin-delete-user (fluxo existente).
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-delete-user", {
      user_id: createdData.user_id, confirm_email: testEmail,
    });
    const data = expectSuccess(resp, ["ok", "deleted", "user_id", "email"], "cleanup_delete");
    if (data.deleted !== true) die("cleanup_delete: deleted != true: " + sanitize(JSON.stringify(data)));
    summary.steps.cleanup_delete = "OK";
    log("[OK] cleanup_delete: deleted=true");
  } catch (e) { die("Falha no cleanup via admin-delete-user: " + sanitize(e.message)); }

  // 13. Confirma cleanup zero.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    if (Array.isArray(rows) && rows.length > 0) die("cleanup_verify: perfil ainda existe apos delete.");
    summary.steps.cleanup_verify = "OK";
    log("[OK] cleanup_verify: perfil ausente (cleanup zero confirmado)");
  } catch (e) { die("Falha ao verificar cleanup: " + sanitize(e.message)); }

  summary.result = "PASS";
  log("");
  log("RAVATEX trocar-senha-obrigatoria (A4.2) E2E staging");
  log("project_ref: " + summary.project_ref);
  log("test_email: " + summary.test_email);
  log("test_user_id: " + summary.test_user_id);
  for (const [k, v] of Object.entries(summary.steps)) log(k + ": " + v);
  log("result: " + summary.result);
}

async function main() {
  const cmd = (process.argv[2] || "").toLowerCase();
  if (cmd === "setup") return cmdSetup();
  if (cmd === "run") return cmdRun();
  log("Uso:");
  log("  node scripts/staging/trocar-senha-obrigatoria-e2e.mjs setup");
  log("  node scripts/staging/trocar-senha-obrigatoria-e2e.mjs run");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
