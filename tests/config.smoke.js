// Smoke test do módulo js/config.js (CONFIG-MODULE-A).
//
// Garante que a extração do bloco CONFIG do script inline de index.html
// para js/config.js preservou o comportamento exato:
//
//   1. arquivo existe e é script clássico (não ES module);
//   2. index.html carrega js/config.js antes do script inline;
//   3. script inline NÃO contém mais as definições de
//      APP_ENVIRONMENTS, detectAppEnvironment, APP_ENV, APP_CONFIG,
//      SUPABASE_URL, SUPABASE_ANON_KEY;
//   4. detectAppEnvironment retorna 'production' apenas para os domínios
//      de produção Vercel exatos (inttracker-jade.vercel.app,
//      inttracker-git-dev-inttex.vercel.app);
//   5. detectAppEnvironment retorna 'restricted' para qualquer outro host
//      (localhost, 127.0.0.1, previews *.vercel.app, example.com, vazio);
//   6. o ref canônico de produção aparece no módulo, e o projeto
//      retirado (gqmpsxkxynrjvidfmojk) NÃO aparece em lugar nenhum;
//   6b. só `production` tem writesEnabled === true; `restricted` aponta
//      para o MESMO banco porém sem permissão de escrita;
//   7. service_role e password literal NÃO aparecem em lugar nenhum;
//   8. em runtime simulado, js/config.js cria window.RAVATEX_CONFIG
//      e também expõe os globais legados para o script inline.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const http   = require('node:http');

const ROOT  = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const CFG   = path.join(ROOT, 'js', 'config.js');

// INTTRACKER-PRODUCTION-CUTOVER-R1: ucrjtfswnfdlxwtmxnoo é o ÚNICO
// projeto Supabase com papel de runtime. gqmpsxkxynrjvidfmojk foi
// retirado de toda a configuração ativa e é verificado por ausência.
const PROD_REF     = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF  = 'gqmpsxkxynrjvidfmojk';

