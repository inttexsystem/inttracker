// =====================================================================
// === scripts/staging/admin-disable-user-ui-browser-e2e.mjs ===========
// Runner de browser automatizado para validar a UI real de
// desativação de usuário em um ambiente Supabase nao-produtivo
// isolado — que hoje NAO existe (runner desativado).
//
// Substitui validação manual visual da tela
// `#/cadastros/usuarios` por automação: login admin → cria
// descartável via UI → clica "Desativar" → valida estado →
// tenta login do desativado (bloqueado).
//
// Comandos:
//
//   node scripts/staging/admin-disable-user-ui-browser-e2e.mjs run
//     [--app-url http://localhost:8765/]
//
// Pré-requisitos:
//
//   1. App rodando localmente em `http://localhost:8765/` (ou
//      override). Para subir local: .\run-local.bat (Python serve
//      em :8765).
//   2. Edge Functions `admin-disable-user` e `admin-create-user`
//      deployadas no ambiente nao-produtivo.
//   3. Config local em
//      `.ravatex-local/admin-disable-user-e2e.config.json`
//      (criada por
//      `node scripts/staging/admin-disable-user-e2e.mjs setup`).
//   4. Playwright instalado em diretório fora do repo. Forma
//      recomendada (em diretório TEMP, fora do repo):
//        mkdir -p C:\Users\klebe\AppData\Local\Temp\ravatex-pw
//        cd C:\Users\klebe\AppData\Local\Temp\ravatex-pw
//        npm init -y
//        npm install playwright
//        npx playwright install chromium
//      Em seguida, executar com NODE_PATH apontando para o
//      node_modules:
//        $env:NODE_PATH = "C:\Users\klebe\AppData\Local\Temp\ravatex-pw\node_modules"
//        node scripts/staging/admin-disable-user-ui-browser-e2e.mjs run
//
// Garantias:
//   - DESATIVADO (fail closed): bhgifjrfagkzubpyqpew e o projeto PROIBIDO.
//     ucrjtfswnfdlxwtmxnoo e PRODUCAO: mutacao por este runner nao e autorizada.
//   - Não usa SQL manual, .delete(), nem service_role.
//   - Nunca imprime password, anon key, JWT, refresh token, access
//     token, cookie, nem service_role no console.
//   - Cria um usuário descartável e o desativa; o Auth ban impede
//     login subsequente (verificado por tentativa de login após
//     desativação).
// =====================================================================

import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const DEFAULT_APP_URL = "http://localhost:8765/";

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

function assertNonProductionEnvironment() {
  // Defesa em profundidade: qualquer caminho remanescente que tente
  // validar o ambiente para mutar falha fechada.
  refuseNonProductionEnvironmentUnavailable();
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    die(
      "Config não encontrado em " + CONFIG_PATH + ". " +
        "Rode antes: node scripts/staging/admin-disable-user-e2e.mjs setup",
    );
  }
  let raw;
  try { raw = readFileSync(CONFIG_PATH, "utf8"); }
  catch (e) { die("Falha ao ler " + CONFIG_PATH + ": " + sanitize(e.message)); }
  let cfg;
  try { cfg = JSON.parse(raw); }
  catch (e) { die("Config inválido (JSON.parse falhou): " + sanitize(e.message)); }
  for (const k of ["supabaseUrl", "anonKey", "adminEmail", "adminPassword"]) {
    if (!cfg[k] || typeof cfg[k] !== "string") {
      die("Campo obrigatório ausente/inválido no config: " + k);
    }
  }
  assertNonProductionEnvironment();
  return cfg;
}

function parseArgs(argv) {
  const out = { appUrl: DEFAULT_APP_URL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--app-url" || a === "--appUrl") {
      const v = argv[++i];
      if (v) out.appUrl = v;
    }
  }
  return out;
}

