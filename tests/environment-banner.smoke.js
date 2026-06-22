// Smoke test do módulo js/environment-banner.js (ENV-BANNER-MODULE-A).
//
// Garante que a extração do banner laranja de staging do script inline
// de index.html para js/environment-banner.js preservou o comportamento
// visual exato:
//
//   1. arquivo existe, é script clássico (não ES module);
//   2. index.html carrega js/config.js → js/supabase-client.js →
//      js/environment-banner.js antes do script inline;
//   3. script inline NÃO contém mais o bloco env-banner;
//   4. window.RAVATEX_ENV_BANNER é criado no runtime simulado;
//   5. staging cria #env-banner;
//   6. production NÃO cria #env-banner;
//   7. texto do banner é preservado exatamente;
//   8. estilo do banner usa bottom:0, não top:0;
//   9. z-index 99998;
//  10. posição relativa ao write-guard banner preservada;
//  11. banner vermelho write-guard continua em js/supabase-client.js;
//  12. APP_ENV e SUPABASE_URL continuam vindos de js/config.js;
//  13. supa continua vindo de js/supabase-client.js;
//  14. service_role e password literal NÃO aparecem;
//  15. refs produção/staging preservados.

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
const ENV   = path.join(ROOT, 'js', 'environment-banner.js');

const PROD_REF    = 'bhgifjrfagkzubpyqpew';
const STAGING_REF = 'ucrjtfswnfdlxwtmxnoo';

const cfgSrc   = fs.readFileSync(CFG, 'utf8');
const supaSrc  = fs.readFileSync(SUPA, 'utf8');
const envSrc   = fs.readFileSync(ENV, 'utf8');
const indexSrc = fs.readFileSync(INDEX, 'utf8');

// -----------------------------------------------------------------------------
// Helpers estáticos
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}"\\s*><\\/script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
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
// Helpers runtime
// -----------------------------------------------------------------------------

// Cria um DOM mock com `body` real e rastreamento de elementos criados.
function makeDomMock({ withWriteGuardBanner = false } = {}) {
  const created = [];
  const body = {
    tagName: 'BODY',
    children: [],
    appendChild(n) { this.children.push(n); created.push(n); return n; },
    prepend(n) { this.children.unshift(n); created.push(n); return n; },
    insertBefore(n, ref) {
      const i = this.children.indexOf(ref);
      if (i < 0) { this.children.push(n); }
      else { this.children.splice(i, 0, n); }
      created.push(n);
      return n;
    },
  };
  const elementsById = {};
  if (withWriteGuardBanner) {
    const wg = {
      id: 'write-guard-banner',
      tagName: 'DIV',
      style: {},
      textContent: 'WRITES BLOQUEADOS',
      _parent: body,
    };
    Object.defineProperty(wg, 'parentNode', { get: () => wg._parent });
    body.children.push(wg);
    elementsById['write-guard-banner'] = wg;
  }
  const document = {
    body,
    createElement: (t) => {
      const el = {
        id: '',
        tagName: String(t).toUpperCase(),
        style: { cssText: '' },
        _attrs: {},
        _text: null,
        setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; if (k === 'role') this._role = v; if (k === 'id') this.id = v; },
        get textContent() { return this._text == null ? '' : this._text; },
        set textContent(v) { this._text = v; },
      };
      // Quando `id` for atribuído diretamente, indexar no elementsById
      // para que getElementById() funcione.
      let _id = '';
      Object.defineProperty(el, 'id', {
        get() { return _id; },
        set(v) { _id = String(v); if (_id) elementsById[_id] = el; },
        configurable: true,
        enumerable: true,
      });
      created.push(el);
      return el;
    },
    getElementById: (id) => elementsById[id] || null,
  };
  return { document, body, elementsById, created };
}

