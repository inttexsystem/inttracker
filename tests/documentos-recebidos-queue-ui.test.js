// =====================================================================
// === tests/documentos-recebidos-queue-ui.test.js ====================
// Testes focados para o namespace browser-classic
// `window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI` (G28-B4-B2).
//
// Escopo: mapeamento puro de documentos carregados em itens de fila,
//   opcoes de filtro estaveis em portugues, filtragem deterministica,
//   distincao entre source-empty e filter-empty, preservacao de
//   semanticas legado/remota-indisponivel, e ausencia de efeitos
//   colaterais (Supabase, DOM, rede, escrita, RPC).
// =====================================================================

'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.resolve(__dirname, '..');
var QUEUE_UI_PATH = path.join(ROOT, 'js', 'screens', 'documentos-recebidos-queue-ui.js');
var READ_MODEL_PATH = path.join(ROOT, 'js', 'document-queue-read-model.js');

var readModel = require(READ_MODEL_PATH);
var createItem = readModel.createDocumentQueueItem;
var C = readModel.constants;

// Simula ambiente browser-classico: o read-model e carregado como script
// global, entao `window.createDocumentQueueItem` deve existir.
global.window = global;
global.createDocumentQueueItem = createItem;

require(QUEUE_UI_PATH);

var queueUI = global.window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function makeDoc(overrides) {
  var doc = {
    document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18',
    filename_original: 'NF-99.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-99',
    drive_web_view_link: 'https://drive.example/99',
    status: 'pending',
    pedido_manual: 'PED-99-2026',
    pedido_id: null,
    email_received_at: '2026-07-01T10:00:00.000Z',
    created_at: '2026-07-01T09:00:00.000Z',
    sender_email: 'fornecedor@example.com',
  };
  if (!overrides) return doc;
  for (var k in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) doc[k] = overrides[k];
  }
  return doc;
}

function setReceived(docs, source) {
  global.window.RAVATEX_DOCUMENTS_RECEIVED = docs ? clone(docs) : undefined;
  global.window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE = source || '';
}

function ids(entriesOrResult) {
  var entries = entriesOrResult && Array.isArray(entriesOrResult.visible)
    ? entriesOrResult.visible
    : entriesOrResult;
  return entries.map(function (e) { return e.queueItem.identity.document_id; });
}

// =====================================================================
// 1. Contrato e exposicao
// =====================================================================

test('queue-ui: namespace expoe API esperada', function () {
  assert.ok(queueUI, 'namespace deve existir');
  assert.equal(typeof queueUI.buildQueue, 'function');
  assert.equal(typeof queueUI.getFilterOptions, 'function');
  assert.equal(typeof queueUI.filterQueue, 'function');
  assert.equal(typeof queueUI.isSourceEmpty, 'function');
  assert.equal(typeof queueUI.getPedidoOptions, 'function');
  assert.equal(typeof queueUI.countByStatus, 'function');
  assert.equal(typeof queueUI.getSourceFilePresentation, 'function');
  assert.equal(typeof queueUI.getValidationPresentation, 'function');
});

// =====================================================================
// 2. Mapeamento / cardinalidade / ordem / imutabilidade
// =====================================================================

