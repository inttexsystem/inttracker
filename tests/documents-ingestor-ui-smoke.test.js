// =====================================================================
// === tests/documents-ingestor-ui-smoke.test.js ========================
// Smoke de UI read-only: valida que a secao "DOCUMENTOS RECEBIDOS
// (INGESTOR)" renderiza corretamente no Pedido Detail quando a global
// window.RAVATEX_DOCUMENTS_LOADED_EVENTS e populada via fixture.
//
// Fase: RAVATEX-TAPETES-G11-C-DOCUMENTS-CONSUMER-UI-SMOKE
// Escopo: validacao visual/read-only. Sem Supabase, sem Google/Drive,
//   sem export real, sem alterar Documents Ingestor.
//
// Garante:
//   - computeViewModel popula ingestorDocumentRows com fixture
//   - computeViewModel popula ingestorTimeline
//   - buildDocuments renderiza secao com labels, badges, botoes e
//     timeline dots
//   - fixture PED-25-2026 compativel com pedido.numero=25
//   - sem regressao no Pedido Detail
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
const FIXTURE = path.join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl');

const SCREEN = path.join(ROOT, 'js', 'screens', 'pedido-detail.js');
const DETAIL_DATA = path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js');
const CHAIN_STATE = path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js');
const DETAIL_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const DETAIL_EVENTS = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');
const OP_DISPLAY = path.join(ROOT, 'js', 'op-display.js');

const PEDIDO_DETAIL_SMOKE = path.join(ROOT, 'tests', 'pedido-detail.smoke.js');
const DOCS_TEST = path.join(ROOT, 'tests', 'documents-ingestor.test.js');

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const documentsIngestorSrc = readOrFail(DOC_INGESTOR);
const fixtureText = readOrFail(FIXTURE);
const detailProgressSrc = readOrFail(DETAIL_PROGRESS);
const detailRenderSrc = readOrFail(DETAIL_RENDER);
// Slice do buildDocuments para asserts focados (regex generico que funciona antes/depois de exports)
var buildDocsSlice = (detailRenderSrc.match(
  /function buildDocuments\s*\(view\)\s*\{[\s\S]*?\n  \}\n\n  ns\.renderPedidoDetailScreen/
) || [''])[0];

const detailBundle = [
  readOrFail(OP_DISPLAY),
  readOrFail(CHAIN_STATE),
  readOrFail(SCREEN),
  readOrFail(DETAIL_DATA),
  readOrFail(DETAIL_PROGRESS),
  readOrFail(DETAIL_EVENTS),
  readOrFail(DETAIL_RENDER),
].join('\n\n');

const ingestorDetailBundle = [documentsIngestorSrc, detailBundle].join('\n\n');

var fixtureEvents = fixtureText
  .split('\n')
  .filter(function (l) { return l.trim(); })
  .map(function (line) { return JSON.parse(line); });

// -------------------------------------------------------------------
// Mock DOM helpers
// -------------------------------------------------------------------

function buildMockEl() {
  var el = function (tag, attrs) {
    var children = [];
    for (var i = 2; i < arguments.length; i++) {
      if (arguments[i] === null || arguments[i] === undefined) continue;
      children.push(arguments[i]);
    }
    var node = {
      tag: tag,
      attrs: attrs || {},
      children: children,
    };
    node.textContent = flattenNodeText(children);
    node.appendChild = function (child) {
      if (child === null || child === undefined) return;
      children.push(child);
      node.children = children;
      node.textContent = flattenNodeText(children);
    };
    node.querySelectorAll = function () { return []; };
    node.querySelector = function () { return null; };
    node.addEventListener = function () {};
    node.removeEventListener = function () {};
    if (attrs && typeof attrs.onclick === 'function') {
      node.onclick = attrs.onclick;
      node.attrs.onclick = attrs.onclick;
    }
    return node;
  };
  return el;
}

function flattenNodeText(children) {
  var text = '';
  for (var i = 0; i < children.length; i++) {
    var c = children[i];
    if (c === null || c === undefined) continue;
    if (typeof c === 'string') {
      text += c;
    } else if (typeof c === 'object' && c !== null && typeof c.textContent === 'string') {
      text += c.textContent;
    }
  }
  return text;
}

