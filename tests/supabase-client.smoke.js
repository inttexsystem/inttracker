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
//   6. no ambiente restricted (localhost/127.0.0.1/preview) writes SÃO
//      bloqueados — não existe banco não-produtivo, o ambiente resolve
//      para a produção em modo somente leitura;
//   7. cenário forçado (local + URL de produção) bloqueia insert/update/
//      delete/upsert/rpc; select e auth.getSession continuam livres;
//   8. banner vermelho do write-guard continua existindo quando guard
//      ativo, e vive agora em js/supabase-client.js;
//   9. banner laranja do ambiente restricted permanece no inline (não foi
//      movido nesta fase);
//  10. service_role e password literal NÃO aparecem;
//  11. o módulo não embute refs próprios — produção vem de js/config.js.

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

// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1 — identidades
// correntes. `ucrjtfswnfdlxwtmxnoo` é a PRODUÇÃO definitiva (e o banco
// que o ambiente `restricted` também lê, em somente leitura);
// `gqmpsxkxynrjvidfmojk` foi RETIRADO; `bhgifjrfagkzubpyqpew` é PROIBIDO.
const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF    = 'gqmpsxkxynrjvidfmojk';
const FORBIDDEN_REF  = 'bhgifjrfagkzubpyqpew';

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
  assert.match(ebSrc, /AMBIENTE SOMENTE LEITURA — DADOS REAIS DE PRODUÇÃO/, 'o texto do env-banner deve viver em js/environment-banner.js');
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

test('identidades de ambiente: js/config.js usa a produção definitiva e não reintroduz retirado/proibido', () => {
  // O runtime é dono do roteamento; este teste apenas prova que a
  // identidade corrente é a única presente na configuração ativa.
  assert.equal(cfgSrc.includes(PRODUCTION_REF), true,
    'js/config.js deve apontar para a produção definitiva');
  assert.equal(cfgSrc.includes(`https://${RETIRED_REF}.supabase.co`), false,
    'js/config.js reintroduziu a URL do projeto RETIRADO');
  assert.equal(cfgSrc.includes(`https://${FORBIDDEN_REF}.supabase.co`), false,
    'js/config.js reintroduziu a URL do projeto PROIBIDO');
  // O módulo do client não embute ref algum.
  for (const ref of [PRODUCTION_REF, RETIRED_REF, FORBIDDEN_REF]) {
    assert.equal(supaSrc.includes(ref), false,
      `js/supabase-client.js embute o ref ${ref} — deve usar js/config.js`);
  }
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
  assert.match(match[1], /BANCO DE PRODUÇÃO EM SOMENTE LEITURA/);
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

// INTTRACKER-PRODUCTION-CUTOVER-R1: estes dois testes eram "guard OFF,
// writes passam", porque localhost apontava para um banco de staging
// separado. Não existe mais banco de staging — localhost lê o banco REAL
// de produção, então o guard tem de estar ON e a escrita tem de morrer
// antes de alcançar o client.
test('restricted: localhost → guard ON, writes bloqueados', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);
  assert.equal(vm.runInContext('window._WRITES_ENABLED', sandbox), false);
  assert.equal(vm.runInContext('window._IS_LOCAL', sandbox), true);
  assert.equal(vm.runInContext('window._IS_PROD_URL', sandbox), true);

  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  await assert.rejects(() => qb.insert({ foo: 'bar' }), /WRITE-GUARD/,
    'insert deveria bloquear em localhost');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.equal(insertCalls.length, 0, 'insert NÃO pode chegar no client em localhost');
});

test('restricted: 127.0.0.1 → guard ON, writes bloqueados', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: '127.0.0.1' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);
  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  await assert.rejects(() => qb.update({ foo: 'bar' }), /WRITE-GUARD/,
    'update deveria bloquear em 127.0.0.1');
  const updCalls = fakeSupa._calls.filter(c => c.op === 'update');
  assert.equal(updCalls.length, 0, 'update NÃO pode chegar no client em 127.0.0.1');
});