test('queue-ui: mapeia todos os documentos carregados preservando ordem', function () {
  var docs = [
    makeDoc({ document_id: 'a', filename_original: 'A.xml' }),
    makeDoc({ document_id: 'b', filename_original: 'B.pdf' }),
    makeDoc({ document_id: 'c', filename_original: 'C.jsonl' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.equal(entries.length, 3, 'cardinalidade preservada');
  assert.deepStrictEqual(ids(entries), ['a', 'b', 'c'], 'ordem preservada');
});

test('queue-ui: ignora documentos que nao geram queue item', function () {
  setReceived([makeDoc(), null, makeDoc({ document_id: 'b' })], 'supabase');
  var entries = queueUI.buildQueue();
  assert.equal(entries.length, 2);
});

test('queue-ui: nao muta o array nem os documentos de entrada', function () {
  var docs = [makeDoc()];
  var frozen = clone(docs);
  setReceived(docs, 'supabase');
  queueUI.buildQueue();
  assert.deepStrictEqual(global.window.RAVATEX_DOCUMENTS_RECEIVED, frozen);
  assert.deepStrictEqual(docs, frozen);
});

test('queue-ui: cada entrada expoe queueItem e metadado de indice', function () {
  setReceived([makeDoc()], 'supabase');
  var entries = queueUI.buildQueue();
  assert.equal(entries.length, 1);
  assert.ok(entries[0].queueItem, 'entry.queueItem existe');
  assert.equal(typeof entries[0].index, 'number');
  assert.equal(entries[0].index, 0);
});

// =====================================================================
// 3. Contexto de origem e disponibilidade remota
// =====================================================================

runTable('queue-ui: collectionSource vem da fonte global/documento', [
  ['supabase', undefined, 'supabase'],
  ['g22-auto', undefined, 'legacy_fallback'],
  ['manual', undefined, 'legacy_fallback'],
  ['', 'supabase', 'supabase'],
  ['', 'legacy', 'legacy'],
  ['', 'bogus', 'unknown'],
  ['', '', 'unknown'],
], function (row) {
  var doc = makeDoc();
  if (row[1] !== undefined) doc._ravatex_source = row[1];
  setReceived([doc], row[0]);
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.source.collection_source, row[2], row[0] + '/' + row[1]);
});

test('queue-ui: remoteAvailability e available apenas para supabase', function () {
  setReceived([makeDoc()], 'supabase');
  var supa = queueUI.buildQueue()[0];
  // O item em si nao expoe remoteAvailability diretamente, mas a evidence
  // reflete: supabase sem evidencia -> missing (nunca unavailable).
  assert.equal(supa.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.MISSING);

  setReceived([makeDoc()], 'g22-auto');
  var legacy = queueUI.buildQueue()[0];
  assert.equal(legacy.queueItem.filter_values.collection_source, 'legacy_fallback');
  assert.equal(legacy.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.UNAVAILABLE);
});

test('queue-ui: legacy retem raw para acoes legado', function () {
  var doc = makeDoc();
  setReceived([doc], 'manual');
  var entry = queueUI.buildQueue()[0];
  assert.strictEqual(entry.raw, global.window.RAVATEX_DOCUMENTS_RECEIVED[0], 'raw mantido para legacy');
});

test('queue-ui: supabase nao retem raw (nao e necessario)', function () {
  var doc = makeDoc();
  setReceived([doc], 'supabase');
  var entry = queueUI.buildQueue()[0];
  assert.strictEqual(entry.raw, null, 'raw e null para supabase');
});

// =====================================================================
// 4. Filtros puros e deterministicos
// =====================================================================

test('queue-ui: filtro por texto busca filename, tipo, pedido e origem', function () {
  var docs = [
    makeDoc({ document_id: 'a', filename_original: 'NF-A.xml', pedido_manual: 'PED-1', sender_email: 'a@x.com' }),
    makeDoc({ document_id: 'b', filename_original: 'Romaneio-B.pdf', pedido_manual: 'PED-2', sender_email: 'b@x.com' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();

  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { search: 'NF-A' })), ['a']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { search: 'Romaneio' })), ['b']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { search: 'PED-2' })), ['b']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { search: 'b@x.com' })), ['b']);
});

test('queue-ui: filtro por tipo', function () {
  var docs = [
    makeDoc({ document_id: 'a', tipo_documento: 'nf' }),
    makeDoc({ document_id: 'b', tipo_documento: 'romaneio' }),
    makeDoc({ document_id: 'c', tipo_documento: '' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { tipo: 'nf' })), ['a']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { tipo: 'romaneio' })), ['b']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { tipo: 'desconhecido' })), ['c']);
});

test('queue-ui: filtro por status-equivalente (review/pedido)', function () {
  var docs = [
    makeDoc({ document_id: 'p', status: 'pending', pedido_manual: null }),
    makeDoc({ document_id: 'a', status: 'accepted', pedido_manual: null }),
    makeDoc({ document_id: 'r', status: 'rejected', pedido_manual: null }),
    makeDoc({ document_id: 's', status: 'pending', pedido_id: 'uuid-ped' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { status: 'pending' })), ['p']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { status: 'accepted' })), ['a']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { status: 'rejected' })), ['r']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { status: 'assigned' })), ['s']);
});

test('queue-ui: filtro por periodo (email e processamento)', function () {
  var today = new Date();
  var todayIso = today.toISOString();
  var oldIso = '2026-01-01T10:00:00.000Z';
  var docs = [
    makeDoc({ document_id: 'new', email_received_at: todayIso }),
    makeDoc({ document_id: 'old', email_received_at: oldIso }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { periodo: 'hoje' })), ['new']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { periodo: '30d' })), ['new']);
});

test('queue-ui: filtro por collectionSource com codigos estaveis', function () {
  var docs = [makeDoc({ document_id: 's' }), makeDoc({ document_id: 'l' }), makeDoc({ document_id: 'u' })];
  docs[0]._ravatex_source = 'supabase';
  docs[1]._ravatex_source = 'manual';
  docs[2]._ravatex_source = 'bogus';
  setReceived(docs, 'mixed');
  var entries = queueUI.buildQueue();
  // canonical_remote mapeia supabase do B4-B1
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'canonical_remote' })), ['s']);
  // legacy_fallback mapeia legacy_fallback e legacy do B4-B1
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'legacy_fallback' })), ['l']);
  // unknown mapeia unknown do B4-B1
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'unknown' })), ['u']);
  // all = sem restricao
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'all' })), ['s', 'l', 'u']);
  // vazio = sem restricao
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, {})), ['s', 'l', 'u']);
  // supabase/legacy nao sao codigos de filtro validos
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'supabase' })), []);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { collectionSource: 'legacy' })), []);
});

