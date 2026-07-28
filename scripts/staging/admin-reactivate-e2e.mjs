// =====================================================================
// === scripts/staging/admin-reactivate-e2e.mjs ==========================
// Runner local automatizado para E2E de `admin-reactivate-user`
// (A5.3-A5.4) em ambiente Supabase nao-produtivo isolado — que hoje
// NAO existe (runner desativado). Mesmo
// esqueleto de scripts/staging/admin-disable-user-e2e.mjs e
// scripts/staging/admin-reset-password-e2e.mjs (setup/run, HTTP cru,
// sem SQL manual, sem chamar auth.admin.* fora das Edge Functions
// existentes, nunca imprime segredo).
//
// Comandos:
//
//   node scripts/staging/admin-reactivate-e2e.mjs setup
//     Coleta admin_email, admin_password e (opcionalmente) fornecedor_id
//     uma única vez e salva em
//     .ravatex-local/admin-reactivate-e2e.config.json (gitignored).
//     Descobre staging URL e anon key via js/config.js. Bloqueia se
//     detectar produção.
//
//   node scripts/staging/admin-reactivate-e2e.mjs run
//     Carrega o config e executa o E2E completo em staging:
//       1) login admin
//       2) confirma admin ativo em public.usuarios
//       3) resolve fornecedor_id
//       4) cria fornecedor descartável via admin-create-user
//       5) confirma login do sintético ANTES da desativação
//       6) desativa o sintético via admin-disable-user (fluxo já
//          existente e aceito — espera sucesso)
//       7) confirma login bloqueado (banido) após a desativação
//       8) reativa via admin-reactivate-user (nova Edge Function)
//          → espera sucesso, ativo=true, auth_banned=false
//       9) confirma flags limpas em public.usuarios (ativo=true,
//          desativado_em/desativado_por/motivo_desativacao = null)
//      10) confirma login funciona novamente (ban removido)
//      11) guarda REACTIVATE_NOT_INACTIVE: reativar o mesmo usuário
//          (agora ativo) de novo → espera erro
//      12) cleanup via admin-delete-user
//      13) confirma cleanup zero
//      14) imprime resumo sanitizado
//
// Garantias:
//   - DESATIVADO (fail closed): bhgifjrfagkzubpyqpew e o projeto PROIBIDO.
//     ucrjtfswnfdlxwtmxnoo e PRODUCAO: mutacao por este runner nao e autorizada.
//   - Não usa SQL manual, .delete(), nem chama auth.admin.* fora das
//     Edge Functions já existentes e aceitas.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role.
//   - Salva config em .ravatex-local/ (gitignored).
//
// Edge Functions `admin-disable-user` e `admin-reactivate-user` devem
// estar deployadas no ambiente nao-produtivo antes do `run`. Sem esse
// ambiente, `run` nao executa.
//
// IMPORTANTE: este runner faz login com senha real de admin. Deve ser
// executado por um humano com as credenciais de admin de staging, não
// pelo agente IA (que não entra senha/token em nenhum campo).
// =====================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..", "..");
const CONFIG_DIR = resolve(ROOT, ".ravatex-local");
const CONFIG_PATH = resolve(CONFIG_DIR, "admin-reactivate-e2e.config.json");
// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1 — fail closed.
// Este runner executa mutacao (Auth / Edge Function / dados) e so pode
// operar contra um ambiente nao-produtivo isolado. Esse ambiente NAO
// existe: ucrjtfswnfdlxwtmxnoo e a PRODUCAO definitiva,
// gqmpsxkxynrjvidfmojk foi RETIRADO (nao e producao, staging, development
// nem fallback) e bhgifjrfagkzubpyqpew e PROIBIDO. O caminho real de
// execucao esta desativado deterministicamente; o proposito futuro do
// runner permanece visivel no codigo.
const PRODUCTION_REF = "ucrjtfswnfdlxwtmxnoo";
const RETIRED_REF = "gqmpsxkxynrjvidfmojk";
const FORBIDDEN_REF = "bhgifjrfagkzubpyqpew";
const NONPRODUCTION_ENVIRONMENT_UNAVAILABLE = "INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE";