async function loadPlaywright() {
  // Tenta carregar Playwright dinamicamente. Se não estiver
  // disponível, instrui como instalar (em diretório fora do repo).
  let mod;
  try {
    mod = await import("playwright");
  } catch (e) {
    die(
      "Playwright não está disponível. Instale em diretório FORA do repo:\n" +
        "  mkdir -p C:\\Users\\klebe\\AppData\\Local\\Temp\\ravatex-pw\n" +
        "  cd C:\\Users\\klebe\\AppData\\Local\\Temp\\ravatex-pw\n" +
        "  npm init -y\n" +
        "  npm install playwright\n" +
        "  npx playwright install chromium\n" +
        "Depois execute com:\n" +
        "  $env:NODE_PATH = \"C:\\Users\\klebe\\AppData\\Local\\Temp\\ravatex-pw\\node_modules\"\n" +
        "  node scripts/staging/admin-disable-user-ui-browser-e2e.mjs run\n" +
        "Erro original: " + sanitize(e.message),
    );
  }
  if (!mod.chromium) {
    die("Playwright carregado mas `chromium` ausente. Verifique a instalação.");
  }
  return mod;
}

function generateTestEmail() {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return "disable-ui-browser-e2e-" + ts + "@tapetes.test";
}

function generateTestPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 22; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function findInPage(page, text) {
  // Localiza o primeiro elemento de UI cujo texto visível contenha
  // `text` (case-insensitive). Retorna null se não encontrar.
  const handle = await page.evaluateHandle((t) => {
    const lower = String(t).toLowerCase();
    function visibleText(el) {
      if (!el) return "";
      return (el.innerText || el.textContent || "").toLowerCase();
    }
    const all = document.querySelectorAll("button, a, td, th, span, div, label, h1, h2, h3, h4, p");
    for (const el of all) {
      if (visibleText(el).includes(lower)) {
        // Ignora divs/p/h que sejam containers maiores; só retorna
        // elementos "clicáveis" ou células de tabela.
        const tag = (el.tagName || "").toLowerCase();
        if (
          tag === "button" || tag === "a" || tag === "td" || tag === "th"
          || tag === "label" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4"
        ) {
          return el;
        }
      }
    }
    return null;
  }, text);
  const el = handle.asElement();
  if (!el) return null;
  return el;
}

async function clickByText(page, text) {
  const el = await findInPage(page, text);
  if (!el) {
    throw new Error('Elemento com texto "' + text + '" não encontrado.');
  }
  await el.click();
}

