// =====================================================================
// === scripts/staging/admin-disable-user-e2e.mjs ========================
// Runner local automatizado para E2E de `admin-disable-user` em um
// ambiente Supabase nao-produtivo isolado — que hoje NAO existe
// (runner desativado).
//
// Comandos:
//
//   node scripts/staging/admin-disable-user-e2e.mjs setup
//     Coleta admin_email, admin_password e (opcionalmente) fornecedor_id
//     uma única vez e salva em .ravatex-local/admin-disable-user-e2e.config.json
//     (gitignored). Também descobre automaticamente staging URL e
//     anon key do app via leitura de js/config.js (valores já
//     públicos). Bloqueia se detectar produção.
//
//   node scripts/staging/admin-disable-user-e2e.mjs run
//     Carrega o config e executa o E2E completo em staging:
//       1) login admin (loginExpectSuccess — fatal se falhar)
//       2) confirma admin ativo em public.usuarios
//       3) escolhe fornecedor_id (config ou autodetect)
//       4) cria fornecedor descartável via admin-create-user
//       5) tenta desativar admin (espera FORBIDDEN)
//       6) desativa o fornecedor descartável (espera sucesso)
//       7) tenta login do desativado
//          (loginExpectFailure — aceita HTTP 400 "User is banned"
//          como SUCESSO esperado do teste; falha inesperada aborta)
//       8) re-desativa (espera idempotente: already_disabled=true)
//       9) tenta self-disable (espera SELF_DISABLE_FORBIDDEN)
//      10) imprime resumo sanitizado
//
// Helpers de login separados:
//
//   loginExpectSuccess(url, key, email, pwd, label)
//     Login que DEVE dar certo. Falha é fatal com
//     "<label> failed: HTTP ...". Rótulos usados:
//     "admin_login", "test_user_login", "admin_relogin".
//
//   loginExpectFailure(url, key, email, pwd, expected[], label)
//     Login que DEVE falhar. Aceita HTTP 4xx/5xx cujo corpo
//     (error_description, msg, message, error) case-insensitive
//     contenha qualquer um dos `expected` (ex.: "User is banned",
//     "banned", "Banned user"). Retorna
//     { ok: true, status, detail } em falha esperada, ou
//     { ok: false, unexpected: true, status, detail } caso
//     contrário. NUNCA chama die()/process.exit — caller decide.
//
// Garantias:
//   - DESATIVADO (fail closed): bhgifjrfagkzubpyqpew e o projeto PROIBIDO.
//     ucrjtfswnfdlxwtmxnoo e PRODUCAO: mutacao por este runner nao e autorizada.
//   - Não usa SQL manual, .delete(), nem chama auth.admin.*.deleteUser.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role.
//   - Salva config em .ravatex-local/ (gitignored).
//
// Edge Function `admin-disable-user` deveria estar deployada no
// ambiente nao-produtivo antes do `run`. Sem esse ambiente, `run` nao
// executa.
// =====================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, readFileSync as _rfs } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..", "..");
const CONFIG_DIR = resolve(ROOT, ".ravatex-local");
const CONFIG_PATH = resolve(CONFIG_DIR, "admin-disable-user-e2e.config.json");
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
  // Remove tokens, JWTs, chaves e senhas de qualquer string vinda de
  // erros do Supabase. Mantém mensagens legíveis.
  if (typeof input !== "string") return input;
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/(password|service_role|anon[_-]?key|access[_-]?token|refresh[_-]?token)["'\s:=]+[^\s"',}]+/gi, "$1=[REDACTED]");
}

