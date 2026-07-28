// =====================================================================
// === tests/admin-disable-user-ui-browser-e2e.smoke.js =================
// Smoke estático para o runner de browser
// `scripts/staging/admin-disable-user-ui-browser-e2e.mjs`.
//
// Fase: RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-BROWSER-E2E-A
// Escopo: valida o código do runner SEM executar browser nem
// Supabase real. Verifica:
//   - runner existe;
//   - tem comando `run`;
//   - reutiliza config do runner backend
//     (.ravatex-local/admin-disable-user-e2e.config.json);
//   - default app URL é http://localhost:8765/;
//   - tem guard de staging `ucrjtfswnfdlxwtmxnoo`;
//   - tem guard contra produção `bhgifjrfagkzubpyqpew`;
//   - navega para #/cadastros/usuarios;
//   - procura `+ Novo usuário` e `Desativar` por texto;
//   - gera email `disable-ui-browser-e2e-`;
//   - testa login bloqueado;
//   - tenta importar Playwright (sem instalar);
//   - não contém segredo real;
//   - não imprime senha/token/key;
//   - não usa SQL manual;
//   - não usa service_role;
//   - não usa auth.admin;
//   - não usa .delete().
//
// Pode ser executado com:
//   node --test tests/admin-disable-user-ui-browser-e2e.smoke.js
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
  "admin-disable-user-ui-browser-e2e.mjs",
);

function readOrFail(p) {
  assert.ok(fs.existsSync(p), "arquivo não encontrado: " + p);
  return fs.readFileSync(p, "utf8");
}

const src = readOrFail(SCRIPT_PATH);

// ---------------------------------------------------------------------
// 1. Existência e comando run
// ---------------------------------------------------------------------

test("runner: script existe", () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), "scripts/staging/admin-disable-user-ui-browser-e2e.mjs ausente");
});