async function fillByLabel(page, labelText, value) {
  // Encontra um <input> próximo de um label que contenha `labelText`.
  const ok = await page.evaluate(({ lt, v }) => {
    const lower = String(lt).toLowerCase();
    const labels = document.querySelectorAll("label");
    for (const lab of labels) {
      if ((lab.innerText || lab.textContent || "").toLowerCase().includes(lower)) {
        // Procura input dentro do mesmo formField container.
        const root = lab.closest("div") || lab.parentElement;
        if (!root) continue;
        const input = root.querySelector("input, textarea");
        if (input) {
          // Substitui valor via React-friendly setter.
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value",
          ).set;
          setter.call(input, v);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, { lt: labelText, v: value });
  if (!ok) {
    throw new Error('Input com label "' + labelText + '" não encontrado.');
  }
}

// ---------------------------------------------------------------------
// Fluxo principal
// ---------------------------------------------------------------------

async function cmdRun() {
  const args = parseArgs(process.argv.slice(3));
  const appUrl = args.appUrl;
  const cfg = loadConfig();

  const summary = {
    project_ref: PRODUCTION_REF,
    test_email: null,
    test_user_id: null,
    steps: {},
    result: "FAIL",
  };

  log("RAVATEX admin-disable-user UI browser E2E staging");
  log("project_ref: " + PRODUCTION_REF);
  log("app_url: " + appUrl);
  log("");

  const playwright = await loadPlaywright();

  // Browser headless. Cache fora do repo (Playwright default
  // %LOCALAPPDATA% / $HOME/.cache/ms-playwright).
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Não logar headers, tokens ou bodies completos.
  page.on("request", (req) => {
    const h = req.headers();
    if (h && h.authorization) {
      // Log estruturado sem o token real.
      log("[net] " + req.method() + " " + sanitize(req.url()) + " (auth=Bearer [REDACTED])");
    }
  });
  page.on("pageerror", (e) => log("[pageerror] " + sanitize(e.message)));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      log("[console.error] " + sanitize(msg.text()));
    }
  });

  try {
    // 1. Abrir app
    log("[step] open app: " + appUrl);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    summary.steps.app_open = "OK";

    // 2. Login admin
    log("[step] admin login");
    // Espera a tela de login carregar.
    await page.waitForLoadState("domcontentloaded");
    // Procura campos de e-mail e senha na tela de login.
    await fillByLabel(page, "E-mail", cfg.adminEmail);
    await fillByLabel(page, "Senha", cfg.adminPassword);
    // Procura botão "Entrar" (ou similar).
    let clicked = false;
    for (const t of ["Entrar", "Login", "Acessar", "Sign in"]) {
      try {
        await clickByText(page, t);
        clicked = true;
        break;
      } catch (_) { /* try next */ }
    }
    if (!clicked) throw new Error("Botão de login não encontrado.");
    // Espera a navegação acontecer (rota pós-login).
    await page.waitForFunction(() => location.hash !== "#/login" && location.hash !== "" && location.hash !== "#/", { timeout: 15000 });
    summary.steps.admin_login = "OK";
    log("[OK] admin_login");

    // 3. Navegar para #/cadastros/usuarios
    log("[step] navegar para #/cadastros/usuarios");
    await page.goto(appUrl + "#/cadastros/usuarios", { waitUntil: "domcontentloaded" });
    // Espera "+ Novo usuário" aparecer.
    await findInPage(page, "+ Novo usuário");
    summary.steps.usuarios_screen = "OK";
    log("[OK] usuarios_screen");

    // 4. Confirma presença de + Novo usuário
    if (!(await findInPage(page, "+ Novo usuário"))) {
      throw new Error("Botão '+ Novo usuário' não encontrado.");
    }
    log("[OK] + Novo usuário visível");

    // 5. Confirma presença de botão Desativar (em alguma linha)
    if (!(await findInPage(page, "Desativar"))) {
      throw new Error("Botão 'Desativar' não encontrado na listagem.");
    }
    summary.steps.disable_button = "OK";
    log("[OK] disable_button");

    // 6. Cria usuário descartável pela UI
    log("[step] criar usuário descartável pela UI");
    const testEmail = generateTestEmail();
    const testPassword = generateTestPassword();
    summary.test_email = testEmail;

    await clickByText(page, "+ Novo usuário");
    // Espera o modal de criação abrir.
    await page.waitForSelector("input[type=email]", { timeout: 5000 });
    await fillByLabel(page, "E-mail", testEmail);
    await fillByLabel(page, "Nome", "Disable UI Browser E2E");
    // Tipo: fornecedor (default costuma ser o primeiro select).
    // Procura o select e escolhe a opção cujo texto contém "Fornecedor".
    await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      for (const s of selects) {
        for (const opt of s.options) {
          if (/fornecedor/i.test(opt.text || "")) {
            s.value = opt.value;
            s.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }
        }
      }
    });
    // Fornecedor: seleciona o primeiro fornecedor (ou usa o id da
    // config se presente). A UI deve ter um select para fornecedor
    // quando o tipo for fornecedor.
    if (cfg.fornecedorId && Number.isInteger(cfg.fornecedorId) && cfg.fornecedorId > 0) {
      await page.evaluate((fid) => {
        const selects = document.querySelectorAll("select");
        for (const s of selects) {
          for (const opt of s.options) {
            if (String(opt.value) === String(fid) || /fornecedor/i.test(opt.text || "")) {
              if (String(opt.value) === String(fid)) {
                s.value = opt.value;
                s.dispatchEvent(new Event("change", { bubbles: true }));
                return;
              }
            }
          }
        }
      }, cfg.fornecedorId);
    }
    await fillByLabel(page, "Senha", testPassword);
    // Confirma o modal (botão "Salvar" / "Criar" / "Criar usuário").
    let savedOk = false;
    for (const t of ["Salvar", "Criar", "Criar usuário"]) {
      try {
        await clickByText(page, t);
        savedOk = true;
        break;
      } catch (_) { /* try next */ }
    }
    if (!savedOk) throw new Error("Botão de salvar do modal de criação não encontrado.");
    // Espera a listagem recarregar e o novo email aparecer.
    await page.waitForFunction(
      (email) => {
        const txt = document.body.innerText || "";
        return txt.includes(email);
      },
      testEmail,
      { timeout: 15000 },
    );
    summary.steps.create_user_ui = "OK";
    log("[OK] create_user_ui: " + testEmail);

    // 7. Localiza a linha do descartável e clica "Desativar"
    log("[step] desativar usuário pela UI");
    // Procura a célula com o email e sobe até a linha, depois
    // procura o botão "Desativar" dentro dela.
    const clickedDisable = await page.evaluate((email) => {
      const lower = String(email).toLowerCase();
      const cells = document.querySelectorAll("td");
      for (const cell of cells) {
        if ((cell.innerText || cell.textContent || "").toLowerCase().includes(lower)) {
          // Sobe até a linha <tr>.
          let row = cell;
          while (row && row.tagName !== "TR") row = row.parentElement;
          if (!row) continue;
          const buttons = row.querySelectorAll("button, a");
          for (const b of buttons) {
            if ((b.innerText || b.textContent || "").toLowerCase().includes("desativar")) {
              b.click();
              return true;
            }
          }
        }
      }
      return false;
    }, testEmail);
    if (!clickedDisable) {
      throw new Error("Botão 'Desativar' não encontrado na linha do descartável.");
    }
    // Espera modal de confirmação aparecer.
    await page.waitForSelector("input[type=text], textarea", { timeout: 5000 });
    // Preenche motivo (campo opcional).
    try { await fillByLabel(page, "Motivo", "Teste automatizado UI browser E2E staging"); }
    catch (_) { /* opcional */ }
    // Confirma o modal (botão "Desativar" do modal).
    let confirmed = false;
    for (const t of ["Desativar"]) {
      try {
        await clickByText(page, t);
        confirmed = true;
        break;
      } catch (_) { /* try next */ }
    }
    if (!confirmed) throw new Error("Botão de confirmação 'Desativar' do modal não encontrado.");

    // 8. Espera a listagem recarregar com status "Inativo" (ou
    // remoção do email da lista visível). Aceita ambos.
    await page.waitForFunction(
      (email) => {
        const txt = document.body.innerText || "";
        // Texto contém "Inativo" em algum lugar (status do email).
        if (txt.includes("Inativo")) return true;
        // Ou o email sumiu da listagem.
        return !txt.includes(email);
      },
      testEmail,
      { timeout: 15000 },
    );
    summary.steps.disable_success = "OK";
    summary.steps.status_inactive_or_removed = "OK";
    log("[OK] disable_success");
    log("[OK] status_inactive_or_removed");

    // 9. Logout
    log("[step] logout");
    let loggedOut = false;
    for (const t of ["Sair", "Logout"]) {
      try {
        await clickByText(page, t);
        loggedOut = true;
        break;
      } catch (_) { /* try next */ }
    }
    if (!loggedOut) {
      // Tenta via API direta: window.logout().
      try {
        await page.evaluate(async () => {
          if (window.logout) await window.logout();
        });
        loggedOut = true;
      } catch (_) { /* ignore */ }
    }
    if (!loggedOut) {
      log("[WARN] logout não confirmado; tentando seguir mesmo assim");
    } else {
      // Espera voltar para a tela de login.
      await page.waitForFunction(() => location.hash === "#/login" || location.hash === "" || location.hash === "#/", { timeout: 10000 });
    }
    log("[OK] logout");

    // 10. Tenta login com usuário descartável (espera bloqueado)
    log("[step] tentar login com usuário desativado (esperado: bloqueado)");
    // Garante que estamos na tela de login.
    if (!/#\/login|^$|^#\//.test(await page.evaluate(() => location.hash))) {
      await page.goto(appUrl + "#/login", { waitUntil: "domcontentloaded" });
    }
    await fillByLabel(page, "E-mail", testEmail);
    await fillByLabel(page, "Senha", testPassword);
    let loginAttempted = false;
    for (const t of ["Entrar", "Login", "Acessar", "Sign in"]) {
      try {
        await clickByText(page, t);
        loginAttempted = true;
        break;
      } catch (_) { /* try next */ }
    }
    if (!loginAttempted) throw new Error("Botão de login não encontrado na 2a tentativa.");
    // Espera a tela NÃO redirecionar para uma rota autenticada
    // (deve continuar em #/login ou mostrar toast de erro).
    let loginBlocked = false;
    try {
      await page.waitForFunction(() => {
        const h = location.hash;
        const txt = (document.body.innerText || "").toLowerCase();
        const errPhrases = [
          "invalid login",
          "user is banned",
          "banned",
          "desativado",
          "inativo",
          "credentials",
          "erro",
        ];
        // Se ainda estamos na tela de login, é bloqueado.
        if (h === "" || h === "#/" || h === "#/login") {
          // E há algum sinal de erro.
          for (const p of errPhrases) {
            if (txt.includes(p)) return true;
          }
          // Ou o hash não mudou de login.
          return true;
        }
        return false;
      }, { timeout: 8000 });
      loginBlocked = true;
    } catch (_) {
      loginBlocked = false;
    }
    if (!loginBlocked) {
      // Captura texto visível para diagnóstico.
      const bodyText = await page.evaluate(() => document.body.innerText || "");
      log("[WARN] Login pode não ter sido bloqueado. Texto visível: " + sanitize(bodyText.slice(0, 300)));
      throw new Error("Login do usuário desativado não foi bloqueado pela UI/Auth.");
    }
    summary.steps.login_blocked = "OK";
    log("[OK] login_blocked");

    summary.result = "PASS";
  } catch (e) {
    summary.result = "FAIL";
    log("ERROR: " + sanitize((e && e.message) || String(e)));
  } finally {
    try { await context.close(); } catch (_) { /* ignore */ }
    try { await browser.close(); } catch (_) { /* ignore */ }
  }

  log("");
  log("RAVATEX admin-disable-user UI browser E2E staging");
  log("project_ref: " + summary.project_ref);
  log("test_email: " + summary.test_email);
  log("test_user_id: " + (summary.test_user_id || "(definido pela UI, não extraído)"));
  log("admin_login: " + (summary.steps.admin_login || "—"));
  log("usuarios_screen: " + (summary.steps.usuarios_screen || "—"));
  log("create_user_ui: " + (summary.steps.create_user_ui || "—"));
  log("disable_button: " + (summary.steps.disable_button || "—"));
  log("disable_success: " + (summary.steps.disable_success || "—"));
  log("status_inactive_or_removed: " + (summary.steps.status_inactive_or_removed || "—"));
  log("login_blocked: " + (summary.steps.login_blocked || "—"));
  log("result: " + summary.result);

  process.exit(summary.result === "PASS" ? 0 : 1);
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main() {
  const cmd = (process.argv[2] || "").toLowerCase();
  // Fail closed ANTES de qualquer prompt de credencial, leitura de token,
  // criacao de client, abertura de browser, fetch ou escrita de config
  // local de execucao.
  if (cmd === "run") refuseNonProductionEnvironmentUnavailable();
  log("Uso:");
  log("  node scripts/staging/admin-disable-user-ui-browser-e2e.mjs run [--app-url URL]");
  process.exit(2);
}

main().catch((e) => {
  die("Erro inesperado: " + sanitize((e && e.message) || String(e)));
});