// Nao existe variavel de ambiente, flag de CLI, prompt oculto ou override
// generico que libere o caminho de escrita em producao.
function refuseNonProductionEnvironmentUnavailable() {
  console.error(NONPRODUCTION_ENVIRONMENT_UNAVAILABLE);
  console.error("Este runner exige um ambiente nao-produtivo isolado.");
  console.error("Nenhum ambiente nao-produtivo valido existe atualmente.");
  console.error("O projeto configurado (" + PRODUCTION_REF + ") e PRODUCAO.");
  console.error("Mutacao em producao nao e autorizada por este runner.");
  console.error("Projeto retirado: " + RETIRED_REF + "; projeto proibido: " + FORBIDDEN_REF + ".");
  process.exit(3);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

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

function assertNonProductionEnvironment() {
  // Defesa em profundidade: qualquer caminho remanescente que tente
  // validar o ambiente para mutar falha fechada.
  refuseNonProductionEnvironmentUnavailable();
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

// ---------------------------------------------------------------------
// HTTP helpers (sem dependência de @supabase/supabase-js)
// ---------------------------------------------------------------------

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

async function loginExpectFailure(supabaseUrl, anonKey, email, password, expectedSubstrings, label) {
  const labelStr = label || "login";
  const { status, body } = await postSupabaseLogin(supabaseUrl, anonKey, email, password);
  const raw = String(extractLoginErrorText(body, "") || "");
  const lower = raw.toLowerCase();
  if (status >= 200 && status < 300) {
    return {
      ok: false, unexpected: true, status,
      detail: labelStr + ": login succeeded unexpectedly (HTTP " + status + ")",
      body,
    };
  }
  const expected = Array.isArray(expectedSubstrings) ? expectedSubstrings : [];
  for (const e of expected) {
    if (typeof e === "string" && lower.includes(e.toLowerCase())) {
      return { ok: true, status, detail: raw, body };
    }
  }
  return {
    ok: false, unexpected: true, status,
    detail: labelStr + ": erro não corresponde ao esperado. recebido=" + sanitize(raw),
    body,
  };
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

// ---------------------------------------------------------------------
// Comandos: setup / run
// ---------------------------------------------------------------------

async function cmdSetup() {
  log("RAVATEX admin-reactivate-user (A5.3-A5.4) E2E - setup");
  log("");

  const cfg = detectStagingFromConfigJs();
  let supabaseUrl, anonKey;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    supabaseUrl = cfg.supabaseUrl;
    anonKey = cfg.supabaseAnonKey;
    log("Detectado staging do app (js/config.js): " + sanitize(supabaseUrl));
  } else {
    die("Não foi possível detectar staging do app via js/config.js.");
  }
  assertNonProductionEnvironment();

  const adminEmail = (await promptLine("Admin email (staging): ")).trim();
  if (!adminEmail) die("Admin email obrigatório.");
  const adminPassword = (await promptLine("Admin password (staging, será salvo local e gitignored): ")).trim();
  if (!adminPassword) die("Admin password obrigatório.");

  const autoForn = (await promptLine("Auto-detectar primeiro fornecedor no run? (s/N): ")).trim().toLowerCase();
  const autoDetect = autoForn === "s" || autoForn === "sim" || autoForn === "y" || autoForn === "yes";

  let fornecedorId = null;
  if (!autoDetect) {
    const raw = (await promptLine("fornecedor_id (número) ou vazio para autodetect no run: ")).trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) die("fornecedor_id inválido.");
      fornecedorId = n;
    }
  }

  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });

  const config = {
    supabaseUrl, anonKey, adminEmail, adminPassword,
    autoDetectFornecedor: autoDetect, fornecedorId,
    createdAt: new Date().toISOString(),
    note: "Arquivo local, gitignored (.ravatex-local/). Não versionar. Não commitar.",
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  log("");
  log("Configuração salva em: " + CONFIG_PATH);
  log("  project_ref:   " + PRODUCTION_REF);
  log("  supabaseUrl:   " + sanitize(supabaseUrl));
  log("  adminEmail:    " + adminEmail);
  log("  adminPassword: " + maskSecret(adminPassword));
  log("  autoDetect:    " + String(autoDetect));
  log("  fornecedorId:  " + (fornecedorId === null ? "(autodetect no run)" : fornecedorId));
  log("");
  log("Para rodar o E2E: node scripts/staging/admin-reactivate-e2e.mjs run");
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die("Config não encontrado em " + CONFIG_PATH + ". Rode antes: node scripts/staging/admin-reactivate-e2e.mjs setup");
  }
  let raw;
  try { raw = readFileSync(CONFIG_PATH, "utf8"); } catch (e) { die("Falha ao ler " + CONFIG_PATH + ": " + sanitize(e.message)); }
  let cfg;
  try { cfg = JSON.parse(raw); } catch (e) { die("Config inválido (JSON.parse falhou): " + sanitize(e.message)); }
  for (const k of ["supabaseUrl", "anonKey", "adminEmail", "adminPassword"]) {
    if (!cfg[k] || typeof cfg[k] !== "string") die("Campo obrigatório ausente/inválido no config: " + k);
  }
  assertNonProductionEnvironment();
  return cfg;
}

