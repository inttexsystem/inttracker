// =====================================================================
// === tests/documents-ingestor-auto-load.test.js ======================
// Testes para o auto-load controlado de documentos mapeados via
// fetch relativo em js/documents-ingestor-auto-load.js.
//
// Fase: RAVATEX-DOCUMENTS-G22-B-DOCUMENTS-AUTO-LOAD-PATCH
//
// Garante:
//   - autoLoadDocuments exposta no namespace RAVATEX_DOCUMENTS
//   - Bloqueio em producao (APP_ENV === 'production')
//   - Bloqueio para nao-admin (CURRENT_USER.tipo !== 'admin')
//   - Fetch de latest.json apenas quando permitido
//   - Skip do JSONL quando hash igual ao armazenado
//   - Carrega JSONL quando hash diferente
//   - Flag RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION setada no sucesso
//   - Erro 404 tratado sem quebrar
//   - Erro JSON invalido tratado
//   - Nao re-executa na mesma sessao (autoLoadDocumentsReset)
//   - Nao referencia Supabase, Google/Drive, Gmail
//   - Nao faz fetch automatico no bootstrap
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// -------------------------------------------------------------------
// Paths
// -------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const DOC_INGESTOR = path.join(ROOT, 'js', 'documents-ingestor.js');
const DOC_LOADER = path.join(ROOT, 'js', 'documents-ingestor-loader.js');
const DOC_AUTO_LOAD = path.join(ROOT, 'js', 'documents-ingestor-auto-load.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const ingestorSrc = readOrFail(DOC_INGESTOR);
const loaderSrc = readOrFail(DOC_LOADER);
const autoLoadSrc = readOrFail(DOC_AUTO_LOAD);
const indexSrc = readOrFail(INDEX);

// JSONL de resposta mockada
const MOCK_JSONL_TEXT = [
  JSON.stringify({ document_id: 'doc-a-1', filename_original: 'NF-001.xml', tipo_documento: 'nf', formato: 'xml', drive_web_view_link: 'https://drive/a' }),
  JSON.stringify({ document_id: 'doc-a-2', filename_original: 'NF-002.pdf', tipo_documento: 'nf', formato: 'pdf', drive_web_view_link: 'https://drive/b' }),
].join('\n');

const MOCK_LATEST_DIFF = { hash: 'abc123def', count: 2, exported_at: '2026-07-09T10:00:00Z' };
const MOCK_LATEST_SAME = { hash: 'stored-hash', count: 2, exported_at: '2026-07-09T10:00:00Z' };
const MOCK_LATEST_NO_HASH = { count: 2, exported_at: '2026-07-09T10:00:00Z' };

// -------------------------------------------------------------------
// Sandbox helpers
// -------------------------------------------------------------------

function makeAutoLoadSandbox(opts) {
  opts = opts || {};

  var fetchCalls = [];
  var localStorageStore = {};

  // Se opts.localStorage for fornecido, usa como base
  if (opts.localStorageContent) {
    localStorageStore[opts.localStorageKey || 'RAVATEX_DOCUMENTS_RECEIVED_METADATA'] = opts.localStorageContent;
  }

  var sandbox = {
    window: {},
    console: {},
    localStorage: {
      getItem: function (key) {
        return localStorageStore[key] || null;
      },
      setItem: function (key, value) {
        localStorageStore[key] = value;
      },
      removeItem: function (key) {
        delete localStorageStore[key];
      },
    },
  };

  // Configura mock fetch
  sandbox.window.fetch = function (url) {
    fetchCalls.push(url);

    var latestResponse = opts.latestResponse;
    if (latestResponse === undefined) latestResponse = MOCK_LATEST_DIFF;
    var jsonlResponse = opts.jsonlResponse;
    if (jsonlResponse === undefined) jsonlResponse = MOCK_JSONL_TEXT;
    var latestStatus = opts.latestStatus;
    if (latestStatus === undefined) latestStatus = 200;
    var jsonlStatus = opts.jsonlStatus;
    if (jsonlStatus === undefined) jsonlStatus = 200;

    if (url.indexOf('latest.json') >= 0) {
      if (latestStatus !== 200) {
        return Promise.resolve({ ok: false, status: latestStatus, json: function () { return Promise.reject(new Error('HTTP ' + latestStatus)); } });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve(typeof latestResponse === 'function' ? latestResponse() : latestResponse); },
      });
    }

    if (url.indexOf('documentos-mapeados.jsonl') >= 0) {
      if (jsonlStatus !== 200) {
        return Promise.resolve({ ok: false, status: jsonlStatus, text: function () { return Promise.resolve(''); } });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: function () { return Promise.resolve(typeof jsonlResponse === 'function' ? jsonlResponse() : jsonlResponse); },
      });
    }

    return Promise.resolve({ ok: false, status: 404, text: function () { return Promise.resolve(''); } });
  };

  // Configura APP_ENV e CURRENT_USER
  sandbox.window.APP_ENV = opts.appEnv !== undefined ? opts.appEnv : 'staging';
  if (opts.currentUser !== undefined) {
    sandbox.window.CURRENT_USER = opts.currentUser;
  } else {
    sandbox.window.CURRENT_USER = { tipo: 'admin' };
  }

  vm.createContext(sandbox);

  // Carrega dependencias
  vm.runInContext(ingestorSrc, sandbox);
  vm.runInContext(loaderSrc, sandbox);
  vm.runInContext(autoLoadSrc, sandbox);

  return {
    sandbox: sandbox,
    ns: sandbox.window.RAVATEX_DOCUMENTS,
    fetchCalls: fetchCalls,
    localStorageStore: localStorageStore,
  };
}