function detectStagingFromConfigJs() {
  // js/config.js expõe as configs de produção e staging. O staging é o
  // ambiente operacional deste runner. A leitura é apenas para extrair
  // URL e anon key públicas já versionadas.
  const configPath = resolve(ROOT, "js", "config.js");
  if (!existsSync(configPath)) return null;
  const src = readFileSync(configPath, "utf8");
  // Heurística: extrai o bloco `staging: { ... supabaseUrl: '...',
  // supabaseAnonKey: '...' ... }`.
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
  // Camada HTTP crua: NUNCA chama die()/process.exit. Retorna
  // { status, body } para que o caller (loginExpectSuccess ou
  // loginExpectFailure) decida se a resposta é esperada.
  // Esta separação é essencial: o passo `login_blocked` precisa
  // aceitar HTTP 400 com mensagem "User is banned" como SUCESSO
  // esperado do teste, sem encerrar o processo.
  const url = supabaseUrl.replace(/\/+$/, "") + "/auth/v1/token?grant_type=password";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

function extractLoginErrorText(body, fallback) {
  if (body && typeof body === "object") {
    return (
      body.error_description ||
      body.msg ||
      body.message ||
      body.error ||
      fallback ||
      ""
    );
  }
  return fallback || "";
}

async function loginExpectSuccess(supabaseUrl, anonKey, email, password, label) {
  // Login que DEVE dar certo. Falha é fatal com rótulo específico
  // (ex.: "admin_login failed", "test_user_login failed",
  // "admin_relogin failed"). Nunca imprime password, token, JWT.
  const labelStr = label || "login";
  const { status, body } = await postSupabaseLogin(supabaseUrl, anonKey, email, password);
  if (status < 200 || status >= 300) {
    die(
      labelStr + " failed: HTTP " + status + " " +
        sanitize(extractLoginErrorText(body, "(sem corpo)")),
    );
  }
  if (!body || !body.access_token || !body.user || !body.user.id) {
    die("Resposta de login inesperada (sem access_token/user.id) em " + labelStr + ".");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user.id,
    email: body.user.email,
  };
}

async function loginExpectFailure(supabaseUrl, anonKey, email, password, expectedSubstrings, label) {
  // Login que DEVE falhar. Aceita HTTP 4xx/5xx cujo corpo
  // (error_description, msg, message, error) contenha qualquer um
  // dos `expectedSubstrings` (case-insensitive). Retorna
  // { ok: true, status, detail } em caso de falha esperada.
  // Em caso de:
  //   - sucesso inesperado (HTTP 2xx), ou
  //   - erro com mensagem não-esperada,
  // retorna { ok: false, unexpected: true, status, detail, body }.
  // NUNCA chama die()/process.exit: o caller decide se a falha
  // inesperada do teste é fatal ou não.
  const labelStr = label || "login";
  const { status, body } = await postSupabaseLogin(supabaseUrl, anonKey, email, password);
  const raw = String(extractLoginErrorText(body, "") || "");
  const lower = raw.toLowerCase();
  if (status >= 200 && status < 300) {
    return {
      ok: false,
      unexpected: true,
      status,
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
    ok: false,
    unexpected: true,
    status,
    detail: labelStr + ": erro nao corresponde ao esperado. recebido=" + sanitize(raw),
    body,
  };
}

async function restSelect(supabaseUrl, anonKey, accessToken, table, query) {
  const url =
    supabaseUrl.replace(/\/+$/, "") +
    "/rest/v1/" + table + "?" + query;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": anonKey,
      "Authorization": "Bearer " + accessToken,
    },
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    die(
      "GET " + table + " falhou: HTTP " + res.status + " " +
        sanitize(JSON.stringify(body)),
    );
  }
  return body;
}