const cfgSrc     = fs.readFileSync(CFG, 'utf8');
const indexSrc   = fs.readFileSync(INDEX, 'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

// TEST-DOUBLE-STALE-ASSERTION-CLEANUP (Lot L2, 2026-07-17): index.html is now
// fully modularized — there is no content-bearing inline <script> left (the
// config block moved to js/config.js) and every script loads with a ?v=
// cache-buster (§12). These helpers reflect that post-modularization structure;
// the previous inline-extraction helpers threw `nenhum <script> inline
// encontrado` and the script-tag regexes did not tolerate ?v=.

// Content-bearing inline <script> bodies. Empty after full modularization.
function inlineContent(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let out = '';
  while ((m = re.exec(html)) !== null) out += m[1];
  return out;
}

// <script src="js/config.js"> tags (tolerating the ?v= cache-buster).
function configScriptTags(html) {
  const re = /<script\s+src="js\/config\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const tags = [];
  let m;
  while ((m = re.exec(html)) !== null) tags.push({ index: m.index, text: m[0] });
  return tags;
}

// Index of the app entrypoint script (js/boot.js) — the module that replaced
// the old inline main script as the last-loaded, dependency-consuming script.
function entrypointIdx(html) {
  return html.indexOf('js/boot.js');
}

// Remove todos os comentários `// ...` e `/* ... */` de um trecho de JS
// para que matches por palavras-chave não caiam dentro de comentário.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

// -----------------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------------

test('js/config.js existe e é script clássico (sem type=module)', () => {
  assert.ok(fs.existsSync(CFG), 'js/config.js não existe');
  // O arquivo não pode usar 'export' (que indicaria ES module via Babel/etc)
  // nem conter diretiva <script type=module> dentro do JS.
  assert.equal(/^\s*export\s+/m.test(cfgSrc), false,
    'js/config.js parece usar export — deve ser script clássico');
});

test('js/config.js tem sintaxe JS válida (node -c)', () => {
  // node -c verifica parse sem executar.
  // (Não usamos vm aqui para não depender de APIs do browser como window.)
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${CFG}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/config.js EXATAMENTE UMA VEZ no <head>', () => {
  const tags = configScriptTags(indexSrc);
  assert.equal(tags.length, 1,
    `esperado 1 <script src="js/config.js">, encontrado ${tags.length}`);
});

test('index.html: <script src="js/config.js"> vem ANTES do entrypoint js/boot.js', () => {
  const tags = configScriptTags(indexSrc);
  assert.equal(tags.length, 1);
  const cfgIdx = tags[0].index;
  const bootIdx = entrypointIdx(indexSrc);
  assert.ok(cfgIdx > 0, 'tag de config não encontrada');
  assert.ok(bootIdx > 0, 'entrypoint js/boot.js não encontrado');
  assert.ok(cfgIdx < bootIdx,
    `js/config.js (idx ${cfgIdx}) deve vir antes do entrypoint boot.js (idx ${bootIdx})`);
});

test('index.html: ordem dos <script> preserva dependências (calculo → ui → badges → config)', () => {
  const calculoIdx = indexSrc.indexOf('js/calculo-op.js');
  const uiIdx      = indexSrc.indexOf('js/ui.js');
  const badgesIdx  = indexSrc.indexOf('js/badges.js');
  const cfgIdx     = indexSrc.indexOf('js/config.js');
  assert.ok(calculoIdx > 0 && uiIdx > 0 && badgesIdx > 0 && cfgIdx > 0,
    'uma das tags de script não foi encontrada');
  assert.ok(calculoIdx < uiIdx,  'calculo-op deve vir antes de ui');
  assert.ok(uiIdx      < badgesIdx, 'ui deve vir antes de badges');
  assert.ok(badgesIdx  < cfgIdx,    'badges deve vir antes de config');
});

// Post-modularization invariant (replaces the seven per-symbol "inline NÃO
// contém X" tests, which asserted against an inline <script> that no longer
// exists): the config block was fully extracted, so there is no content-bearing
// inline script, and the definitions now live in js/config.js.
test('index.html NÃO tem mais <script> inline com conteúdo (config foi extraída)', () => {
  assert.equal(inlineContent(indexSrc).trim(), '',
    'index.html ainda tem um <script> inline com conteúdo — a extração de config não está completa');
});

test('as definições de config vivem em js/config.js (extraídas do inline)', () => {
  const noComments = stripComments(cfgSrc);
  assert.match(noComments, /\bconst\s+APP_ENVIRONMENTS\s*=/, 'APP_ENVIRONMENTS deve viver em js/config.js');
  assert.match(noComments, /\bfunction\s+detectAppEnvironment\s*\(/, 'detectAppEnvironment deve viver em js/config.js');
  assert.match(noComments, /\bconst\s+APP_ENV\s*=/, 'APP_ENV deve viver em js/config.js');
  assert.match(noComments, /\bconst\s+APP_CONFIG\s*=/, 'APP_CONFIG deve viver em js/config.js');
  assert.match(noComments, /\bconst\s+SUPABASE_URL\s*=/, 'SUPABASE_URL deve viver em js/config.js');
  assert.match(noComments, /\bconst\s+SUPABASE_ANON_KEY\s*=/, 'SUPABASE_ANON_KEY deve viver em js/config.js');
  assert.ok(cfgSrc.includes(PROD_REF),
    'o ref canônico de produção deve viver em js/config.js');
});

test('js/config.js: o ref de produção é o único URL Supabase do módulo', () => {
  assert.match(cfgSrc, new RegExp(
    `PRODUCTION_SUPABASE_URL\\s*=\\s*'https://${PROD_REF}\\.supabase\\.co'`));
  const urls = new Set(cfgSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/g) || []);
  assert.deepEqual([...urls], [`https://${PROD_REF}.supabase.co`],
    'js/config.js deve referenciar exatamente um projeto Supabase');
});

// Guarda de RETIRADA: o projeto stale não pode voltar a aparecer em
// nenhum papel — nem produção, nem staging, nem fallback.
// O ref retirado permanece citado APENAS no comentário de cabeçalho, que
// explica por que ele foi retirado. O que a guarda proíbe é que ele volte
// a aparecer em CÓDIGO ativo (URL, chave, mapa de ambientes, fallback).
test('js/config.js: o projeto retirado gqmpsxkxynrjvidfmojk NÃO aparece em código ativo', () => {
  assert.equal(stripComments(cfgSrc).includes(RETIRED_REF), false,
    `${RETIRED_REF} foi retirado do runtime e não pode reaparecer em código de js/config.js`);
});

test('js/config.js: production tem writesEnabled true e restricted tem false', () => {
  const noComments = stripComments(cfgSrc);
  assert.match(noComments, /production:\s*\{[\s\S]*?writesEnabled:\s*true/,
    'production deve declarar writesEnabled: true');
  assert.match(noComments, /restricted:\s*\{[\s\S]*?writesEnabled:\s*false/,
    'restricted deve declarar writesEnabled: false');
});

test('js/config.js: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(cfgSrc), false,
    'service_role encontrado em js/config.js');
});

test('js/config.js: nenhum password literal', () => {
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(cfgSrc), false,
    'password literal encontrado em js/config.js');
});

