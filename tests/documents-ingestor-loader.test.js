// =====================================================================
// === tests/documents-ingestor-loader.test.js ==========================
// Testes para o loader local/manual do Documents Ingestor em
// js/documents-ingestor-loader.js.
//
// Fase: RAVATEX-TAPETES-G11-D-DOCUMENTS-LOCAL-LOADER
//       + G12-F2-MAPPED-DOCUMENTS-CONSUMER-PATCH
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
//   - G12-F2: loadReceivedDocumentsFromText preserva campos extras
//     de documentos-mapeados.jsonl em RAVATEX_DOCUMENTS_RECEIVED
//   - G12-F2: loadReceivedDocumentsFromText aceita formato antigo
//     documentos-recebidos.jsonl (regressao)
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
// 4b. Testes: seguranca de URL — bloqueios
// -------------------------------------------------------------------

test('loader-url-guard: bloqueia URL externa https', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('https://evil.example/events.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('URLs absolutas') >= 0 || result.error.indexOf('://') >= 0);
});

test('loader-url-guard: bloqueia URL externa http', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('http://192.168.1.1:8080/data.jsonl');
  assert.equal(result.ok, false);
});

test('loader-url-guard: bloqueia file://', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('file:///etc/passwd');
  assert.equal(result.ok, false);
});

test('loader-url-guard: bloqueia javascript:', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('javascript:alert(1)');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Esquema de URL bloqueado') >= 0);
});

test('loader-url-guard: bloqueia data:', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('data:text/html,<script>alert(1)</script>');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Esquema de URL bloqueado') >= 0);
});

test('loader-url-guard: bloqueia blob:', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('blob:https://example.com/uuid');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Esquema de URL bloqueado') >= 0);
});

test('loader-url-guard: bloqueia path traversal ../', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('../etc/secrets.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Path traversal') >= 0);
});

test('loader-url-guard: bloqueia path traversal ..\\ (Windows)', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('..\\windows\\system32\\config.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Path traversal') >= 0);
});

test('loader-url-guard: permite caminho relativo /data/fixtures/', async function () {
  var sandbox = makeLoaderSandbox({
    mockFetch: function () {
      return Promise.resolve({
        ok: true,
        text: function () { return Promise.resolve(fixtureText); },
      });
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('/data/fixtures/document-events-sample.jsonl');
  assert.equal(result.ok, true);
  assert.equal(result.count, 7);
});

test('loader-url-guard: permite caminho relativo sem leading slash', async function () {
  var sandbox = makeLoaderSandbox({
    mockFetch: function () {
      return Promise.resolve({
        ok: true,
        text: function () { return Promise.resolve(fixtureText); },
      });
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('data/fixtures/document-events-sample.jsonl');
  assert.equal(result.ok, true);
  assert.equal(result.count, 7);
});

test('loader-url-guard: bloqueia protocolo relativo //evil.example', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadDocumentsIngestorEventsFromUrl('//evil.example/events.jsonl');
  assert.equal(result.ok, false);
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

// =====================================================================
// Bloco G12-G1: received documents parser/loader
// Formato flat (sem wrapper document{}, sem event_type).
// Estado separado: window.RAVATEX_DOCUMENTS_RECEIVED.
// NAO toca window.RAVATEX_DOCUMENTS_LOADED_EVENTS (Pedido Detail).
// =====================================================================

const RECEIVED_JSONL = [
  JSON.stringify({
    document_id: 'doc-rcv-1',
    gmail_message_id: 'msg-1',
    filename_original: 'NF-001.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-1',
    drive_web_view_link: 'https://drive.google.com/file/d/1/view',
    created_at: '2026-07-07T12:00:00.000Z',
  }),
  JSON.stringify({
    document_id: 'doc-rcv-2',
    gmail_message_id: 'msg-2',
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    direcao_nf: null,
    created_at: '2026-07-07T12:10:00.000Z',
  }),
  JSON.stringify({
    document_id: 'doc-rcv-3',
    gmail_message_id: 'msg-3',
    filename_original: 'NF-002.pdf',
    tipo_documento: 'nf',
    formato: 'pdf',
    direcao_nf: 'saida',
    created_at: '2026-07-07T12:20:00.000Z',
  }),
].join('\n');

test('received-loader: expoe 3 funcoes no namespace', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(typeof ns.loadReceivedDocumentsFromText, 'function',
    'loadReceivedDocumentsFromText ausente');
  assert.equal(typeof ns.loadReceivedDocumentsFromUrl, 'function',
    'loadReceivedDocumentsFromUrl ausente');
  assert.equal(typeof ns.setReceivedDocuments, 'function',
    'setReceivedDocuments ausente');
});

test('received-loader: loadReceivedDocumentsFromText popula RAVATEX_DOCUMENTS_RECEIVED', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadReceivedDocumentsFromText(RECEIVED_JSONL);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, '3 documentos apos dedup');
  var received = sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.ok(Array.isArray(received));
  assert.equal(received.length, 3);
  assert.equal(received[0].document_id, 'doc-rcv-1');
  assert.equal(received[0].filename_original, 'NF-001.xml');
  assert.equal(received[2].tipo_documento, 'nf');
});

test('received-loader: loadReceivedDocumentsFromText NAO sobrescreve RAVATEX_DOCUMENTS_LOADED_EVENTS', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;

  // Pre-popula o estado do Pedido Detail (legado)
  var events = ns.parseDocumentEventsJsonl(fixtureText);
  ns.loadDocumentsIngestorEventsFromText(fixtureText);
  var legacyBefore = sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(legacyBefore));
  assert.equal(legacyBefore.length, 7, 'estado legado deve ter 7 eventos');
  var sampleEvent = legacyBefore[0];

  // Carrega received em seguida
  ns.loadReceivedDocumentsFromText(RECEIVED_JSONL);

  var legacyAfter = sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(legacyAfter));
  assert.equal(legacyAfter.length, 7, 'estado legado NAO pode mudar de tamanho');
  assert.strictEqual(legacyAfter[0], sampleEvent, 'estado legado NAO pode ser sobrescrito');
  assert.notStrictEqual(legacyAfter, sandbox.window.RAVATEX_DOCUMENTS_RECEIVED,
    'devem ser referencias distintas');
});

test('received-loader: loadReceivedDocumentsFromText texto vazio falha', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(ns.loadReceivedDocumentsFromText('').ok, false);
  assert.equal(ns.loadReceivedDocumentsFromText(null).ok, false);
  assert.equal(ns.loadReceivedDocumentsFromText(undefined).ok, false);
});

