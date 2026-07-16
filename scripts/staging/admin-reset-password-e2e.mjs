// =====================================================================
// === scripts/staging/admin-reset-password-e2e.mjs =====================
// Runner local automatizado para verificacao pos-deploy do reset de
// senha administrativo (A5.1-A5.2), Supabase staging
// `ucrjtfswnfdlxwtmxnoo`.
//
// Mesmo esqueleto de scripts/staging/admin-create-user-password-policy-e2e.mjs
// e scripts/staging/trocar-senha-obrigatoria-e2e.mjs (setup/run, HTTP
// cru, sem SQL manual, sem chamar auth.admin.* fora das Edge Functions
// existentes, nunca imprime segredo). Este runner ENCADEIA reset
// administrativo (A5.1-A5.2) com o gate de troca obrigatoria (A4.2) ja
// verificado, fechando o ciclo completo.
//
// Comandos:
//
//   node scripts/staging/admin-reset-password-e2e.mjs setup
//     Coleta admin_email, admin_password e (opcionalmente) fornecedor_id
//     uma unica vez e salva em
//     .ravatex-local/admin-reset-password-e2e.config.json (gitignored).
//     Descobre staging URL e anon key via js/config.js. Bloqueia se
//     detectar producao.
//
//   node scripts/staging/admin-reset-password-e2e.mjs run
//     Carrega o config e executa a verificacao completa em staging:
//       1) login admin
//       2) confirma admin ativo
//       3) resolve fornecedor_id
//       4) cria usuario sintetico via admin-create-user (senha
//          temporaria P1, gerada pelo script)
//       5) guarda SELF_RESET_FORBIDDEN: admin tenta resetar a propria
//          senha -> espera 403 SELF_RESET_FORBIDDEN
//       6) guarda NOT_FOUND: reset com UUID inexistente -> espera 404
//       7) reseta a senha do usuario sintetico via
//          admin-reset-user-password -> nova senha P2 retornada na
//          resposta (uma unica vez, nunca logada)
//       8) confirma em public.usuarios: senha_temporaria=true e
//          senha_gerada_em atualizado (comparado ao valor da criacao)
//       9) confirma que a senha ANTIGA (P1) nao funciona mais
//          (login esperado falhar)
//      10) login com a senha NOVA (P2) -> sucesso; confirma que o
//          proprio token le senha_temporaria=true (a guarda A4.2
//          dispararia aqui no app real)
//      11) self-service (mesmo caminho de trocar-senha-obrigatoria-e2e):
//          PATCH /auth/v1/user com senha P3 + PATCH /rest/v1/usuarios
//          senha_temporaria=false, ambos com o token do usuario
//          sintetico
//      12) confirma flag zerada (token admin)
//      13) relogin com P3 -> sucesso, senha_temporaria=false
//          ("proximo login entra direto", sem gate)
//      14) cleanup via admin-delete-user
//      15) confirma cleanup zero
//      16) imprime resumo sanitizado
//
// Garantias:
//   - Bloqueia execucao se a URL for producao `bhgifjrfagkzubpyqpew`.
//   - Exige URL contendo o ref de staging `ucrjtfswnfdlxwtmxnoo`.
//   - Nao usa SQL manual, .delete() direto, nem chama auth.admin.*
//     fora das Edge Functions ja existentes e aceitas.
//   - Todas as senhas (P1/P2/P3) sao geradas pelo proprio script ou
//     recebidas da Edge Function — nunca digitadas por humano ou agente.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role.
//   - Salva config em .ravatex-local/ (gitignored).
//
// IMPORTANTE: este runner faz login com senha real de admin. Deve ser
// executado por um humano com as credenciais de admin de staging, nao
// pelo agente IA (que nao entra senha/token em nenhum campo).
// =====================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..", "..");
const CONFIG_DIR = resolve(ROOT, ".ravatex-local");
const CONFIG_PATH = resolve(CONFIG_DIR, "admin-reset-password-e2e.config.json");
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