test('index.html: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(indexSrc), false,
    'service_role encontrado em index.html');
});

test('index.html: nenhum password literal', () => {
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(indexSrc), false,
    'password literal encontrado em index.html');
});

// -----------------------------------------------------------------------------
// Testes de runtime: executa js/config.js num vm.Context com location
// controlada e valida que expõe os globais esperados.
// -----------------------------------------------------------------------------

function runConfigInSandbox({ hostname }) {
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    window: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  return sandbox;
}

test('runtime: window.RAVATEX_CONFIG é criado', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  const ns = vm.runInContext('window.RAVATEX_CONFIG', sb);
  assert.ok(ns && typeof ns === 'object', 'RAVATEX_CONFIG não é objeto');
  assert.equal(typeof ns.detectAppEnvironment, 'function');
  assert.equal(typeof ns.APP_ENV, 'string');
  assert.ok(ns.APP_CONFIG && typeof ns.APP_CONFIG === 'object');
  assert.equal(typeof ns.SUPABASE_URL, 'string');
  assert.equal(typeof ns.SUPABASE_ANON_KEY, 'string');
});

test('runtime: globais legados continuam disponíveis', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('typeof APP_ENVIRONMENTS', sb),     'object');
  assert.equal(vm.runInContext('typeof detectAppEnvironment', sb), 'function');
  assert.equal(vm.runInContext('typeof APP_ENV', sb),              'string');
  assert.equal(vm.runInContext('typeof APP_CONFIG', sb),           'object');
  assert.equal(vm.runInContext('typeof SUPABASE_URL', sb),         'string');
  assert.equal(vm.runInContext('typeof SUPABASE_ANON_KEY', sb),    'string');
});