// Faz um client Supabase FAKE que devolve Promises.
function makeFakeSupabase() {
  const qb = () => {
    const b = {
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      eq: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    return b;
  };
  return {
    createClient: (url, key) => ({
      from: () => qb(),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      _url: url, _key: key,
    }),
  };
}

// Carrega config.js + supabase-client.js + environment-banner.js num
// vm.Context com hostname e opções controladas. Se `forceProduction` for
// true, sobrescreve APP_ENV para 'production' antes de carregar o módulo.
function runSandbox({ hostname, forceProduction = false, withWriteGuardBanner = false, body: externalBody } = {}) {
  const { document, body, created } = makeDomMock({ withWriteGuardBanner });
  const fakeSupabase = makeFakeSupabase();
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    document,
    supabase: fakeSupabase,
    Promise, Reflect, Proxy, Set,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  if (forceProduction) {
    vm.runInContext('APP_ENV = "production";', sandbox, { filename: 'force-prod.js' });
  }
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  vm.runInContext(envSrc,  sandbox, { filename: 'js/environment-banner.js' });

  return { sandbox, document, body, created };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('js/environment-banner.js existe e é script clássico', () => {
  assert.ok(fs.existsSync(ENV), 'js/environment-banner.js não existe');
  assert.equal(/^\s*export\s+/m.test(envSrc), false,
    'js/environment-banner.js parece usar export — deve ser script clássico');
});

test('js/environment-banner.js tem sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${ENV}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('index.html carrega js/environment-banner.js EXATAMENTE UMA VEZ no <head>', () => {
  const re = /<script\s+src="js\/environment-banner\.js"\s*><\/script>/g;
  const matches = indexSrc.match(re) || [];
  assert.equal(matches.length, 1,
    `esperado 1 <script src="js/environment-banner.js">, encontrado ${matches.length}`);
});

test('index.html: ordem dos scripts: config → supabase-client → environment-banner → inline', () => {
  const cfgIdx   = findScriptIdx(indexSrc, 'js/config.js');
  const supaIdx  = findScriptIdx(indexSrc, 'js/supabase-client.js');
  const envIdx   = findScriptIdx(indexSrc, 'js/environment-banner.js');
  const inlineIdx = firstInlineScriptIndex(indexSrc);
  assert.ok(cfgIdx   > 0, 'js/config.js não encontrado');
  assert.ok(supaIdx  > 0, 'js/supabase-client.js não encontrado');
  assert.ok(envIdx   > 0, 'js/environment-banner.js não encontrado');
  assert.ok(inlineIdx > 0, 'tag inline não encontrada');
  assert.ok(cfgIdx < supaIdx,  'config deve vir antes de supabase-client');
  assert.ok(supaIdx < envIdx,  'supabase-client deve vir antes de environment-banner');
  assert.ok(envIdx < inlineIdx, 'environment-banner deve vir antes do inline');
});

test('script inline NÃO contém mais o env-banner (extraído para js/environment-banner.js)', () => {
  const inline = extractInlineScript(indexSrc);
  assert.equal(/=== ENV-BANNER/.test(inline), false,
    'script inline ainda tem marcador === ENV-BANNER');
  assert.equal(/_envBanner/.test(inline), false,
    'script inline ainda referencia _envBanner');
  assert.equal(/AMBIENTE STAGING — DADOS DE TESTE/.test(inline), false,
    'script inline ainda tem texto do env-banner');
  // O inline agora começa em === ROUTER === (auth e env-banner foram
  // extraídos em fases anteriores).
  assert.match(inline, /=== ROUTER/);
  // Garantia adicional via stripComments: nenhum identificador do
  // env-banner sobrevive à remoção de comentários.
  const noComments = stripComments(inline);
  assert.equal(/=== ENV-BANNER/.test(noComments), false);
  assert.equal(/_envBanner/.test(noComments), false);
  assert.equal(/AMBIENTE STAGING/.test(noComments), false);
});

test('js/environment-banner.js: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(envSrc), false,
    'service_role encontrado em js/environment-banner.js');
});

test('js/environment-banner.js: nenhum password literal', () => {
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(envSrc), false,
    'password literal encontrado em js/environment-banner.js');
});

test('index.html: nenhum service_role presente', () => {
  assert.equal(/service_role/i.test(indexSrc), false,
    'service_role encontrado em index.html');
});

test('index.html: nenhum password literal', () => {
  assert.equal(/password\s*[:=]\s*['"][^'"]+['"]/i.test(indexSrc), false,
    'password literal encontrado em index.html');
});

test('js/environment-banner.js: produção ref aparece em APP_CONFIG (via config.js)', () => {
  // O módulo depende de js/config.js para APP_ENV/APP_CONFIG, então
  // a presença dos refs em js/config.js já é testada em tests/config.smoke.js.
  // Aqui só validamos que o módulo NÃO embute refs próprios.
  assert.equal(envSrc.includes(PROD_REF), false,
    'js/environment-banner.js embute ref de produção — deve usar js/config.js');
  assert.equal(envSrc.includes(STAGING_REF), false,
    'js/environment-banner.js embute ref de staging — deve usar js/config.js');
  assert.equal(envSrc.includes('supabase.co'), false,
    'js/environment-banner.js embute URL do Supabase');
});

