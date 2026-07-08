// =====================================================================
// === tests/documents-ingestor-loader.test.js ==========================
// Testes para o loader local/manual do Documents Ingestor em
// js/documents-ingestor-loader.js.
//
// Fase: RAVATEX-TAPETES-G11-D-DOCUMENTS-LOCAL-LOADER
// Escopo: valida funcoes de carga, seguranca e integracao com o
//   view model do Pedido Detail.
//
// Garante:
//   - loadDocumentsIngestorEventsFromText popula a global com JSONL
//   - loadDocumentsIngestorEventsFromUrl com mock fetch
//   - setDocumentsIngestorEvents com array direto
//   - deduplicacao via parser existente
//   - falha controlada em JSON invalido/vazio
//   - nao chama Supabase
//   - nao chama Google/Drive
//   - view model renderiza docs apos loader popular a global
//   - sem regressao nos testes G11-B/G11-C
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
const FIXTURE = path.join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl');

const DETAIL_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const documentsIngestorSrc = readOrFail(DOC_INGESTOR);
const documentsLoaderSrc = readOrFail(DOC_LOADER);
const fixtureText = readOrFail(FIXTURE);
const detailProgressSrc = readOrFail(DETAIL_PROGRESS);

// -------------------------------------------------------------------
// Sandbox helpers
// -------------------------------------------------------------------

function makeLoaderSandbox(opts) {
  opts = opts || {};
  var sandbox = { window: {}, console: {} };
  if (opts.mockFetch !== undefined) {
    sandbox.window.fetch = opts.mockFetch;
  }
  vm.createContext(sandbox);
  vm.runInContext(documentsIngestorSrc, sandbox);
  vm.runInContext(documentsLoaderSrc, sandbox);
  return sandbox;
}

// -------------------------------------------------------------------
// 1. Testes de existencia e sintaxe
// -------------------------------------------------------------------

test('documents-ingestor-loader.js: arquivo existe', function () {
  assert.ok(fs.existsSync(DOC_LOADER), 'js/documents-ingestor-loader.js ausente');
});

test('documents-ingestor-loader.js: sintaxe JS valida', function () {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', DOC_LOADER], { stdio: 'pipe' }
  );
});

test('documents-ingestor-loader.js: expoe funcoes no namespace RAVATEX_DOCUMENTS', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(typeof ns.loadDocumentsIngestorEventsFromText, 'function',
    'loadDocumentsIngestorEventsFromText ausente');
  assert.equal(typeof ns.loadDocumentsIngestorEventsFromUrl, 'function',
    'loadDocumentsIngestorEventsFromUrl ausente');
  assert.equal(typeof ns.setDocumentsIngestorEvents, 'function',
    'setDocumentsIngestorEvents ausente');
});

// -------------------------------------------------------------------
// 2. Testes: loadDocumentsIngestorEventsFromText
// -------------------------------------------------------------------

test('loader: loadDocumentsIngestorEventsFromText com fixture valida', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadDocumentsIngestorEventsFromText(fixtureText);
  assert.equal(result.ok, true);
  assert.equal(result.count, 7, '7 eventos apos deduplicacao');
  var events = sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(events));
  assert.equal(events.length, 7);
});

test('loader: loadDocumentsIngestorEventsFromText texto vazio', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadDocumentsIngestorEventsFromText('');
  assert.equal(result.ok, false);
  assert.equal(result.count, 0);
  assert.ok(typeof result.error === 'string');
});

test('loader: loadDocumentsIngestorEventsFromText com null/undefined', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(ns.loadDocumentsIngestorEventsFromText(null).ok, false);
  assert.equal(ns.loadDocumentsIngestorEventsFromText(undefined).ok, false);
});

test('loader: loadDocumentsIngestorEventsFromText com JSON malformado', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadDocumentsIngestorEventsFromText('isto nao e json');
  assert.equal(result.ok, false);
});