// -------------------------------------------------------------------
// 1. Testes de existencia e sintaxe
// -------------------------------------------------------------------

test('auto-load: arquivo existe', function () {
  assert.ok(fs.existsSync(DOC_AUTO_LOAD), 'js/documents-ingestor-auto-load.js ausente');
});

test('auto-load: sintaxe JS valida', function () {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', DOC_AUTO_LOAD], { stdio: 'pipe' }
  );
});

test('auto-load: expoe autoLoadDocuments no namespace', function () {
  var ctx = makeAutoLoadSandbox();
  assert.equal(typeof ctx.ns.autoLoadDocuments, 'function',
    'autoLoadDocuments ausente');
});

test('auto-load: expoe autoLoadDocumentsReset no namespace', function () {
  var ctx = makeAutoLoadSandbox();
  assert.equal(typeof ctx.ns.autoLoadDocumentsReset, 'function',
    'autoLoadDocumentsReset ausente');
});

// -------------------------------------------------------------------
// 2. Gate: bloqueio em producao
// -------------------------------------------------------------------

test('auto-load: retorna not-allowed em producao', async function () {
  var ctx = makeAutoLoadSandbox({ appEnv: 'production', currentUser: { tipo: 'admin' } });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-allowed');
  assert.equal(ctx.fetchCalls.length, 0, 'nenhum fetch em producao');
});

// -------------------------------------------------------------------
// 3. Gate: bloqueio para nao-admin
// -------------------------------------------------------------------

test('auto-load: retorna not-allowed para cliente', async function () {
  var ctx = makeAutoLoadSandbox({ currentUser: { tipo: 'cliente' } });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-allowed');
});

test('auto-load: retorna not-allowed para fornecedor', async function () {
  var ctx = makeAutoLoadSandbox({ currentUser: { tipo: 'fornecedor' } });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-allowed');
});

test('auto-load: retorna not-allowed sem CURRENT_USER', async function () {
  var ctx = makeAutoLoadSandbox({ currentUser: null });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-allowed');
});

test('auto-load: retorna not-allowed sem fetch', async function () {
  var ctx = makeAutoLoadSandbox({ currentUser: { tipo: 'admin' } });
  delete ctx.sandbox.window.fetch;
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-allowed');
});