test('received-loader: loadReceivedDocumentsFromText com JSON malformado', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadReceivedDocumentsFromText('isto nao e json');
  assert.equal(result.ok, false);
});

test('received-loader: loadReceivedDocumentsFromText deduplica por document_id', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var doc = JSON.parse(RECEIVED_JSONL.split('\n')[0]);
  var duplicated = JSON.stringify(doc) + '\n' + RECEIVED_JSONL;
  var result = ns.loadReceivedDocumentsFromText(duplicated);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, 'duplicata removida');
});

test('received-loader: loadReceivedDocumentsFromText linha sem document_id rejeitada', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var valid = JSON.stringify({ document_id: 'd-1' });
  var invalid = JSON.stringify({ filename_original: 'sem id' });
  var text = valid + '\n' + invalid;
  var result = ns.loadReceivedDocumentsFromText(text);
  assert.equal(result.ok, true);
  assert.equal(result.count, 1, 'apenas 1 doc com document_id');
});

test('received-loader: setReceivedDocuments com array valido', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var docs = [
    { document_id: 'a', filename_original: 'a.xml' },
    { document_id: 'b', filename_original: 'b.pdf' },
  ];
  var result = ns.setReceivedDocuments(docs);
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 2);
});

test('received-loader: setReceivedDocuments com array vazio', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.setReceivedDocuments([]);
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.ok(Array.isArray(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED));
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 0);
});

test('received-loader: setReceivedDocuments com entrada invalida', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  assert.equal(ns.setReceivedDocuments(null).ok, false);
  assert.equal(ns.setReceivedDocuments('string').ok, false);
  assert.equal(ns.setReceivedDocuments(42).ok, false);
});

test('received-loader: setReceivedDocuments com doc invalido falha', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.setReceivedDocuments([{ not: 'valid' }]);
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('invalido') >= 0 || result.error.indexOf('document_id') >= 0);
});