test("runner: tem comando run", () => {
  assert.match(
    src,
    /(argv\[2\]|cmd)\s*===\s*['"]run['"]/i,
    "deve rotear para o comando run",
  );
  assert.match(
    src,
    /admin-disable-user-ui-browser-e2e\.mjs run/,
    "deve mostrar uso com 'run' no console",
  );
});

// ---------------------------------------------------------------------
// 2. Reuso de config do runner backend
// ---------------------------------------------------------------------

test("runner: reusa .ravatex-local/admin-disable-user-e2e.config.json", () => {
  assert.match(
    src,
    /CONFIG_PATH\s*=\s*resolve\(CONFIG_DIR,\s*['"]admin-disable-user-e2e\.config\.json['"]\)/,
    "CONFIG_PATH deve apontar para o mesmo arquivo do runner backend",
  );
  assert.match(
    src,
    /CONFIG_DIR\s*=\s*resolve\(ROOT,\s*['"]\.ravatex-local['"]\)/,
    "CONFIG_DIR deve apontar para .ravatex-local",
  );
});

test("runner: se config ausente, orienta rodar setup do runner backend", () => {
  assert.match(
    src,
    /admin-disable-user-e2e\.mjs setup/,
    "deve orientar o usuário a rodar o setup do runner backend",
  );
});

// ---------------------------------------------------------------------
// 3. Default app URL e override
// ---------------------------------------------------------------------

test("runner: default app URL é http://localhost:8765/", () => {
  assert.match(
    src,
    /DEFAULT_APP_URL\s*=\s*['"]http:\/\/localhost:8765\/['"]/,
    "DEFAULT_APP_URL deve ser http://localhost:8765/",
  );
});

test("runner: aceita --app-url para override", () => {
  assert.match(
    src,
    /--app-url/,
    "deve aceitar a flag --app-url",
  );
  assert.match(
    src,
    /parseArgs/,
    "deve ter função parseArgs",
  );
});

// ---------------------------------------------------------------------
// 4. Guards de staging e produção
// ---------------------------------------------------------------------

// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1: não existe banco
// não-produtivo. Este runner abre browser e muta Auth/Edge Function, então
// o caminho real de execução é desativado deterministicamente em vez de
// ser redirecionado para a produção.
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

test("runner: falha fechada antes de abrir browser ou emitir fetch", () => {
  assert.match(
    src,
    /INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE/,
    "deve usar a identidade estável de falha fechada",
  );
  assert.match(
    src,
    /if \(cmd === "run"\) refuseNonProductionEnvironmentUnavailable\(\);/,
    "run deve parar no dispatch, antes de prompt/browser/fetch",
  );
  assert.doesNotMatch(
    src,
    /process\.env\.[A-Z_]*(ALLOW|FORCE|OVERRIDE|CONFIRM)[A-Z_]*/,
    "nenhuma variável de ambiente pode liberar o runner",
  );
});

test("runner: não trata produção como destino operacional", () => {
  const idx = src.indexOf("ucrjtfswnfdlxwtmxnoo");
  assert.ok(idx > 0, "deve mencionar o ref de produção para bloqueio");
  const before = src.slice(Math.max(0, idx - 400), idx);
  const after = src.slice(idx, Math.min(src.length, idx + 400));
  assert.ok(
    /fail closed|PRODUCAO|nao-produtivo/i.test(before + after),
    "referência à produção deve estar em contexto de bloqueio",
  );
});

// ---------------------------------------------------------------------
// 5. Fluxo UI: navegação e elementos visíveis
// ---------------------------------------------------------------------

test("runner: navega para #/cadastros/usuarios", () => {
  assert.match(
    src,
    /#\/cadastros\/usuarios/,
    "deve navegar para a rota #/cadastros/usuarios",
  );
});

test("runner: procura '+ Novo usuário' na UI", () => {
  assert.match(
    src,
    /\+ Novo usu[áa]rio/,
    "deve procurar o botão '+ Novo usuário'",
  );
});

test("runner: procura 'Desativar' na UI", () => {
  // O texto "Desativar" deve aparecer tanto na listagem quanto no
  // modal de confirmação. O smoke apenas garante que o runner
  // referencia o rótulo.
  const matches = src.match(/Desativar/g) || [];
  assert.ok(
    matches.length >= 2,
    "deve referenciar 'Desativar' pelo menos 2x (botão de linha + confirmação do modal)",
  );
});

test("runner: gera email de teste com prefixo disable-ui-browser-e2e-", () => {
  assert.match(
    src,
    /disable-ui-browser-e2e-/,
    "deve gerar email com prefixo disable-ui-browser-e2e-",
  );
  assert.match(
    src,
    /@tapetes\.test/,
    "deve usar domínio @tapetes.test",
  );
});

test("runner: testa login bloqueado após desativação", () => {
  assert.match(
    src,
    /login_blocked/,
    "deve testar login bloqueado (resumo + lógica)",
  );
  // A função deve preencher o login com email/senha do descartável.
  const idx = src.indexOf("fillByLabel(page, \"E-mail\", testEmail)");
  assert.ok(
    idx > 0,
    "deve tentar login com testEmail após desativação",
  );
});

// ---------------------------------------------------------------------
// 6. Imports e toolchain
// ---------------------------------------------------------------------

test("runner: tenta importar playwright dinamicamente", () => {
  assert.match(
    src,
    /await\s+import\(\s*['"]playwright['"]\s*\)/,
    "deve usar dynamic import('playwright')",
  );
});

test("runner: instrui instalação de Playwright se não disponível", () => {
  assert.match(
    src,
    /npm install playwright/,
    "deve instruir instalação de playwright",
  );
  assert.match(
    src,
    /npx playwright install chromium/,
    "deve instruir download do browser chromium",
  );
});

test("runner: tem helper sanitize() para mascarar tokens/keys/passwords", () => {
  assert.match(src, /function\s+sanitize\(/, "deve ter função sanitize()");
  assert.match(src, /REDACTED_JWT|Bearer\s+\[REDACTED\]/);
});

// ---------------------------------------------------------------------
// 7. Não-regras (segurança)
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

test("runner: não usa SQL manual", () => {
  // SELECT SQL é tipicamente em uppercase, ou seguido de
  // asterisco/nome de coluna. Exclui o caso comum em PT "o select"
  // (lowercase, com espaço antes de palavra comum).
  assert.doesNotMatch(
    src,
    /\bSELECT\s+(\*|[A-Za-z_])/,
    "runner não deve usar SELECT SQL (asterisco ou nome de coluna)",
  );
  assert.doesNotMatch(
    src,
    /\bDELETE\s+FROM\b/i,
    "runner não deve usar DELETE FROM SQL",
  );
  assert.doesNotMatch(
    src,
    /\.from\(["']usuarios["']\)\s*\.\s*delete\s*\(/,
    "runner não deve usar .from('usuarios').delete()",
  );
});

test("runner: não chama auth.admin", () => {
  assert.doesNotMatch(
    src,
    /auth\s*\.\s*admin/,
    "runner não deve referenciar auth.admin",
  );
});

test("runner: não chama service_role", () => {
  // O runner pode MENCIONAR service_role em comentário/proibição,
  // mas não pode usá-lo como valor ou operação. A regex exige
  // atribuição ou chamada.
  assert.doesNotMatch(
    src,
    /service_role\s*\(/,
    "runner não deve chamar service_role()",
  );
});

test("runner: não cria .env", () => {
  assert.doesNotMatch(
    src,
    /\.env/,
    "runner não deve criar/ler .env",
  );
});

test("runner: não imprime password/token/key em cleartext", () => {
  // O source pode referenciar "password" e "token" no contexto de
  // helpers e labels. Mas qualquer log que mencione password/token
  // deve passar por sanitize() ou maskSecret().
  // Opcionalmente, presença de função de máscara indica cuidado.
  assert.match(src, /sanitize\(/);
  // Logs do runner devem usar a função log(). Procurar padrões
  // de log perigoso: log de cfg.adminPassword cru.
  const riskyLogs = src.match(/log\([^)]*adminPassword[^)]*\)/g) || [];
  for (const p of riskyLogs) {
    assert.match(
      p,
      /sanitize\(|maskSecret\(/,
      "qualquer log de adminPassword deve passar por sanitize()/maskSecret(): " + p,
    );
  }
});

// ---------------------------------------------------------------------
// 8. Seletores por texto
// ---------------------------------------------------------------------

test("runner: usa busca por texto para elementos da UI (seletores robustos)", () => {
  assert.match(
    src,
    /findInPage/,
    "deve ter helper findInPage() para busca por texto",
  );
  assert.match(
    src,
    /clickByText/,
    "deve ter helper clickByText()",
  );
  assert.match(
    src,
    /fillByLabel/,
    "deve ter helper fillByLabel()",
  );
});

test("runner: evita seletores frágeis baseados em classes CSS", () => {
  // Comentário: o runner não deve depender de data-testid específicos
  // (não há data-testid no UI). Apenas usa texto visível. Confirma
  // que o source menciona "texto" como estratégia.
  assert.match(
    src,
    /texto/i,
    "deve referenciar estratégia por texto visível",
  );
});

// ---------------------------------------------------------------------
// 9. Resumo e saída
// ---------------------------------------------------------------------

test("runner: imprime resumo sanitizado com campos esperados", () => {
  const expected = [
    "project_ref",
    "test_email",
    "admin_login",
    "usuarios_screen",
    "create_user_ui",
    "disable_button",
    "disable_success",
    "status_inactive_or_removed",
    "login_blocked",
    "result",
  ];
  for (const f of expected) {
    assert.match(src, new RegExp("summary\\.steps\\." + f + "|\\b" + f + "\\b"));
  }
});

test("runner: tem helper de exit code baseado em result", () => {
  // O runner deve sair com código 0 em PASS e !=0 em FAIL.
  assert.match(
    src,
    /process\.exit\(\s*summary\.result\s*===\s*['"]PASS['"]\s*\?\s*0\s*:\s*1/,
    "deve usar process.exit(0/1) baseado em result === 'PASS'",
  );
});
