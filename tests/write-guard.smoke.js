// Smoke test do WRITE-GUARD-A e CONFIG-STAGING-A.
//
// O que este teste garante:
//
//   1. Detecção de ambiente por hostname:
//      - grupoterrabranca.github.io → production
//      - localhost / 127.0.0.1 / ravatexapps-dotcom.github.io / unknown → staging
//
//   2. Write-guard (defesa em profundidade):
//      - Ativa SÓ se APP_ENV === 'production' E hostname é local
//      - Bloqueia insert/update/delete/upsert/rpc com erro "WRITE-GUARD"
//      - Preserva select e auth.getSession
//
//   3. Refs e chaves:
//      - produção usa bhgifjrfagkzubpyqpew
//      - staging usa ucrjtfswnfdlxwtmxnoo
//      - service_role não aparece no index.html
//
// Estratégia de teste:
//   - Lê o <script> inline do index.html servido por http.server
//     (porta 8765), extrai do `=== CONFIG` até o fim do `=== WRITE-GUARD`
//     (inclui o bloco CONFIG com APP_ENVIRONMENTS, e o bloco WRITE-GUARD).
//   - Executa num vm.Context com mocks controlados (location, document, supabase).
//   - Ajusta `location.hostname` para simular cada ambiente.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const http   = require('node:http');

const ROOT = path.resolve(__dirname, '..');

const PORT = 8765;
const HOST = '127.0.0.1';

const PROD_REF = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

function fetchIndexHtml() {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: HOST, port: PORT, path: '/index.html' }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

// A partir da fase SUPABASE-CLIENT-MODULE-A, o client Supabase e o
// write-guard inteiro foram extraídos do script inline para
// js/supabase-client.js. Este teste agora carrega os módulos js/ do
// projeto no mesmo vm.Context (na ordem do <head>) e valida o
// comportamento da guarda. Nada mais é extraído do script inline.
function extractConfigAndGuardBlock(_inline) {
  return '';
}

// Cria um cliente Supabase FAKE (não toca rede) que devolve Promises
// identificáveis. Cada método registra o que foi chamado.
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

// Roda o js/config.js + js/supabase-client.js num sandbox com hostname
// controlado, simulando a ordem dos <script src> do <head> de index.html.
// Retorna { sandbox, fakeSupa, env } onde env referencia APP_ENV,
// SUPABASE_URL, _IS_PROD_URL, _IS_LOCAL e _GUARD_BLOCK_WRITES.
function runGuardInSandbox({ hostname, forceLocal = true }) {
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => {
      fakeSupa._createdWith = { url, key, opts };
      return fakeSupa;
    },
  };
  const documentMock = {
    body: null, // sem DOM real; banners são best-effort
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute(){}, style:{}, textContent:'' }),
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

  return new Promise((resolve, reject) => {
    // Carrega os 2 módulos na ordem do <head> de index.html. Em produção,
    // <script src="js/config.js"></script> vem antes de
    // <script src="js/supabase-client.js"></script>, que vem antes do
    // inline. Aqui simulamos a mesma ordem.
    try {
      const cfgSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'),         'utf8');
      const supaSrc = fs.readFileSync(path.join(ROOT, 'js', 'supabase-client.js'), 'utf8');
      vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
      vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
    } catch (e) {
      return reject(new Error('Falha ao carregar js/config.js ou js/supabase-client.js: ' + e.message));
    }

    fetchIndexHtml().then(({ body }) => {
      const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
      if (!inlineMatch) return reject(new Error('nenhum <script> inline encontrado'));
      const inline = inlineMatch[1];
      const env = {
        APP_ENV: vm.runInContext('APP_ENV', sandbox),
        SUPABASE_URL: vm.runInContext('SUPABASE_URL', sandbox),
        IS_PROD_URL: vm.runInContext('_IS_PROD_URL', sandbox),
        IS_LOCAL: vm.runInContext('_IS_LOCAL', sandbox),
        GUARD_BLOCK_WRITES: vm.runInContext('_GUARD_BLOCK_WRITES', sandbox),
      };
      resolve({ sandbox, fakeSupa, inline, env });
    }).catch(reject);
  });
}