function findTextInNode(node, search, visited) {
  visited = visited || new Set();
  if (!node || visited.has(node)) return false;
  visited.add(node);
  if (typeof node === 'string') return node.indexOf(search) >= 0;
  if (node.textContent && node.textContent.indexOf(search) >= 0) return true;
  if (Array.isArray(node.children)) {
    for (var i = 0; i < node.children.length; i++) {
      if (findTextInNode(node.children[i], search, visited)) return true;
    }
  }
  return false;
}

function collectTexts(node, arr) {
  arr = arr || [];
  if (!node) return arr;
  if (typeof node === 'string') { arr.push(node); return arr; }
  if (node.textContent) arr.push(node.textContent);
  if (Array.isArray(node.children)) {
    for (var i = 0; i < node.children.length; i++) {
      collectTexts(node.children[i], arr);
    }
  }
  return arr;
}

// -------------------------------------------------------------------
// Runtime helpers
// -------------------------------------------------------------------

function makeIngestorRuntime(opts) {
  opts = opts || {};
  var sandbox = { window: {}, console: {} };
  sandbox.window.el = buildMockEl();
  sandbox.window.RavatexPedidoTracking = null;
  sandbox.window.toast = function () {};
  var docMock = {
    createElement: function (tag) {
      var el = { tag: tag, innerHTML: '', firstChild: null, textContent: '' };
      return {
        get firstChild() { return el.firstChild; },
        set innerHTML(html) {
          el.innerHTML = html;
          el.firstChild = { tag: 'svg', textContent: '', attrs: {}, children: [] };
        },
        get innerHTML() { return el.innerHTML; },
      };
    },
  };
  sandbox.document = docMock;
  sandbox.window.document = docMock;
  vm.createContext(sandbox);
  vm.runInContext(ingestorDetailBundle, sandbox);

  if (!opts.skipFixture) {
    sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS = fixtureEvents.slice();
  }

  return {
    sandbox: sandbox,
    ns: sandbox.window.RAVATEX_SCREENS && sandbox.window.RAVATEX_SCREENS.pedidoDetail,
    RAVATEX_DOCUMENTS: sandbox.window.RAVATEX_DOCUMENTS,
  };
}

function pedido25State(ns) {
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
  return s;
}

// -------------------------------------------------------------------
// 1. Testes de fonte (assert.match no codigo do render)
// -------------------------------------------------------------------

test('ingestor-ui-source: seção DOCUMENTOS RECEBIDOS (INGESTOR) no codigo do render', () => {
  assert.match(detailRenderSrc, /DOCUMENTOS RECEBIDOS \(INGESTOR\)/,
    'deve conter o titulo da secao de ingestor');
});

test('ingestor-ui-source: secao condicional a ingestorDocsLoaded', () => {
  assert.match(detailRenderSrc, /if\s*\(view\.ingestorDocsLoaded/,
    'deve renderizar condicionalmente com ingestorDocsLoaded');
  assert.match(detailRenderSrc, /view\.ingestorDocumentRows/,
    'deve usar ingestorDocumentRows do view model');
});

test('ingestor-ui-source: badges com bg/text/label inline', () => {
  assert.match(detailRenderSrc, /b\.bg/,
    'deve usar atributo b.bg para cor de fundo do badge');
  assert.match(detailRenderSrc, /b\.text/,
    'deve usar atributo b.text para cor de texto do badge');
  assert.match(detailRenderSrc, /b\.label/,
    'deve usar atributo b.label para texto do badge');
});

test('ingestor-ui-source: botao Ver com window.open seguro', () => {
  assert.match(buildDocsSlice, /window\.open\s*\(\s*row\.driveLink/,
    'deve chamar window.open com o driveLink do documento');
  assert.match(buildDocsSlice, /noopener/,
    'deve usar noopener para seguranca');
  assert.match(buildDocsSlice, /noreferrer/,
    'deve usar noreferrer para seguranca');
});

test('ingestor-ui-source: reason em vermelho', () => {
  assert.match(detailRenderSrc, /row\.reason\s*\?\s*['"]#a23434/,
    'reason deve usar cor vermelha #a23434');
  assert.match(detailRenderSrc, /Rejeitado:/,
    'deve prefixar reason com "Rejeitado:"');
});

test('ingestor-ui-source: timeline dots renderizadas', () => {
  assert.match(detailRenderSrc, /ingestorTimeline/,
    'deve renderizar timeline de eventos do ingestor');
  assert.match(detailRenderSrc, /border-radius:\s*50%/,
    'deve usar dots circulares (border-radius:50%)');
  assert.match(detailRenderSrc, /EVENTOS/,
    'deve ter titulo EVENTOS para a timeline');
});

test('ingestor-ui-source: status badge com fallback a RAVATEX_DOCUMENTS', () => {
  assert.match(detailRenderSrc, /row\.statusMeta\s*\|\|\s*window\.RAVATEX_DOCUMENTS\.getDocumentStatusBadgeMeta/,
    'deve fazer fallback ao modulo RAVATEX_DOCUMENTS se statusMeta ausente');
});

// -------------------------------------------------------------------
// 2. Testes de dados (computeViewModel via runtime)
// -------------------------------------------------------------------

test('ingestor-ui-data: ingestorDocsLoaded true com fixture populada', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.equal(view.ingestorDocsLoaded, true, 'ingestorDocsLoaded deve ser true');
});

test('ingestor-ui-data: 3 documentos consolidados (7 eventos -> 3 documentos)', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.equal(view.ingestorDocumentRows.length, 3,
    'fixture tem 3 documentos unicos (doc_sample_001, 002, 003)');
});

test('ingestor-ui-data: filenames corretos nos documentos', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var names = view.ingestorDocumentRows.map(function (r) { return r.label; }).join('|');
  assert.ok(names.indexOf('NF-25487-entrada.xml') >= 0, 'doc1 filename');
  assert.ok(names.indexOf('NF-35891-saida.pdf') >= 0, 'doc2 filename');
  assert.ok(names.indexOf('Romaneio-Entrega-8720.pdf') >= 0, 'doc3 filename');
});