test('runtime: detectAppEnvironment("inttracker-jade.vercel.app") → production', () => {
  const sb = runConfigInSandbox({ hostname: 'inttracker-jade.vercel.app' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
  assert.ok(vm.runInContext('SUPABASE_URL', sb).includes(PROD_REF));
});

test('runtime: detectAppEnvironment("inttracker-git-dev-inttex.vercel.app") → production', () => {
  // A branch de produção do projeto Vercel é `dev`, então este é o alias
  // de branch de produção.
  const sb = runConfigInSandbox({ hostname: 'inttracker-git-dev-inttex.vercel.app' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
  assert.ok(vm.runInContext('SUPABASE_URL', sb).includes(PROD_REF));
});

// REGRESSÃO DE CUTOVER: `main` deixou de ser a branch de produção. Um
// deploy de `main` agora é PREVIEW e não pode resolver para production.
test('runtime: detectAppEnvironment("inttracker-git-main-inttex.vercel.app") → restricted', () => {
  const sb = runConfigInSandbox({ hostname: 'inttracker-git-main-inttex.vercel.app' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', sb), false);
});

test('runtime: detectAppEnvironment("random-preview.vercel.app") → restricted (preview deploy, fail-safe)', () => {
  // Match é exato contra os domínios de produção — qualquer outro *.vercel.app
  // (incluindo preview deployments de PR/branch) cai em restricted por padrão,
  // para nunca escrever em produção a partir de um preview não revisado.
  const sb = runConfigInSandbox({ hostname: 'random-preview.vercel.app' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', sb), false);
});

test('runtime: detectAppEnvironment("localhost") → restricted', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
  assert.ok(vm.runInContext('SUPABASE_URL', sb).includes(PROD_REF));
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', sb), false);
});

test('runtime: detectAppEnvironment("127.0.0.1") → restricted', () => {
  const sb = runConfigInSandbox({ hostname: '127.0.0.1' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', sb), false);
});

test('runtime: detectAppEnvironment("ravatexapps-dotcom.github.io") → restricted', () => {
  const sb = runConfigInSandbox({ hostname: 'ravatexapps-dotcom.github.io' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
});

test('runtime: detectAppEnvironment("example.com") → restricted (fallback seguro)', () => {
  const sb = runConfigInSandbox({ hostname: 'example.com' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
});

// O ponto central do cutover: os dois ambientes apontam para o MESMO
// banco, e a única diferença é permissão de escrita.
test('runtime: production e restricted compartilham o banco; só production escreve', () => {
  const prod = runConfigInSandbox({ hostname: 'inttracker-jade.vercel.app' });
  const rest = runConfigInSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('SUPABASE_URL', prod), vm.runInContext('SUPABASE_URL', rest));
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', prod), true);
  assert.equal(vm.runInContext('APP_CONFIG.writesEnabled', rest), false);
});

test('runtime: detectAppEnvironment em MAIÚSCULAS também funciona ("Inttracker-Jade.VERCEL.app")', () => {
  // Sanity: o código usa .toLowerCase() antes de comparar. Garante que
  // o comportamento original (case-insensitive) foi preservado.
  const sb = runConfigInSandbox({ hostname: 'Inttracker-Jade.VERCEL.app' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
});

test('runtime: detectAppEnvironment(undefined) → restricted (sem hostname)', () => {
  const sb = runConfigInSandbox({ hostname: undefined });
  assert.equal(vm.runInContext('APP_ENV', sb), 'restricted');
});

test('runtime: APP_CONFIG.isProduction bate com APP_ENV', () => {
  for (const [host, env] of [
    ['inttracker-jade.vercel.app', 'production'],
    ['localhost', 'restricted'],
  ]) {
    const sb = runConfigInSandbox({ hostname: host });
    assert.equal(vm.runInContext('APP_ENV', sb), env);
    assert.equal(vm.runInContext('APP_CONFIG.isProduction', sb), env === 'production');
  }
});

test('runtime: SUPABASE_URL em produção contém o ref de produção', () => {
  const sb = runConfigInSandbox({ hostname: 'inttracker-jade.vercel.app' });
  const url = vm.runInContext('SUPABASE_URL', sb);
  assert.ok(url.startsWith('https://'));
  assert.ok(url.includes(PROD_REF));
  assert.ok(url.endsWith('.supabase.co'));
});

test('runtime: SUPABASE_URL em restricted contém o mesmo ref de produção', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  const url = vm.runInContext('SUPABASE_URL', sb);
  assert.ok(url.startsWith('https://'));
  assert.ok(url.includes(PROD_REF));
  assert.ok(url.endsWith('.supabase.co'));
});

test('runtime: o projeto retirado não é alcançável por nenhum hostname', () => {
  for (const hostname of [
    'inttracker-jade.vercel.app',
    'inttracker-git-dev-inttex.vercel.app',
    'inttracker-git-main-inttex.vercel.app',
    'random-preview.vercel.app',
    'localhost',
    '127.0.0.1',
    'example.com',
    undefined,
  ]) {
    const sb = runConfigInSandbox({ hostname });
    assert.equal(vm.runInContext('SUPABASE_URL', sb).includes(RETIRED_REF), false,
      `hostname ${String(hostname)} resolveu para o projeto retirado`);
  }
});

test('runtime: SUPABASE_ANON_KEY é JWT com 3 segmentos (anon, não service_role)', () => {
  // service_role começa com eyJ...mas tem `role: "service_role"` no payload.
  // Aqui validamos que (a) tem 3 segmentos e (b) não menciona service_role.
  for (const host of ['inttracker-jade.vercel.app', 'localhost']) { // production + restricted
    const sb = runConfigInSandbox({ hostname: host });
    const key = vm.runInContext('SUPABASE_ANON_KEY', sb);
    assert.equal(typeof key, 'string');
    const parts = key.split('.');
    assert.equal(parts.length, 3, `JWT em ${host} não tem 3 segmentos`);
    assert.equal(/service_role/.test(key), false, 'key parece ser service_role');
  }
});

// -----------------------------------------------------------------------------
// Integração leve: serve o index.html via http.server e checa que
// carrega js/config.js antes do script inline.
// -----------------------------------------------------------------------------

test('http.server (listen(0)): index.html servido contém js/config.js antes do entrypoint boot.js', (t, done) => {
  const srv = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexSrc);
    } else if (req.url === '/js/config.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(cfgSrc);
    } else {
      res.writeHead(404); res.end();
    }
  });
  srv.listen(0, '127.0.0.1', () => {
    const port = srv.address().port;
    http.get({ host: '127.0.0.1', port, path: '/index.html' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const cfgIdx = body.indexOf('js/config.js');
          const bootIdx = body.indexOf('js/boot.js');
          assert.ok(cfgIdx > 0, 'tag js/config.js não encontrada no body servido');
          assert.ok(bootIdx > 0, 'entrypoint js/boot.js não encontrado no body servido');
          assert.ok(cfgIdx < bootIdx, 'js/config.js deve vir antes do entrypoint boot.js');
          srv.close();
          done();
        } catch (e) {
          srv.close();
          done(e);
        }
      });
    }).on('error', (e) => { srv.close(); done(e); });
  });
});
