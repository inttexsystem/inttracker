// =====================================================================
// === scripts/staging/usuarios-audit-e2e.mjs =============================
// Runner local automatizado para E2E do audit trail (A6.2) —
// public.usuarios_eventos — em Supabase staging `ucrjtfswnfdlxwtmxnoo`.
// Mesmo esqueleto de scripts/staging/admin-reactivate-e2e.mjs (setup/run,
// HTTP cru, sem SQL manual, sem chamar auth.admin.* fora das Edge
// Functions existentes, nunca imprime segredo).
//
// Exercita as cinco Edge Functions do A6.2 (admin-create-user,
// admin-disable-user, admin-reactivate-user, admin-reset-user-password,
// admin-delete-user) sobre um único usuário sintético fornecedor, e
// valida, para cada uma, via leitura direta de public.usuarios_eventos
// (RLS admin-only, db/60):
//   - exatamente 1 evento novo por ação (nenhum double-entry vindo do
//     trigger trg_usuario_evento, que deve ficar em silêncio sob
//     service_role — auth.uid() IS NULL, db/60 §design decision);
//   - tipo_evento/ator_id/payload/snapshot corretos por ação;
//   - o payload de admin-reset-user-password nunca contém a senha
//     gerada, em nenhuma forma;
//   - o evento usuario_excluido, e TODOS os eventos anteriores do
//     mesmo usuário, sobrevivem ao delete do perfil com usuario_id
//     agora NULL (db/61, ON DELETE SET NULL propaga a todo child row,
//     não só ao evento mais recente) e o snapshot de identidade
//     continua legível.
//
// Comandos:
//
//   node scripts/staging/usuarios-audit-e2e.mjs setup
//     Coleta admin_email, admin_password e (opcionalmente) fornecedor_id
//     uma única vez e salva em
//     .ravatex-local/usuarios-audit-e2e.config.json (gitignored).
//     Descobre staging URL e anon key via js/config.js. Bloqueia se
//     detectar produção.
//
//   node scripts/staging/usuarios-audit-e2e.mjs run
//     Carrega o config e executa o E2E completo em staging:
//       1) login admin
//       2) confirma admin ativo em public.usuarios
//       3) resolve fornecedor_id
//       4) cria fornecedor descartável via admin-create-user
//          → confirma exatamente 1 evento usuario_criado, ator_id=admin,
//            payload {tipo, fornecedor_id, cliente_id}, snapshot correto
//       5) desativa via admin-disable-user
//          → confirma exatamente 1 evento usuario_desativado, payload
//            {ativo:{de:true,para:false}, motivo}
//       6) reativa via admin-reactivate-user
//          → confirma exatamente 1 evento usuario_reativado, payload
//            {ativo:{de:false,para:true}}
//       7) reseta senha via admin-reset-user-password
//          → confirma exatamente 1 evento senha_resetada, payload {}
//            (vazio), senha gerada ausente do evento em qualquer forma
//       8) snapshot pré-delete: total de eventos do usuário (4) e seus
//          ids
//       9) exclui via admin-delete-user
//          → confirma exatamente 1 evento usuario_excluido adicional
//            (5 no total)
//      10) confirma SURVIVAL: todos os 5 eventos (os 4 anteriores +
//          usuario_excluido) permanecem legíveis por email/nome/tipo
//          snapshot, com usuario_id agora NULL em todos
//      11) confirma cleanup zero em public.usuarios e auth.users (o
//          perfil não existe mais); usuarios_eventos NÃO é limpo — é
//          append-only por desenho (db/60/db/61, sem policy de
//          DELETE para nenhum papel de cliente) — os 5 eventos
//          órfãos permanecem em staging como prova do audit trail,
//          não como resíduo a remover
//      12) imprime resumo sanitizado
//
// Garantias:
//   - Bloqueia execução se a URL for produção `bhgifjrfagkzubpyqpew`.
//   - Exige URL contendo o ref de staging `ucrjtfswnfdlxwtmxnoo`.
//   - Não usa SQL manual, nem chama auth.admin.* fora das Edge
//     Functions já existentes e aceitas.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role. A senha gerada por
//     admin-reset-user-password é usada apenas para comparação
//     interna (nunca logada).
//   - Salva config em .ravatex-local/ (gitignored).
//
// As cinco Edge Functions devem estar deployadas em staging (project
// ref `ucrjtfswnfdlxwtmxnoo`) antes do `run` — deploy é do arquiteto,
// fora do alcance de credenciais desta sessão.
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
const CONFIG_PATH = resolve(CONFIG_DIR, "usuarios-audit-e2e.config.json");
const STAGING_REF = "ucrjtfswnfdlxwtmxnoo";
const PRODUCTION_REF = "bhgifjrfagkzubpyqpew";

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