async function loginExpectFailure(supabaseUrl, anonKey, email, password, label) {
  const labelStr = label || "login";
  const { status } = await postSupabaseLogin(supabaseUrl, anonKey, email, password);
  if (status >= 200 && status < 300) {
    die(labelStr + ": esperava falha de login (senha antiga deveria estar invalidada), mas obteve sucesso HTTP " + status);
  }
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
  log("RAVATEX admin-reset-user-password (A5.1-A5.2) E2E - setup");
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
  log("Para rodar a verificacao: node scripts/staging/admin-reset-password-e2e.mjs run");
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die("Config nao encontrado em " + CONFIG_PATH + ". Rode antes: node scripts/staging/admin-reset-password-e2e.mjs setup");
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
  return "admin-reset-e2e-" + ts + "@tapetes.test";
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

function expectErrorCode(resp, expectedCodes, label) {
  if (resp.status < 400) {
    die((label || "") + ": esperava erro 4xx/5xx com code " + JSON.stringify(expectedCodes) + ", recebi HTTP " + resp.status + " body=" + sanitize(JSON.stringify(resp.body)));
  }
  const code = resp.body && resp.body.error && resp.body.error.code;
  if (!expectedCodes.includes(code)) {
    die((label || "") + ": esperava code " + JSON.stringify(expectedCodes) + ", recebi " + JSON.stringify(code) + " (HTTP " + resp.status + ") body=" + sanitize(JSON.stringify(resp.body)));
  }
  return { code, message: resp.body?.error?.message };
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

  log("RAVATEX admin-reset-user-password (A5.1-A5.2) E2E staging");
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
  const p1 = generateSyntheticPassword();

  // 4. Cria usuario sintetico.
  let createdData;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-create-user", {
      email: testEmail, password: p1, nome: "Admin Reset E2E", tipo: "fornecedor", fornecedor_id: fornecedorId,
    });
    createdData = expectSuccess(resp, ["user_id", "email", "tipo", "fornecedor_id"], "create_synthetic_user");
    summary.test_user_id = createdData.user_id;
    summary.steps.create_synthetic_user = "OK";
    log("[OK] create_synthetic_user: user_id=" + createdData.user_id);
  } catch (e) { die("Falha ao criar usuario sintetico: " + sanitize(e.message)); }

  let senhaGeradaEmAntes;
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id,senha_gerada_em&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    senhaGeradaEmAntes = rows && rows[0] && rows[0].senha_gerada_em;
    if (!senhaGeradaEmAntes) die("senha_gerada_em ausente logo apos a criacao.");
  } catch (e) { die("Falha ao ler senha_gerada_em pos-criacao: " + sanitize(e.message)); }

  // 5. Guarda SELF_RESET_FORBIDDEN.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reset-user-password", {
      user_id: admin.userId,
    });
    expectErrorCode(resp, ["SELF_RESET_FORBIDDEN"], "self_reset_forbidden");
    summary.steps.self_reset_forbidden = "OK";
    log("[OK] self_reset_forbidden: admin não pode resetar a própria senha");
  } catch (e) { die("Falha no teste self_reset_forbidden: " + sanitize(e.message)); }

  // 6. Guarda NOT_FOUND.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reset-user-password", {
      user_id: "00000000-0000-0000-0000-000000000000",
    });
    expectErrorCode(resp, ["NOT_FOUND"], "reset_not_found");
    summary.steps.reset_not_found = "OK";
    log("[OK] reset_not_found: UUID inexistente rejeitado");
  } catch (e) { die("Falha no teste reset_not_found: " + sanitize(e.message)); }

  // 7. Reset real do usuario sintetico.
  let p2;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reset-user-password", {
      user_id: createdData.user_id,
    });
    const data = expectSuccess(resp, ["user_id", "email", "tipo", "password", "senha_temporaria"], "reset_synthetic_user");
    p2 = data.password;
    if (!p2 || p2.length < 8) die("senha retornada pelo reset parece invalida.");
    if (data.senha_temporaria !== true) die("resposta do reset nao trouxe senha_temporaria=true.");
    summary.steps.reset_synthetic_user = "OK";
    log("[OK] reset_synthetic_user: user_id=" + createdData.user_id + " (senha nova recebida, não impressa)");
  } catch (e) { die("Falha ao resetar a senha do usuario sintetico: " + sanitize(e.message)); }

  // 8. Confirma flag+timestamp atualizados.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id,senha_temporaria,senha_gerada_em&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    const prof = rows && rows[0];
    if (!prof) die("Perfil do usuario sintetico nao encontrado apos reset.");
    if (prof.senha_temporaria !== true) die("senha_temporaria != true apos reset: " + sanitize(JSON.stringify(prof)));
    if (!prof.senha_gerada_em) die("senha_gerada_em nao preenchido apos reset.");
    if (prof.senha_gerada_em === senhaGeradaEmAntes) die("senha_gerada_em nao mudou apos o reset (deveria ser atualizado).");
    summary.steps.reset_flag_and_timestamp = "OK";
    log("[OK] reset_flag_and_timestamp: senha_temporaria=true, senha_gerada_em atualizado (" + senhaGeradaEmAntes + " -> " + prof.senha_gerada_em + ")");
  } catch (e) { die("Falha ao confirmar flag/timestamp pos-reset: " + sanitize(e.message)); }

  // 9. Senha ANTIGA (P1) nao funciona mais.
  try {
    await loginExpectFailure(cfg.supabaseUrl, cfg.anonKey, testEmail, p1, "old_password_login");
    summary.steps.old_password_rejected = "OK";
    log("[OK] old_password_rejected: senha antiga (P1) invalidada pelo reset");
  } catch (e) { die("Falha ao confirmar invalidação da senha antiga: " + sanitize(e.message)); }

  // 10. Login com a senha NOVA (P2).
  let synth;
  try {
    synth = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, p2, "synthetic_login_new_password");
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(synth.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== true) die("self_read_flag_true: perfil proprio nao mostra senha_temporaria=true apos reset.");
    summary.steps.synthetic_login_new_password = "OK";
    log("[OK] synthetic_login_new_password: login com P2 ok, senha_temporaria=true (a guarda A4.2 dispararia aqui)");
  } catch (e) { die("Falha no login com a senha nova (P2): " + sanitize(e.message)); }

  // 11. Self-service: troca de senha (mesmo caminho de A4.2) + zera flag.
  const p3 = generateSyntheticPassword();
  try {
    const respAuth = await authUpdateUserPassword(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, p3);
    if (!respAuth.ok) die("auth.updateUser (self-service) falhou: HTTP " + respAuth.status + " " + sanitize(JSON.stringify(respAuth.body)));
    const respFlag = await restPatch(cfg.supabaseUrl, cfg.anonKey, synth.accessToken, "usuarios",
      "id=eq." + encodeURIComponent(synth.userId), { senha_temporaria: false });
    if (!respFlag.ok) die("PATCH usuarios (self-service, zerar flag) falhou: HTTP " + respFlag.status + " " + sanitize(JSON.stringify(respFlag.body)));
    summary.steps.self_service_password_change = "OK";
    log("[OK] self_service_password_change: A4.2 self-service exercido com sucesso (senha P3 + flag zerada)");
  } catch (e) { die("Falha no self-service pós-reset (A4.2): " + sanitize(e.message)); }

  // 12. Confirma flag zerada (token admin).
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(synth.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== false) die("senha_temporaria != false apos self-service: " + sanitize(JSON.stringify(prof)));
    summary.steps.flag_cleared_confirmed = "OK";
    log("[OK] flag_cleared_confirmed: senha_temporaria=false");
  } catch (e) { die("Falha ao confirmar flag zerada: " + sanitize(e.message)); }

  // 13. Relogin com P3 - "proximo login entra direto".
  try {
    const relogin = await loginExpectSuccess(cfg.supabaseUrl, cfg.anonKey, testEmail, p3, "synthetic_relogin_p3");
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, relogin.accessToken, "usuarios",
      "select=id,senha_temporaria&limit=1&id=eq." + encodeURIComponent(relogin.userId));
    const prof = rows && rows[0];
    if (!prof || prof.senha_temporaria !== false) die("relogin: senha_temporaria deveria ser false.");
    summary.steps.relogin_no_gate = "OK";
    log("[OK] relogin_no_gate: login com P3 ok, senha_temporaria=false (proximo login entra direto, sem gate)");
  } catch (e) { die("Falha no relogin com P3: " + sanitize(e.message)); }

  // 14. Cleanup.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-delete-user", {
      user_id: createdData.user_id, confirm_email: testEmail,
    });
    const data = expectSuccess(resp, ["ok", "deleted", "user_id", "email"], "cleanup_delete");
    if (data.deleted !== true) die("cleanup_delete: deleted != true.");
    summary.steps.cleanup_delete = "OK";
    log("[OK] cleanup_delete: deleted=true");
  } catch (e) { die("Falha no cleanup via admin-delete-user: " + sanitize(e.message)); }

  // 15. Confirma cleanup zero.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    if (Array.isArray(rows) && rows.length > 0) die("cleanup_verify: perfil ainda existe apos delete.");
    summary.steps.cleanup_verify = "OK";
    log("[OK] cleanup_verify: perfil ausente (cleanup zero confirmado)");
  } catch (e) { die("Falha ao verificar cleanup: " + sanitize(e.message)); }

  summary.result = "PASS";
  log("");
  log("RAVATEX admin-reset-user-password (A5.1-A5.2) E2E staging");
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
  log("  node scripts/staging/admin-reset-password-e2e.mjs setup");
  log("  node scripts/staging/admin-reset-password-e2e.mjs run");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