test('received-loader: setReceivedDocuments deduplica automaticamente', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var docs = ns.parseReceivedDocumentsJsonl(RECEIVED_JSONL);
  var duplicated = docs.concat(docs);
  var result = ns.setReceivedDocuments(duplicated);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, 'duplicatas removidas pelo dedup');
});

test('received-loader: loadReceivedDocumentsFromUrl com fetch mockado (sucesso)', async function () {
  var sandbox = makeLoaderSandbox({
    mockFetch: function (url) {
      return Promise.resolve({
        ok: true,
        text: function () { return Promise.resolve(RECEIVED_JSONL); },
      });
    },
  });
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('/fake/documentos-recebidos.jsonl');
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3);
});

test('received-loader: loadReceivedDocumentsFromUrl respeita URL guard (https)', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('https://evil.example/data.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('URLs absolutas') >= 0 || result.error.indexOf('://') >= 0);
});

test('received-loader: loadReceivedDocumentsFromUrl bloqueia javascript:', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('javascript:alert(1)');
  assert.equal(result.ok, false);
});

test('received-loader: loadReceivedDocumentsFromUrl bloqueia path traversal', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('../etc/secrets.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('Path traversal') >= 0);
});

test('received-loader: loadReceivedDocumentsFromUrl sem fetch retorna erro', async function () {
  var sandbox = makeLoaderSandbox();
  if (sandbox.window.fetch) delete sandbox.window.fetch;
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('/test.jsonl');
  assert.equal(result.ok, false);
  assert.ok(result.error.indexOf('fetch') >= 0);
});

test('received-loader: loadReceivedDocumentsFromUrl URL vazia falha', async function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = await ns.loadReceivedDocumentsFromUrl('');
  assert.equal(result.ok, false);
});

test('received-loader: integracao com Pedido Detail NAO quebra', function () {
  // Garante que mesmo com RAVATEX_DOCUMENTS_RECEIVED populado,
  // o Pedido Detail continua lendo apenas o estado legado.
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

  vm.createContext(sandbox);
  vm.runInContext(documentsIngestorSrc, sandbox);
  vm.runInContext(documentsLoaderSrc, sandbox);

  // Popula ambos os estados
  sandbox.window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(fixtureText);
  sandbox.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(RECEIVED_JSONL);

  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7);
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3);

  // Carrega o bundle do Pedido Detail
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
  assert.equal(view.ingestorDocsLoaded, true);
  assert.equal(view.ingestorDocumentRows.length, 3, 'Pedido Detail continua vendo 3 docs do estado legado');
  assert.equal(view.ingestorTimeline.length, 7, 'Pedido Detail continua vendo 7 eventos do estado legado');
  // Documentos recebidos NAO vazam para o Pedido Detail
  assert.ok(!('receivedDocumentRows' in view),
    'Pedido Detail NAO deve ter coluna de received');
});

// =====================================================================
// Bloco G12-F2: Suporte a documentos-mapeados.jsonl
// O export G12-F1 traz campos alem dos do documentos-recebidos.jsonl
// (schema_version, status, pedido_manual, received_at, detected_at,
//  linked_at, accepted_at, rejected_at, rejected_reason).
// O loader deve aceitar e preservar todos esses campos extras
// em window.RAVATEX_DOCUMENTS_RECEIVED, sem alterar o estado
// legado do Pedido Detail.
// =====================================================================

const MAPPED_JSONL = [
  JSON.stringify({
    schema_version: 1,
    document_id: 'doc-mapped-1',
    filename_original: 'NF-001.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-m1',
    drive_web_view_link: 'https://drive.google.com/file/d/m1/view',
    status: 'pending',
    pedido_manual: '',
    received_at: '2026-07-08T10:00:00.000Z',
    detected_at: '2026-07-08T09:55:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
    created_at: '2026-07-08T10:00:00.000Z',
  }),
  JSON.stringify({
    schema_version: 1,
    document_id: 'doc-mapped-2',
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    direcao_nf: 'saida',
    drive_file_id: 'drive-m2',
    drive_web_view_link: 'https://drive.google.com/file/d/m2/view',
    status: 'assigned',
    pedido_manual: 'PED-25-2026',
    received_at: '2026-07-08T11:00:00.000Z',
    detected_at: '2026-07-08T10:55:00.000Z',
    linked_at: '2026-07-08T10:58:00.000Z',
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
    created_at: '2026-07-08T11:00:00.000Z',
  }),
  JSON.stringify({
    schema_version: 1,
    document_id: 'doc-mapped-3',
    filename_original: 'NF-002.pdf',
    tipo_documento: 'nf',
    formato: 'pdf',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-m3',
    drive_web_view_link: 'https://drive.google.com/file/d/m3/view',
    status: 'rejected',
    pedido_manual: '',
    received_at: '2026-07-08T12:00:00.000Z',
    detected_at: '2026-07-08T11:55:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: '2026-07-08T12:05:00.000Z',
    rejected_reason: 'formato invalido',
    created_at: '2026-07-08T12:00:00.000Z',
  }),
].join('\n');