// -------------------------------------------------------------------
// 4. Fetch de latest.json (admin em staging)
// -------------------------------------------------------------------

test('auto-load: fetch de latest.json', async function () {
  var ctx = makeAutoLoadSandbox();
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.hash, 'abc123def');
  assert.equal(ctx.fetchCalls.length, 2, 'dois fetches: latest + JSONL');
  assert.ok(ctx.fetchCalls[0].indexOf('latest.json') >= 0, 'primeiro fetch = latest.json');
  assert.ok(ctx.fetchCalls[1].indexOf('documentos-mapeados.jsonl') >= 0, 'segundo fetch = JSONL');
});

// -------------------------------------------------------------------
// 5. Skip JSONL se hash igual ao armazenado
// -------------------------------------------------------------------

test('auto-load: skip JSONL se hash igual', async function () {
  var storedMeta = JSON.stringify({ importedAt: '2026-07-09T09:00:00Z', hash: 'stored-hash', count: 2 });
  var ctx = makeAutoLoadSandbox({
    latestResponse: MOCK_LATEST_SAME,
    localStorageContent: storedMeta,
  });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.hash, 'stored-hash');
  assert.equal(ctx.fetchCalls.length, 1, 'apenas 1 fetch: latest.json');
  assert.ok(ctx.fetchCalls[0].indexOf('latest.json') >= 0);
});

// -------------------------------------------------------------------
// 6. Erro no latest.json
// -------------------------------------------------------------------

test('auto-load: erro 404 no latest.json', async function () {
  var ctx = makeAutoLoadSandbox({ latestStatus: 404 });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('404') >= 0, 'erro deve conter 404: ' + result.error);
  assert.equal(ctx.fetchCalls.length, 1, 'apenas 1 fetch: latest.json');
});

test('auto-load: latest.json sem campo hash', async function () {
  var ctx = makeAutoLoadSandbox({ latestResponse: MOCK_LATEST_NO_HASH });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('hash') >= 0, 'erro deve mencionar hash: ' + result.error);
});

test('auto-load: latest.json invalido (nao-JSON)', async function () {
  var ctx = makeAutoLoadSandbox({
    latestResponse: function () { throw new Error('JSON parse error'); },
  });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string');
});

// -------------------------------------------------------------------
// 7. Erro no documentos-mapeados.jsonl
// -------------------------------------------------------------------

test('auto-load: erro 404 no JSONL', async function () {
  var ctx = makeAutoLoadSandbox({ jsonlStatus: 404 });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('404') >= 0, 'erro deve conter 404: ' + result.error);
  assert.equal(ctx.fetchCalls.length, 2, 'dois fetches: latest + JSONL');
});

test('auto-load: JSONL vazio', async function () {
  var ctx = makeAutoLoadSandbox({ jsonlResponse: '' });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('vazio') >= 0, 'erro deve mencionar vazio: ' + result.error);
});

test('auto-load: JSONL com dados invalidos (sem document_id)', async function () {
  var badJsonl = JSON.stringify({ filename_original: 'sem-id.xml' }) + '\n';
  var ctx = makeAutoLoadSandbox({ jsonlResponse: badJsonl });
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, false);
  assert.ok(typeof result.error === 'string');
});

// -------------------------------------------------------------------
// 8. Nao re-executa na mesma sessao
// -------------------------------------------------------------------

test('auto-load: nao re-executa na mesma sessao', async function () {
  var ctx = makeAutoLoadSandbox();
  var result1 = await ctx.ns.autoLoadDocuments();
  assert.equal(result1.ok, true);

  var callsAfterFirst = ctx.fetchCalls.length;
  var result2 = await ctx.ns.autoLoadDocuments();
  assert.equal(result2.ok, false);
  assert.equal(result2.reason, 'already-loaded');
  assert.equal(ctx.fetchCalls.length, callsAfterFirst, 'sem novos fetches na segunda chamada');
});

