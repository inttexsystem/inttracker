// Smoke test do módulo js/supabase-client.js (SUPABASE-CLIENT-MODULE-A).
//
// Garante que a extração do bloco SUPA + WRITE-GUARD do script inline
// de index.html para js/supabase-client.js preservou o comportamento
// exato, em particular:
//
//   1. arquivo existe, é script clássico (não ES module);
//   2. index.html carrega js/config.js antes de js/supabase-client.js;
//   3. index.html carrega js/supabase-client.js antes do script inline;
//   4. script inline NÃO contém mais createClient / _supaRaw /
//      _GUARD_BLOCK_WRITES / Proxy do `supa` / etc;
//   5. window.RAVATEX_SUPABASE_CLIENT e window.supa são criados no
//      runtime simulado;
//   6. em staging (localhost/127.0.0.1) writes NÃO são bloqueados;
//   7. cenário forçado (local + URL de produção) bloqueia insert/update/
//      delete/upsert/rpc; select e auth.getSession continuam livres;
//   8. banner vermelho do write-guard continua existindo quando guard
//      ativo, e vive agora em js/supabase-client.js;
//   9. banner laranja staging permanece no inline (não foi movido nesta
//      fase);
//  10. service_role e password literal NÃO aparecem;
//  11. refs produção/staging preservados no módulo.

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
const SUPA  = path.join(ROOT, 'js', 'supabase-client.js');

const PROD_REF    = 'gqmpsxkxynrjvidfmojk';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

const cfgSrc    = fs.readFileSync(CFG,  'utf8');
const supaSrc   = fs.readFileSync(SUPA, 'utf8');
const indexSrc  = fs.readFileSync(INDEX,'utf8');

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

// TEST-DOUBLE-STALE-ASSERTION-CLEANUP (Lot L2, 2026-07-17): index.html is fully
// modularized — no content-bearing inline <script> remains (the SUPA +
// WRITE-GUARD block moved to js/supabase-client.js) and scripts load with a ?v=
// cache-buster (§12). Helpers reflect that post-modularization structure; the
// previous inline extractor threw and findScriptIdx did not tolerate ?v=.