test('loader: loadDocumentsIngestorEventsFromText com linha malformada misturada', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  // Linhas validas + uma linha invalida no meio
  var text = fixtureText + '\n{nao e json}';
  var result = ns.loadDocumentsIngestorEventsFromText(text);
  assert.equal(result.ok, true);
  assert.equal(result.count, 7, 'linha malformada ignorada, 7 eventos validos');
});

test('loader: loadDocumentsIngestorEventsFromText deduplica eventos', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  // Texto com primeiro evento duplicado
  var lines = fixtureText.split('\n').filter(function (l) { return l.trim(); });
  var duplicatedText = lines[0] + '\n' + lines[0] + '\n' + fixtureText;
  var result = ns.loadDocumentsIngestorEventsFromText(duplicatedText);
  assert.equal(result.ok, true);
  // fixture tem 7 eventos unicos; duplicar o primeiro nao aumenta
  assert.equal(result.count, 7, 'duplicata deve ser removida');
});

test('loader: loadDocumentsIngestorEventsFromText apenas linhas vazias', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadDocumentsIngestorEventsFromText('\n  \n\n');
  assert.equal(result.ok, false);
});

test('loader: loadDocumentsIngestorEventsFromText excede limite MAX_EVENTS', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var lines = [];
  for (var i = 0; i < 2001; i++) {
    lines.push('{"schema_version":2,"event_type":"document.detected","event_id":"ev' + i + '","ingestion_event_id":"ingevt-' + i + '","created_at":"2026-07-07T12:00:00.000Z","pedido_manual":"PED-25-2026","source":"gmail","document":{"document_id":"doc' + i + '","tipo_documento":"nf","formato":"xml","filename_original":"test' + i + '.xml","sha256":"1111111111111111111111111111111111111111111111111111111111111111","storage_backend":"google_drive","drive_web_view_link":"https://drive.google.com/file/d/test' + i + '"}}');
  }
  var result = ns.loadDocumentsIngestorEventsFromText(lines.join('\n'));
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Excedeu') >= 0 || result.error.indexOf('limite') >= 0);
});

// -------------------------------------------------------------------
// 3. Testes: setDocumentsIngestorEvents
// -------------------------------------------------------------------

test('loader: setDocumentsIngestorEvents com array valido', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var events = ns.parseDocumentEventsJsonl(fixtureText);
  var result = ns.setDocumentsIngestorEvents(events);
  assert.equal(result.ok, true);
  assert.equal(result.count, 7);
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7);
});

test('loader: setDocumentsIngestorEvents com array vazio', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.setDocumentsIngestorEvents([]);
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 0);
});

test('loader: setDocumentsIngestorEvents com entrada invalida', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(ns.setDocumentsIngestorEvents(null).ok, false);
  assert.equal(ns.setDocumentsIngestorEvents('string').ok, false);
  assert.equal(ns.setDocumentsIngestorEvents(42).ok, false);
});

test('loader: setDocumentsIngestorEvents com evento invalido no array', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.setDocumentsIngestorEvents([{ not: 'valid' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('invalido') >= 0 || result.error.indexOf('falta') >= 0);
});

test('loader: setDocumentsIngestorEvents deduplica automaticamente', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var events = ns.parseDocumentEventsJsonl(fixtureText);
  var duplicated = events.concat(events.slice(0, 2));
  var result = ns.setDocumentsIngestorEvents(duplicated);
  assert.equal(result.ok, true);
  assert.equal(result.count, 7, 'duplicatas removidas pelo dedup');
});

// -------------------------------------------------------------------
// 4. Testes: loadDocumentsIngestorEventsFromUrl
// -------------------------------------------------------------------

test('loader: loadDocumentsIngestorEventsFromUrl com fetch mockado (sucesso)', async function () {
  var calledUrl = null;
  var sandbox = makeLoaderSandbox({
    mockFetch: function (url) {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        text: function () { return Promise.resolve(fixtureText); },
      });
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('/fake/fixture.jsonl');
  assert.equal(result.ok, true);
  assert.equal(result.count, 7);
  assert.equal(calledUrl, '/fake/fixture.jsonl');
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7);
});

test('loader: loadDocumentsIngestorEventsFromUrl com URL vazia', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('');
  assert.equal(result.ok, false);
});