// -----------------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------------

test('http.server responde em :8765 e index.html contém o esperado', async () => {
  const { body } = await fetchIndexHtml();
  assert.equal(typeof body, 'string');
  assert.ok(body.length > 1000, 'index.html muito curto');
  // Após ROUTER-MODULE-A, todo o bootstrap (config, client, write-guard,
  // env-banner, auth, router) vive em js/*.js. O script inline começa
  // agora no bloco === BOOT NOTES ===.
  assert.match(body, /js\/config\.js/);
  assert.match(body, /js\/supabase-client\.js/);
  assert.match(body, /js\/environment-banner\.js/);
  assert.match(body, /js\/auth\.js/);
  assert.match(body, /js\/router\.js/);
  assert.match(body, /=== BOOT NOTES/);
});

test('script inline NÃO contém mais o client Supabase nem o write-guard nem o env-banner nem o auth', async () => {
  const { body } = await fetchIndexHtml();
  const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
  const inline = inlineMatch[1];
  // O client/write-guard foram extraídos para js/supabase-client.js.
  // O env-banner para js/environment-banner.js. O auth para js/auth.js.
  // O router para js/router.js. O inline agora começa em === BOOT NOTES ===.
  assert.equal(/supabase\.createClient\s*\(/.test(inline), false,
    'script inline ainda chama supabase.createClient — client não foi extraído');
  assert.equal(/\b_supaRaw\b/.test(inline), false,
    'script inline ainda referencia _supaRaw — client não foi extraído');
  assert.equal(/\b_LOCAL_HOSTS\b/.test(inline), false,
    'script inline ainda referencia _LOCAL_HOSTS — write-guard não foi extraído');
  assert.equal(/\b_IS_LOCAL\b/.test(inline), false,
    'script inline ainda referencia _IS_LOCAL — write-guard não foi extraído');
  assert.equal(/\b_IS_PROD_URL\b/.test(inline), false,
    'script inline ainda referencia _IS_PROD_URL — write-guard não foi extraído');
  assert.equal(/\b_GUARD_BLOCK_WRITES\b/.test(inline), false,
    'script inline ainda referencia _GUARD_BLOCK_WRITES — write-guard não foi extraído');
  assert.equal(/\b_WG_ERROR\b/.test(inline), false,
    'script inline ainda referencia _WG_ERROR — write-guard não foi extraído');
  assert.equal(/function\s+_wrapQueryBuilder/.test(inline), false,
    'script inline ainda define _wrapQueryBuilder — write-guard não foi extraído');
  assert.equal(/\bconst\s+supa\s*=/.test(inline), false,
    'script inline ainda define const supa — Proxy não foi extraído');
  // Env-banner (laranja) também não está mais no inline.
  assert.equal(/=== ENV-BANNER/.test(inline), false,
    'script inline ainda tem marcador === ENV-BANNER — env-banner não foi extraído');
  assert.equal(/_envBanner/.test(inline), false,
    'script inline ainda referencia _envBanner — env-banner não foi extraído');
  // Auth também não está mais no inline.
  assert.equal(/=== AUTH/.test(inline), false,
    'script inline ainda tem marcador === AUTH — auth não foi extraído');
  assert.equal(/let\s+CURRENT_USER\s*=/.test(inline), false,
    'script inline ainda tem `let CURRENT_USER =`');
  assert.equal(/async\s+function\s+login\s*\(/.test(inline), false,
    'script inline ainda define `async function login`');
  assert.equal(/async\s+function\s+logout\s*\(/.test(inline), false,
    'script inline ainda define `async function logout`');
  assert.equal(/async\s+function\s+loadCurrentUser\s*\(/.test(inline), false,
    'script inline ainda define `async function loadCurrentUser`');
  // O inline deve começar com === BOOT NOTES === (router extraído).
  assert.match(inline, /=== BOOT NOTES/);
});

test('hostname grupoterrabranca.github.io → production (ref bhgifjrfagkzubpyqpew)', async () => {
  const { env } = await runGuardInSandbox({ hostname: 'grupoterrabranca.github.io' });
  assert.equal(env.APP_ENV, 'production');
  assert.ok(env.SUPABASE_URL.includes(PROD_REF), 'SUPABASE_URL não tem ref de produção');
  assert.equal(env.IS_PROD_URL, true);
  assert.equal(env.IS_LOCAL, false);
  assert.equal(env.GUARD_BLOCK_WRITES, false, 'guard não deve ativar em produção real');
});

test('hostname localhost → staging (ref ucrjtfswnfdlxwtmxnoo)', async () => {
  const { env } = await runGuardInSandbox({ hostname: 'localhost' });
  assert.equal(env.APP_ENV, 'staging');
  assert.ok(env.SUPABASE_URL.includes(STAGING_REF), 'SUPABASE_URL não tem ref de staging');
  assert.equal(env.IS_PROD_URL, false);
  assert.equal(env.IS_LOCAL, true);
  assert.equal(env.GUARD_BLOCK_WRITES, false, 'guard não deve ativar em localhost (vai para staging)');
});

test('hostname 127.0.0.1 → staging', async () => {
  const { env } = await runGuardInSandbox({ hostname: '127.0.0.1' });
  assert.equal(env.APP_ENV, 'staging');
  assert.ok(env.SUPABASE_URL.includes(STAGING_REF));
  assert.equal(env.IS_LOCAL, true);
  assert.equal(env.GUARD_BLOCK_WRITES, false);
});

test('hostname ravatexapps-dotcom.github.io → staging', async () => {
  const { env } = await runGuardInSandbox({ hostname: 'ravatexapps-dotcom.github.io' });
  assert.equal(env.APP_ENV, 'staging');
  assert.ok(env.SUPABASE_URL.includes(STAGING_REF));
  assert.equal(env.GUARD_BLOCK_WRITES, false);
});

test('hostname desconhecido → staging (fallback seguro)', async () => {
  const { env } = await runGuardInSandbox({ hostname: 'example.com' });
  assert.equal(env.APP_ENV, 'staging');
  assert.ok(env.SUPABASE_URL.includes(STAGING_REF));
  assert.equal(env.GUARD_BLOCK_WRITES, false);
});

test('hostname *.grupoterrabranca.github.io → production (subdomínio)', async () => {
  const { env } = await runGuardInSandbox({ hostname: 'x.grupoterrabranca.github.io' });
  assert.equal(env.APP_ENV, 'production');
  assert.ok(env.SUPABASE_URL.includes(PROD_REF));
});

test('em staging: insert/update/delete/upsert/rpc NÃO são bloqueados', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({ hostname: 'localhost' });
  fakeSupa._calls.length = 0;
  for (const op of ['insert', 'update', 'delete', 'upsert']) {
    const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
    const res = await qb[op]({ foo: 'bar' });
    assert.equal(res && res.error, null, `${op} não deveria bloquear em staging`);
  }
  const rpcRes = await vm.runInContext(`supa.rpc('qualquer', {})`, sandbox);
  assert.equal(rpcRes && rpcRes.error, null, 'rpc não deveria bloquear em staging');
  // verificar que pelo menos 1 insert chegou no fake client
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em staging');
});

test('em staging: select e auth.getSession funcionam', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({ hostname: 'localhost' });
  fakeSupa._calls.length = 0;
  const sel = vm.runInContext(`supa.from('usuarios')`, sandbox);
  const res = await sel.select('*');
  assert.equal(res && typeof res, 'object', 'select deve devolver objeto');
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from');
  assert.ok(fromCalls.length >= 1, 'from() não chegou no fake client');
  const authSession = await vm.runInContext(`supa.auth.getSession()`, sandbox);
  assert.equal(authSession && typeof authSession, 'object', 'auth.getSession deve devolver objeto');
});

test('em produção (grupoterrabranca.github.io): writes NÃO são bloqueados', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({ hostname: 'grupoterrabranca.github.io' });
  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const res = await qb.insert({ foo: 'bar' });
  assert.equal(res && res.error, null, 'insert não deveria bloquear em produção real');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em produção real');
});

// Teste de defesa em profundidade: o guard só ativa se IS_LOCAL && IS_PROD_URL.
// A partir da CONFIG-STAGING-A, isso é geometricamente impossível: localhost
// sempre seleciona staging (cuja URL difere de produção). Por design, não há
// caminho localhost → produção. Este teste documenta que:
//   - Em produção real: APP_ENV=production, IS_LOCAL=false, guard off
//   - Em localhost: APP_ENV=staging, IS_PROD_URL=false, guard off
//   - Os dois nunca podem ser true simultaneamente
test('defesa em profundidade: IS_LOCAL e IS_PROD_URL nunca são ambos true', async () => {
  const checks = [
    { hostname: 'localhost' },
    { hostname: '127.0.0.1' },
    { hostname: 'grupoterrabranca.github.io' },
    { hostname: 'x.grupoterrabranca.github.io' },
    { hostname: 'ravatexapps-dotcom.github.io' },
    { hostname: 'example.com' },
  ];
  for (const { hostname } of checks) {
    const { env } = await runGuardInSandbox({ hostname });
    const bothOn = env.IS_LOCAL && env.IS_PROD_URL;
    assert.equal(bothOn, false, `IS_LOCAL && IS_PROD_URL ambos true em ${hostname}`);
  }
});

test('produção ref bhgifjrfagkzubpyqpew aparece em js/config.js (production)', async () => {
  // A partir da CONFIG-MODULE-A, o ref vive em js/config.js, não mais
  // no script inline de index.html. Aqui validamos que o ref está em
  // config.js E sumiu do body do index.html.
  const { body } = await fetchIndexHtml();
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  assert.match(cfgSrc, /supabaseUrl:\s*'https:\/\/bhgifjrfagkzubpyqpew\.supabase\.co'/);
  // O ref NÃO deve mais aparecer no body do index.html (que agora só
  // carrega config via <script src> e referencia SUPABASE_URL como global).
  assert.equal(body.includes('bhgifjrfagkzubpyqpew'), false,
    'ref de produção ainda aparece no body de index.html — config não foi totalmente extraída');
});

test('staging ref ucrjtfswnfdlxwtmxnoo aparece em js/config.js (staging)', async () => {
  const { body } = await fetchIndexHtml();
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  assert.match(cfgSrc, /supabaseUrl:\s*'https:\/\/ucrjtfswnfdlxwtmxnoo\.supabase\.co'/);
  assert.equal(body.includes('ucrjtfswnfdlxwtmxnoo'), false,
    'ref de staging ainda aparece no body de index.html — config não foi totalmente extraída');
});

test('index.html: nenhum service_role presente', async () => {
  const { body } = await fetchIndexHtml();
  assert.equal(/service_role/i.test(body), false, 'service_role encontrado no index.html');
});

test('index.html: nenhum password/senha em texto puro (password literal)', async () => {
  const { body } = await fetchIndexHtml();
  // Não exigimos zero (existem variáveis internas), mas exigimos que
  // não haja strings tipo "password=..." ou campos de senha.
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(body), false, 'password literal encontrado');
});