async function callEdgeFunction(supabaseUrl, anonKey, accessToken, name, payload) {
  const url =
    supabaseUrl.replace(/\/+$/, "") + "/functions/v1/" + name;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": "Bearer " + accessToken,
    },
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
  log("RAVATEX admin-disable-user E2E — setup");
  log("");

  const cfg = detectStagingFromConfigJs();
  let supabaseUrl;
  let anonKey;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    supabaseUrl = cfg.supabaseUrl;
    anonKey = cfg.supabaseAnonKey;
    log("Detectado staging do app (js/config.js): " + sanitize(supabaseUrl));
  } else {
    die(
      "Não foi possível detectar staging do app via js/config.js. " +
        "Verifique se o arquivo existe e está íntegro.",
    );
  }

  assertNonProductionEnvironment();

  const adminEmail = (await promptLine("Admin email (staging): ")).trim();
  if (!adminEmail) die("Admin email obrigatório.");
  const adminPassword = (await promptLine("Admin password (staging, será salvo local e gitignored): ")).trim();
  if (!adminPassword) die("Admin password obrigatório.");

  const autoForn = (await promptLine(
    "Auto-detectar primeiro fornecedor no run? (s/N): ",
  )).trim().toLowerCase();
  const autoDetect = autoForn === "s" || autoForn === "sim" || autoForn === "y" || autoForn === "yes";

  let fornecedorId = null;
  if (!autoDetect) {
    const raw = (await promptLine("fornecedor_id (número) ou vazio para autodetect no run: ")).trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        die("fornecedor_id inválido.");
      }
      fornecedorId = n;
    }
  }

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config = {
    supabaseUrl,
    anonKey,
    adminEmail,
    adminPassword,
    autoDetectFornecedor: autoDetect,
    fornecedorId,
    createdAt: new Date().toISOString(),
    note:
      "Arquivo local, gitignored (.ravatex-local/). " +
      "Não versionar. Não commitar.",
  };

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  log("");
  log("Configuração salva em: " + CONFIG_PATH);
  log("  project_ref:    " + PRODUCTION_REF);
  log("  supabaseUrl:    " + sanitize(supabaseUrl));
  log("  adminEmail:     " + adminEmail);
  log("  adminPassword:  " + maskSecret(adminPassword));
  log("  autoDetect:     " + String(autoDetect));
  log("  fornecedorId:   " + (fornecedorId === null ? "(autodetect no run)" : fornecedorId));
  log("");
  log("AVISO: este arquivo é LOCAL e GITIGNORED. Não commitar.");
  log("Para rodar o E2E: node scripts/staging/admin-disable-user-e2e.mjs run");
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die(
      "Config não encontrado em " + CONFIG_PATH + ". " +
        "Rode antes: node scripts/staging/admin-disable-user-e2e.mjs setup",
    );
  }
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, "utf8");
  } catch (e) {
    die("Falha ao ler " + CONFIG_PATH + ": " + sanitize(e.message));
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    die("Config inválido (JSON.parse falhou): " + sanitize(e.message));
  }
  for (const k of ["supabaseUrl", "anonKey", "adminEmail", "adminPassword"]) {
    if (!cfg[k] || typeof cfg[k] !== "string") {
      die("Campo obrigatório ausente/inválido no config: " + k);
    }
  }
  assertNonProductionEnvironment();
  return cfg;
}

function generateTestEmail() {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return "disable-edge-e2e-" + ts + "@tapetes.test";
}

function generateTestPassword() {
  // Senha descartável forte gerada em memória (não persistida).
  // ~22 chars alfanuméricos + símbolos básicos.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 22; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function resolveFornecedorId(cfg, adminAccess) {
  if (cfg.fornecedorId && Number.isInteger(cfg.fornecedorId) && cfg.fornecedorId > 0) {
    return cfg.fornecedorId;
  }
  if (cfg.autoDetectFornecedor === true) {
    const rows = await restSelect(
      cfg.supabaseUrl,
      cfg.anonKey,
      adminAccess.accessToken,
      "fornecedores",
      "select=id,nome&order=id&limit=1",
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      die("autoDetect habilitado mas nenhum fornecedor encontrado em public.fornecedores.");
    }
    return rows[0].id;
  }
  die(
    "fornecedor_id ausente no config e autoDetect=false. " +
      "Rode setup novamente e defina fornecedor_id ou habilite autodetect.",
  );
}

function expectErrorCode(resp, expectedCodes) {
  if (resp.status < 400) {
    die(
      "Esperava erro 4xx/5xx com code " +
        JSON.stringify(expectedCodes) +
        ", mas recebi HTTP " + resp.status + " body=" +
        sanitize(JSON.stringify(resp.body)),
    );
  }
  const code = resp.body && resp.body.error && resp.body.error.code;
  if (!expectedCodes.includes(code)) {
    die(
      "Esperava code " + JSON.stringify(expectedCodes) +
        ", mas recebi " + JSON.stringify(code) + " (HTTP " + resp.status + ") body=" +
        sanitize(JSON.stringify(resp.body)),
    );
  }
  return code;
}