test('ingestor-ui-data: badges — tipos NF e Romaneio', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var doc1 = view.ingestorDocumentRows[0]; // NF-25487: nf
  var doc2 = view.ingestorDocumentRows[1]; // NF-35891: nf
  var doc3 = view.ingestorDocumentRows[2]; // Romaneio

  function hasBadge(row, label) {
    return (row.badges || []).some(function (b) { return b.label === label; });
  }

  assert.ok(hasBadge(doc1, 'NF'), 'doc1 badge NF');
  assert.ok(hasBadge(doc1, 'XML'), 'doc1 badge XML');
  assert.ok(hasBadge(doc1, 'Entrada'), 'doc1 badge Entrada');

  assert.ok(hasBadge(doc2, 'NF'), 'doc2 badge NF');
  assert.ok(hasBadge(doc2, 'PDF'), 'doc2 badge PDF');
  assert.ok(hasBadge(doc2, 'Saida'), 'doc2 badge Saida');

  assert.ok(hasBadge(doc3, 'Romaneio'), 'doc3 badge Romaneio');
  assert.ok(hasBadge(doc3, 'PDF'), 'doc3 badge PDF');
});

test('ingestor-ui-data: status — accepted e rejected', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.equal(view.ingestorDocumentRows[0].status, 'accepted', 'doc1 accepted');
  assert.equal(view.ingestorDocumentRows[1].status, 'rejected', 'doc2 rejected');
  assert.equal(view.ingestorDocumentRows[2].status, 'pending_app_acceptance', 'doc3 pendente');

  assert.equal(view.ingestorDocumentRows[0].statusMeta.label, 'Aceito');
  assert.equal(view.ingestorDocumentRows[1].statusMeta.label, 'Rejeitado');
  assert.equal(view.ingestorDocumentRows[2].statusMeta.label, 'Pendente');
});

test('ingestor-ui-data: driveLink presente em documentos', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  for (var i = 0; i < view.ingestorDocumentRows.length; i++) {
    var link = view.ingestorDocumentRows[i].driveLink;
    assert.ok(typeof link === 'string' && link.length > 0,
      'driveLink deve estar presente no doc ' + i);
    assert.ok(link.indexOf('drive.google.com') >= 0 || link.indexOf('drive_sample') >= 0,
      'driveLink deve conter URL do Google Drive');
  }
});

test('ingestor-ui-data: reason presente apenas no documento rejeitado', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.equal(view.ingestorDocumentRows[0].reason, null, 'accepted nao tem reason');
  assert.ok(typeof view.ingestorDocumentRows[1].reason === 'string', 'rejected tem reason');
  assert.ok(view.ingestorDocumentRows[1].reason.indexOf('correcao') >= 0,
    'reason contem texto explicativo');
  assert.equal(view.ingestorDocumentRows[2].reason, null, 'pendente nao tem reason');
});

test('ingestor-ui-data: timeline tem 7 eventos', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.ok(Array.isArray(view.ingestorTimeline), 'timeline deve ser array');
  assert.equal(view.ingestorTimeline.length, 7, '7 eventos na timeline');
});