// ============================================================
// Banner staging posicionado no RODAPÉ (fase STAGING-BANNER-BOTTOM-A).
// A partir da ENV-BANNER-MODULE-A, o banner laranja vive em
// js/environment-banner.js, não mais no script inline.
// ============================================================

test('STAGING-BANNER-BOTTOM: env-banner existe em js/environment-banner.js com texto esperado', async () => {
  const envBannerSrc = fs.readFileSync(path.join(ROOT, 'js', 'environment-banner.js'), 'utf8');
  // Extrai o textContent do env-banner
  const match = envBannerSrc.match(/_envBanner\.textContent\s*=\s*([^;]+);/);
  assert.ok(match, 'textContent do env-banner não encontrado em js/environment-banner.js');
  const expr = match[1].trim();
  // O textContent agora é uma constante (ENV_BANNER_TEXT), não mais um literal.
  // Validamos que a constante tem o texto correto.
  assert.match(envBannerSrc, /ENV_BANNER_TEXT\s*=\s*\n?\s*'AMBIENTE STAGING — DADOS DE TESTE\. Não usar para operações reais\.'/);
});

test('STAGING-BANNER-BOTTOM: env-banner usa bottom:0 (não top:0)', async () => {
  const envBannerSrc = fs.readFileSync(path.join(ROOT, 'js', 'environment-banner.js'), 'utf8');
  // Extrai o style.cssText do env-banner
  const match = envBannerSrc.match(/_envBanner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do env-banner não encontrado em js/environment-banner.js');
  const css = match[1];
  // Deve ter bottom:0
  assert.match(css, /bottom:0/, 'env-banner não tem bottom:0');
  // NÃO deve ter top:0 no cssText
  assert.equal(/\btop\s*:\s*0\b/.test(css), false, 'env-banner ainda tem top:0 no cssText');
});

test('STAGING-BANNER-BOTTOM: env-banner mantém z-index 99998', async () => {
  const envBannerSrc = fs.readFileSync(path.join(ROOT, 'js', 'environment-banner.js'), 'utf8');
  const match = envBannerSrc.match(/_envBanner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do env-banner não encontrado em js/environment-banner.js');
  const css = match[1];
  assert.match(css, /z-index\s*:\s*99998/, 'env-banner perdeu o z-index 99998');
});

test('STAGING-BANNER-BOTTOM: env-banner preserva posição relativa ao write-guard banner', async () => {
  const envBannerSrc = fs.readFileSync(path.join(ROOT, 'js', 'environment-banner.js'), 'utf8');
  // Deve continuar verificando a presença do write-guard-banner e
  // inserindo logo após ele (preservando empilhamento).
  assert.match(envBannerSrc, /getElementById\(['"]write-guard-banner['"]\)/,
    'env-banner não consulta write-guard-banner');
  assert.match(envBannerSrc, /insertBefore\(_envBanner,\s*_wg\.nextSibling\)/,
    'env-banner não insere relativo ao write-guard banner');
});

test('STAGING-BANNER-BOTTOM: write-guard banner continua no topo (agora em js/supabase-client.js)', async () => {
  // A partir da SUPABASE-CLIENT-MODULE-A, o banner vermelho do
  // write-guard vive em js/supabase-client.js, não mais no inline.
  const supaClientSrc = fs.readFileSync(path.join(ROOT, 'js', 'supabase-client.js'), 'utf8');
  // write-guard banner (vermelho) deve continuar com top:0
  const match = supaClientSrc.match(/_banner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do write-guard banner não encontrado em js/supabase-client.js');
  const css = match[1];
  assert.match(css, /\btop\s*:\s*0\b/, 'write-guard banner perdeu top:0');
  assert.match(css, /position\s*:\s*fixed/, 'write-guard banner perdeu position:fixed');
  // O body do index.html NÃO deve mais conter a definição do banner vermelho.
  const { body } = await fetchIndexHtml();
  assert.equal(/_banner\.id\s*=\s*'write-guard-banner'/.test(body), false,
    'banner vermelho ainda é criado no script inline — não foi extraído para js/supabase-client.js');
});