test('queue-ui: filtro por technicalEvidence', function () {
  var docs = [
    makeDoc({ document_id: 'av', _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' } }),
    makeDoc({ document_id: 'ms', _ravatex_technical_evidence: null }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { technicalEvidence: 'available' })), ['av']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { technicalEvidence: 'missing' })), ['ms']);
});

test('queue-ui: filtragem combinada', function () {
  var docs = [
    makeDoc({ document_id: 'a', tipo_documento: 'nf', status: 'pending', pedido_manual: null }),
    makeDoc({ document_id: 'b', tipo_documento: 'nf', status: 'accepted', pedido_manual: null }),
    makeDoc({ document_id: 'c', tipo_documento: 'romaneio', status: 'pending', pedido_manual: null }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { tipo: 'nf', status: 'pending' })), ['a']);
});

test('queue-ui: filtragem e pura e deterministica', function () {
  setReceived([makeDoc(), makeDoc({ document_id: 'b' })], 'supabase');
  var entries = queueUI.buildQueue();
  var criteria = { search: 'NF-99' };
  var r1 = queueUI.filterQueue(entries, criteria);
  var r2 = queueUI.filterQueue(entries, criteria);
  assert.deepStrictEqual(r1, r2);
  assert.notStrictEqual(r1.entries, entries);
  assert.notStrictEqual(r1.visible, r1.entries);
});

// =====================================================================
// 4a. Novas APIs: getPedidoOptions, countByStatus, filtro pedido
// =====================================================================

test('queue-ui: getPedidoOptions extrai pedidos unicos dos queue items', function () {
  var docs = [
    makeDoc({ document_id: 'a', pedido_manual: 'PED-1', pedido_id: null }),
    makeDoc({ document_id: 'b', pedido_manual: 'PED-2', pedido_id: null }),
    makeDoc({ document_id: 'c', pedido_manual: 'PED-1', pedido_id: null }),
    makeDoc({ document_id: 'd', pedido_manual: null, pedido_id: null }),
    // G28-B6 contract: candidate.pedido_id is Ingestor-owned and NOT a confirmed
    // link, so doc 'e' contributes no Pedido option (only pedido_manual
    // suggestions and canonical confirmed references produce options).
    makeDoc({ document_id: 'e', pedido_manual: null, pedido_id: 'uuid-ped' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  var options = queueUI.getPedidoOptions(entries);
  var values = options.map(function (o) { return o.value; });
  assert.deepStrictEqual(values, ['PED-1', 'PED-2']);
});

test('queue-ui: countByStatus conta usando queueItem.review e pedido state', function () {
  var docs = [
    makeDoc({ document_id: 'p', status: 'pending', pedido_manual: null }),
    makeDoc({ document_id: 'a', status: 'accepted', pedido_manual: null }),
    makeDoc({ document_id: 'r', status: 'rejected', pedido_manual: null }),
    makeDoc({ document_id: 's', status: 'pending', pedido_id: 'uuid-ped' }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  var counts = queueUI.countByStatus(entries);
  assert.deepStrictEqual(counts, { todos: 4, pending: 1, assigned: 1, accepted: 1, rejected: 1 });
});

test('queue-ui: filtro por pedido via queueItem.pedido', function () {
  var docs = [
    makeDoc({ document_id: 'a', pedido_manual: 'PED-1' }),
    makeDoc({ document_id: 'b', pedido_manual: 'PED-2' }),
    makeDoc({ document_id: 'c', pedido_manual: null }),
  ];
  setReceived(docs, 'supabase');
  var entries = queueUI.buildQueue();
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { pedido: 'PED-1' })), ['a']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { pedido: 'PED-2' })), ['b']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, { pedido: 'todos' })), ['a', 'b', 'c']);
  assert.deepStrictEqual(ids(queueUI.filterQueue(entries, {})), ['a', 'b', 'c']);
});

// =====================================================================
// 5. Estados vazios
// =====================================================================

test('queue-ui: source-empty quando nao ha documentos', function () {
  setReceived([], 'supabase');
  assert.equal(queueUI.isSourceEmpty(), true);
  var result = queueUI.filterQueue(queueUI.buildQueue(), {});
  assert.equal(result.isSourceEmpty, true);
  assert.equal(result.isFilterEmpty, false);
});

test('queue-ui: filter-empty quando filtros excluem tudo', function () {
  setReceived([makeDoc()], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, { tipo: 'romaneio' });
  assert.equal(result.isSourceEmpty, false);
  assert.equal(result.isFilterEmpty, true);
  assert.equal(result.visible.length, 0);
  assert.equal(result.entries.length, 1);
});