// -----------------------------------------------------------------------------
// 2. Validação visual do banner
// -----------------------------------------------------------------------------

test('js/environment-banner.js: banner laranja usa bottom:0 e position:fixed', () => {
  // O cssText é montado em concatenação de strings; o primeiro chunk já
  // contém position/top/z-index. A cor laranja está em outro chunk.
  const match = envSrc.match(/_envBanner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do env-banner não encontrado');
  const css = match[1];
  assert.match(css, /\bbottom\s*:\s*0\b/, 'env-banner não tem bottom:0');
  assert.match(css, /position\s*:\s*fixed/, 'env-banner não tem position:fixed');
  assert.match(css, /z-index\s*:\s*99998/, 'env-banner perdeu z-index 99998');
  // Cor laranja está no segundo chunk da concatenação: valida no source
  // inteiro (não só no cssText do primeiro chunk).
  assert.match(envSrc, /background\s*:\s*#f59e0b/, 'env-banner perdeu cor laranja #f59e0b');
  // NÃO deve ter top:0 no cssText
  assert.equal(/\btop\s*:\s*0\b/.test(css), false, 'env-banner ainda tem top:0 no cssText');
});

test('js/environment-banner.js: id, role e texto do banner preservados', () => {
  // O id é atribuído via constante (ENV_BANNER_ID = 'env-banner'), não
  // literal inline. Validamos ambas as formas.
  assert.match(envSrc, /ENV_BANNER_ID\s*=\s*['"]env-banner['"]/);
  assert.match(envSrc, /_envBanner\.id\s*=\s*ENV_BANNER_ID/);
  assert.match(envSrc, /_envBanner\.setAttribute\(['"]role['"]\s*,\s*['"]status['"]\)/);
  assert.match(envSrc, /_envBanner\.textContent\s*=\s*ENV_BANNER_TEXT/);
  assert.match(envSrc, /ENV_BANNER_TEXT\s*=\s*\n?\s*'AMBIENTE STAGING — DADOS DE TESTE\. Não usar para operações reais\.'/);
});

test('js/environment-banner.js: posição relativa ao write-guard banner preservada', () => {
  // Deve continuar verificando a presença do write-guard-banner e
  // inserindo logo após ele.
  assert.match(envSrc, /getElementById\(['"]write-guard-banner['"]\)/,
    'env-banner não consulta write-guard-banner');
  assert.match(envSrc, /insertBefore\(_envBanner,\s*_wg\.nextSibling\)/,
    'env-banner não insere relativo ao write-guard banner');
});

// -----------------------------------------------------------------------------
// 3. Validação de runtime
// -----------------------------------------------------------------------------

test('runtime: window.RAVATEX_ENV_BANNER é criado', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const ns = vm.runInContext('window.RAVATEX_ENV_BANNER', sandbox);
  assert.ok(ns && typeof ns === 'object', 'RAVATEX_ENV_BANNER não é objeto');
  assert.equal(typeof ns.ensureEnvironmentBanner, 'function');
  assert.equal(ns.ENV_BANNER_ID, 'env-banner');
  assert.equal(typeof ns.ENV_BANNER_TEXT, 'string');
  assert.match(ns.ENV_BANNER_TEXT, /AMBIENTE STAGING — DADOS DE TESTE/);
});

test('runtime staging: cria #env-banner quando APP_ENV !== production', () => {
  const { document, body } = runSandbox({ hostname: 'localhost' });
  const banner = document.getElementById('env-banner');
  assert.ok(banner, '#env-banner não foi criado em staging');
  assert.equal(banner.tagName, 'DIV');
  assert.equal(banner.getAttribute && banner.getAttribute('role') || banner._role, 'status');
  assert.match(banner.textContent, /AMBIENTE STAGING — DADOS DE TESTE/);
  // Está no body
  assert.ok(body.children.includes(banner) || body.children.some(c => c._id === 'env-banner'),
    'env-banner não foi inserido no body');
});

test('runtime produção: NÃO cria #env-banner quando APP_ENV === production', () => {
  const { document, body } = runSandbox({ hostname: 'grupoterrabranca.github.io', forceProduction: true });
  const banner = document.getElementById('env-banner');
  assert.equal(banner, null, '#env-banner não deveria existir em produção');
});

test('runtime produção: ensureEnvironmentBanner retorna null', () => {
  const { sandbox } = runSandbox({ hostname: 'grupoterrabranca.github.io', forceProduction: true });
  const result = vm.runInContext('window.RAVATEX_ENV_BANNER.ensureEnvironmentBanner()', sandbox);
  assert.equal(result, null,
    'ensureEnvironmentBanner deveria retornar null em produção');
});

test('runtime staging: ensureEnvironmentBanner retorna o nó criado', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const result = vm.runInContext('window.RAVATEX_ENV_BANNER.ensureEnvironmentBanner()', sandbox);
  assert.ok(result, 'ensureEnvironmentBanner deveria retornar o nó em staging');
  assert.equal(result.id, 'env-banner');
});

test('runtime: env-banner é inserido relativo ao write-guard banner (sem sobrescrever)', () => {
  const { document, body, created } = runSandbox({
    hostname: '127.0.0.1',
    withWriteGuardBanner: true,
  });
  // O write-guard banner só aparece se o guard ativar, mas o teste
  // está apenas validando o caminho "se existir, inserir relativo".
  // Para o 127.0.0.1 + staging, o guard não ativa, então o write-guard
  // banner não existe por padrão. Aqui, com withWriteGuardBanner, ele
  // existe artificialmente para validar a lógica de inserção.
  const wg = document.getElementById('write-guard-banner');
  const env = document.getElementById('env-banner');
  assert.ok(wg, 'pré-condição: write-guard banner deve existir no mock');
  assert.ok(env, 'env-banner deve existir');
  // O env-banner deve estar IMEDIATAMENTE após o write-guard no array
  // de children do body (insertBefore com nextSibling).
  const wgIdx = body.children.indexOf(wg);
  const envIdx = body.children.indexOf(env);
  assert.equal(envIdx, wgIdx + 1,
    `env-banner deveria estar em idx ${wgIdx + 1}, mas está em ${envIdx}`);
});

// -----------------------------------------------------------------------------
// 4. Banner vermelho write-guard continua em js/supabase-client.js
// -----------------------------------------------------------------------------

test('js/supabase-client.js: banner vermelho (write-guard) continua usando top:0', () => {
  const match = supaSrc.match(/_banner\.style\.cssText\s*=\s*'([^']+)'/);
  assert.ok(match, 'cssText do write-guard banner não encontrado em js/supabase-client.js');
  const css = match[1];
  assert.match(css, /\btop\s*:\s*0\b/, 'write-guard banner perdeu top:0');
  assert.match(css, /position\s*:\s*fixed/);
  assert.match(css, /z-index\s*:\s*99999/, 'write-guard banner perdeu z-index 99999');
});

test('js/supabase-client.js: banner vermelho texto correto', () => {
  const match = supaSrc.match(/_banner\.textContent\s*=\s*'([^']+)'/);
  assert.ok(match, 'textContent do banner vermelho não encontrado');
  assert.match(match[1], /LOCAL APONTANDO PARA PRODUÇÃO/);
  assert.match(match[1], /WRITES BLOQUEADOS/);
});

// -----------------------------------------------------------------------------
// 5. Integração: roteiriza ordem completa e presença de scripts externos
// -----------------------------------------------------------------------------

test('http.server: index.html servido contém js/environment-banner.js antes do inline', (t, done) => {
  const srv = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexSrc);
    } else if (req.url === '/js/config.js' || req.url === '/js/supabase-client.js' || req.url === '/js/environment-banner.js') {
      const file = req.url === '/js/config.js' ? cfgSrc
        : req.url === '/js/supabase-client.js' ? supaSrc
        : envSrc;
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
          const cfgIdx   = body.indexOf('js/config.js');
          const supaIdx  = body.indexOf('js/supabase-client.js');
          const envIdx   = body.indexOf('js/environment-banner.js');
          const inlineIdx = body.indexOf('<script>');
          assert.ok(cfgIdx   > 0, 'js/config.js não encontrado');
          assert.ok(supaIdx  > 0, 'js/supabase-client.js não encontrado');
          assert.ok(envIdx   > 0, 'js/environment-banner.js não encontrado');
          assert.ok(inlineIdx > 0, 'tag inline não encontrada');
          assert.ok(cfgIdx < supaIdx, 'config deve vir antes de supabase-client');
          assert.ok(supaIdx < envIdx, 'supabase-client deve vir antes de environment-banner');
          assert.ok(envIdx < inlineIdx, 'environment-banner deve vir antes do inline');
          srv.close();
          done();
        } catch (e) { srv.close(); done(e); }
      });
    }).on('error', (e) => { srv.close(); done(e); });
  });
});