function generateTestEmail() {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return "reactivate-e2e-" + ts + "@tapetes.test";
}

function generateTestPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 22; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function resolveFornecedorId(cfg, adminAccess) {
  if (cfg.fornecedorId && Number.isInteger(cfg.fornecedorId) && cfg.fornecedorId > 0) return cfg.fornecedorId;
  if (cfg.autoDetectFornecedor === true) {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, adminAccess.accessToken, "fornecedores", "select=id,nome&order=id&limit=1");
    if (!Array.isArray(rows) || rows.length === 0) die("autoDetect habilitado mas nenhum fornecedor encontrado em public.fornecedores.");
    return rows[0].id;
  }
  die("fornecedor_id ausente no config e autoDetect=false. Rode setup novamente.");
}

function expectErrorCode(resp, expectedCodes, label) {
  if (resp.status < 400) {
    die((label || "") + ": esperava erro 4xx/5xx com code " + JSON.stringify(expectedCodes) + ", recebi HTTP " + resp.status + " body=" + sanitize(JSON.stringify(resp.body)));
  }
  const code = resp.body && resp.body.error && resp.body.error.code;
  if (!expectedCodes.includes(code)) {
    die((label || "") + ": esperava code " + JSON.stringify(expectedCodes) + ", recebi " + JSON.stringify(code) + " (HTTP " + resp.status + ") body=" + sanitize(JSON.stringify(resp.body)));
  }
  return code;
}

function expectSuccess(resp, expectedFields, label) {
  if (resp.status < 200 || resp.status >= 300) {
    die((label || "") + ": esperava sucesso 2xx, recebi HTTP " + resp.status + " body=" + sanitize(JSON.stringify(resp.body)));
  }
  if (!resp.body || !resp.body.data) {
    die((label || "") + ": resposta de sucesso sem envelope { data: ... }: " + sanitize(JSON.stringify(resp.body)));
  }
  for (const f of expectedFields) {
    if (!(f in resp.body.data)) die((label || "") + ": campo obrigatório ausente em data: " + f);
  }
  return resp.body.data;
}