test('loader: loadDocumentsIngestorEventsFromUrl com fetch retornando erro HTTP', async function () {
  var sandbox = makeLoaderSandbox({
    mockFetch: function () {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: function () { return Promise.resolve(''); },
      });
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('/nao-existe.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('404') >= 0, 'erro deve conter status 404, mas contem: ' + result.error);
});

test('loader: loadDocumentsIngestorEventsFromUrl com fetch lancando erro', async function () {
  var sandbox = makeLoaderSandbox({
    mockFetch: function () {
      return Promise.reject(new Error('Network down'));
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('/error.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Network down') >= 0);
});

test('loader: loadDocumentsIngestorEventsFromUrl sem fetch disponivel', async function () {
  var sandbox = makeLoaderSandbox();
  if (sandbox.window.fetch) {
    delete sandbox.window.fetch;
  }
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('/test.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('fetch') >= 0);
});

// -------------------------------------------------------------------
// 5. Testes de garantia (seguranca)
// -------------------------------------------------------------------

test('loader: nao referencia Supabase', function () {
  var src = readOrFail(DOC_LOADER);
  assert.ok(src.indexOf('supabase') === -1, 'loader referencia supabase');
  assert.ok(src.indexOf('window.supa') === -1, 'loader referencia window.supa');
});

test('loader: nao referencia Google/Drive', function () {
  var src = readOrFail(DOC_LOADER);
  assert.ok(src.indexOf('googleapis') === -1, 'loader referencia googleapis');
  assert.ok(src.indexOf('google-auth') === -1, 'loader referencia google-auth');
});

test('loader: nao faz fetch automatico no bootstrap', function () {
  var src = readOrFail(DOC_LOADER);
  // O codigo IIFE nao pode conter chamada a fetch fora de funcao
  var iifeBody = src.substring(src.indexOf('(function (window) {'));
  var outsideFunctions = iifeBody.replace(/function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/g, '');
  assert.ok(outsideFunctions.indexOf('fetch(') === -1,
    'loader nao pode chamar fetch no bootstrap');
});

test('loader: nao persiste em localStorage/sessionStorage', function () {
  var src = readOrFail(DOC_LOADER);
  assert.ok(src.indexOf('localStorage') === -1, 'loader referencia localStorage');
  assert.ok(src.indexOf('sessionStorage') === -1, 'loader referencia sessionStorage');
});

// -------------------------------------------------------------------
// 6. Testes de integracao com Pedido Detail
// -------------------------------------------------------------------

test('loader-integracao: view model renderiza docs apos loader popular a global', function () {
  // Carrega ingestor + loader + progress + render no mesmo sandbox
  var sandbox = { window: {}, console: {} };
  sandbox.window.el = function (tag, attrs) {
    var children = [];
    for (var i = 2; i < arguments.length; i++) {
      if (arguments[i] === null || arguments[i] === undefined) continue;
      children.push(arguments[i]);
    }
    return {
      tag: tag,
      attrs: attrs || {},
      children: children,
      textContent: children.filter(function (c) { return typeof c === 'string'; }).join(''),
      appendChild: function (child) {
        if (child === null || child === undefined) return;
        children.push(child);
        this.children = children;
      },
    };
  };

  var opDisplaySrc = readOrFail(path.join(ROOT, 'js', 'op-display.js'));
  var chainStateSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js'));
  var screenSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js'));
  var detailDataSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js'));
  var detailEventsSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js'));
  var detailRenderSrc = readOrFail(DETAIL_RENDER);

  vm.createContext(sandbox);

  // Carrega ingestor e loader
  vm.runInContext(documentsIngestorSrc, sandbox);
  vm.runInContext(documentsLoaderSrc, sandbox);

  // Popula a global via loader
  sandbox.window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(fixtureText);

  // Carrega o bundle do Pedido Detail
  var bundle = [opDisplaySrc, chainStateSrc, screenSrc, detailDataSrc, detailProgressSrc, detailEventsSrc, detailRenderSrc].join('\n\n');
  vm.runInContext(bundle, sandbox);

  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var s = ns.createInitialState();
  s.pedido = { id: 'ped-test-25', numero: 25, status: 'recebido', metros_total: 0 };
  s.pedido.criado_em = '2026-01-15T10:00:00.000Z';
  s.itens = [];
  s.ops = [];
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.expedicoes = [];
  s.expedicaoItens = [];
  s.modelosById = {};
  s.coresById = {};

  var view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocsLoaded, true, 'ingestorDocsLoaded deve ser true apos loader');
  assert.equal(view.ingestorDocumentRows.length, 3, '3 documentos consolidados');
  assert.equal(view.ingestorTimeline.length, 7, '7 eventos na timeline');
});

test('loader-integracao: view model sem loader nao quebra', function () {
  // sem carregar o loader — apenas ingestor + progress
  var sandbox = { window: {}, console: {} };
  vm.createContext(sandbox);
  vm.runInContext(documentsIngestorSrc, sandbox);

  var opDisplaySrc = readOrFail(path.join(ROOT, 'js', 'op-display.js'));
  var chainStateSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js'));
  var screenSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js'));
  var detailDataSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js'));
  var detailEventsSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js'));
  var detailRenderSrc = readOrFail(DETAIL_RENDER);

  var bundle = [opDisplaySrc, chainStateSrc, screenSrc, detailDataSrc, detailProgressSrc, detailEventsSrc, detailRenderSrc].join('\n\n');
  vm.runInContext(bundle, sandbox);

  var ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
  var s = ns.createInitialState();
  s.pedido = { id: 'p1', numero: 1, status: 'recebido', metros_total: 0 };
  s.itens = [];
  s.ops = [];
  s.entregaItens = [];
  s.entregasById = {};
  s.opLatexEntregas = [];
  s.expedicoes = [];
  s.expedicaoItens = [];
  s.modelosById = {};
  s.coresById = {};

  var view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocsLoaded, false, 'sem loader, ingestorDocsLoaded deve ser false');
  assert.equal(view.ingestorDocumentRows.length, 0, 'sem loader, 0 documentos');
  assert.equal(view.ingestorTimeline.length, 0, 'sem loader, timeline vazia');
});

// -------------------------------------------------------------------
// 7. Teste de regressao: index.html carrega scripts na ordem correta
// -------------------------------------------------------------------

test('index.html: documents-ingestor.js carregado depois de ui.js', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxUi = index.indexOf('js/ui.js');
  var idxIngestor = index.indexOf('js/documents-ingestor.js');
  assert.ok(idxIngestor > 0, 'documents-ingestor.js deve estar no index.html');
  assert.ok(idxIngestor > idxUi, 'documents-ingestor.js deve vir depois de ui.js');
});

test('index.html: documents-ingestor-loader.js carregado depois do ingestor', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxIngestor = index.indexOf('js/documents-ingestor.js');
  var idxLoader = index.indexOf('js/documents-ingestor-loader.js');
  assert.ok(idxLoader > 0, 'documents-ingestor-loader.js deve estar no index.html');
  assert.ok(idxLoader > idxIngestor, 'loader deve vir depois do ingestor');
});

test('index.html: documents-ingestor.js carregado antes de pedido-detail.js', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxIngestor = index.indexOf('js/documents-ingestor.js');
  var idxDetail = index.indexOf('js/screens/pedido-detail.js');
  assert.ok(idxIngestor < idxDetail, 'documents-ingestor.js deve vir antes de pedido-detail.js');
});

test('index.html: documents-ingestor.js EXATAMENTE UMA VEZ', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var matches = index.match(/js\/documents-ingestor\.js/g) || [];
  assert.equal(matches.length, 1, 'documents-ingestor.js carregado ' + matches.length + ' vez(es)');
});

test('index.html: documents-ingestor-loader.js EXATAMENTE UMA VEZ', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var matches = index.match(/js\/documents-ingestor-loader\.js/g) || [];
  assert.equal(matches.length, 1, 'documents-ingestor-loader.js carregado ' + matches.length + ' vez(es)');
});