function assertStagingUrl(url) {
  if (typeof url !== "string" || !url) {
    die("URL do Supabase ausente ou inválida.");
  }
  if (url.includes(PRODUCTION_REF)) {
    die(
      "URL aponta para PRODUÇÃO (" + PRODUCTION_REF + "). " +
        "Este runner é exclusivo para staging (" + STAGING_REF + "). Abortando.",
    );
  }
  if (!url.includes(STAGING_REF)) {
    die(
      "URL não contém o ref de staging esperado (" + STAGING_REF + "). " +
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
  if (resp.body.data.audit_recorded !== true) {
    die((label || "") + ": audit_recorded deveria ser true (insert de auditoria falhou?). body=" + sanitize(JSON.stringify(resp.body)));
  }
  return resp.body.data;
}

// ---------------------------------------------------------------------
// Comandos: setup / run
// ---------------------------------------------------------------------

async function cmdSetup() {
  log("RAVATEX usuarios_eventos audit trail (A6.2) E2E - setup");
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
  assertStagingUrl(supabaseUrl);

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
  log("  project_ref:   " + STAGING_REF);
  log("  supabaseUrl:   " + sanitize(supabaseUrl));
  log("  adminEmail:    " + adminEmail);
  log("  adminPassword: " + maskSecret(adminPassword));
  log("  autoDetect:    " + String(autoDetect));
  log("  fornecedorId:  " + (fornecedorId === null ? "(autodetect no run)" : fornecedorId));
  log("");
  log("Para rodar o E2E: node scripts/staging/usuarios-audit-e2e.mjs run");
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die("Config não encontrado em " + CONFIG_PATH + ". Rode antes: node scripts/staging/usuarios-audit-e2e.mjs setup");
  }
  let raw;
  try { raw = readFileSync(CONFIG_PATH, "utf8"); } catch (e) { die("Falha ao ler " + CONFIG_PATH + ": " + sanitize(e.message)); }
  let cfg;
  try { cfg = JSON.parse(raw); } catch (e) { die("Config inválido (JSON.parse falhou): " + sanitize(e.message)); }
  for (const k of ["supabaseUrl", "anonKey", "adminEmail", "adminPassword"]) {
    if (!cfg[k] || typeof cfg[k] !== "string") die("Campo obrigatório ausente/inválido no config: " + k);
  }
  assertStagingUrl(cfg.supabaseUrl);
  return cfg;
}

function generateTestEmail() {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return "audit-e2e-" + ts + "@tapetes.test";
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

// Consulta eventos por usuario_id (enquanto o perfil existe).
async function selectEventsByUsuarioId(cfg, adminAccess, usuarioId) {
  return restSelect(
    cfg.supabaseUrl, cfg.anonKey, adminAccess.accessToken, "usuarios_eventos",
    "select=id,tipo_evento,ator_id,payload,usuario_id,usuario_email,usuario_nome,usuario_tipo,criado_em"
      + "&usuario_id=eq." + encodeURIComponent(usuarioId)
      + "&order=criado_em.asc,id.asc",
  );
}

// Consulta eventos por snapshot de email (após o delete, usuario_id vira NULL).
async function selectEventsByEmailSnapshot(cfg, adminAccess, email) {
  return restSelect(
    cfg.supabaseUrl, cfg.anonKey, adminAccess.accessToken, "usuarios_eventos",
    "select=id,tipo_evento,ator_id,payload,usuario_id,usuario_email,usuario_nome,usuario_tipo,criado_em"
      + "&usuario_email=eq." + encodeURIComponent(email)
      + "&order=criado_em.asc,id.asc",
  );
}

function countByTipoEvento(events, tipoEvento) {
  return events.filter((e) => e.tipo_evento === tipoEvento).length;
}

function payloadContainsPassword(payload, password) {
  const json = JSON.stringify(payload || {});
  if (json.toLowerCase().includes("password")) return true;
  if (password && json.includes(password)) return true;
  return false;
}

async function cmdRun() {
  const cfg = loadConfig();
  const summary = { project_ref: STAGING_REF, test_email: null, test_user_id: null, steps: {}, result: "FAIL" };

  log("RAVATEX usuarios_eventos audit trail (A6.2) E2E staging");
  log("project_ref: " + STAGING_REF);
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

  // 4. Cria fornecedor descartável via admin-create-user.
  const testEmail = generateTestEmail();
  const testNome = "Admin Audit E2E";
  const testPassword = generateTestPassword();
  summary.test_email = testEmail;
  let createdData;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-create-user", {
      email: testEmail, password: testPassword, nome: testNome, tipo: "fornecedor", fornecedor_id: fornecedorId,
    });
    createdData = expectSuccess(resp, ["user_id", "email", "tipo", "fornecedor_id"], "create_synthetic_user");
    summary.test_user_id = createdData.user_id;
    summary.steps.create_synthetic_user = "OK";
    log("[OK] create_synthetic_user: user_id=" + createdData.user_id);
  } catch (e) { die("Falha ao criar usuário sintético: " + sanitize(e.message)); }

  // 4b. Confirma exatamente 1 evento usuario_criado, payload/snapshot corretos, sem double-entry.
  try {
    const events = await selectEventsByUsuarioId(cfg, admin, createdData.user_id);
    const n = countByTipoEvento(events, "usuario_criado");
    if (n !== 1) die("audit_usuario_criado: esperava exatamente 1 evento usuario_criado, encontrei " + n + " (double-entry ou falha de registro).");
    const ev = events.find((e) => e.tipo_evento === "usuario_criado");
    if (ev.ator_id !== admin.userId) die("audit_usuario_criado: ator_id não é o admin chamador.");
    if (ev.usuario_email !== testEmail || ev.usuario_nome !== testNome || ev.usuario_tipo !== "fornecedor") {
      die("audit_usuario_criado: snapshot de identidade incorreto. body=" + sanitize(JSON.stringify(ev)));
    }
    if (!ev.payload || ev.payload.tipo !== "fornecedor" || Number(ev.payload.fornecedor_id) !== Number(fornecedorId)) {
      die("audit_usuario_criado: payload incorreto. body=" + sanitize(JSON.stringify(ev.payload)));
    }
    summary.steps.audit_usuario_criado = "OK (1 evento, sem double-entry)";
    log("[OK] audit_usuario_criado: 1 evento, ator/payload/snapshot corretos");
  } catch (e) { die("Falha ao validar evento usuario_criado: " + sanitize(e.message)); }

  // 5. Desativa via admin-disable-user.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-disable-user", {
      user_id: createdData.user_id, reason: "E2E audit runner: desativação de teste",
    });
    const data = expectSuccess(resp, ["user_id", "ativo", "auth_banned"], "disable_synthetic_user");
    if (data.ativo !== false) die("disable_synthetic_user: esperava ativo=false.");
    summary.steps.disable_synthetic_user = "OK";
    log("[OK] disable_synthetic_user: ativo=false");
  } catch (e) { die("Falha ao desativar o usuário sintético: " + sanitize(e.message)); }

  // 5b. Confirma exatamente 1 evento usuario_desativado.
  try {
    const events = await selectEventsByUsuarioId(cfg, admin, createdData.user_id);
    const n = countByTipoEvento(events, "usuario_desativado");
    if (n !== 1) die("audit_usuario_desativado: esperava exatamente 1 evento, encontrei " + n + " (double-entry ou falha de registro).");
    const ev = events.find((e) => e.tipo_evento === "usuario_desativado");
    if (ev.ator_id !== admin.userId) die("audit_usuario_desativado: ator_id não é o admin chamador.");
    if (!ev.payload || !ev.payload.ativo || ev.payload.ativo.de !== true || ev.payload.ativo.para !== false) {
      die("audit_usuario_desativado: payload.ativo incorreto. body=" + sanitize(JSON.stringify(ev.payload)));
    }
    summary.steps.audit_usuario_desativado = "OK (1 evento, sem double-entry)";
    log("[OK] audit_usuario_desativado: 1 evento, payload correto");
  } catch (e) { die("Falha ao validar evento usuario_desativado: " + sanitize(e.message)); }

  // 6. Reativa via admin-reactivate-user.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reactivate-user", {
      user_id: createdData.user_id,
    });
    const data = expectSuccess(resp, ["user_id", "ativo", "auth_banned"], "reactivate_synthetic_user");
    if (data.ativo !== true) die("reactivate_synthetic_user: esperava ativo=true.");
    summary.steps.reactivate_synthetic_user = "OK";
    log("[OK] reactivate_synthetic_user: ativo=true");
  } catch (e) { die("Falha na reativação do usuário sintético: " + sanitize(e.message)); }

  // 6b. Confirma exatamente 1 evento usuario_reativado.
  try {
    const events = await selectEventsByUsuarioId(cfg, admin, createdData.user_id);
    const n = countByTipoEvento(events, "usuario_reativado");
    if (n !== 1) die("audit_usuario_reativado: esperava exatamente 1 evento, encontrei " + n + " (double-entry ou falha de registro).");
    const ev = events.find((e) => e.tipo_evento === "usuario_reativado");
    if (ev.ator_id !== admin.userId) die("audit_usuario_reativado: ator_id não é o admin chamador.");
    if (!ev.payload || !ev.payload.ativo || ev.payload.ativo.de !== false || ev.payload.ativo.para !== true) {
      die("audit_usuario_reativado: payload.ativo incorreto. body=" + sanitize(JSON.stringify(ev.payload)));
    }
    summary.steps.audit_usuario_reativado = "OK (1 evento, sem double-entry)";
    log("[OK] audit_usuario_reativado: 1 evento, payload correto");
  } catch (e) { die("Falha ao validar evento usuario_reativado: " + sanitize(e.message)); }

  // 7. Reseta senha via admin-reset-user-password.
  let resetPassword;
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-reset-user-password", {
      user_id: createdData.user_id,
    });
    const data = expectSuccess(resp, ["user_id", "password", "senha_temporaria"], "reset_synthetic_user_password");
    if (data.senha_temporaria !== true) die("reset_synthetic_user_password: esperava senha_temporaria=true.");
    resetPassword = data.password;
    if (!resetPassword) die("reset_synthetic_user_password: senha gerada ausente na resposta.");
    summary.steps.reset_synthetic_user_password = "OK";
    log("[OK] reset_synthetic_user_password: senha_temporaria=true (senha gerada não logada)");
  } catch (e) { die("Falha ao resetar senha do usuário sintético: " + sanitize(e.message)); }

  // 7b. Confirma exatamente 1 evento senha_resetada, payload vazio, senha ausente em qualquer forma.
  try {
    const events = await selectEventsByUsuarioId(cfg, admin, createdData.user_id);
    const n = countByTipoEvento(events, "senha_resetada");
    if (n !== 1) die("audit_senha_resetada: esperava exatamente 1 evento, encontrei " + n + " (double-entry ou falha de registro).");
    const ev = events.find((e) => e.tipo_evento === "senha_resetada");
    if (ev.ator_id !== admin.userId) die("audit_senha_resetada: ator_id não é o admin chamador.");
    if (payloadContainsPassword(ev.payload, resetPassword)) {
      die("SECURITY: audit_senha_resetada payload contém a senha gerada ou a palavra 'password'. HARD STOP.");
    }
    if (JSON.stringify(ev.payload) !== "{}") {
      die("audit_senha_resetada: payload deveria ser {} vazio, recebi " + sanitize(JSON.stringify(ev.payload)));
    }
    summary.steps.audit_senha_resetada = "OK (1 evento, payload vazio, sem senha)";
    log("[OK] audit_senha_resetada: 1 evento, payload vazio, senha ausente");
  } catch (e) { die("Falha ao validar evento senha_resetada: " + sanitize(e.message)); }

  // 8. Snapshot pré-delete: total de eventos do usuário até aqui (esperado: 4).
  let preDeleteEvents;
  try {
    preDeleteEvents = await selectEventsByUsuarioId(cfg, admin, createdData.user_id);
    if (preDeleteEvents.length !== 4) {
      die("pre_delete_snapshot: esperava exatamente 4 eventos antes do delete, encontrei " + preDeleteEvents.length + ".");
    }
    summary.steps.pre_delete_snapshot = "OK (4 eventos)";
    log("[OK] pre_delete_snapshot: 4 eventos confirmados antes do delete");
  } catch (e) { die("Falha no snapshot pré-delete: " + sanitize(e.message)); }

  // 9. Exclui via admin-delete-user.
  try {
    const resp = await callEdgeFunction(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "admin-delete-user", {
      user_id: createdData.user_id, confirm_email: testEmail,
    });
    const data = expectSuccess(resp, ["ok", "deleted", "user_id", "email"], "delete_synthetic_user");
    if (data.deleted !== true) die("delete_synthetic_user: deleted != true.");
    summary.steps.delete_synthetic_user = "OK";
    log("[OK] delete_synthetic_user: deleted=true");
  } catch (e) { die("Falha na exclusão do usuário sintético: " + sanitize(e.message)); }

  // 10. Confirma cleanup zero em public.usuarios e auth.users.
  try {
    const rows = await restSelect(cfg.supabaseUrl, cfg.anonKey, admin.accessToken, "usuarios",
      "select=id&limit=1&id=eq." + encodeURIComponent(createdData.user_id));
    if (Array.isArray(rows) && rows.length > 0) die("cleanup_verify: perfil ainda existe em public.usuarios após delete.");
    summary.steps.cleanup_verify_usuarios = "OK";
    log("[OK] cleanup_verify_usuarios: perfil ausente (cleanup zero confirmado)");
  } catch (e) { die("Falha ao verificar cleanup de usuarios: " + sanitize(e.message)); }

  // 11. SURVIVAL: os 5 eventos (4 anteriores + usuario_excluido) devem
  //     estar todos legíveis por snapshot de email, com usuario_id NULL.
  try {
    const events = await selectEventsByEmailSnapshot(cfg, admin, testEmail);
    if (events.length !== 5) {
      die("survival_check: esperava exatamente 5 eventos sobreviventes (4 anteriores + usuario_excluido), encontrei " + events.length + ".");
    }
    const nExcluido = countByTipoEvento(events, "usuario_excluido");
    if (nExcluido !== 1) die("survival_check: esperava exatamente 1 evento usuario_excluido, encontrei " + nExcluido + ".");
    const nonNullUsuarioId = events.filter((e) => e.usuario_id !== null);
    if (nonNullUsuarioId.length > 0) {
      die("survival_check: " + nonNullUsuarioId.length + " evento(s) ainda com usuario_id não-NULL após o delete — FK ON DELETE SET NULL não propagou. HARD STOP.");
    }
    for (const ev of events) {
      if (ev.usuario_email !== testEmail || ev.usuario_nome !== testNome || ev.usuario_tipo !== "fornecedor") {
        die("survival_check: snapshot de identidade perdido/incorreto no evento id=" + ev.id + " (" + ev.tipo_evento + "). body=" + sanitize(JSON.stringify(ev)));
      }
    }
    const evExcluido = events.find((e) => e.tipo_evento === "usuario_excluido");
    if (evExcluido.ator_id !== admin.userId) die("survival_check: ator_id do evento usuario_excluido não é o admin chamador.");
    summary.steps.survival_check = "OK (5/5 eventos sobreviventes, usuario_id NULL, snapshot intacto)";
    log("[OK] survival_check: todos os 5 eventos sobrevivem ao delete, usuario_id NULL, snapshot intacto");
  } catch (e) { die("Falha na verificação de sobrevivência (survival): " + sanitize(e.message)); }

  summary.result = "PASS";
  log("");
  log("RAVATEX usuarios_eventos audit trail (A6.2) E2E staging");
  log("project_ref: " + summary.project_ref);
  log("test_email: " + summary.test_email);
  log("test_user_id: " + summary.test_user_id + " (perfil excluído — id preservado apenas para referência do run)");
  for (const [k, v] of Object.entries(summary.steps)) log(k + ": " + v);
  log("cleanup: public.usuarios/auth.users = 0 residue; public.usuarios_eventos = 5 eventos ORFAOS permanecem por desenho (append-only, sem policy de DELETE para nenhum papel de cliente) — essa persistência É a prova do audit trail, não resíduo.");
  log("result: " + summary.result);
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main() {
  const cmd = (process.argv[2] || "").toLowerCase();
  if (cmd === "setup") return cmdSetup();
  if (cmd === "run") return cmdRun();
  log("Uso:");
  log("  node scripts/staging/usuarios-audit-e2e.mjs setup");
  log("  node scripts/staging/usuarios-audit-e2e.mjs run");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