async function cmdRun() {
  const cfg = loadConfig();
  const summary = { project_ref: PRODUCTION_REF, test_email: null, test_user_id: null, steps: {}, result: "FAIL" };

  log("RAVATEX admin-reactivate-user (A5.3-A5.4) E2E staging");
  log("project_ref: " + PRODUCTION_REF);
  log("");

  // 1. Login admin.
  let admin;
  try {
    admin = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, cfg.adminEmail, cfg.adminPassword, "admin_login");
    summary.steps.admin_login = "OK";
    log("[OK] admin_login: " + cfg.adminEmail);
  } catch (e) { die("Falha no login admin: " + sanitize(e.message)); }

  // 2. Confirma admin ativo.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios", "select=id,tipo,ativo&limit=1&id=eq." + encodeURIComponent(admin.userId));
    const prof = rows && rows[0];
    if (!prof || prof.tipo !== "admin" || prof.ativo !== true) die("Chamador não é admin ativo.");
    summary.steps.admin_active = "OK";
    log("[OK] admin_active: tipo=admin, ativo=true");
  } catch (e) { die("Falha ao verificar admin ativo: " + sanitize(e.message)); }

  // 3. Resolve fornecedor_id.
  let fornecedorId;
  try {
    fornecedorId = await resolveFornecedorId(cfg, admin);
    summary.steps.fornecedor_resolved = "OK";
    log("[OK] fornecedor_resolved: id=" + fornecedorId);
  } catch (e) { die("Falha ao resolver fornecedor_id: " + sanitize(e.message)); }

  // 4. Cria fornecedor descartável.
  const testEmail = generateTestEmail();
  const testPassword = generateTestPassword();
  summary.test_email = testEmail;
  let createdData;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-create-user", {
      email: testEmail, password: testPassword, nome: "Admin Reactivate E2E", tipo: "fornecedor", fornecedor_id: fornecedorId,
    });
    createdData = expectSuccess(resp, ["user_id", "email", "tipo", "fornecedor_id"], "create_synthetic_user");
    summary.test_user_id = createdData.user_id;
    summary.steps.create_synthetic_user = "OK";
    log("[OK] create_synthetic_user: user_id=" + createdData.user_id);
  } catch (e) { die("Falha ao criar usuário sintético: " + sanitize(e.message)); }

  // 5. Confirma login do sintético ANTES da desativação.
  try {
    await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, testPassword, "synthetic_login_before_disable");
    summary.steps.synthetic_login_before_disable = "OK";
    log("[OK] synthetic_login_before_disable: login funciona antes de qualquer desativação");
  } catch (e) { die("Falha no login do sintético antes da desativação: " + sanitize(e.message)); }

  // 6. Desativa o sintético (fluxo já existente e aceito).
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-disable-user", {
      user_id: createdData.user_id, reason: "E2E reactivate runner: desativação preparatória",
    });
    const data = expectSuccess(resp, ["user_id", "ativo", "auth_banned"], "disable_synthetic_user");
    if (data.ativo !== false) die("disable_synthetic_user: esperava ativo=false.");
    if (data.auth_banned !== true) die("disable_synthetic_user: esperava auth_banned=true.");
    summary.steps.disable_synthetic_user = "OK";
    log("[OK] disable_synthetic_user: ativo=false, auth_banned=true");
  } catch (e) { die("Falha ao desativar o usuário sintético: " + sanitize(e.message)); }

  // 7. Confirma login bloqueado (banido) após a desativação.
  try {
    const failRes = await loginExpectFailure(
      cfg.supabaseUrl, cfg.anonKey, testEmail, testPassword,
      ["User is banned", "banned", "Banned", "Banned user"],
      "login_blocked_after_disable",
    );
    if (failRes.unexpected) die("login_blocked_after_disable: " + failRes.detail);
    summary.steps.login_blocked_after_disable = "OK";
    log("[OK] login_blocked_after_disable: HTTP " + failRes.status + " (falha esperada após desativação)");
  } catch (e) { die("Falha no teste de login bloqueado: " + sanitize(e.message)); }

  // 8. Reativa via admin-reactivate-user.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reactivate-user", {
      user_id: createdData.user_id,
    });
    const data = expectSuccess(resp, ["user_id", "email", "tipo", "ativo", "auth_banned"], "reactivate_synthetic_user");
    if (data.ativo !== true) die("reactivate_synthetic_user: esperava ativo=true. body=" + sanitize(JSON.stringify(data)));
    if (data.auth_banned !== false) die("reactivate_synthetic_user: esperava auth_banned=false. body=" + sanitize(JSON.stringify(data)));
    summary.steps.reactivate_synthetic_user = "OK";
    log("[OK] reactivate_synthetic_user: ativo=true, auth_banned=false");
  } catch (e) { die("Falha na reativação do usuário sintético: " + sanitize(e.message)); }

  // 9. Confirma flags limpas em public.usuarios.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=ativo,desativado_em,desativado_por,motivo_desativacao&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    const prof = rows && rows[0];
    if (!prof) die("Perfil do reativado não encontrado.");
    if (prof.ativo !== true) die("Perfil não está com ativo=true após reativação.");
    if (prof.desativado_em !== null) die("desativado_em deveria estar null após reativação.");
    if (prof.desativado_por !== null) die("desativado_por deveria estar null após reativação.");
    if (prof.motivo_desativacao !== null) die("motivo_desativacao deveria estar null após reativação.");
    summary.steps.profile_flags_cleared = "OK";
    log("[OK] profile_flags_cleared: ativo=true, desativado_em/por/motivo=null");
  } catch (e) { die("Falha ao validar perfil reativado: " + sanitize(e.message)); }

  // 10. Confirma login funciona novamente (ban removido).
  try {
    await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, testPassword, "synthetic_login_after_reactivate");
    summary.steps.login_restored = "OK";
    log("[OK] login_restored: login funciona novamente após a reativação");
  } catch (e) { die("Falha ao confirmar login restaurado: " + sanitize(e.message)); }

  // 11. Guarda REACTIVATE_NOT_INACTIVE (alvo já ativo).
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reactivate-user", {
      user_id: createdData.user_id,
    });
    const code = expectErrorCode(resp, ["REACTIVATE_NOT_INACTIVE"], "reactivate_not_inactive_guard");
    summary.steps.reactivate_not_inactive_guard = "OK";
    log("[OK] reactivate_not_inactive_guard: " + code);
  } catch (e) { die("Falha no teste de guarda REACTIVATE_NOT_INACTIVE: " + sanitize(e.message)); }

  // 12. Cleanup.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-delete-user", {
      user_id: createdData.user_id, confirm_email: testEmail,
    });
    const data = expectSuccess(resp, ["ok", "deleted", "user_id", "email"], "cleanup_delete");
    if (data.deleted !== true) die("cleanup_delete: deleted != true.");
    summary.steps.cleanup_delete = "OK";
    log("[OK] cleanup_delete: deleted=true");
  } catch (e) { die("Falha no cleanup via admin-delete-user: " + sanitize(e.message)); }

  // 13. Confirma cleanup zero.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    if (Array.isArray(rows) && rows.length > 0) die("cleanup_verify: perfil ainda existe após delete.");
    summary.steps.cleanup_verify = "OK";
    log("[OK] cleanup_verify: perfil ausente (cleanup zero confirmado)");
  } catch (e) { die("Falha ao verificar cleanup: " + sanitize(e.message)); }

  summary.result = "PASS";
  log("");
  log("RAVATEX admin-reactivate-user (A5.3-A5.4) E2E staging");
  log("project_ref: " + summary.project_ref);
  log("test_email: " + summary.test_email);
  log("test_user_id: " + summary.test_user_id);
  for (const [k, v] of Object.entries(summary.steps)) log(k + ": " + v);
  log("result: " + summary.result);
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main() {
  const cmd = (process.argv[2] || "").toLowerCase();
  // Fail closed ANTES de qualquer prompt de credencial, leitura de token,
  // criacao de client, abertura de browser, fetch ou escrita de config
  // local de execucao.
  if (cmd === "setup" || cmd === "run") refuseNonProductionEnvironmentUnavailable();
  log("Uso:");
  log("  node scripts/staging/admin-reactivate-e2e.mjs setup");
  log("  node scripts/staging/admin-reactivate-e2e.mjs run");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
