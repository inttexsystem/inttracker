// =====================================================================
// === tests/admin-disable-user-e2e-runner.smoke.js =====================
// Smoke estático para o runner
// `scripts/staging/admin-disable-user-e2e.mjs`.
//
// Fase: RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A
// Escopo: valida o código do runner (e o .gitignore) sem executá-lo
// nem acessar Supabase real. Garante:
//   - script existe;
//   - tem comandos `setup` e `run`;
//   - cria/usa `.ravatex-local/admin-disable-user-e2e.config.json`;
//   - `.ravatex-local/` está no `.gitignore`;
//   - não contém segredo real hardcoded;
//   - não trata produção como destino operacional;
//   - contém guard contra `bhgifjrfagkzubpyqpew`;
//   - exige staging `ucrjtfswnfdlxwtmxnoo`;
//   - chama `admin-create-user` e `admin-disable-user`;
//   - testa fornecedor bloqueado, login bloqueado, idempotência,
//     self-disable;
//   - não usa SQL manual, .delete(), nem auth.admin.deleteUser;
//   - não cria `.env`;
//   - não imprime password/token/key.
//
// Pode ser executado com:
//   node --test tests/admin-disable-user-e2e-runner.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(
  ROOT,
  "scripts",
  "staging",
  "admin-disable-user-e2e.mjs",
);
const GITIGNORE_PATH = path.join(ROOT, ".gitignore");

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo não encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const src = readOrFail(SCRIPT_PATH);
const gitignore = readOrFail(GITIGNORE_PATH);

// ---------------------------------------------------------------------
// 1. Existência
// ---------------------------------------------------------------------

test("runner: script existe", () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), "scripts/staging/admin-disable-user-e2e.mjs ausente");
});

test("runner: arquivo .gitignore existe", () => {
  assert.ok(fs.existsSync(GITIGNORE_PATH), ".gitignore ausente");
});

// ---------------------------------------------------------------------
// 2. Comandos setup e run
// ---------------------------------------------------------------------