// Content-bearing inline <script> bodies. Empty after full modularization.
function inlineContent(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let out = '';
  while ((m = re.exec(html)) !== null) out += m[1];
  return out;
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}(?:\\?[^"]*)?"\\s*><\\/script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

// App entrypoint (js/boot.js) replaced the inline main script as the last
// dependency-consuming script.
function entrypointIdx(html) {
  return html.indexOf('js/boot.js');
}

function stripComments(src) {
  // IMPORTANTE: usar [^\n]* em vez de .*$ — em JS, $ em modo m ancora
  // ao fim do string, não da linha. [^\n]* garante consumo até o \n.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/[ \t]+\/\/[^\n]*/g, '');
}

// -----------------------------------------------------------------------------
// Helpers de runtime
// -----------------------------------------------------------------------------

// Cria um cliente Supabase FAKE que devolve Promises identificáveis.
function makeFakeSupabaseClient() {
  const calls = [];
  const record = (op) => (...args) => {
    calls.push({ op, args });
    if (op === 'select') return Promise.resolve({ data: [], error: null });
    if (op === 'auth.getSession') return Promise.resolve({ data: { session: null }, error: null });
    if (op === 'rpc') return Promise.resolve({ data: 'ok', error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const queryBuilder = () => ({
    select: record('select'),
    insert: record('insert'),
    update: record('update'),
    delete: record('delete'),
    upsert: record('upsert'),
    eq: () => queryBuilder(),
    single: record('select'),
  });
  return {
    from: (table) => { calls.push({ op: 'from', args: [table] }); return queryBuilder(); },
    rpc: record('rpc'),
    auth: { getSession: record('auth.getSession'), signInWithPassword: record('auth.signInWithPassword'), signOut: record('auth.signOut') },
    storage: {},
    _calls: calls,
  };
}

// Carrega js/config.js + js/supabase-client.js num vm.Context com
// location controlada, Supabase fake e DOM mock mínimo.
function runSandbox({ hostname, forceLocalInDoc, overrideProdUrl }) {
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => {
      fakeSupa._createdWith = { url, key, opts };
      return fakeSupa;
    },
  };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    document: documentMock,
    supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(cfgSrc,  sandbox, { filename: 'js/config.js' });
  if (overrideProdUrl) {
    // Para forçar _IS_PROD_URL=true mesmo com hostname local, sobrescreve
    // SUPABASE_URL com a URL de produção antes de carregar o client.
    vm.runInContext(
      `SUPABASE_URL = ${JSON.stringify(overrideProdUrl)}; APP_ENVIRONMENTS.production.supabaseUrl = ${JSON.stringify(overrideProdUrl)};`,
      sandbox, { filename: 'force-prod-url.js' }
    );
  }
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });

  return { sandbox, fakeSupa };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('js/supabase-client.js existe e é script clássico', () => {
  assert.ok(fs.existsSync(SUPA), 'js/supabase-client.js não existe');
  assert.equal(/^\s*export\s+/m.test(supaSrc), false,
    'js/supabase-client.js parece usar export — deve ser script clássico');
});

test('js/supabase-client.js tem sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${SUPA}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/supabase-client.js EXATAMENTE UMA VEZ no <head>', () => {
  const re = /<script\s+src="js\/supabase-client\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/supabase-client.js">, encontrado ${matches.length}`);
});

test('index.html: <script src="js/config.js"> vem ANTES de <script src="js/supabase-client.js">', () => {
  const cfgIdx  = findScriptIdx(indexSrc, 'js/config.js');
  const supaIdx = findScriptIdx(indexSrc, 'js/supabase-client.js');
  assert.ok(cfgIdx  > 0, 'js/config.js não encontrado no <head>');
  assert.ok(supaIdx > 0, 'js/supabase-client.js não encontrado no <head>');
  assert.ok(cfgIdx < supaIdx,
    `config.js (idx ${cfgIdx}) deve vir antes de supabase-client.js (idx ${supaIdx})`);
});

test('index.html: <script src="js/supabase-client.js"> vem ANTES do entrypoint js/boot.js', () => {
  const supaIdx = findScriptIdx(indexSrc, 'js/supabase-client.js');
  const bootIdx = entrypointIdx(indexSrc);
  assert.ok(supaIdx > 0, 'js/supabase-client.js não encontrado no <head>');
  assert.ok(bootIdx > 0, 'entrypoint js/boot.js não encontrado');
  assert.ok(supaIdx < bootIdx,
    `supabase-client.js (idx ${supaIdx}) deve vir antes do entrypoint boot.js (idx ${bootIdx})`);
});

// Post-modularization invariant (replaces the "inline NÃO contém X" test, which
// asserted against an inline <script> that no longer exists): there is no
// content-bearing inline script, and the SUPA + WRITE-GUARD logic lives in
// js/supabase-client.js.
test('a lógica do client (createClient, _supaRaw, write-guard) vive em js/supabase-client.js, não no inline', () => {
  assert.equal(inlineContent(indexSrc).trim(), '',
    'index.html ainda tem um <script> inline com conteúdo');
  const noComments = stripComments(supaSrc);
  assert.match(noComments, /supabase\.createClient\s*\(/, 'createClient deve viver em js/supabase-client.js');
  assert.match(noComments, /\b_supaRaw\b/, '_supaRaw deve viver em js/supabase-client.js');
  assert.match(noComments, /\b_GUARD_BLOCK_WRITES\b/, '_GUARD_BLOCK_WRITES deve viver em js/supabase-client.js');
  assert.match(noComments, /\b_WG_ERROR\b/, '_WG_ERROR deve viver em js/supabase-client.js');
  assert.match(noComments, /function\s+_wrapQueryBuilder/, '_wrapQueryBuilder deve viver em js/supabase-client.js');
  assert.match(noComments, /\bconst\s+supa\s*=/, 'o Proxy supa deve viver em js/supabase-client.js');
});

// Post-modularization invariant: the env-banner was extracted to
// js/environment-banner.js; there is no content-bearing inline script, and the
// banner logic/text lives in the dedicated module.
test('o env-banner laranja foi extraído para js/environment-banner.js (não está no inline)', () => {
  assert.equal(inlineContent(indexSrc).trim(), '',
    'index.html ainda tem um <script> inline com conteúdo');
  const EB = path.join(ROOT, 'js', 'environment-banner.js');
  assert.ok(fs.existsSync(EB), 'js/environment-banner.js deve existir');
  const ebSrc = fs.readFileSync(EB, 'utf8');
  assert.match(ebSrc, /_envBanner/, '_envBanner deve viver em js/environment-banner.js');
  assert.match(ebSrc, /AMBIENTE STAGING — DADOS DE TESTE/, 'o texto do env-banner deve viver em js/environment-banner.js');
});

test('js/supabase-client.js: produção ref aparece em production config (via config.js)', () => {
  // O módulo depende de js/config.js para URLs/keys, então a presença
  // dos refs em js/config.js já é testada em tests/config.smoke.js.
  // Aqui só validamos que o módulo NÃO embute URLs próprias.
  assert.equal(supaSrc.includes('supabase.co'), false,
    'js/supabase-client.js embute URL do Supabase — deve usar js/config.js');
  assert.equal(supaSrc.includes('anonKey'), false,
    'js/supabase-client.js embute anon key — deve usar js/config.js');
});

test('js/supabase-client.js: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(supaSrc), false,
    'service_role encontrado em js/supabase-client.js');
});

test('js/supabase-client.js: nenhum password literal', () => {
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(supaSrc), false,
    'password literal encontrado em js/supabase-client.js');
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
// 2. Validação do banner vermelho do write-guard
// -----------------------------------------------------------------------------

test('js/supabase-client.js: banner vermelho (write-guard) usa top:0 e position:fixed', () => {
  // O cssText é montado em concatenação de strings; o primeiro chunk já
  // contém position/top/z-index. A cor vermelha está em outro chunk.
  const match = supaSrc.match(/_banner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do write-guard banner não encontrado em js/supabase-client.js');
  const css = match[1];
  assert.match(css, /\btop\s*:\s*0\b/, 'banner vermelho perdeu top:0');
  assert.match(css, /position\s*:\s*fixed/, 'banner vermelho perdeu position:fixed');
  assert.match(css, /z-index\s*:\s*99999/, 'banner vermelho perdeu z-index 99999');
  // Cor vermelha está no segundo chunk da concatenação: valida no source
  // inteiro (não só no cssText do primeiro chunk).
  assert.match(supaSrc, /background\s*:\s*#dc2626/, 'banner vermelho perdeu cor vermelha');
});

test('js/supabase-client.js: banner vermelho texto correto', () => {
  const match = supaSrc.match(/_banner\.textContent\s*=\s*'([^']+)'/);
  assert.ok(match, 'textContent do banner vermelho não encontrado');
  assert.match(match[1], /LOCAL APONTANDO PARA PRODUÇÃO/);
  assert.match(match[1], /WRITES BLOQUEADOS/);
});

// -----------------------------------------------------------------------------
// 3. Validação de runtime
// -----------------------------------------------------------------------------

test('runtime: window.RAVATEX_SUPABASE_CLIENT é criado', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const ns = vm.runInContext('window.RAVATEX_SUPABASE_CLIENT', sandbox);
  assert.ok(ns && typeof ns === 'object', 'RAVATEX_SUPABASE_CLIENT não é objeto');
  assert.equal(typeof ns.raw, 'object', 'raw não é objeto');
  assert.equal(typeof ns.guarded, 'object', 'guarded não é objeto');
  assert.equal(typeof ns.IS_LOCAL, 'boolean');
  assert.equal(typeof ns.IS_PROD_URL, 'boolean');
  assert.equal(typeof ns.GUARD_BLOCK_WRITES, 'boolean');
  assert.ok(ns.LOCAL_HOSTS instanceof Set, 'LOCAL_HOSTS não é Set');
});

test('runtime: window.supa existe e é o client (ou Proxy) do Supabase', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const supa = vm.runInContext('window.supa', sandbox);
  assert.ok(supa, 'window.supa é falsy');
  assert.equal(typeof supa.from, 'function');
  assert.equal(typeof supa.rpc, 'function');
  assert.ok(supa.auth, 'supa.auth ausente');
  assert.equal(typeof supa.auth.getSession, 'function');
});

test('runtime: window._supaRaw existe e tem auth.from.rpc', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const raw = vm.runInContext('window._supaRaw', sandbox);
  assert.ok(raw, '_supaRaw ausente');
  assert.equal(typeof raw.from, 'function');
  assert.equal(typeof raw.rpc, 'function');
});

test('runtime: globais legados _LOCAL_HOSTS / _IS_LOCAL / _IS_PROD_URL / _GUARD_BLOCK_WRITES / _WG_ERROR', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  assert.ok(vm.runInContext('window._LOCAL_HOSTS', sandbox) instanceof Set);
  assert.equal(typeof vm.runInContext('window._IS_LOCAL', sandbox), 'boolean');
  assert.equal(typeof vm.runInContext('window._IS_PROD_URL', sandbox), 'boolean');
  assert.equal(typeof vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), 'boolean');
  assert.equal(typeof vm.runInContext('window._WG_ERROR', sandbox), 'function');
  assert.equal(typeof vm.runInContext('window._wrapQueryBuilder', sandbox), 'function');
});

// -----------------------------------------------------------------------------
// 4. Comportamento do write-guard
// -----------------------------------------------------------------------------

test('staging: localhost → guard OFF, writes passam', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), false);
  assert.equal(vm.runInContext('window._IS_LOCAL', sandbox), true);
  assert.equal(vm.runInContext('window._IS_PROD_URL', sandbox), false);

  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const ins = await qb.insert({ foo: 'bar' });
  assert.equal(ins && ins.error, null, 'insert não deveria bloquear em staging');
  // Garante que a chamada chegou no client fake
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em staging');
});

test('staging: 127.0.0.1 → guard OFF, writes passam', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: '127.0.0.1' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), false);
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const upd = await qb.update({ foo: 'bar' });
  assert.equal(upd && upd.error, null, 'update não deveria bloquear em 127.0.0.1');
  const updCalls = fakeSupa._calls.filter(c => c.op === 'update');
  assert.ok(updCalls.length >= 1, 'update não chegou no fake client em 127.0.0.1');
});

test('produção (inttracker-jade.vercel.app): guard OFF, writes passam', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'inttracker-jade.vercel.app' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), false);
  assert.equal(vm.runInContext('window._IS_LOCAL', sandbox), false);
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const ins = await qb.insert({ foo: 'bar' });
  assert.equal(ins && ins.error, null, 'insert não deveria bloquear em produção');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em produção');
});

test('staging: select e auth.getSession funcionam', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  fakeSupa._calls.length = 0;
  const sel = vm.runInContext(`supa.from('usuarios')`, sandbox);
  const res = await sel.select('*');
  assert.equal(res && typeof res, 'object');
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from');
  assert.ok(fromCalls.length >= 1, 'from() não chegou no fake client');
  const authSession = await vm.runInContext(`supa.auth.getSession()`, sandbox);
  assert.equal(authSession && typeof authSession, 'object');
});

test('cénario forçado: local + URL de produção → guard ON, insert/update/delete/upsert/rpc bloqueiam', async () => {
  // Forçar o guard exige _IS_LOCAL=true E _IS_PROD_URL=true. Em produção
  // real isso é geometricamente impossível (localhost sempre seleciona
  // staging). Aqui simulamos o cenário defensivo sobrescrevendo
  // SUPABASE_URL no sandbox antes de carregar o client.
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => {
      fakeSupa._createdWith = { url, key, opts };
      return fakeSupa;
    },
  };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname: '127.0.0.1', href: 'http://127.0.0.1/index.html' },
    document: documentMock,
    supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Carrega config.js (sandbox detecta staging para 127.0.0.1) e depois
  // sobrescreve SUPABASE_URL com a URL de produção.
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  vm.runInContext(
    `SUPABASE_URL = 'https://${PROD_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
    sandbox, { filename: 'force-prod.js' }
  );
  // Carrega o client.
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });

  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true,
    'guard deveria estar ativo no cenário forçado');

  for (const op of ['insert', 'update', 'delete', 'upsert']) {
    const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
    let caught = null;
    try {
      await qb[op]({ foo: 'bar' });
    } catch (e) { caught = e; }
    assert.ok(caught, `${op} deveria rejeitar (rejeição deve aparecer)`);
    assert.match(caught.message, /WRITE-GUARD/);
  }
  // rpc também bloqueia
  let rpcCaught = null;
  try {
    await vm.runInContext(`supa.rpc('qualquer', {})`, sandbox);
  } catch (e) { rpcCaught = e; }
  assert.ok(rpcCaught, 'rpc deveria rejeitar');
  assert.match(rpcCaught.message, /WRITE-GUARD/);
});