test('G12-F2: loadReceivedDocumentsFromText aceita formato documentos-mapeados.jsonl', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadReceivedDocumentsFromText(MAPPED_JSONL);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, '3 documentos mapeados aceitos');
});

test('G12-F2: loader preserva campos extras (schema_version, status, received_at...) em RECEIVED', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  ns.loadReceivedDocumentsFromText(MAPPED_JSONL);
  var received = sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.equal(received.length, 3);
  // Campos extras do export mapeados estao preservados nos objetos
  var d1 = received[0];
  assert.equal(d1.schema_version, 1, 'schema_version preservado');
  assert.equal(d1.status, 'pending', 'status preservado');
  assert.equal(d1.received_at, '2026-07-08T10:00:00.000Z', 'received_at preservado');
  assert.equal(d1.detected_at, '2026-07-08T09:55:00.000Z', 'detected_at preservado');
  assert.equal(d1.linked_at, null, 'linked_at null preservado');
  assert.equal(d1.rejected_reason, null, 'rejected_reason null preservado');
  var d2 = received[1];
  assert.equal(d2.status, 'assigned', 'status assigned preservado');
  assert.equal(d2.pedido_manual, 'PED-25-2026', 'pedido_manual preenchido preservado');
  var d3 = received[2];
  assert.equal(d3.status, 'rejected', 'status rejected preservado');
  assert.equal(d3.rejected_reason, 'formato invalido', 'rejected_reason preservado');
  assert.equal(d3.rejected_at, '2026-07-08T12:05:00.000Z', 'rejected_at preservado');
});

test('G12-F2: loader aceita formato antigo documentos-recebidos.jsonl (regressao)', function () {
  // Sem schema_version, status, received_at, etc.
  // O parser/loader deve continuar aceitando (regressao).
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  var result = ns.loadReceivedDocumentsFromText(RECEIVED_JSONL);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, '3 docs do formato antigo aceitos');
  var received = sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  // Campos do mapeados ficam undefined (ausentes) no formato antigo
  assert.equal(received[0].status, undefined, 'status ausente no formato antigo');
  assert.equal(received[0].schema_version, undefined, 'schema_version ausente no formato antigo');
  assert.equal(received[0].received_at, undefined, 'received_at ausente no formato antigo');
  // Mas os campos do flat original estao intactos
  assert.equal(received[0].document_id, 'doc-rcv-1');
  assert.equal(received[0].filename_original, 'NF-001.xml');
  assert.equal(received[0].created_at, '2026-07-07T12:00:00.000Z');
});

test('G12-F2: loader dedup continua funcionando com mapped + legacy misturados', function () {
  var sandbox = makeLoaderSandbox();
  var ns = sandbox.window.RAVATEX_DOCUMENTS;
  // Doc do mapeados (doc-mapped-1) + mesmo document_id no formato antigo
  // nao devem duplicar. Cria um legacy com mesmo document_id.
  var legacyComMesmoId = JSON.stringify({
    document_id: 'doc-mapped-1',
    filename_original: 'NF-001.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    created_at: '2026-07-07T12:00:00.000Z',
  });
  var mixed = MAPPED_JSONL + '\n' + legacyComMesmoId;
  var result = ns.loadReceivedDocumentsFromText(mixed);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3, 'dedup por document_id funciona entre formatos (3 unicos, 4 linhas)');
  // O primeiro doc e o do mapeados (preservado como veio)
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED[0].document_id, 'doc-mapped-1');
  assert.equal(sandbox.window.RAVATEX_DOCUMENTS_RECEIVED[0].status, 'pending',
    'doc do mapeados preserva campos extras no dedup');
});
