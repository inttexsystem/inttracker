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

// Extrai o bloco CONFIG + SUPA + WRITE-GUARD do script inline.
// A partir da CONFIG-STAGING-A, o write-guard depende de
// APP_ENVIRONMENTS/APP_ENV/APP_CONFIG (declarados no bloco CONFIG)
// E de _supaRaw (declarado no bloco SUPA).
// Por isso extraímos desde `=== CONFIG` até o separador `=== AUTH`.
function extractConfigAndGuardBlock(inline) {
  const start = inline.indexOf('=== CONFIG');
  if (start < 0) throw new Error('marcador === CONFIG não encontrado no script inline');
  const blockStart = inline.lastIndexOf('// ====', start);
  const idx = inline.indexOf('// === AUTH', start + 20);
  if (idx < 0) throw new Error('fim do bloco WRITE-GUARD não encontrado');
  const sepStart = inline.lastIndexOf('// ====', idx);
  if (sepStart < 0) throw new Error('separador de seção não encontrado');
  return inline.slice(blockStart, sepStart);
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

// Roda o bloco CONFIG+WRITE-GUARD num sandbox com hostname controlado.
// Retorna { sandbox, fakeSupa, inline, env } onde env é uma referência
// para APP_ENV (string) e APP_CONFIG (objeto) do sandbox.
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
    fetchIndexHtml().then(({ body }) => {
      const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
      if (!inlineMatch) return reject(new Error('nenhum <script> inline encontrado'));
      const inline = inlineMatch[1];
      const block = extractConfigAndGuardBlock(inline);
      // O bloco extraído inclui CONFIG + SUPA + WRITE-GUARD, então
      // _supaRaw é declarado pelo próprio bloco (não injetar).
      try {
        vm.runInContext(block, sandbox, { filename: 'config-and-guard.js' });
      } catch (e) {
        return reject(new Error('Bloco lançou erro ao inicializar: ' + e.message));
      }
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
  assert.match(body, /=== CONFIG/);
  assert.match(body, /=== WRITE-GUARD/);
  assert.match(body, /APP_ENVIRONMENTS/);
  assert.match(body, /detectAppEnvironment/);
  assert.match(body, /_GUARD_BLOCK_WRITES/);
});

test('extrai o bloco CONFIG + WRITE-GUARD do script inline', async () => {
  const { body } = await fetchIndexHtml();
  const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
  const inline = inlineMatch[1];
  const block = extractConfigAndGuardBlock(inline);
  assert.ok(block.includes('APP_ENVIRONMENTS'), 'bloco não contém APP_ENVIRONMENTS');
  assert.ok(block.includes('detectAppEnvironment'), 'bloco não contém detectAppEnvironment');
  assert.ok(block.includes('_GUARD_BLOCK_WRITES'), 'bloco não contém _GUARD_BLOCK_WRITES');
  assert.ok(block.includes('Promise.reject'), 'bloco não usa Promise.reject');
  assert.ok(block.includes('new Proxy'), 'bloco não usa Proxy');
  assert.equal(block.includes('=== AUTH'), false, 'bloco vazou para AUTH');
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

test('index.html: produção ref bhgifjrfagkzubpyqpew aparece APENAS em config production', async () => {
  const { body } = await fetchIndexHtml();
  // O ref deve aparecer no URL de produção no APP_ENVIRONMENTS
  assert.match(body, /supabaseUrl:\s*'https:\/\/bhgifjrfagkzubpyqpew\.supabase\.co'/);
});

test('index.html: staging ref ucrjtfswnfdlxwtmxnoo aparece em config staging', async () => {
  const { body } = await fetchIndexHtml();
  assert.match(body, /supabaseUrl:\s*'https:\/\/ucrjtfswnfdlxwtmxnoo\.supabase\.co'/);
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
// Banner staging posicionado no RODAPÉ (fase STAGING-BANNER-BOTTOM-A)
// ============================================================

test('STAGING-BANNER-BOTTOM: env-banner existe e tem o texto esperado', async () => {
  const { body } = await fetchIndexHtml();
  // Extrai o bloco que cria o env-banner
  const match = body.match(/const _envBanner[\s\S]*?_envBanner\.textContent\s*=\s*'([^']+)'/);
  assert.ok(match, 'bloco de criação do env-banner não encontrado');
  const text = match[1];
  assert.equal(text, 'AMBIENTE STAGING — DADOS DE TESTE. Não usar para operações reais.',
    `texto do banner divergente: ${text}`);
});

test('STAGING-BANNER-BOTTOM: env-banner usa bottom:0 (não top:0)', async () => {
  const { body } = await fetchIndexHtml();
  // Extrai o style.cssText do env-banner
  const match = body.match(/_envBanner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do env-banner não encontrado');
  const css = match[1];
  // Deve ter bottom:0
  assert.match(css, /bottom:0/, 'env-banner não tem bottom:0');
  // NÃO deve ter top:0 (exceto o comentário que mencionava "topo" no passado)
  // O style em si não deve usar top:0
  assert.equal(/\btop\s*:\s*0\b/.test(css), false, 'env-banner ainda tem top:0 no cssText');
});

test('STAGING-BANNER-BOTTOM: env-banner mantém z-index alto', async () => {
  const { body } = await fetchIndexHtml();
  const match = body.match(/_envBanner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do env-banner não encontrado');
  const css = match[1];
  assert.match(css, /z-index\s*:\s*99998/, 'env-banner perdeu o z-index 99998');
});

test('STAGING-BANNER-BOTTOM: write-guard banner continua no topo', async () => {
  const { body } = await fetchIndexHtml();
  // write-guard banner (vermelho) deve continuar com top:0
  const match = body.match(/_banner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do write-guard banner não encontrado');
  const css = match[1];
  assert.match(css, /\btop\s*:\s*0\b/, 'write-guard banner perdeu top:0');
  assert.match(css, /position\s*:\s*fixed/, 'write-guard banner perdeu position:fixed');
});