test('auto-load: reset permite re-executar', async function () {
  var ctx = makeAutoLoadSandbox({
    latestResponse: MOCK_LATEST_DIFF,
  });
  var result1 = await ctx.ns.autoLoadDocuments();
  assert.equal(result1.ok, true);

  ctx.ns.autoLoadDocumentsReset();
  ctx.fetchCalls.length = 0;

  var result2 = await ctx.ns.autoLoadDocuments();
  assert.equal(result2.ok, true);
  assert.ok(ctx.fetchCalls.length >= 1, 'novos fetches apos reset');
});

// -------------------------------------------------------------------
// 9. Flag RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION
// -------------------------------------------------------------------

test('auto-load: seta flag de sessao no sucesso', async function () {
  var ctx = makeAutoLoadSandbox();
  assert.equal(ctx.sandbox.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION, undefined, 'flag nao existe antes');
  await ctx.ns.autoLoadDocuments();
  assert.equal(ctx.sandbox.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION, true, 'flag setada apos sucesso');
});

test('auto-load: NAO seta flag em caso de erro', async function () {
  var ctx = makeAutoLoadSandbox({ latestStatus: 404 });
  await ctx.ns.autoLoadDocuments();
  assert.equal(ctx.sandbox.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION, undefined, 'flag nao setada');
});

test('auto-load: flag NAO setada no skip', async function () {
  var storedMeta = JSON.stringify({ importedAt: '2026-07-09T09:00:00Z', hash: 'stored-hash', count: 2 });
  var ctx = makeAutoLoadSandbox({
    latestResponse: MOCK_LATEST_SAME,
    localStorageContent: storedMeta,
  });
  await ctx.ns.autoLoadDocuments();
  assert.equal(ctx.sandbox.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION, undefined, 'flag nao setada no skip');
});

// -------------------------------------------------------------------
// 10. Seguranca: sem Supabase, Drive, Gmail
// -------------------------------------------------------------------

test('auto-load: NAO referencia Supabase', function () {
  assert.equal(autoLoadSrc.indexOf('supabase'), -1, 'referencia supabase');
  assert.equal(autoLoadSrc.indexOf('window.supa'), -1, 'referencia window.supa');
});

test('auto-load: NAO referencia Google/Drive', function () {
  assert.equal(autoLoadSrc.indexOf('googleapis'), -1, 'referencia googleapis');
  assert.equal(autoLoadSrc.indexOf('google-auth'), -1, 'referencia google-auth');
});

test('auto-load: NAO referencia Gmail/Google API', function () {
  assert.equal(autoLoadSrc.indexOf('gmail-'), -1, 'nome gmail- no codigo');
  assert.equal(autoLoadSrc.indexOf('googleapis'), -1, 'referencia googleapis');
  assert.equal(autoLoadSrc.indexOf('google-auth'), -1, 'referencia google-auth');
});

// -------------------------------------------------------------------
// 11. Nao faz fetch automatico no bootstrap
// -------------------------------------------------------------------

test('auto-load: nao faz fetch automatico no bootstrap', function () {
  var iifeBody = autoLoadSrc.substring(autoLoadSrc.indexOf('(function (window) {'));
  var outsideFunctions = iifeBody.replace(/function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/g, '');
  assert.equal(outsideFunctions.indexOf('fetch('), -1, 'sem fetch no bootstrap');
});

// -------------------------------------------------------------------
// 12. index.html carrega auto-load na ordem correta
// -------------------------------------------------------------------

test('index.html: documents-ingestor-auto-load.js EXATAMENTE UMA VEZ', function () {
  var matches = indexSrc.match(/js\/documents-ingestor-auto-load\.js/g) || [];
  assert.equal(matches.length, 1, 'auto-load carregado ' + matches.length + ' vez(es)');
});

