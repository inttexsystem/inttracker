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
//   4. detectAppEnvironment retorna 'production' para
//      grupoterrabranca.github.io e subdomínios;
//   5. detectAppEnvironment retorna 'staging' para qualquer outro host
//      (localhost, 127.0.0.1, ravatexapps-dotcom, example.com, vazio);
//   6. refs canônicos de produção e staging aparecem no módulo;
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

const PROD_REF    = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

const cfgSrc     = fs.readFileSync(CFG, 'utf8');
const indexSrc   = fs.readFileSync(INDEX, 'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

// Extrai o ÚLTIMO <script>...</script> que NÃO tem src (o inline principal).
// No estado pós-extração, esse script NÃO deve mais conter as definições
// de config — apenas comentários referenciando js/config.js.
function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

// Extrai o(s) <script src="js/config.js"> do <head>, em ordem de aparição.
function configScriptTags(html) {
  const re = /<script\s+src="js\/config\.js"\s*><\/script>/g;
  const tags = [];
  let m;
  while ((m = re.exec(html)) !== null) tags.push({ index: m.index, text: m[0] });
  return tags;
}

// Encontra o índice do PRIMEIRO <script> inline (sem src) em <body>.
function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// Extrai a substring de <script> inline (começa em `<script>` e vai até `</script>`).
function extractInlineRaw(html) {
  const start = html.indexOf('<script>');
  if (start < 0) throw new Error('<script> inline (sem src) não encontrado');
  const end = html.indexOf('</script>', start);
  if (end < 0) throw new Error('</script> de fechamento não encontrado');
  return html.slice(start, end + '</script>'.length);
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

test('index.html: <script src="js/config.js"> vem ANTES do <script> inline', () => {
  const tags = configScriptTags(indexSrc);
  assert.equal(tags.length, 1);
  const cfgIdx = tags[0].index;
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(cfgIdx > 0, 'tag de config não encontrada');
  assert.ok(inlineIdx > 0, 'tag inline não encontrada');
  assert.ok(cfgIdx < inlineIdx,
    `js/config.js (idx ${cfgIdx}) deve vir antes do inline (idx ${inlineIdx})`);
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

test('script inline NÃO contém mais `const APP_ENVIRONMENTS =`', () => {
  const inline = extractInlineScript(indexSrc);
  // Remove comentários pra não pegar menções em // que apenas documentam
  // a origem.
  const noComments = stripComments(inline);
  assert.equal(/\bconst\s+APP_ENVIRONMENTS\s*=/.test(noComments), false,
    'script inline ainda declara APP_ENVIRONMENTS — config não foi extraída');
});

test('script inline NÃO contém mais `function detectAppEnvironment`', () => {
  const inline = extractInlineScript(indexSrc);
  const noComments = stripComments(inline);
  assert.equal(/\bfunction\s+detectAppEnvironment\s*\(/.test(noComments), false,
    'script inline ainda define detectAppEnvironment');
});

test('script inline NÃO contém mais `const APP_ENV` (sem ponto-antes)', () => {
  // APP_ENV aparece como propriedade (APP_ENV !== 'production') e em
  // template strings ('APP-ENV ' + APP_CONFIG.label). Mas não deve haver
  // a DECLARAÇÃO `const APP_ENV = ...` no inline.
  const inline = extractInlineScript(indexSrc);
  const noComments = stripComments(inline);
  assert.equal(/\bconst\s+APP_ENV\s*=/.test(noComments), false,
    'script inline ainda declara APP_ENV');
});

test('script inline NÃO contém mais `const APP_CONFIG =`', () => {
  const inline = extractInlineScript(indexSrc);
  const noComments = stripComments(inline);
  assert.equal(/\bconst\s+APP_CONFIG\s*=/.test(noComments), false,
    'script inline ainda declara APP_CONFIG');
});

test('script inline NÃO contém mais `const SUPABASE_URL =`', () => {
  const inline = extractInlineScript(indexSrc);
  const noComments = stripComments(inline);
  assert.equal(/\bconst\s+SUPABASE_URL\s*=/.test(noComments), false,
    'script inline ainda declara SUPABASE_URL');
});

test('script inline NÃO contém mais `const SUPABASE_ANON_KEY =`', () => {
  const inline = extractInlineScript(indexSrc);
  const noComments = stripComments(inline);
  assert.equal(/\bconst\s+SUPABASE_ANON_KEY\s*=/.test(noComments), false,
    'script inline ainda declara SUPABASE_ANON_KEY');
});

test('script inline NÃO contém mais refs canônicos de produção/staging (anon keys saíram)', () => {
  // As anon keys (eyJ...) e os URLs dos refs DEVEM ter saído do script
  // inline — agora vivem em js/config.js.
  const inline = extractInlineScript(indexSrc);
  assert.equal(inline.includes(PROD_REF), false,
    `script inline ainda referencia ref de produção ${PROD_REF}`);
  assert.equal(inline.includes(STAGING_REF), false,
    `script inline ainda referencia ref de staging ${STAGING_REF}`);
  assert.equal(inline.includes('supabaseUrl:'), false,
    'script inline ainda define supabaseUrl');
  assert.equal(inline.includes('supabaseAnonKey:'), false,
    'script inline ainda define supabaseAnonKey');
});

test('js/config.js: produção ref aparece em production config', () => {
  assert.match(cfgSrc, new RegExp(
    `supabaseUrl:\\s*'https://${PROD_REF}\\.supabase\\.co'`));
});

test('js/config.js: staging ref aparece em staging config', () => {
  assert.match(cfgSrc, new RegExp(
    `supabaseUrl:\\s*'https://${STAGING_REF}\\.supabase\\.co'`));
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

test('runtime: detectAppEnvironment("grupoterrabranca.github.io") → production', () => {
  const sb = runConfigInSandbox({ hostname: 'grupoterrabranca.github.io' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
  assert.ok(vm.runInContext('SUPABASE_URL', sb).includes(PROD_REF));
});

test('runtime: detectAppEnvironment("x.grupoterrabranca.github.io") → production (subdomínio)', () => {
  const sb = runConfigInSandbox({ hostname: 'x.grupoterrabranca.github.io' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
});

test('runtime: detectAppEnvironment("localhost") → staging', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'staging');
  assert.ok(vm.runInContext('SUPABASE_URL', sb).includes(STAGING_REF));
});

test('runtime: detectAppEnvironment("127.0.0.1") → staging', () => {
  const sb = runConfigInSandbox({ hostname: '127.0.0.1' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'staging');
});

test('runtime: detectAppEnvironment("ravatexapps-dotcom.github.io") → staging', () => {
  const sb = runConfigInSandbox({ hostname: 'ravatexapps-dotcom.github.io' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'staging');
});

test('runtime: detectAppEnvironment("example.com") → staging (fallback seguro)', () => {
  const sb = runConfigInSandbox({ hostname: 'example.com' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'staging');
});

test('runtime: detectAppEnvironment em MAIÚSCULAS também funciona ("Grupoterrabranca.GITHUB.io")', () => {
  // Sanity: o código usa .toLowerCase() antes de comparar. Garante que
  // o comportamento original (case-insensitive) foi preservado.
  const sb = runConfigInSandbox({ hostname: 'Grupoterrabranca.GITHUB.io' });
  assert.equal(vm.runInContext('APP_ENV', sb), 'production');
});

test('runtime: detectAppEnvironment(undefined) → staging (sem hostname)', () => {
  const sb = runConfigInSandbox({ hostname: undefined });
  assert.equal(vm.runInContext('APP_ENV', sb), 'staging');
});

test('runtime: APP_CONFIG.isProduction bate com APP_ENV', () => {
  for (const [host, env] of [
    ['grupoterrabranca.github.io', 'production'],
    ['localhost', 'staging'],
  ]) {
    const sb = runConfigInSandbox({ hostname: host });
    assert.equal(vm.runInContext('APP_ENV', sb), env);
    assert.equal(vm.runInContext('APP_CONFIG.isProduction', sb), env === 'production');
  }
});

test('runtime: SUPABASE_URL em produção contém o ref de produção', () => {
  const sb = runConfigInSandbox({ hostname: 'grupoterrabranca.github.io' });
  const url = vm.runInContext('SUPABASE_URL', sb);
  assert.ok(url.startsWith('https://'));
  assert.ok(url.includes(PROD_REF));
  assert.ok(url.endsWith('.supabase.co'));
});

test('runtime: SUPABASE_URL em staging contém o ref de staging', () => {
  const sb = runConfigInSandbox({ hostname: 'localhost' });
  const url = vm.runInContext('SUPABASE_URL', sb);
  assert.ok(url.startsWith('https://'));
  assert.ok(url.includes(STAGING_REF));
  assert.ok(url.endsWith('.supabase.co'));
});

test('runtime: SUPABASE_ANON_KEY é JWT com 3 segmentos (anon, não service_role)', () => {
  // service_role começa com eyJ...mas tem `role: "service_role"` no payload.
  // Aqui validamos que (a) tem 3 segmentos e (b) não menciona service_role.
  for (const host of ['grupoterrabranca.github.io', 'localhost']) {
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

test('http.server: index.html servido contém js/config.js antes do inline', (t, done) => {
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
          const inlineIdx = body.indexOf('<script>');
          assert.ok(cfgIdx > 0, 'tag js/config.js não encontrada no body servido');
          assert.ok(inlineIdx > 0, 'tag inline não encontrada no body servido');
          assert.ok(cfgIdx < inlineIdx, 'js/config.js deve vir antes do inline');
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