// =====================================================================
// 6. Semanticas especiais
// =====================================================================

test('queue-ui: legacy fallback nao vira pending canonico', function () {
  setReceived([makeDoc({ status: 'pending' })], 'manual');
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.review.state, C.REVIEW_STATE.UNAVAILABLE);
  assert.equal(entry.queueItem.filter_values.review_state, C.REVIEW_STATE.UNAVAILABLE);
});

test('queue-ui: indisponibilidade nao e confundida com missing', function () {
  // Documentos legado tem evidence_state UNAVAILABLE (nunca MISSING),
  // preservando a distincao do read-model.
  setReceived([makeDoc({ _ravatex_technical_evidence: null })], 'manual');
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.UNAVAILABLE);
  assert.notEqual(entry.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.MISSING);
});

test('queue-ui: remote_unavailable via contexto global', function () {
  // Contexto: supabase como fonte canonica mas remote indisponivel.
  // Um documento sem technical evidence + remoteAvailability=unavailable
  // deve produzir evidence_state REMOTE_UNAVAILABLE.
  global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  setReceived([makeDoc({ _ravatex_technical_evidence: null })], 'supabase');
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.filter_values.collection_source, 'supabase');
  assert.equal(entry.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.REMOTE_UNAVAILABLE);
  assert.notEqual(entry.queueItem.filter_values.evidence_state, C.EVIDENCE_STATE.MISSING);

  // O filtro por technicalEvidence 'remote_unavailable' reconhece.
  var result = queueUI.filterQueue(queueUI.buildQueue(), { technicalEvidence: 'remote_unavailable' });
  assert.equal(result.visible.length, 1);

  delete global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
});

test('queue-ui: pedido sugerido, OP e duplicate preservados', function () {
  setReceived([makeDoc({ pedido_id: null, pedido_manual: 'PED-99' })], 'supabase');
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.pedido.state, C.PEDIDO_STATE.SUGGESTED_PEDIDO);
  // G28-B6 contract: OP is projected from the active canonical revision. With
  // no confirmed OP links the state is no_confirmed_op (not the former
  // hard-coded unavailable placeholder). Duplicate remains unavailable.
  assert.deepStrictEqual(entry.queueItem.op, { state: 'no_confirmed_op', op_ids: [] });
  assert.deepStrictEqual(entry.queueItem.duplicate, { state: 'unavailable' });
});

test('queue-ui: drive source capability preservada', function () {
  setReceived([makeDoc()], 'supabase');
  var entry = queueUI.buildQueue()[0];
  assert.equal(entry.queueItem.source_file.state, C.SOURCE_CAPABILITY.DRIVE_AVAILABLE);
});

// =====================================================================
// 7. Opcoes de filtro em portugues com codigos estaveis
// =====================================================================

test('queue-ui: opcoes de filtro expoem apenas codigos estaveis (canonical_remote/legacy_fallback/unknown)', function () {
  var options = queueUI.getFilterOptions();
  assert.ok(Array.isArray(options.collectionSource));
  assert.ok(Array.isArray(options.technicalEvidence));

  var csCodes = options.collectionSource.map(function (o) { return o.code; });
  assert.deepStrictEqual(csCodes, ['all', 'canonical_remote', 'legacy_fallback', 'unknown'],
    'deve expor all/canonical_remote/legacy_fallback/unknown, sem supabase/legacy');

  var evCodes = options.technicalEvidence.map(function (o) { return o.code; });
  assert.deepStrictEqual(evCodes, ['all', 'available', 'missing', 'invalid', 'remote_unavailable', 'unavailable']);

  options.collectionSource.forEach(function (o) {
    assert.equal(typeof o.label, 'string');
    assert.ok(o.label.length > 0);
  });
  options.technicalEvidence.forEach(function (o) {
    assert.equal(typeof o.label, 'string');
    assert.ok(o.label.length > 0);
  });
});

// =====================================================================
// 8. Seguranca: sem acesso proibido
// =====================================================================