test('ingestor-ui-data: timeline eventos tem eventType e label', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var types = view.ingestorTimeline.map(function (t) { return t.eventType; }).join('|');
  assert.ok(types.indexOf('document.detected') >= 0, 'evento detected');
  assert.ok(types.indexOf('document.linked') >= 0, 'evento linked');
  assert.ok(types.indexOf('document.accepted') >= 0, 'evento accepted');
  assert.ok(types.indexOf('document.rejected') >= 0, 'evento rejected');

  var pts = view.ingestorTimeline.map(function (t) { return t.label; });
  assert.ok(pts.some(function (l) { return l === 'Documento detectado'; }), 'label detected');
  assert.ok(pts.some(function (l) { return l === 'Documento vinculado'; }), 'label linked');
  assert.ok(pts.some(function (l) { return l === 'Documento aceito'; }), 'label accepted');
  assert.ok(pts.some(function (l) { return l === 'Documento rejeitado'; }), 'label rejected');
});

test('ingestor-ui-data: timeline docLabel referencia filename', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var labels = view.ingestorTimeline.map(function (t) { return t.docLabel; }).join('|');
  assert.ok(labels.indexOf('NF-25487') >= 0, 'docLabel referencia NF-25487');
  assert.ok(labels.indexOf('NF-35891') >= 0, 'docLabel referencia NF-35891');
  assert.ok(labels.indexOf('Romaneio') >= 0, 'docLabel referencia Romaneio');
});

test('ingestor-ui-data: timeline ordenada por created_at', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  for (var i = 1; i < view.ingestorTimeline.length; i++) {
    assert.ok(view.ingestorTimeline[i].timestamp >= view.ingestorTimeline[i - 1].timestamp,
      'eventos devem estar em ordem cronologica (pos ' + i + ')');
  }
});

test('ingestor-ui-data: sem injecao quando global nao populada', () => {
  var rt = makeIngestorRuntime({ skipFixture: true });
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.equal(view.ingestorDocsLoaded, false, 'nao deve carregar sem fixture');
  assert.equal(view.ingestorDocumentRows.length, 0, 'nenhum doc sem fixture');
  assert.equal(view.ingestorTimeline.length, 0, 'nenhum timeline sem fixture');
});

test('ingestor-ui-data: sem injecao para pedido diferente', () => {
  var rt = makeIngestorRuntime();
  var ns = rt.ns;
  var s = ns.createInitialState();
  s.pedido = { id: 'other', numero: 99, status: 'recebido' };
  s.pedido.criado_em = '2026-01-01T00:00:00.000Z';
  var view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocumentRows.length, 0,
    'nenhum documento deve ser carregado para pedido diferente');
  assert.equal(view.ingestorTimeline.length, 0,
    'nenhum evento de timeline para pedido diferente');
});

// -------------------------------------------------------------------
// 3. Testes DOM (buildDocuments via runtime)
// -------------------------------------------------------------------

test('ingestor-ui-dom: seção DOCUMENTOS RECEBIDOS (INGESTOR) no DOM', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'DOCUMENTOS RECEBIDOS (INGESTOR)'),
    'deve conter o titulo da secao no DOM');
});

test('ingestor-ui-dom: filename NF-25487 no DOM', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'NF-25487-entrada.xml'), 'filename doc1 no DOM');
  assert.ok(findTextInNode(card, 'NF-35891-saida.pdf'), 'filename doc2 no DOM');
  assert.ok(findTextInNode(card, 'Romaneio-Entrega-8720.pdf'), 'filename doc3 no DOM');
});

test('ingestor-ui-dom: badges NF, XML, Entrada no DOM', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'NF'), 'badge NF no DOM');
  assert.ok(findTextInNode(card, 'XML'), 'badge XML no DOM');
  assert.ok(findTextInNode(card, 'Entrada'), 'badge Entrada no DOM');
  assert.ok(findTextInNode(card, 'PDF'), 'badge PDF no DOM');
  assert.ok(findTextInNode(card, 'Saida'), 'badge Saida no DOM');
  assert.ok(findTextInNode(card, 'Romaneio'), 'badge Romaneio no DOM');
});

test('ingestor-ui-dom: status Aceito e Rejeitado no DOM', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'Aceito'), 'status Aceito no DOM');
  assert.ok(findTextInNode(card, 'Rejeitado'), 'status Rejeitado no DOM');
  assert.ok(findTextInNode(card, 'Pendente'), 'status Pendente no DOM');
});