test('restricted: preview *.vercel.app → guard ON, writes bloqueados', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'random-preview.vercel.app' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);
  assert.equal(vm.runInContext('window._IS_LOCAL', sandbox), false,
    'preview não é local — é o caso que a condição antiga deixava passar');
  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('pedidos')`, sandbox);
  await assert.rejects(() => qb.delete(), /WRITE-GUARD/,
    'delete deveria bloquear em preview');
  const delCalls = fakeSupa._calls.filter(c => c.op === 'delete');
  assert.equal(delCalls.length, 0, 'delete NÃO pode chegar no client em preview');
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

test('restricted: select e auth.getSession funcionam', async () => {
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
  // Forçar o guard exige _IS_LOCAL=true E _IS_PROD_URL=true. Aqui
  // simulamos o cenário defensivo sobrescrevendo SUPABASE_URL no sandbox
  // antes de carregar o client.
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

  // Carrega config.js (sandbox detecta `restricted` para 127.0.0.1) e
  // depois sobrescreve SUPABASE_URL com a URL de produção.
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  vm.runInContext(
    `SUPABASE_URL = 'https://${PRODUCTION_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
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
    `SUPABASE_URL = 'https://${PRODUCTION_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
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
    `SUPABASE_URL = 'https://${PRODUCTION_REF}.supabase.co'; APP_ENVIRONMENTS.production.supabaseUrl = SUPABASE_URL;`,
    sandbox, { filename: 'force-prod.js' }
  );
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);

  const authSession = await vm.runInContext(`supa.auth.getSession()`, sandbox);
  assert.equal(authSession && typeof authSession, 'object', 'auth.getSession deve devolver objeto');
});

// -----------------------------------------------------------------------------
// 4b. READ-RPC-GUARD-CORRECTION-R1 — allowlist literal de RPCs de leitura
// -----------------------------------------------------------------------------
//
// O guard publicado rejeitava TODA `.rpc()` sem olhar o nome. Como três telas
// leem EXCLUSIVAMENTE por RPC, elas ficavam inutilizáveis fora dos hostnames de
// produção. A correção libera uma allowlist LITERAL, provada sobre a definição
// SQL versionada de cada função (volatilidade declarada + varredura do corpo
// terminal + fecho transitivo das chamadas), nunca por nome ou prefixo.
//
// Este bloco é o dono canônico do contrato. Ele tem de FALHAR contra o
// comportamento publicado (que rejeitava as três leituras) e passar com a
// correção, e tem de continuar provando que o default é NEGAR.

// As 14 entradas autorizadas. Esta lista é o contrato: uma entrada nova no
// módulo sem passar por aqui derruba o teste, que é exatamente o ponto — cada
// nome precisa ser reprovado sobre a definição SQL antes de entrar.
const READ_ONLY_RPCS_ESPERADAS = [
  'admin_alteracao_comparacao',
  'admin_usuarios_last_sign_in',
  'avaliar_necessidades_compra_fio',
  'cliente_alteracao_resumo',
  'cliente_pedido_summary',
  'consultar_saldo_expedicao_latex',
  'diagnosticar_impacto_pedido',
  'listar_ordens_compra_admin',
  'listar_ordens_compra_fio_compat',
  'obter_distribuicao_ordem_compra',
  'obter_historico_recebimento_ordem_compra',
  'obter_ordem_compra_admin',
  'obter_planejamento_compra_pedido',
  'sugerir_codigo_ordem_compra',
];

// RPCs de ESCRITA que têm de continuar morrendo antes do transporte. Duas
// delas — `proximo_numero_op` e `resolver_regime_compra_fio_pedido` — PARECEM
// leitura e gravam de verdade: são a prova de que a autorização não pode ser
// heurística de nome.
const WRITE_RPCS_BLOQUEADAS = [
  'salvar_pedido_admin',
  'emitir_ordem_compra',
  'gerar_ordem_compra_do_planejamento',
  'proximo_numero_op',
  'resolver_regime_compra_fio_pedido',
];

// Extrai a lista literal do FONTE (não do runtime): garante que a allowlist é
// um literal auditável no módulo, e não algo montado dinamicamente.
function allowlistDoFonte() {
  const m = supaSrc.match(/_READ_ONLY_RPCS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '_READ_ONLY_RPCS não é um `new Set([...])` literal em js/supabase-client.js');
  return (m[1].match(/'([a-z0-9_]+)'/g) || []).map((s) => s.replace(/'/g, ''));
}

// Chama supa.rpc dentro do sandbox com nome/params controlados pelo teste.
function chamarRpc(sandbox, fn, params) {
  const ctx = vm.runInContext('({ chamar: (f, p) => supa.rpc(f, p) })', sandbox);
  return ctx.chamar(fn, params);
}

function rpcCalls(fakeSupa) {
  return fakeSupa._calls.filter((c) => c.op === 'rpc');
}

test('allowlist: o módulo declara exatamente as 14 RPCs de leitura provadas', () => {
  const doFonte = allowlistDoFonte().slice().sort();
  assert.deepEqual(doFonte, READ_ONLY_RPCS_ESPERADAS.slice().sort(),
    'a allowlist literal de js/supabase-client.js divergiu do contrato de 14 entradas');
  assert.equal(new Set(doFonte).size, 14, 'a allowlist tem de ter 14 entradas distintas');
  // Nenhuma escritora conhecida pode ter entrado na lista.
  for (const w of WRITE_RPCS_BLOQUEADAS) {
    assert.equal(doFonte.includes(w), false,
      w + ' grava e nunca pode entrar na allowlist de leitura');
  }
});

test('restricted: TODA entrada da allowlist alcança o transporte RPC bruto', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true,
    'o cenário tem de ser restricted');
  for (const nome of READ_ONLY_RPCS_ESPERADAS) {
    fakeSupa._calls.length = 0;
    const res = await chamarRpc(sandbox, nome, { p_teste: 1 });
    assert.equal(res && res.error, null, nome + ' não deveria ser bloqueada em restricted');
    assert.equal(rpcCalls(fakeSupa).length, 1,
      nome + ' não alcançou o client Supabase — o guard rejeitou uma leitura provada');
  }
});

// As três regressões reais que a correção fecha. Cada uma amarra a tela ao
// nome que ela realmente chama: se a tela trocar de RPC ou a allowlist perder
// a entrada, este teste cai.
const LEITURAS_DE_TELA = [
  { tela: 'Ordens de Compra (lista)', modulo: 'js/screens/ordem-compra-data.js',            rpc: 'listar_ordens_compra_admin' },
  { tela: 'Pedido (detalhe)',         modulo: 'js/screens/ordem-compra-receipt-cutover.js', rpc: 'listar_ordens_compra_fio_compat' },
  { tela: 'Planejamento de Compra',   modulo: 'js/screens/pedido-insumos-distribuicao.js',  rpc: 'obter_planejamento_compra_pedido' },
];

for (const { tela, modulo, rpc } of LEITURAS_DE_TELA) {
  test(`restricted: ${tela} — ${rpc} NÃO é rejeitada pelo guard`, async () => {
    const src = fs.readFileSync(path.join(ROOT, modulo), 'utf8');
    assert.match(src, new RegExp(`rpc\\(\\s*'${rpc}'`),
      `${modulo} deveria continuar lendo por ${rpc}`);
    assert.ok(READ_ONLY_RPCS_ESPERADAS.includes(rpc),
      `${rpc} tem de estar na allowlist ou ${tela} volta a quebrar em restricted`);

    const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
    assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);
    fakeSupa._calls.length = 0;
    const params = { p_pedido_id: 'ped-1', p_ordem_id: 7 };
    const res = await chamarRpc(sandbox, rpc, params);
    assert.equal(res && res.error, null, `${rpc} foi bloqueada — ${tela} continua quebrada`);
    const chamadas = rpcCalls(fakeSupa);
    assert.equal(chamadas.length, 1, `${rpc} não delegou ao client bruto`);
    assert.equal(chamadas[0].args[0], rpc, 'o nome da RPC chegou alterado ao transporte');
    assert.deepEqual(chamadas[0].args[1], params, 'os parâmetros chegaram alterados ao transporte');
  });
}

test('restricted: nome e parâmetros são repassados sem alteração e sem cópia', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  fakeSupa._calls.length = 0;
  const params = { p_pedido_id: 'abc-123', p_lista: [1, 2, 3], p_nulo: null };
  await chamarRpc(sandbox, 'obter_ordem_compra_admin', params);
  const chamada = rpcCalls(fakeSupa)[0];
  assert.equal(chamada.args[0], 'obter_ordem_compra_admin');
  assert.equal(chamada.args[1], params, 'os parâmetros têm de ser o MESMO objeto, sem transformação');
  assert.equal(chamada.args.length, 2, 'o guard não pode acrescentar argumentos');
  // Sem params também tem de funcionar (RPC sem argumentos).
  fakeSupa._calls.length = 0;
  await chamarRpc(sandbox, 'admin_usuarios_last_sign_in', undefined);
  assert.equal(rpcCalls(fakeSupa).length, 1, 'RPC de leitura sem parâmetros tem de passar');
});

test('restricted: RPCs de escrita continuam rejeitadas ANTES do transporte', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  for (const nome of WRITE_RPCS_BLOQUEADAS) {
    fakeSupa._calls.length = 0;
    await assert.rejects(() => chamarRpc(sandbox, nome, { p_x: 1 }), /WRITE-GUARD/,
      nome + ' tem de ser rejeitada em restricted');
    assert.equal(rpcCalls(fakeSupa).length, 0,
      nome + ' alcançou o client Supabase — o guard falhou');
  }
});

test('restricted: os escritores do Planejamento de Compra continuam bloqueados', async () => {
  const PLANEJAMENTO = 'js/screens/pedido-insumos-distribuicao.js';
  const src = fs.readFileSync(path.join(ROOT, PLANEJAMENTO), 'utf8');
  const escritores = [
    'substituir_planejamento_compra_necessidade',
    'aplicar_planejamento_rapido',
    'gerar_ordem_compra_do_planejamento',
  ];
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  for (const nome of escritores) {
    assert.match(src, new RegExp(`callRpc\\(\\s*'${nome}'`),
      `${PLANEJAMENTO} deveria continuar gravando por ${nome}`);
    assert.equal(READ_ONLY_RPCS_ESPERADAS.includes(nome), false,
      nome + ' grava e não pode estar na allowlist');
    fakeSupa._calls.length = 0;
    await assert.rejects(() => chamarRpc(sandbox, nome, { p_x: 1 }), /WRITE-GUARD/,
      nome + ' tem de continuar bloqueada em restricted');
    assert.equal(rpcCalls(fakeSupa).length, 0, nome + ' alcançou o client Supabase');
  }
});

test('restricted: default é NEGAR — nome desconhecido e nome montado dinamicamente caem', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });

  // (a) literal desconhecido
  fakeSupa._calls.length = 0;
  await assert.rejects(() => chamarRpc(sandbox, 'rpc_que_nao_existe', {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);

  // (b) nome montado dinamicamente e AUSENTE da lista — a decisão é por
  // pertinência ao conjunto, não pela forma sintática da chamada.
  fakeSupa._calls.length = 0;
  const montado = 'listar_ordens_compra' + '_admin_v2';
  assert.equal(READ_ONLY_RPCS_ESPERADAS.includes(montado), false);
  await assert.rejects(() => chamarRpc(sandbox, montado, {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);

  // (c) prefixo de uma entrada autorizada NÃO autoriza.
  fakeSupa._calls.length = 0;
  await assert.rejects(() => chamarRpc(sandbox, 'listar_ordens_compra', {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);

  // (d) não-string com toString() de um nome autorizado NÃO passa: a
  // verificação exige `typeof fn === 'string'`.
  fakeSupa._calls.length = 0;
  const impostor = { toString: () => 'listar_ordens_compra_admin' };
  await assert.rejects(() => chamarRpc(sandbox, impostor, {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);
});

test('restricted: insert/update/delete/upsert continuam rejeitados antes do transporte', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  for (const op of ['insert', 'update', 'delete', 'upsert']) {
    fakeSupa._calls.length = 0;
    const qb = vm.runInContext(`supa.from('ordens_compra')`, sandbox);
    await assert.rejects(() => qb[op]({ foo: 'bar' }), /WRITE-GUARD/,
      op + ' tem de continuar bloqueado');
    assert.equal(fakeSupa._calls.filter((c) => c.op === op).length, 0,
      op + ' alcançou o client Supabase');
  }
});

test('restricted: o erro identifica a RPC bloqueada e NÃO expõe os parâmetros', async () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const SEGREDO = 'VALOR-SENSIVEL-NAO-PODE-VAZAR';
  let capturado = null;
  try {
    await chamarRpc(sandbox, 'salvar_pedido_admin', { p_campo_secreto: SEGREDO });
  } catch (e) { capturado = e; }
  assert.ok(capturado, 'a chamada bloqueada tem de rejeitar');
  assert.match(capturado.message, /WRITE-GUARD/);
  assert.match(capturado.message, /salvar_pedido_admin/,
    'a mensagem tem de identificar QUAL RPC foi bloqueada');
  assert.equal(capturado.message.includes(SEGREDO), false,
    'a mensagem não pode expor valores de parâmetro');
  assert.equal(capturado.message.includes('p_campo_secreto'), false,
    'a mensagem não pode expor nomes de parâmetro');
});

test('nenhum consumidor de runtime usa o client BRUTO para contornar o guard', () => {
  const arquivos = [];
  (function walk(dir) {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (nome.endsWith('.js')) arquivos.push(p);
    }
  })(path.join(ROOT, 'js'));
  const OWNER = path.join(ROOT, 'js', 'supabase-client.js');
  const infratores = [];
  for (const p of arquivos) {
    if (p === OWNER) continue; // o dono é quem cria e publica o bruto
    const code = stripComments(fs.readFileSync(p, 'utf8'));
    if (/\b_supaRaw\b/.test(code) || /RAVATEX_SUPABASE_CLIENT\s*\.\s*raw\b/.test(code)) {
      infratores.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  assert.deepEqual(infratores, [],
    'consumidor de runtime alcançando o client bruto — isso contorna o write-guard');
  // E o próprio dono só expõe o bruto; o `supa` publicado é o guardado.
  assert.match(stripComments(supaSrc), /window\.supa\s*=\s*supa\s*;/,
    'window.supa tem de ser o client guardado');
});

test('produção: comportamento ordinário de RPC permanece inalterado', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'inttracker-jade.vercel.app' });
  assert.equal(vm.runInContext('window._WRITES_ENABLED', sandbox), true);
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), false);
  // Em produção não há Proxy: `supa` é o próprio client bruto.
  assert.equal(
    vm.runInContext('window.supa === window._supaRaw', sandbox), true,
    'em produção o client publicado tem de ser o bruto, sem Proxy');
  // Tanto uma RPC da allowlist quanto uma de escrita passam, com os
  // argumentos intactos.
  for (const nome of ['listar_ordens_compra_admin', 'salvar_pedido_admin']) {
    fakeSupa._calls.length = 0;
    const params = { p_pedido_id: 'abc' };
    const res = await chamarRpc(sandbox, nome, params);
    assert.equal(res && res.error, null, nome + ' não pode ser bloqueada em produção');
    const chamadas = rpcCalls(fakeSupa);
    assert.equal(chamadas.length, 1, nome + ' não alcançou o client em produção');
    assert.equal(chamadas[0].args[0], nome);
    assert.equal(chamadas[0].args[1], params);
  }
  // E as escritas por tabela continuam livres.
  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('pedidos')`, sandbox);
  const ins = await qb.insert({ foo: 'bar' });
  assert.equal(ins && ins.error, null, 'insert não pode bloquear em produção');
  assert.equal(fakeSupa._calls.filter((c) => c.op === 'insert').length, 1);
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