test('queue-ui: codigo-fonte nao referencia Supabase/DOM/fetch/RPC/storage', function () {
  var src = fs.readFileSync(QUEUE_UI_PATH, 'utf8');
  assert.equal(/window\.supa/.test(src), false, 'nao referencia window.supa');
  assert.equal(/\bfetch\s*\(/.test(src), false, 'nao faz fetch');
  assert.equal(/XMLHttpRequest/.test(src), false, 'nao usa XHR');
  assert.equal(/\.rpc\s*\(/.test(src), false, 'nao chama RPC');
  assert.equal(/localStorage/.test(src), false, 'nao usa localStorage');
  assert.equal(/sessionStorage/.test(src), false, 'nao usa sessionStorage');
  assert.equal(/document\./.test(src), false, 'nao acessa document');
});

// =====================================================================
// 9. getUIState: boundary puro de estado de UI
// =====================================================================

test('queue-ui: getUIState expoe funcao no namespace', function () {
  assert.equal(typeof queueUI.getUIState, 'function', 'getUIState deve ser uma funcao');
});

test('queue-ui: getUIState loading retorna estado com label e marker corretos', function () {
  setReceived([makeDoc()], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  var state = queueUI.getUIState(entries, result, { loading: true });
  assert.ok(state, 'deve retornar estado');
  assert.equal(state.state, 'loading');
  assert.equal(state.label, 'Carregando documentos...');
  assert.equal(state.ariaLabel, 'Status: carregando documentos');
  assert.equal(state.marker, 'queue-ui-state-loading');
});

test('queue-ui: getUIState source-empty retorna estado com label e marker corretos', function () {
  setReceived([], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  var state = queueUI.getUIState(entries, result, {});
  assert.ok(state, 'deve retornar estado');
  assert.equal(state.state, 'source-empty');
  assert.equal(state.label, 'Nenhum documento recebido.');
  assert.equal(state.ariaLabel, 'Status: nenhum documento recebido');
  assert.equal(state.marker, 'queue-ui-state-source-empty');
});

test('queue-ui: getUIState source-empty ignora loading quando source ja esta vazio', function () {
  setReceived([], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  var state = queueUI.getUIState(entries, result, { loading: true });
  assert.equal(state.state, 'loading', 'loading tem prioridade sobre source-empty');
});

test('queue-ui: getUIState filter-empty retorna estado com label e marker corretos', function () {
  setReceived([makeDoc({ tipo_documento: 'nf' })], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, { tipo: 'romaneio' });
  assert.equal(result.isFilterEmpty, true);
  var state = queueUI.getUIState(entries, result, {});
  assert.ok(state, 'deve retornar estado');
  assert.equal(state.state, 'filter-empty');
  assert.equal(state.label, 'Nenhum documento neste filtro.');
  assert.equal(state.ariaLabel, 'Status: nenhum documento neste filtro');
  assert.equal(state.marker, 'queue-ui-state-filter-empty');
});

test('queue-ui: getUIState remote-unavailable quando remoto indisponivel sem fallback visivel', function () {
  global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  setReceived([makeDoc({ _ravatex_source: 'supabase' })], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  assert.equal(result.isSourceEmpty, false);
  assert.equal(result.isFilterEmpty, false);
  var state = queueUI.getUIState(entries, result, {});
  assert.ok(state, 'deve retornar estado remote-unavailable');
  assert.equal(state.state, 'remote-unavailable');
  assert.equal(state.label, 'Conexão remota indisponível.');
  assert.equal(state.ariaLabel, 'Status: conexão remota indisponível');
  assert.equal(state.marker, 'queue-ui-state-remote-unavailable');
  delete global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
});

test('queue-ui: getUIState remote-unavailable-legacy-fallback com fallback visivel', function () {
  global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  setReceived([
    makeDoc({ _ravatex_source: 'manual' }),
    makeDoc({ _ravatex_source: 'supabase' }),
  ], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  assert.equal(result.isSourceEmpty, false);
  var state = queueUI.getUIState(entries, result, {});
  assert.ok(state, 'deve retornar estado');
  assert.equal(state.state, 'remote-unavailable-legacy-fallback');
  assert.equal(state.label, 'Conexão remota indisponível. Exibindo registros de fallback local.');
  assert.equal(state.ariaLabel, 'Status: conexão remota indisponível, exibindo registros locais');
  assert.equal(state.marker, 'queue-ui-state-remote-unavailable-legacy-fallback');
  delete global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
});

test('queue-ui: getUIState retorna null quando tudo ok (sem loading, sem empty, remoto disponivel)', function () {
  global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
  setReceived([makeDoc()], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  var state = queueUI.getUIState(entries, result, {});
  assert.strictEqual(state, null, 'deve retornar null para estado ok');
  delete global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
});

test('queue-ui: getUIState distingue source-empty de filter-empty', function () {
  // source-empty: sem documentos
  setReceived([], 'supabase');
  var sourceState = queueUI.getUIState(queueUI.buildQueue(), queueUI.filterQueue(queueUI.buildQueue(), {}), {});
  assert.equal(sourceState.state, 'source-empty');

  // filter-empty: tem documentos mas filtro exclui tudo
  setReceived([makeDoc({ tipo_documento: 'nf' })], 'supabase');
  var filterState = queueUI.getUIState(queueUI.buildQueue(), queueUI.filterQueue(queueUI.buildQueue(), { tipo: 'romaneio' }), {});
  assert.equal(filterState.state, 'filter-empty');

  assert.notEqual(sourceState.state, filterState.state, 'source-empty e filter-empty devem ser distintos');
  assert.notEqual(sourceState.marker, filterState.marker, 'markers devem ser distintos');
});

test('queue-ui: getUIState remote-unavailable vs remote-unavailable-legacy-fallback sao distintos', function () {
  global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';

  // Apenas supabase visivel → remote-unavailable
  setReceived([makeDoc({ _ravatex_source: 'supabase' })], 'supabase');
  var entriesA = queueUI.buildQueue();
  var stateA = queueUI.getUIState(entriesA, queueUI.filterQueue(entriesA, {}), {});
  assert.equal(stateA.state, 'remote-unavailable');

  // Legacy visivel → remote-unavailable-legacy-fallback
  setReceived([makeDoc({ _ravatex_source: 'manual' })], 'supabase');
  var entriesB = queueUI.buildQueue();
  var stateB = queueUI.getUIState(entriesB, queueUI.filterQueue(entriesB, {}), {});
  assert.equal(stateB.state, 'remote-unavailable-legacy-fallback');

  assert.notEqual(stateA.state, stateB.state, 'estados devem ser distintos');
  assert.notEqual(stateA.marker, stateB.marker, 'markers devem ser distintos');

  delete global.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
});

test('queue-ui: getUIState e puro e nao tem efeitos colaterais', function () {
  setReceived([makeDoc()], 'supabase');
  var entries = queueUI.buildQueue();
  var result = queueUI.filterQueue(entries, {});
  var before = clone(global.window.RAVATEX_DOCUMENTS_RECEIVED);
  var state1 = queueUI.getUIState(entries, result, { loading: true });
  var state2 = queueUI.getUIState(entries, result, { loading: true });
  assert.deepStrictEqual(state1, state2, 'chamadas identicas produzem mesmo resultado');
  assert.deepStrictEqual(global.window.RAVATEX_DOCUMENTS_RECEIVED, before, 'nao muta documentos');
  assert.ok(before && before.length === 1, 'cardinalidade preservada');
});

test('queue-ui: getUIState nao referencia Supabase/DOM/fetch/RPC/storage', function () {
  var fnSrc = queueUI.getUIState.toString();
  assert.equal(/window\.supa/.test(fnSrc), false, 'nao referencia window.supa');
  assert.equal(/\bfetch\s*\(/.test(fnSrc), false, 'nao faz fetch');
  assert.equal(/XMLHttpRequest/.test(fnSrc), false, 'nao usa XHR');
  assert.equal(/\.rpc\s*\(/.test(fnSrc), false, 'nao chama RPC');
  assert.equal(/localStorage/.test(fnSrc), false, 'nao usa localStorage');
  assert.equal(/sessionStorage/.test(fnSrc), false, 'nao usa sessionStorage');
  assert.equal(/document\./.test(fnSrc), false, 'nao acessa document');
});

// =====================================================================
// 10. G28-B4-B3: Presentation functions (pure, domain-state-only)
// =====================================================================

test('queue-ui: expoe funcoes de apresentacao', function () {
  assert.equal(typeof queueUI.getEvidencePresentation, 'function');
  assert.equal(typeof queueUI.getReviewPresentation, 'function');
  assert.equal(typeof queueUI.getPedidoPresentation, 'function');
  assert.equal(typeof queueUI.getSourcePresentation, 'function');
  assert.equal(typeof queueUI.getAlertPresentation, 'function');
});

test('queue-ui: getEvidencePresentation cobre todos os 5 estados', function () {
  function qi(s) { return { technical_evidence: { state: s } }; }

  var av = queueUI.getEvidencePresentation(qi('available'));
  assert.equal(av.label, 'Evidência disponível', 'available label');
  assert.equal(av.tone, 'neutral', 'available tone');

  var ms = queueUI.getEvidencePresentation(qi('missing'));
  assert.equal(ms.label, 'Evidência ausente', 'missing label');
  assert.equal(ms.tone, 'info', 'missing tone');

  var inv = queueUI.getEvidencePresentation(qi('invalid'));
  assert.equal(inv.label, 'Evidência inválida', 'invalid label');
  assert.equal(inv.tone, 'warning', 'invalid tone');

  var ru = queueUI.getEvidencePresentation(qi('remote_unavailable'));
  assert.equal(ru.label, 'Consulta indisponível', 'remote_unavailable label');
  assert.equal(ru.tone, 'warning', 'remote_unavailable tone');

  var una = queueUI.getEvidencePresentation(qi('unavailable'));
  assert.equal(una.label, 'Não disponível nesta origem', 'unavailable label');
  assert.equal(una.tone, 'neutral', 'unavailable tone');
});

test('queue-ui: getEvidencePresentation retorna vazio para estado desconhecido e ausente', function () {
  assert.equal(queueUI.getEvidencePresentation({ technical_evidence: { state: 'bogus' } }).label, '');
  assert.equal(queueUI.getEvidencePresentation({}).label, '');
  assert.equal(queueUI.getEvidencePresentation(null).label, '');
});

test('queue-ui: getReviewPresentation cobre todos os 5 estados', function () {
  function qi(s) { return { review: { state: s } }; }

  assert.equal(queueUI.getReviewPresentation(qi('pending')).label, 'Pendente de revisão', 'pending');
  assert.equal(queueUI.getReviewPresentation(qi('accepted')).label, 'Aceito', 'accepted');
  assert.equal(queueUI.getReviewPresentation(qi('rejected')).label, 'Rejeitado', 'rejected');
  assert.equal(queueUI.getReviewPresentation(qi('unknown')).label, 'Estado desconhecido', 'unknown');
  assert.equal(queueUI.getReviewPresentation(qi('unavailable')).label, 'Revisão indisponível', 'unavailable');
});

test('queue-ui: getReviewPresentation retorna vazio para estado desconhecido', function () {
  assert.equal(queueUI.getReviewPresentation({ review: { state: 'bogus' } }).label, '');
});

test('queue-ui: getPedidoPresentation cobre todos os 4 estados', function () {
  function qi(s, o) {
    var p = { state: s };
    if (o) { for (var k in o) p[k] = o[k]; }
    return { pedido: p };
  }

  assert.equal(queueUI.getPedidoPresentation(qi('confirmed_pedido_reference', { pedido_id: 'uuid-123' })).label, 'Pedido referenciado', 'confirmed');
  assert.equal(queueUI.getPedidoPresentation(qi('suggested_pedido')).label, 'Pedido sugerido', 'suggested');
  assert.equal(queueUI.getPedidoPresentation(qi('no_confirmed_link')).label, 'Sem vínculo confirmado', 'no_confirmed_link');
  assert.equal(queueUI.getPedidoPresentation(qi('unavailable')).label, 'Vínculo indisponível', 'unavailable');
});

test('queue-ui: getPedidoPresentation confirmed retorna pedidoId, suggested nao', function () {
  var conf = queueUI.getPedidoPresentation({ pedido: { state: 'confirmed_pedido_reference', pedido_id: 'uuid-c' } });
  assert.equal(conf.pedidoId, 'uuid-c', 'confirmed carrega pedidoId');
  var sug = queueUI.getPedidoPresentation({ pedido: { state: 'suggested_pedido' } });
  assert.equal(sug.pedidoId, null, 'suggested sem pedidoId');
});

test('queue-ui: getSourcePresentation cobre todas as origens', function () {
  function qi(cs) { return { source: { collection_source: cs } }; }

  assert.equal(queueUI.getSourcePresentation(qi('supabase')).label, 'Supabase', 'supabase');
  assert.equal(queueUI.getSourcePresentation(qi('legacy_fallback')).label, 'Fallback legado', 'legacy_fallback');
  assert.equal(queueUI.getSourcePresentation(qi('legacy')).label, 'Fallback legado', 'legacy');
  assert.equal(queueUI.getSourcePresentation(qi('unknown')).label, 'Origem desconhecida', 'unknown');
});

test('queue-ui: getSourcePresentation retorna vazio para source ausente', function () {
  assert.equal(queueUI.getSourcePresentation({}).label, '');
  assert.equal(queueUI.getSourcePresentation(null).label, '');
});

test('queue-ui: getAlertPresentation mapeia todos os 7 codigos', function () {
  var codes = ['invalid_evidence', 'missing_evidence', 'remote_unavailable',
    'unknown_document_type', 'legacy_fallback', 'suggested_pedido', 'unsupported_source_file'];
  var qi = { alerts: codes.map(function (c) { return { code: c, severity: 'info' }; }) };
  var result = queueUI.getAlertPresentation(qi);
  assert.equal(result.length, 7, 'todos os 7 codigos retornados');
  var texts = result.map(function (a) { return a.text; });
  assert.ok(texts.indexOf('Evidência inválida') >= 0);
  assert.ok(texts.indexOf('Evidência ausente') >= 0);
  assert.ok(texts.indexOf('Consulta remota indisponível') >= 0);
  assert.ok(texts.indexOf('Tipo de documento desconhecido') >= 0);
  assert.ok(texts.indexOf('Dados de fallback legado') >= 0);
  assert.ok(texts.indexOf('Pedido sugerido') >= 0);
  assert.ok(texts.indexOf('Arquivo sem suporte a link') >= 0);
});

test('queue-ui: getAlertPresentation deduplica codigos repetidos', function () {
  var qi = { alerts: [
    { code: 'invalid_evidence', severity: 'warning' },
    { code: 'invalid_evidence', severity: 'warning' },
    { code: 'missing_evidence', severity: 'info' },
  ]};
  var result = queueUI.getAlertPresentation(qi);
  assert.equal(result.length, 2, 'apenas 2 apos dedup');
  assert.equal(result[0].code, 'invalid_evidence');
  assert.equal(result[1].code, 'missing_evidence');
});

test('queue-ui: getAlertPresentation nao fabrica alerta para no_confirmed_link', function () {
  var qi = { pedido: { state: 'no_confirmed_link' }, alerts: [] };
  var result = queueUI.getAlertPresentation(qi);
  var nc = result.filter(function (a) { return a.code === 'no_confirmed_link'; });
  assert.equal(nc.length, 0, 'no_confirmed_link nao produz alerta');
});

// =====================================================================
// 11. G28-B4-B4: Source-file and validation presentation helpers
// =====================================================================

test('queue-ui: getSourceFilePresentation cobre unsupported e missing', function () {
  function qi(state) { return { source_file: { state: state } }; }

  var uns = queueUI.getSourceFilePresentation(qi('unsupported'));
  assert.equal(uns.label, 'Acesso ao arquivo não suportado nesta origem', 'unsupported label');
  assert.equal(uns.ariaLabel, 'Acesso ao arquivo não suportado nesta origem', 'unsupported ariaLabel');

  var mis = queueUI.getSourceFilePresentation(qi('missing'));
  assert.equal(mis.label, 'Arquivo não disponível', 'missing label');
  assert.equal(mis.ariaLabel, 'Arquivo não disponível', 'missing ariaLabel');
});

test('queue-ui: getSourceFilePresentation retorna vazio para drive_available e desconhecido', function () {
  function qi(state) { return { source_file: { state: state } }; }

  var da = queueUI.getSourceFilePresentation(qi('drive_available'));
  assert.equal(da.label, '', 'drive_available label vazio');
  assert.equal(da.ariaLabel, '', 'drive_available ariaLabel vazio');

  var bogus = queueUI.getSourceFilePresentation(qi('bogus'));
  assert.equal(bogus.label, '', 'bogus label vazio');

  var missing = queueUI.getSourceFilePresentation({});
  assert.equal(missing.label, '', 'source_file ausente label vazio');

  var nil = queueUI.getSourceFilePresentation(null);
  assert.equal(nil.label, '', 'null queueItem label vazio');
});

test('queue-ui: getValidationPresentation cobre review_pending e review_unavailable', function () {
  function qi(review) { return { validation: { review: review } }; }

  var rp = queueUI.getValidationPresentation(qi('review_pending'));
  assert.equal(rp.label, 'Revisão pendente', 'review_pending label');
  assert.equal(rp.ariaLabel, 'Revisão pendente', 'review_pending ariaLabel');

  var ru = queueUI.getValidationPresentation(qi('review_unavailable'));
  assert.equal(ru.label, 'Revisão indisponível', 'review_unavailable label');
  assert.equal(ru.ariaLabel, 'Revisão indisponível', 'review_unavailable ariaLabel');
});

test('queue-ui: getValidationPresentation retorna vazio para review_available e desconhecido', function () {
  function qi(review) { return { validation: { review: review } }; }

  var ra = queueUI.getValidationPresentation(qi('review_available'));
  assert.equal(ra.label, '', 'review_available label vazio (reserved, nao emitido)');

  var bogus = queueUI.getValidationPresentation(qi('bogus'));
  assert.equal(bogus.label, '', 'bogus label vazio');

  var missing = queueUI.getValidationPresentation({});
  assert.equal(missing.label, '', 'validation ausente label vazio');

  var nil = queueUI.getValidationPresentation(null);
  assert.equal(nil.label, '', 'null queueItem label vazio');
});

test('queue-ui: apresentacao nao contem funcoes/acoes/callbacks', function () {
  var qi = { technical_evidence: { state: 'missing' }, review: { state: 'pending' }, pedido: { state: 'no_confirmed_link', pedido_id: null, pedido_manual: null }, source: { collection_source: 'supabase' }, alerts: [{ code: 'missing_evidence', severity: 'info' }] };
  var fns = ['getEvidencePresentation', 'getReviewPresentation', 'getPedidoPresentation', 'getSourcePresentation', 'getAlertPresentation', 'getSourceFilePresentation', 'getValidationPresentation'];
  fns.forEach(function (fnName) {
    var result = queueUI[fnName](qi);
    assert.ok(result, fnName + ' retorna valor');
    function walk(obj, path) {
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        if (['onClick', 'onclick', 'callback', 'handler', 'action', 'fn'].indexOf(k) >= 0) {
          assert.fail(fnName + ':' + path + '.' + k + ' e chave de acao');
        }
        if (typeof obj[k] === 'function') {
          assert.fail(fnName + ':' + path + '.' + k + ' e funcao');
        }
        if (obj[k] && typeof obj[k] === 'object') walk(obj[k], path + '.' + k);
      }
    }
    walk(result, fnName);
  });
});

// =====================================================================
// Helpers
// =====================================================================

function runTable(name, rows, fn) {
  test(name, function () {
    for (var i = 0; i < rows.length; i++) {
      fn(rows[i]);
    }
  });
}