test('ingestor-ui-dom: botao Ver com onclick presente', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'Ver'), 'texto "Ver" no DOM');
});

test('ingestor-ui-dom: botao Ver tem onclick para window.open', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var stashedOnclick = null;
  var el = rt.sandbox.window.el;
  rt.sandbox.window.el = function (tag, attrs) {
    var args = [];
    for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
    var node = el.apply(null, [tag, attrs].concat(args));
    if (tag === 'button' && node.textContent === 'Ver') {
      stashedOnclick = (attrs && attrs.onclick) || null;
    }
    return node;
  };
  rt.ns.buildDocuments(view);
  assert.ok(typeof stashedOnclick === 'function', 'botao "Ver" deve ter onclick');
  assert.equal(stashedOnclick.length, 0, 'onclick nao deve receber argumentos');
});

test('ingestor-ui-dom: reason rejeitado no DOM em vermelho', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'Rejeitado:'),
    'prefixo "Rejeitado:" no DOM');
  assert.ok(findTextInNode(card, 'NF emitida com valor divergente'),
    'texto do reason no DOM');
});

test('ingestor-ui-dom: timeline eventos com dots e labels', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var card = rt.ns.buildDocuments(view);
  assert.ok(findTextInNode(card, 'EVENTOS'), 'titulo EVENTOS no DOM');
  assert.ok(findTextInNode(card, 'Documento detectado'),
    'label detected no DOM');
  assert.ok(findTextInNode(card, 'Documento aceito'),
    'label accepted no DOM');
  assert.ok(findTextInNode(card, 'Documento rejeitado'),
    'label rejected no DOM');
});

// -------------------------------------------------------------------
// 4. Testes estaticos nos fontes de progresso/ingestor
// -------------------------------------------------------------------

test('ingestor-ui-source: computeViewModel referencia RAVATEX_DOCUMENTS_LOADED_EVENTS', () => {
  assert.match(detailProgressSrc, /RAVATEX_DOCUMENTS_LOADED_EVENTS/,
    'computeViewModel deve ler a global de eventos carregados');
  assert.match(detailProgressSrc, /ingestorDocumentRows/,
    'computeViewModel deve popular ingestorDocumentRows');
  assert.match(detailProgressSrc, /ingestorTimeline/,
    'computeViewModel deve popular ingestorTimeline');
  assert.match(detailProgressSrc, /ingestorDocsLoaded/,
    'computeViewModel deve popular ingestorDocsLoaded');
});

test('ingestor-ui-source: botao Ver usa noopener/noreferrer', () => {
  assert.match(detailRenderSrc, /'noopener,noreferrer'/,
    'window.open deve usar noopener,noreferrer para seguranca');
});

test('ingestor-ui-source: SVG_FILE icone presente na linha do documento', () => {
  assert.match(buildDocsSlice, /SVG_FILE/,
    'deve usar icone SVG_FILE para o documento');
});

// -------------------------------------------------------------------
// 5. Testes de regressao (confirmar que pedido detail permanece intacto)
// -------------------------------------------------------------------

test('ingestor-ui-regressao: buildDocuments ainda chama documentRowsPedido', () => {
  assert.match(detailRenderSrc, /documentRowsPedido\.forEach/,
    'documentos do pedido ainda renderizam');
});

test('ingestor-ui-regressao: buildDocuments ainda chama documentRowsOperacionais', () => {
  assert.match(detailRenderSrc, /documentRowsOperacionais\.forEach/,
    'documentos operacionais ainda renderizam');
});

test('ingestor-ui-regressao: computeViewModel ainda retorna documentRowsPedido', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  assert.ok(Array.isArray(view.documentRowsPedido), 'documentRowsPedido ainda presente');
  assert.ok(Array.isArray(view.documentRowsOperacionais), 'documentRowsOperacionais ainda presente');
});

test('ingestor-ui-regressao: computeViewModel retorna campos obrigatorios do view model', () => {
  var rt = makeIngestorRuntime();
  var view = rt.ns.computeViewModel(pedido25State(rt.ns));
  var required = ['trackingApi', 'chainState', 'opSummaries', 'stepper',
    'documentRowsPedido', 'documentRowsOperacionais', 'pedidoConclusao'];
  for (var i = 0; i < required.length; i++) {
    assert.ok(view.hasOwnProperty(required[i]),
      'computeViewModel deve conter "' + required[i] + '"');
  }
});