test('cénario forçado: select NÃO é bloqueado', async () => {
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => { fakeSupa._createdWith = { url, key, opts }; return fakeSupa; },
  };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname: '127.0.0.1', href: 'http://127.0.0.1/index.html' },
    document: documentMock, supabase: fakeSupabase, Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  vm.runInContext(
    `SUPABASE_URL = 'https://${PROD_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
    sandbox, { filename: 'force-prod.js' }
  );
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);

  const qb = vm.runInContext(`supa.from('usuarios')`, sandbox);
  const sel = await qb.select('*');
  assert.equal(sel && typeof sel, 'object', 'select deve devolver objeto');
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from');
  assert.ok(fromCalls.length >= 1, 'from() não chegou no fake client');
});

test('cénario forçado: auth.getSession NÃO é bloqueado', async () => {
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => { fakeSupa._createdWith = { url, key, opts }; return fakeSupa; },
  };
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'', prepend(){}, appendChild(){} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname: '127.0.0.1', href: 'http://127.0.0.1/index.html' },
    document: documentMock, supabase: fakeSupabase, Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  vm.runInContext(
    `SUPABASE_URL = 'https://${PROD_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
    sandbox, { filename: 'force-prod.js' }
  );
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);

  const authSession = await vm.runInContext(`supa.auth.getSession()`, sandbox);
  assert.equal(authSession && typeof authSession, 'object', 'auth.getSession deve devolver objeto');
});

// -----------------------------------------------------------------------------
// 5. Integração leve: serve o index.html via http.server e checa que
// carrega js/supabase-client.js antes do script inline.
// -----------------------------------------------------------------------------

test('http.server (listen(0)): index.html servido contém js/supabase-client.js antes do entrypoint boot.js', (t, done) => {
  const srv = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexSrc);
    } else if (req.url === '/js/config.js' || req.url === '/js/supabase-client.js') {
      const file = req.url === '/js/config.js' ? cfgSrc : supaSrc;
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(file);
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
          const cfgIdx  = body.indexOf('js/config.js');
          const supaIdx = body.indexOf('js/supabase-client.js');
          const bootIdx = body.indexOf('js/boot.js');
          assert.ok(cfgIdx  > 0, 'js/config.js não encontrado no body servido');
          assert.ok(supaIdx > 0, 'js/supabase-client.js não encontrado no body servido');
          assert.ok(bootIdx > 0, 'entrypoint js/boot.js não encontrado no body servido');
          assert.ok(cfgIdx < supaIdx, 'js/config.js deve vir antes de js/supabase-client.js');
          assert.ok(supaIdx < bootIdx, 'js/supabase-client.js deve vir antes do entrypoint boot.js');
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