test("runner: tem comando setup", () => {
  assert.match(src, /cmdSetup\b/, "deve ter função cmdSetup");
  assert.match(
    src,
    /(argv\[2\]|cmd)\s*===\s*['"]setup['"]/i,
    "deve rotear setup via argv[2] ou variável cmd",
  );
  assert.match(
    src,
    /admin-disable-user-e2e\.mjs setup/,
    "deve mostrar uso com 'setup' no console",
  );
});

test("runner: tem comando run", () => {
  assert.match(src, /cmdRun\b/, "deve ter função cmdRun");
  assert.match(
    src,
    /(argv\[2\]|cmd)\s*===\s*['"]run['"]/i,
    "deve rotear run via argv[2] ou variável cmd",
  );
  assert.match(
    src,
    /admin-disable-user-e2e\.mjs run/,
    "deve mostrar uso com 'run' no console",
  );
});

// ---------------------------------------------------------------------
// 3. Arquivo local de config
// ---------------------------------------------------------------------

test("runner: cria/usa .ravatex-local/admin-disable-user-e2e.config.json", () => {
  assert.match(
    src,
    /CONFIG_DIR\s*=\s*resolve\(ROOT,\s*['"]\.ravatex-local['"]\)/,
    "CONFIG_DIR deve apontar para .ravatex-local",
  );
  assert.match(
    src,
    /CONFIG_PATH\s*=\s*resolve\(CONFIG_DIR,\s*['"]admin-disable-user-e2e\.config\.json['"]\)/,
    "CONFIG_PATH deve apontar para o arquivo de config",
  );
  assert.match(
    src,
    /mkdirSync\(CONFIG_DIR/,
    "deve criar o diretório .ravatex-local/ se não existir",
  );
  assert.match(
    src,
    /writeFileSync\(CONFIG_PATH/,
    "setup deve persistir via writeFileSync no CONFIG_PATH",
  );
  assert.match(
    src,
    /readFileSync\(CONFIG_PATH/,
    "run deve ler o config via readFileSync no CONFIG_PATH",
  );
});

test(".gitignore: ignora .ravatex-local/", () => {
  assert.match(
    gitignore,
    /(^|\n)\.ravatex-local\/?\s*(\n|$)/,
    ".ravatex-local/ deve estar no .gitignore",
  );
});

test("runner: emite aviso de que o arquivo é local e gitignored", () => {
  assert.match(
    src,
    /GITIGNORED/i,
    "deve mencionar GITIGNORED no console durante setup",
  );
});

// ---------------------------------------------------------------------
// 4. Ausência de segredo real
// ---------------------------------------------------------------------

test("runner: não contém JWT hardcoded", () => {
  assert.doesNotMatch(
    src,
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/,
    "JWT hardcoded detectado",
  );
});

test("runner: não contém service_role hardcoded", () => {
  assert.doesNotMatch(
    src,
    /service_role["']\s*[:=]\s*["'][A-Za-z0-9._-]+["']/i,
    "service_role hardcoded detectado",
  );
});

test("runner: não cria .env versionado", () => {
  assert.doesNotMatch(
    src,
    /writeFileSync\([^)]*\.env/,
    "runner não deve escrever .env",
  );
  // Cria diretório gitignored, não .env.
  assert.ok(
    /\.ravatex-local/.test(src),
    "runner deve usar diretório gitignored, não .env",
  );
});

test("runner: tem função de sanitização para mascarar tokens/JWTs/passwords", () => {
  assert.match(
    src,
    /function\s+sanitize\(/,
    "deve ter função sanitize()",
  );
  assert.match(src, /Bearer\s+\[REDACTED\]/);
  assert.match(src, /REDACTED_JWT/);
  assert.match(src, /REDACTED/);
});

// ---------------------------------------------------------------------
// 5. Guard contra produção
// ---------------------------------------------------------------------

// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1: não existe banco
// não-produtivo. Este runner muta Auth/Edge Function, então o caminho
// real de execução é desativado deterministicamente em vez de ser
// redirecionado para a produção.
test("runner: identidades de ambiente correntes, sem STAGING_REF", () => {
  assert.match(
    src,
    /PRODUCTION_REF\s*=\s*['"]ucrjtfswnfdlxwtmxnoo['"]/,
    "deve definir PRODUCTION_REF = ucrjtfswnfdlxwtmxnoo",
  );
  assert.match(
    src,
    /RETIRED_REF\s*=\s*['"]gqmpsxkxynrjvidfmojk['"]/,
    "deve definir RETIRED_REF = gqmpsxkxynrjvidfmojk",
  );
  assert.match(
    src,
    /FORBIDDEN_REF\s*=\s*['"]bhgifjrfagkzubpyqpew['"]/,
    "deve definir FORBIDDEN_REF = bhgifjrfagkzubpyqpew",
  );
  assert.doesNotMatch(src, /STAGING_REF/, "STAGING_REF não pode sobreviver");
  assert.doesNotMatch(src, /assertStagingUrl/, "assertStagingUrl não pode sobreviver");
});

test("runner: falha fechada antes de qualquer efeito externo", () => {
  assert.match(
    src,
    /INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE/,
    "deve usar a identidade estável de falha fechada",
  );
  assert.match(
    src,
    /if \(cmd === "setup" \|\| cmd === "run"\) refuseNonProductionEnvironmentUnavailable\(\);/,
    "setup e run devem parar no dispatch, antes de prompt/fetch/config",
  );
  // Nenhum override libera o caminho de mutação em produção.
  assert.doesNotMatch(
    src,
    /process\.env\.[A-Z_]*(ALLOW|FORCE|OVERRIDE|CONFIRM)[A-Z_]*/,
    "nenhuma variável de ambiente pode liberar o runner",
  );
});

test("runner: não usa produção como destino operacional", () => {
  // Não pode haver um caminho onde produção é tratada como destino
  // válido. A constante existe apenas para bloqueio.
  const idxProd = src.indexOf("bhgifjrfagkzubpyqpew");
  assert.ok(idxProd > 0, "deve mencionar o ref de produção para bloqueio");
  // O trecho deve estar dentro de uma condição de abort/error.
  const before = src.slice(Math.max(0, idxProd - 200), idxProd);
  const after = src.slice(idxProd, Math.min(src.length, idxProd + 200));
  const isBlock = /Abortando|ERROR|die\(|PRODUÇÃO/i.test(before + after);
  assert.ok(isBlock, "referência a produção deve estar em contexto de bloqueio");
});

// ---------------------------------------------------------------------
// 6. Operações cobertas
// ---------------------------------------------------------------------

test("runner: chama admin-create-user", () => {
  assert.match(
    src,
    /callEdgeFunction\([^)]*['"]admin-create-user['"]/,
    "deve chamar admin-create-user via callEdgeFunction",
  );
});

test("runner: chama admin-disable-user", () => {
  assert.match(
    src,
    /callEdgeFunction\([^)]*['"]admin-disable-user['"]/,
    "deve chamar admin-disable-user via callEdgeFunction",
  );
});

test("runner: testa fornecedor bloqueado (espera FORBIDDEN)", () => {
  const idx = src.indexOf("fornecedor_forbidden");
  assert.ok(idx > 0, "bloco fornecedor_forbidden deve existir");
  assert.match(
    src,
    /expectErrorCode\([^)]*FORBIDDEN/,
    "deve esperar erro FORBIDDEN quando fornecedor tenta",
  );
});

test("runner: testa login bloqueado após desativação (esperado)", () => {
  const idx = src.indexOf("login_blocked");
  assert.ok(idx > 0, "bloco login_blocked deve existir");
  // Helper loginExpectFailure deve existir e ser usado para o
  // passo de login do usuário desativado.
  assert.match(
    src,
    /function\s+loginExpectFailure\s*\(/,
    "deve existir helper loginExpectFailure para falha esperada",
  );
  // Aceita "User is banned" como sucesso esperado do teste.
  assert.match(
    src,
    /"User is banned"/,
    "deve aceitar literal \"User is banned\" como falha esperada",
  );
  // Aceita variações case-insensitive.
  assert.match(
    src,
    /"banned"/i,
    "deve aceitar substring \"banned\" (case-insensitive)",
  );
  // Helper loginExpectSuccess deve existir e ser usado para os
  // logins que DEVEM dar certo (admin, test user, re-login).
  assert.match(
    src,
    /function\s+loginExpectSuccess\s*\(/,
    "deve existir helper loginExpectSuccess para login que deve dar certo",
  );
  // Rótulo "login_blocked" deve aparecer.
  assert.match(
    src,
    /"login_blocked"/,
    "rótulo \"login_blocked\" deve aparecer como argumento de loginExpectFailure",
  );
  // summary.steps.login_blocked deve ser setado.
  assert.match(
    src,
    /summary\.steps\.login_blocked\s*=\s*"OK"/,
    "summary.steps.login_blocked deve receber \"OK\" em sucesso esperado",
  );
  // O log final deve exibir o rótulo login_blocked.
  assert.match(
    src,
    /log\(["']login_blocked:\s*["']/,
    "linha de log final deve incluir \"login_blocked:\"",
  );
  // Não pode mais usar a mensagem hardcoded "Login admin falhou" —
  // ela era incorreta quando o login sendo testado era do usuário
  // descartável desativado. Hoje o rótulo é parametrizado.
  assert.doesNotMatch(
    src,
    /Login admin falhou/,
    "mensagem hardcoded \"Login admin falhou\" foi removida (rótulo agora é parametrizado)",
  );
});

test("runner: testa idempotência (already_disabled=true)", () => {
  const idx = src.indexOf("idempotency");
  assert.ok(idx > 0, "bloco idempotency deve existir");
  assert.match(
    src,
    /already_disabled\s*!==\s*true/,
    "deve conferir already_disabled === true na re-desativação",
  );
});

test("runner: fluxo continua para idempotency e self_disable_blocked após login_blocked", () => {
  // Garante que o passo login_blocked NÃO chama die()/process.exit
  // prematuramente: o run deve alcançar idempotency e
  // self_disable_blocked.
  const idxLoginBlocked = src.indexOf("loginExpectFailure");
  const idxIdempotency = src.indexOf("idempotency");
  const idxSelfDisable = src.indexOf("self_disable_blocked");
  const idxResultPass = src.indexOf('result = "PASS"');
  assert.ok(idxLoginBlocked > 0, "loginExpectFailure deve ser chamado");
  assert.ok(idxIdempotency > 0, "bloco idempotency deve existir");
  assert.ok(idxSelfDisable > 0, "bloco self_disable_blocked deve existir");
  assert.ok(idxResultPass > 0, "result=PASS deve ser setado ao final");
  assert.ok(
    idxLoginBlocked < idxIdempotency,
    "loginExpectFailure deve vir antes de idempotency",
  );
  assert.ok(
    idxIdempotency < idxSelfDisable,
    "idempotency deve vir antes de self_disable_blocked",
  );
  assert.ok(
    idxSelfDisable < idxResultPass,
    "self_disable_blocked deve vir antes de result=PASS",
  );
});

test("runner: loginExpectSuccess é usado em admin_login, test_user_login, admin_relogin", () => {
  // O runner deve usar loginExpectSuccess (fatal em falha) em
  // todos os logins que DEVEM dar certo.
  const adminLogin = src.match(/loginExpectSuccess\([^)]*,\s*["']admin_login["']/);
  const testUserLogin = src.match(/loginExpectSuccess\([^)]*,\s*["']test_user_login["']/);
  const adminRelogin = src.match(/loginExpectSuccess\([^)]*,\s*["']admin_relogin["']/);
  assert.ok(adminLogin, "loginExpectSuccess deve ser usado com label admin_login");
  assert.ok(testUserLogin, "loginExpectSuccess deve ser usado com label test_user_login");
  assert.ok(adminRelogin, "loginExpectSuccess deve ser usado com label admin_relogin");
});

test("runner: loginExpectFailure aceita múltiplas variações de 'banned'", () => {
  // A lista de substrings esperadas deve incluir variações
  // case-insensitive que cobrem respostas comuns do Supabase
  // Auth para usuário banido.
  const m = src.match(/loginExpectFailure\([\s\S]*?login_blocked[\s\S]*?\)/);
  assert.ok(m, "bloco loginExpectFailure com label login_blocked deve existir");
  const block = m[0];
  assert.match(block, /User is banned/);
  assert.match(block, /banned/i);
});

test("runner: loginExpectFailure retorna controle ao caller (sem process.exit)", () => {
  // loginExpectFailure é declarado `async` e seu corpo termina
  // com `return { ... }` (não com `process.exit(...)` nem com
  // `die(` em chamada). Verificamos o padrão estrutural.
  const fnStart = src.indexOf("async function loginExpectFailure");
  assert.ok(fnStart > 0, "função loginExpectFailure deve existir");
  const nextFnIdx = src.indexOf("\nasync function restSelect", fnStart);
  assert.ok(nextFnIdx > 0, "próxima função top-level deve ser restSelect");
  const block = src.slice(fnStart, nextFnIdx);
  // Bloco deve terminar com `return { ... };` seguido de `}` da função.
  assert.match(
    block,
    /return\s*\{[\s\S]*?ok:\s*false,\s*unexpected:\s*true[\s\S]*?\}\s*;?\s*\n\s*\}/,
    "loginExpectFailure deve terminar com return { ok: false, unexpected: true, ... }",
  );
  // Não pode haver `process.exit(` no corpo (além de comentários).
  // Usa lookbehind para evitar match em comentários.
  assert.doesNotMatch(
    block.replace(/\/\/[^\n]*/g, ""),
    /\bprocess\.exit\s*\(/,
    "loginExpectFailure NÃO deve chamar process.exit — caller decide",
  );
});

test("runner: testa self-disable (espera SELF_DISABLE_FORBIDDEN)", () => {
  const idx = src.indexOf("self_disable_blocked");
  assert.ok(idx > 0, "bloco self_disable_blocked deve existir");
  assert.match(
    src,
    /expectErrorCode\([^)]*SELF_DISABLE_FORBIDDEN/,
    "deve esperar SELF_DISABLE_FORBIDDEN no self-disable",
  );
});

// ---------------------------------------------------------------------
// 7. Não-regras
// ---------------------------------------------------------------------

test("runner: não usa SQL manual", () => {
  assert.doesNotMatch(
    src,
    /\bfrom\s*\(\s*['"]usuarios['"]\s*\)\s*\.\s*select\s*\(/,
    "runner não deve montar SQL via .from('usuarios').select() inline",
  );
  // O runner usa HTTP via fetch; pode haver GET para /rest/v1 mas
  // não strings com 'SELECT' manuais.
  assert.doesNotMatch(
    src,
    /\bSELECT\s+/i,
    "runner não deve usar SELECT SQL manual",
  );
  assert.doesNotMatch(
    src,
    /\bDELETE\s+FROM\b/i,
    "runner não deve usar DELETE FROM SQL",
  );
});

test("runner: não chama .delete() em public.usuarios", () => {
  assert.doesNotMatch(
    src,
    /\.from\(["']usuarios["']\)\s*\.\s*delete\s*\(/,
    "runner não deve fazer .from('usuarios').delete()",
  );
});

test("runner: não chama auth.admin.deleteUser", () => {
  assert.doesNotMatch(
    src,
    /auth\s*\.\s*admin\s*\.\s*deleteUser/,
    "runner não deve chamar auth.admin.deleteUser",
  );
});

test("runner: não cria .env", () => {
  assert.doesNotMatch(
    src,
    /\.env/,
    "runner não deve criar/ler .env (deve usar .ravatex-local/)",
  );
});

test("runner: não imprime password/token/key em cleartext", () => {
  // As referências a 'password' no source devem estar apenas em
  // contexto de prompt ou de máscara.
  const passwordMatches = src.match(/password/gi) || [];
  assert.ok(
    passwordMatches.length > 0,
    "runner deve referenciar 'password' (input) — checagem apenas para validar comportamento",
  );
  // Deve haver helper de máscara ou sanitize.
  assert.match(src, /maskSecret|sanitize/);
  // Não deve haver log direto de password em cleartext: o console
  // printing deve usar sanitização ou máscara.
  const riskyPrints = src.match(/log\([^)]*adminPassword[^)]*\)/g) || [];
  for (const p of riskyPrints) {
    assert.match(
      p,
      /maskSecret\(/,
      "qualquer log de adminPassword deve passar por maskSecret(): " + p,
    );
  }
});

test("runner: helpers HTTP evitam logar Authorization, JWT ou cookies", () => {
  // callEdgeFunction não deve logar o header Authorization ou o body
  // cru. O source não deve conter `log(... Authorization ...)` com
  // header real.
  assert.doesNotMatch(
    src,
    /log\([^)]*Authorization[^)]*Bearer\s+[A-Za-z0-9]/,
    "runner não deve logar Authorization com Bearer real",
  );
  assert.doesNotMatch(
    src,
    /log\([^)]*access[_-]?token/,
    "runner não deve logar access_token em cleartext",
  );
  assert.doesNotMatch(
    src,
    /log\([^)]*refresh[_-]?token/,
    "runner não deve logar refresh_token em cleartext",
  );
});

// ---------------------------------------------------------------------
// 8. Detecção de staging via js/config.js
// ---------------------------------------------------------------------

test("runner: detecta staging via js/config.js", () => {
  assert.match(
    src,
    /detectStagingFromConfigJs/,
    "deve ter função detectStagingFromConfigJs()",
  );
  assert.match(
    src,
    /js['"]\s*,\s*['"]config\.js['"]/,
    "deve ler js/config.js",
  );
  assert.match(
    src,
    /staging\s*:\s*\{/,
    "deve fazer match do bloco staging em js/config.js",
  );
});

test("runner: setup aborta se não detectar staging em js/config.js", () => {
  assert.match(
    src,
    /N[ãa]o foi poss[íi]vel detectar staging/,
    "deve abortar com mensagem clara se staging não for detectado",
  );
});