test('index.html: auto-load apos loader e antes do import', function () {
  var idxLoader = indexSrc.indexOf('js/documents-ingestor-loader.js');
  var idxAutoLoad = indexSrc.indexOf('js/documents-ingestor-auto-load.js');
  var idxImportReceived = indexSrc.indexOf('js/documents-ingestor-import-received.js');
  assert.ok(idxLoader > 0, 'loader ausente');
  assert.ok(idxAutoLoad > 0, 'auto-load ausente');
  assert.ok(idxImportReceived > 0, 'import-received ausente');
  assert.ok(idxLoader < idxAutoLoad, 'loader antes do auto-load');
  assert.ok(idxAutoLoad < idxImportReceived, 'auto-load antes do import-received');
});

// -------------------------------------------------------------------
// 13. Metadata salva apos auto-load
// -------------------------------------------------------------------

test('auto-load: salva metadata no localStorage apos sucesso', async function () {
  var ctx = makeAutoLoadSandbox();
  await ctx.ns.autoLoadDocuments();
  var raw = ctx.localStorageStore['RAVATEX_DOCUMENTS_RECEIVED_METADATA'];
  assert.ok(raw, 'metadata salva no localStorage');
  var meta = JSON.parse(raw);
  assert.equal(meta.fileName, 'documentos-mapeados.jsonl');
  assert.equal(meta.count, 2);
  assert.equal(meta.hash, 'abc123def');
  assert.ok(typeof meta.importedAt === 'string', 'importedAt presente');
  assert.equal(meta.statusCounts.pending, 2, '2 docs pendentes');
});

test('auto-load: seta window.RAVATEX_DOCUMENTS_RECEIVED_METADATA', async function () {
  var ctx = makeAutoLoadSandbox();
  await ctx.ns.autoLoadDocuments();
  var meta = ctx.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
  assert.ok(meta, 'metadata no window');
  assert.equal(meta.hash, 'abc123def');
});

test('auto-load: NAO salva metadata no skip', async function () {
  var storedMeta = JSON.stringify({ importedAt: '2026-07-09T09:00:00Z', hash: 'stored-hash', count: 2 });
  var ctx = makeAutoLoadSandbox({
    latestResponse: MOCK_LATEST_SAME,
    localStorageContent: storedMeta,
  });
  await ctx.ns.autoLoadDocuments();
  var raw = ctx.localStorageStore['RAVATEX_DOCUMENTS_RECEIVED_METADATA'];
  assert.equal(raw, storedMeta, 'metadata nao alterada no skip');
});

test('auto-load: tolera localStorage indisponivel', async function () {
  var ctx = makeAutoLoadSandbox();
  delete ctx.sandbox.localStorage;
  var result = await ctx.ns.autoLoadDocuments();
  assert.equal(result.ok, true, 'auto-load OK mesmo sem localStorage');
  assert.equal(result.count, 2);
});

// -------------------------------------------------------------------
// 14. Popula RAVATEX_DOCUMENTS_RECEIVED
// -------------------------------------------------------------------

test('auto-load: popula RAVATEX_DOCUMENTS_RECEIVED', async function () {
  var ctx = makeAutoLoadSandbox();
  await ctx.ns.autoLoadDocuments();
  var received = ctx.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.ok(Array.isArray(received));
  assert.equal(received.length, 2);
  assert.equal(received[0].document_id, 'doc-a-1');
  assert.equal(received[1].document_id, 'doc-a-2');
});

test('auto-load: NAO toca RAVATEX_DOCUMENTS_LOADED_EVENTS', async function () {
  var ctx = makeAutoLoadSandbox();
  ctx.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS = [{ event_type: 'legacy', pedido_manual: 'PED-01', document: { document_id: 'old' } }];
  await ctx.ns.autoLoadDocuments();
  var legacy = ctx.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.equal(legacy.length, 1, 'estado legado preservado');
  assert.equal(legacy[0].event_type, 'legacy');
});