function expectSuccess(resp, expectedFields) {
  if (resp.status < 200 || resp.status >= 300) {
    die(
      "Esperava sucesso 2xx, mas recebi HTTP " + resp.status + " body=" +
        sanitize(JSON.stringify(resp.body)),
    );
  }
  if (!resp.body || !resp.body.data) {
    die("Resposta de sucesso sem envelope { data: ... }: " + sanitize(JSON.stringify(resp.body)));
  }
  for (const f of expectedFields) {
    if (!(f in resp.body.data)) {
      die(
        "Campo obrigatório ausente em data: " + f +
          ". body=" + sanitize(JSON.stringify(resp.body)),
      );
    }
  }
  return resp.body.data;
}

async function cmdRun() {
  const cfg = loadConfig();
  const summary = {
    project_ref: PRODUCTION_REF,
    test_email: null,
    test_user_id: null,
    steps: {},
    result: "FAIL",
  };

  log("RAVATEX admin-disable-user E2E staging");
  log("project_ref: " + PRODUCTION_REF);
  log("");

  // 1. Login admin
  let admin;
  try {
    admin = await loginExpectSuccess(
      cfg.supabaseUrl, cfg.anonKey, cfg.adminEmail, cfg.adminPassword, "admin_login",
    );
    summary.steps.admin_login = "OK";
    log("[OK] admin_login: " + cfg.adminEmail);
  } catch (e) {
    die("Falha no login admin: " + sanitize(e.message));
  }

  // 2. Confirma admin ativo em public.usuarios
  let adminProfile;
  try {
    const rows = await restSelect(
      cfg.supabaseUrl,
      cfg.anonKey,
      admin.accessToken,
      "usuarios",
      "select=id,email,tipo,ativo&limit=1&id=eq." + encodeURIComponent(admin.userId),
    );
    adminProfile = rows && rows[0];
    if (!adminProfile) die("Perfil do admin não encontrado em public.usuarios.");
    if (adminProfile.tipo !== "admin") {
      die("Chamador não é admin em public.usuarios (tipo=" + adminProfile.tipo + ").");
    }
    if (adminProfile.ativo !== true) {
      die("Chamador não está ativo (ativo=" + adminProfile.ativo + ").");
    }
    summary.steps.admin_active = "OK";
    log("[OK] admin_active: tipo=admin, ativo=true");
  } catch (e) {
    die("Falha ao verificar admin ativo: " + sanitize(e.message));
  }

  // 3. Resolve fornecedor_id
  let fornecedorId;
  try {
    fornecedorId = await resolveFornecedorId(cfg, admin);
    summary.steps.fornecedor_resolved = "OK";
    log("[OK] fornecedor_resolved: id=" + fornecedorId);
  } catch (e) {
    die("Falha ao resolver fornecedor_id: " + sanitize(e.message));
  }

  // 4. Cria fornecedor descartável
  const testEmail = generateTestEmail();
  const testPassword = generateTestPassword();
  summary.test_email = testEmail;
  let createdData;
  try {
    const resp = await callEdgeFunction(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "admin-create-user",
      {
        email: testEmail,
        password: testPassword,
        nome: "E2E Disable Edge Runner",
        tipo: "fornecedor",
        fornecedor_id: fornecedorId,
      },
    );
    createdData = expectSuccess(resp, ["user_id", "email", "tipo", "fornecedor_id"]);
    summary.test_user_id = createdData.user_id;
    summary.steps.create_user = "OK";
    log("[OK] create_user: user_id=" + createdData.user_id);
  } catch (e) {
    die("Falha ao criar usuário de teste: " + sanitize(e.message));
  }

  // 5. Verifica perfil em public.usuarios
  try {
    const rows = await restSelect(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "usuarios",
      "select=id,email,tipo,ativo&limit=1&id=eq." + encodeURIComponent(createdData.user_id),
    );
    const prof = rows && rows[0];
    if (!prof) die("Perfil do usuário descartável não encontrado em public.usuarios.");
    if (prof.email !== testEmail) die("Email do perfil não confere.");
    if (prof.tipo !== "fornecedor") die("Tipo do perfil não é 'fornecedor'.");
    if (prof.ativo !== true) die("Perfil do descartável não está ativo.");
    summary.steps.profile_created = "OK";
    log("[OK] profile_created: ativo=true, tipo=fornecedor");
  } catch (e) {
    die("Falha ao verificar perfil criado: " + sanitize(e.message));
  }

  // 6. Login como fornecedor descartável
  let testUserAccess;
  try {
    testUserAccess = await loginExpectSuccess(
      cfg.supabaseUrl, cfg.anonKey, testEmail, testPassword, "test_user_login",
    );
    log("[OK] test_user_login: confirmado (será usado para tentar self-bloqueio)");
  } catch (e) {
    die("Falha no login do usuário de teste: " + sanitize(e.message));
  }

  // 7. Tenta desativar admin (como fornecedor) → espera FORBIDDEN
  try {
    const resp = await callEdgeFunction(
      cfg.supabaseUrl, cfg.anonKey, testUserAccess.accessToken,
      "admin-disable-user",
      { user_id: admin.userId, reason: "E2E runner: tentativa não-autorizada" },
    );
    const code = expectErrorCode(resp, ["FORBIDDEN"]);
    summary.steps.fornecedor_forbidden = "OK";
    log("[OK] fornecedor_forbidden: " + code);
  } catch (e) {
    die("Falha no teste de fornecedor bloqueado: " + sanitize(e.message));
  }

  // 8. Confirma admin continua ativo
  try {
    const rows = await restSelect(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "usuarios",
      "select=ativo&limit=1&id=eq." + encodeURIComponent(admin.userId),
    );
    if (!rows || !rows[0] || rows[0].ativo !== true) {
      die("Admin não está mais ativo após tentativa de fornecedor.");
    }
    summary.steps.admin_still_active = "OK";
    log("[OK] admin_still_active: ativo=true");
  } catch (e) {
    die("Falha ao revalidar admin: " + sanitize(e.message));
  }

  // 9. Re-login admin (segurança)
  try {
    admin = await loginExpectSuccess(
      cfg.supabaseUrl, cfg.anonKey, cfg.adminEmail, cfg.adminPassword, "admin_relogin",
    );
    log("[OK] admin_relogin");
  } catch (e) {
    die("Falha no re-login admin: " + sanitize(e.message));
  }

  // 10. Desativa o usuário descartável (espera sucesso)
  let disableData;
  try {
    const resp = await callEdgeFunction(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "admin-disable-user",
      { user_id: createdData.user_id, reason: "E2E runner: desativação válida" },
    );
    disableData = expectSuccess(resp, ["user_id", "email", "tipo", "ativo", "auth_banned"]);
    if (disableData.ativo !== false) {
      die("Resposta de sucesso mas ativo !== false: " + sanitize(JSON.stringify(disableData)));
    }
    if (disableData.auth_banned !== true) {
      die("Resposta de sucesso mas auth_banned !== true: " + sanitize(JSON.stringify(disableData)));
    }
    if (disableData.already_disabled === true) {
      die("Resposta inesperada: already_disabled=true em primeira chamada.");
    }
    summary.steps.admin_disable = "OK";
    log("[OK] admin_disable: ativo=false, auth_banned=true");
  } catch (e) {
    die("Falha na desativação admin: " + sanitize(e.message));
  }

  // 11. Verifica estado em public.usuarios
  try {
    const rows = await restSelect(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "usuarios",
      "select=ativo,desativado_em,desativado_por,motivo_desativacao&limit=1&id=eq." +
        encodeURIComponent(createdData.user_id),
    );
    const prof = rows && rows[0];
    if (!prof) die("Perfil do desativado não encontrado.");
    if (prof.ativo !== false) die("Perfil não está com ativo=false após desativação.");
    if (!prof.desativado_em) die("desativado_em não foi preenchido.");
    if (prof.desativado_por !== admin.userId) {
      die("desativado_por não confere com admin.userId.");
    }
    if (!prof.motivo_desativacao) die("motivo_desativacao não foi preenchido.");
    summary.steps.profile_inactive = "OK";
    log("[OK] profile_inactive: ativo=false, desativado_em=" + prof.desativado_em);
  } catch (e) {
    die("Falha ao validar perfil desativado: " + sanitize(e.message));
  }

  // 12. Tenta login como usuário desativado (espera FALHA).
  // Esta é a única parte do runner em que login falhar é o
  // resultado ESPERADO. Usamos loginExpectFailure para não chamar
  // die()/process.exit em uma falha esperada, e aceitamos HTTP 4xx
  // com mensagens equivalentes a "User is banned" (PT/EN, com
  // variações de casing). Se a Auth retornar 2xx (login passou)
  // ou erro com mensagem diferente das esperadas, isso é falha
  // inesperada do teste e abortamos o run.
  try {
    const failRes = await loginExpectFailure(
      cfg.supabaseUrl, cfg.anonKey, testEmail, testPassword,
      [
        "User is banned",
        "banned",
        "Banned",
        "Banned user",
        "User is already registered",
      ],
      "login_blocked",
    );
    if (failRes.unexpected) {
      die("login_blocked: " + failRes.detail);
    }
    summary.steps.login_blocked = "OK";
    log("[OK] login_blocked: HTTP " + failRes.status + " (falha esperada apos desativacao)");
  } catch (e) {
    die("Falha no teste de login bloqueado: " + sanitize(e.message));
  }

  // 13. Re-desativa o mesmo usuário (idempotência)
  try {
    const resp = await callEdgeFunction(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "admin-disable-user",
      { user_id: createdData.user_id, reason: "E2E runner: idempotência" },
    );
    const data = expectSuccess(resp, ["user_id", "ativo", "auth_banned"]);
    if (data.already_disabled !== true) {
      die("Idempotência ausente: already_disabled !== true. body=" + sanitize(JSON.stringify(data)));
    }
    summary.steps.idempotency = "OK";
    log("[OK] idempotency: already_disabled=true");
  } catch (e) {
    die("Falha no teste de idempotência: " + sanitize(e.message));
  }

  // 14. Self-disable (espera SELF_DISABLE_FORBIDDEN)
  try {
    const resp = await callEdgeFunction(
      cfg.supabaseUrl, cfg.anonKey, admin.accessToken,
      "admin-disable-user",
      { user_id: admin.userId, reason: "E2E runner: self-disable" },
    );
    const code = expectErrorCode(resp, ["SELF_DISABLE_FORBIDDEN"]);
    summary.steps.self_disable_blocked = "OK";
    log("[OK] self_disable_blocked: " + code);
  } catch (e) {
    die("Falha no teste de self-disable: " + sanitize(e.message));
  }

  summary.result = "PASS";
  log("");
  log("RAVATEX admin-disable-user E2E staging");
  log("project_ref: " + summary.project_ref);
  log("test_email: " + summary.test_email);
  log("test_user_id: " + summary.test_user_id);
  log("admin_login: " + summary.steps.admin_login);
  log("create_user: " + summary.steps.create_user);
  log("fornecedor_forbidden: " + summary.steps.fornecedor_forbidden);
  log("admin_disable: " + summary.steps.admin_disable);
  log("profile_inactive: " + summary.steps.profile_inactive);
  log("login_blocked: " + summary.steps.login_blocked);
  log("idempotency: " + summary.steps.idempotency);
  log("self_disable_blocked: " + summary.steps.self_disable_blocked);
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
  log("  node scripts/staging/admin-disable-user-e2e.mjs setup");
  log("  node scripts/staging/admin-disable-user-e2e.mjs run");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
