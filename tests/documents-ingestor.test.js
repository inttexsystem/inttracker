// =====================================================================
// === tests/documents-ingestor.test.js =================================
// Testes puros para o parser/consolidator de eventos do Documents
// Ingestor em js/documents-ingestor.js.
//
// Fase: RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH
//       + G12-F2-MAPPED-DOCUMENTS-CONSUMER-PATCH
// Escopo: valida parser, deduplicacao, consolidacao, filtro, badges.
//   Nao acessa Supabase, Google/Drive, DOM ou rede.
//
// Garante:
//   - parseDocumentEventsJsonl le JSONL valido e rejeita malformado
//   - deduplicateEvents remove duplicatas por ingestion_event_id
//   - consolidateDocumentState retorna ultimo estado por document_id
//   - filterEventsByPedido filtra por pedido_manual
//   - normalizePedidoKey gera PED-XX-YYYY
//   - fixture sample produz 3 docs consolidados para PED-25-2026
//   - status badges meta: accepted, rejected, pending
//   - reason preservado em rejected
//   - drive_web_view_link preservado
//   - G12-F2: isValidReceivedDocument aceita formato documentos-mapeados.jsonl
//   - G12-F2: parseReceivedDocumentsJsonl preserva campos extras (mapped)
//   - sem chamada Supabase
//   - sem chamada Google/Drive
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'js', 'documents-ingestor.js');
const FIXTURE = path.join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl');

// -------------------------------------------------------------------
// Helpers para carregar o modulo em sandbox
// -------------------------------------------------------------------

function loadModule() {
  const src = fs.readFileSync(MODULE, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.RAVATEX_DOCUMENTS;
}

function loadFixture() {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  return { text: text, lines: text.split('\n').filter(function (l) { return l.trim(); }) };
}

// -------------------------------------------------------------------
// Testes: arquivo existe e sintaxe
// -------------------------------------------------------------------

test('documents-ingestor.js: arquivo existe', function () {
  assert.ok(fs.existsSync(MODULE), 'js/documents-ingestor.js ausente');
});

test('documents-ingestor.js: sintaxe JS valida', function () {
  const RAVATEX_DOCUMENTS = loadModule();
  assert.ok(RAVATEX_DOCUMENTS, 'RAVATEX_DOCUMENTS nao exposto');
});

test('fixture existe', function () {
  assert.ok(fs.existsSync(FIXTURE), 'data/fixtures/document-events-sample.jsonl ausente');
});

// -------------------------------------------------------------------
// Testes: normalizePedidoKey
// -------------------------------------------------------------------

test('normalizePedidoKey: gera PED-XX-YYYY corretamente', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(25, 2026), 'PED-25-2026');
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(7, 2025), 'PED-07-2025');
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(99, 2024), 'PED-99-2024');
});

test('normalizePedidoKey: padding de 2 digitos', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(5, 2026), 'PED-05-2026');
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(0, 2026), 'PED-00-2026');
});

test('normalizePedidoKey: numero nulo', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(null, 2026), 'PED-XX-2026');
});

test('normalizePedidoKey: ambos nulos', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.normalizePedidoKey(null, null), null);
});

// -------------------------------------------------------------------
// Testes: parseDocumentEventsJsonl
// -------------------------------------------------------------------

test('parseDocumentEventsJsonl: parseia JSONL valido', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  assert.strictEqual(events.length, 7, '7 eventos esperados na fixture');
  assert.strictEqual(events[0].event_type, 'document.detected');
  assert.strictEqual(events[1].event_type, 'document.linked');
});

test('parseDocumentEventsJsonl: texto vazio retorna array vazio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.ok(Array.isArray(RAVATEX_DOCUMENTS.parseDocumentEventsJsonl('')));
  assert.strictEqual(RAVATEX_DOCUMENTS.parseDocumentEventsJsonl('').length, 0);
  assert.strictEqual(RAVATEX_DOCUMENTS.parseDocumentEventsJsonl('  \n  \n').length, 0);
});

test('parseDocumentEventsJsonl: linha malformada ignorada', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var text = '{"event_type":"test","pedido_manual":"PED-01-2026","document":{"document_id":"1"}}\nnao e json\n{"event_type":"test2","pedido_manual":"PED-01-2026","document":{"document_id":"2"}}';
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(text);
  assert.strictEqual(events.length, 2, 'Linha malformada deve ser ignorada');
});

test('parseDocumentEventsJsonl: string nao eh string trata como vazio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var r1 = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(null);
  var r2 = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(undefined);
  assert.ok(Array.isArray(r1), 'null deve retornar array');
  assert.strictEqual(r1.length, 0, 'null deve retornar array vazio');
  assert.ok(Array.isArray(r2), 'undefined deve retornar array');
  assert.strictEqual(r2.length, 0, 'undefined deve retornar array vazio');
});

// -------------------------------------------------------------------
// Testes: isValidDocumentEvent
// -------------------------------------------------------------------

test('isValidDocumentEvent: evento valido passa', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.ok(RAVATEX_DOCUMENTS.isValidDocumentEvent({
    event_type: 'document.detected',
    pedido_manual: 'PED-25-2026',
    document: { document_id: 'abc' },
  }));
});

test('isValidDocumentEvent: evento sem event_type falha', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidDocumentEvent({
    pedido_manual: 'PED-25-2026',
    document: { document_id: 'abc' },
  }), false);
});

test('isValidDocumentEvent: evento sem document falha', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidDocumentEvent({
    event_type: 'document.detected',
    pedido_manual: 'PED-25-2026',
  }), false);
});

// -------------------------------------------------------------------
// Testes: filterEventsByPedido
// -------------------------------------------------------------------

test('filterEventsByPedido: filtra por pedido_manual', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { pedido_manual: 'PED-25-2026', event_type: 'a' },
    { pedido_manual: 'PED-26-2026', event_type: 'b' },
    { pedido_manual: 'PED-25-2026', event_type: 'c' },
  ];
  var filtered = RAVATEX_DOCUMENTS.filterEventsByPedido(events, 'PED-25-2026');
  assert.strictEqual(filtered.length, 2);
  assert.strictEqual(filtered[0].event_type, 'a');
  assert.strictEqual(filtered[1].event_type, 'c');
});

test('filterEventsByPedido: pedido nao encontrado retorna vazio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { pedido_manual: 'PED-25-2026', event_type: 'a' },
  ];
  var filtered = RAVATEX_DOCUMENTS.filterEventsByPedido(events, 'PED-99-2026');
  assert.strictEqual(filtered.length, 0);
});

// -------------------------------------------------------------------
// Testes: deduplicateEvents
// -------------------------------------------------------------------

test('deduplicateEvents: remove duplicatas por ingestion_event_id', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { ingestion_event_id: 'a', data: 1 },
    { ingestion_event_id: 'b', data: 2 },
    { ingestion_event_id: 'a', data: 3 }, // duplicata
    { ingestion_event_id: 'c', data: 4 },
  ];
  var deduped = RAVATEX_DOCUMENTS.deduplicateEvents(events);
  assert.strictEqual(deduped.length, 3);
  assert.strictEqual(deduped[0].data, 1);
  assert.strictEqual(deduped[1].data, 2);
  assert.strictEqual(deduped[2].data, 4);
});

test('deduplicateEvents: usa event_id como fallback', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { event_id: 'x', data: 1 },
    { event_id: 'x', data: 2 },
  ];
  var deduped = RAVATEX_DOCUMENTS.deduplicateEvents(events);
  assert.strictEqual(deduped.length, 1);
});

// -------------------------------------------------------------------
// Testes: sortEventsByCreatedAt
// -------------------------------------------------------------------

test('sortEventsByCreatedAt: ordena por created_at ascendente', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { created_at: '2026-07-07T12:20:00Z', label: 'c' },
    { created_at: '2026-07-07T12:00:00Z', label: 'a' },
    { created_at: '2026-07-07T12:10:00Z', label: 'b' },
  ];
  var sorted = RAVATEX_DOCUMENTS.sortEventsByCreatedAt(events);
  assert.strictEqual(sorted[0].label, 'a');
  assert.strictEqual(sorted[1].label, 'b');
  assert.strictEqual(sorted[2].label, 'c');
});

// -------------------------------------------------------------------
// Testes: consolidateDocumentState
// -------------------------------------------------------------------

test('consolidateDocumentState: ultimo evento por document_id vence', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { document: { document_id: 'd1' }, status: 'pending_app_acceptance', created_at: '2026-07-07T12:00:00Z' },
    { document: { document_id: 'd1' }, status: 'accepted', created_at: '2026-07-07T12:20:00Z' },
    { document: { document_id: 'd2' }, status: 'pending_app_acceptance', created_at: '2026-07-07T12:10:00Z' },
  ];
  var consolidated = RAVATEX_DOCUMENTS.consolidateDocumentState(events);
  assert.strictEqual(consolidated.length, 2);
  assert.strictEqual(consolidated[0].status, 'accepted');
  assert.strictEqual(consolidated[1].status, 'pending_app_acceptance');
});

test('consolidateDocumentState: mantem ordem de primeira aparencia', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { document: { document_id: 'd1' }, created_at: '2026-07-07T12:00:00Z' },
    { document: { document_id: 'd2' }, created_at: '2026-07-07T12:10:00Z' },
    { document: { document_id: 'd1' }, created_at: '2026-07-07T12:20:00Z' },
  ];
  var consolidated = RAVATEX_DOCUMENTS.consolidateDocumentState(events);
  assert.strictEqual(consolidated[0].document.document_id, 'd1');
  assert.strictEqual(consolidated[1].document.document_id, 'd2');
});

// -------------------------------------------------------------------
// Testes: fixture completa
// -------------------------------------------------------------------

test('fixture: 7 eventos parseados', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  assert.strictEqual(events.length, 7);
});

test('fixture: filtro PED-25-2026 retorna todos os eventos', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var filtered = RAVATEX_DOCUMENTS.filterEventsByPedido(events, 'PED-25-2026');
  assert.strictEqual(filtered.length, 7);
});

test('fixture: filtro pedido inexistente retorna vazio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var filtered = RAVATEX_DOCUMENTS.filterEventsByPedido(events, 'PED-99-2099');
  assert.strictEqual(filtered.length, 0);
});

test('fixture: buildDocumentsForPedido consolida 3 docs', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var result = RAVATEX_DOCUMENTS.buildDocumentsForPedido(events, 'PED-25-2026');
  assert.strictEqual(result.consolidatedDocuments.length, 3);
});

test('fixture: doc_sample_001 consolidado como accepted', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var result = RAVATEX_DOCUMENTS.buildDocumentsForPedido(events, 'PED-25-2026');
  var doc1 = result.consolidatedDocuments.find(function (d) {
    return d.document.document_id === 'doc_sample_001';
  });
  assert.ok(doc1, 'doc_sample_001 nao encontrado');
  assert.strictEqual(doc1.status, 'accepted');
  assert.strictEqual(doc1.document.drive_web_view_link, 'https://drive.google.com/file/d/drive_sample_001/view');
});

test('fixture: drive_web_view_link preservado em cada doc', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var result = RAVATEX_DOCUMENTS.buildDocumentsForPedido(events, 'PED-25-2026');
  result.consolidatedDocuments.forEach(function (doc) {
    assert.ok(typeof doc.document.drive_web_view_link === 'string', 'doc sem drive_web_view_link');
    assert.ok(doc.document.drive_web_view_link.indexOf('drive.google.com') !== -1, 'link nao parece do Google Drive');
  });
});

test('fixture: doc_sample_002 consolidado como rejected com reason', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var result = RAVATEX_DOCUMENTS.buildDocumentsForPedido(events, 'PED-25-2026');
  var doc2 = result.consolidatedDocuments.find(function (d) {
    return d.document.document_id === 'doc_sample_002';
  });
  assert.ok(doc2, 'doc_sample_002 nao encontrado');
  assert.strictEqual(doc2.status, 'rejected');
  assert.ok(doc2.document.reason, 'reason deveria existir em rejected');
  assert.ok(doc2.document.reason.length > 0, 'reason nao pode ser vazio');
});

test('fixture: timeline contem 7 eventos ordenados', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  var result = RAVATEX_DOCUMENTS.buildDocumentsForPedido(events, 'PED-25-2026');
  assert.strictEqual(result.timeline.length, 7);
  // Verificar ordenacao ascendente
  for (var i = 1; i < result.timeline.length; i++) {
    assert.ok(result.timeline[i - 1].created_at <= result.timeline[i].created_at,
      'Timeline fora de ordem: ' + result.timeline[i - 1].created_at + ' > ' + result.timeline[i].created_at);
  }
});

// -------------------------------------------------------------------
// Testes: badges
// -------------------------------------------------------------------

test('badges: status aceito', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta('accepted');
  assert.strictEqual(meta.label, 'Aceito');
  assert.strictEqual(meta.text, '#18794a');
});

test('badges: status rejeitado', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentStatusBadgeMeta('rejected');
  assert.strictEqual(meta.label, 'Rejeitado');
  assert.strictEqual(meta.text, '#a23434');
});

test('badges: tipo NF', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentTipoBadgeMeta('nf');
  assert.strictEqual(meta.label, 'NF');
});

test('badges: tipo romaneio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentTipoBadgeMeta('romaneio');
  assert.strictEqual(meta.label, 'Romaneio');
});

test('badges: formato PDF', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentFormatoBadgeMeta('pdf');
  assert.strictEqual(meta.label, 'PDF');
});

test('badges: formato XML', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentFormatoBadgeMeta('xml');
  assert.strictEqual(meta.label, 'XML');
});

test('badges: direcao entrada', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta('entrada');
  assert.strictEqual(meta.label, 'Entrada');
});

test('badges: direcao saida', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta('saida');
  assert.strictEqual(meta.label, 'Saida');
});

test('badges: direcao desconhecida retorna null', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var meta = RAVATEX_DOCUMENTS.getDocumentDirecaoBadgeMeta('desconhecida');
  assert.strictEqual(meta, null);
});

// -------------------------------------------------------------------
// Testes: fmtTimestamp
// -------------------------------------------------------------------

test('fmtTimestamp: formata ISO para dd/MM HH:mm', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var result = RAVATEX_DOCUMENTS.fmtTimestamp('2026-07-07T12:20:00.000Z');
  assert.ok(typeof result === 'string');
  assert.ok(result.indexOf('/') !== -1, 'deveria conter barra de data');
});

test('fmtTimestamp: valor nulo retorna "-"', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.fmtTimestamp(null), '-');
});

// -------------------------------------------------------------------
// Testes: garantias
// -------------------------------------------------------------------

test('garantias: sem chamada Supabase', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  // O modulo nao referencia window.supa ou window.supabase
  var src = fs.readFileSync(MODULE, 'utf8');
  assert.ok(src.indexOf('window.supa') === -1, 'modulo referencia window.supa');
  assert.ok(src.indexOf('window.supabase') === -1, 'modulo referencia window.supabase');
  // O ban era a substring 'supabase' em qualquer lugar. Ele passou a acusar
  // o proprio contrato de PROVENIENCIA: o ingestor compara a etiqueta
  // `_ravatex_source === 'supabase'` para distinguir documento vindo do
  // servidor de documento local. Isso e classificacao de origem, nao
  // chamada. O que precisa continuar proibido e o ACESSO ao cliente.
  assert.ok(src.indexOf('createClient') === -1, 'modulo instancia cliente Supabase');
  assert.ok(!/\.\s*(from|rpc)\s*\(/.test(src), 'modulo faz query Supabase');
  assert.ok(src.indexOf('functions.invoke') === -1, 'modulo chama edge function');
});

test('garantias: sem chamada Google/Drive', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var src = fs.readFileSync(MODULE, 'utf8');
  // A unica mencao a drive deve ser no contexto de link de visualizacao
  // Nao deve importar googleapis, google-auth-library, etc
  assert.ok(src.indexOf('googleapis') === -1, 'modulo referencia googleapis');
  assert.ok(src.indexOf('google-auth') === -1, 'modulo referencia google-auth');
});

test('garantias: sem fetch/rede no modulo', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var src = fs.readFileSync(MODULE, 'utf8');
  assert.ok(src.indexOf('fetch(') === -1, 'modulo contem fetch');
  assert.ok(src.indexOf('XMLHttpRequest') === -1, 'modulo contem XMLHttpRequest');
});

test('garantias: modulo expoe namespace no window', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.ok(RAVATEX_DOCUMENTS.parseDocumentEventsJsonl, 'parseDocumentEventsJsonl ausente');
  assert.ok(RAVATEX_DOCUMENTS.normalizePedidoKey, 'normalizePedidoKey ausente');
  assert.ok(RAVATEX_DOCUMENTS.buildDocumentsForPedido, 'buildDocumentsForPedido ausente');
  assert.ok(RAVATEX_DOCUMENTS.deduplicateEvents, 'deduplicateEvents ausente');
  assert.ok(RAVATEX_DOCUMENTS.consolidateDocumentState, 'consolidateDocumentState ausente');
  assert.ok(RAVATEX_DOCUMENTS.filterEventsByPedido, 'filterEventsByPedido ausente');
});

// -------------------------------------------------------------------
// Testes: Received documents parser/filter (G12-G1)
// Formato flat (sem wrapper document{}, sem event_type).
// -------------------------------------------------------------------

test('received: parseReceivedDocumentsJsonl expoe funcao', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.equal(typeof RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl, 'function',
    'parseReceivedDocumentsJsonl ausente');
  assert.equal(typeof RAVATEX_DOCUMENTS.isValidReceivedDocument, 'function',
    'isValidReceivedDocument ausente');
  assert.equal(typeof RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido, 'function',
    'filterDocumentsWithoutPedido ausente');
});

test('received: parseReceivedDocumentsJsonl aceita formato flat valido', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var text = [
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
  ].join('\n');
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(text);
  assert.strictEqual(docs.length, 2, '2 documentos esperados');
  assert.strictEqual(docs[0].document_id, 'doc-rcv-1');
  assert.strictEqual(docs[0].filename_original, 'NF-001.xml');
  assert.strictEqual(docs[0].tipo_documento, 'nf');
  assert.strictEqual(docs[0].formato, 'xml');
  assert.strictEqual(docs[0].direcao_nf, 'entrada');
  assert.strictEqual(docs[0].drive_web_view_link, 'https://drive.google.com/file/d/1/view');
  assert.strictEqual(docs[1].document_id, 'doc-rcv-2');
});

test('received: parseReceivedDocumentsJsonl preserva campos principais', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-x',
    filename_original: 'NF-x.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'saida',
    drive_web_view_link: 'https://drive.google.com/file/d/x/view',
    created_at: '2026-07-08T10:00:00.000Z',
  };
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(JSON.stringify(doc));
  assert.strictEqual(docs.length, 1);
  var parsed = docs[0];
  assert.strictEqual(parsed.document_id, doc.document_id);
  assert.strictEqual(parsed.filename_original, doc.filename_original);
  assert.strictEqual(parsed.tipo_documento, doc.tipo_documento);
  assert.strictEqual(parsed.formato, doc.formato);
  assert.strictEqual(parsed.direcao_nf, doc.direcao_nf);
  assert.strictEqual(parsed.drive_web_view_link, doc.drive_web_view_link);
  assert.strictEqual(parsed.created_at, doc.created_at);
});

test('received: parseReceivedDocumentsJsonl rejeita linha sem document_id', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var valid = JSON.stringify({ document_id: 'doc-valid', filename_original: 'a' });
  var invalid = JSON.stringify({ filename_original: 'sem-id', tipo_documento: 'nf' });
  var text = valid + '\n' + invalid;
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(text);
  assert.strictEqual(docs.length, 1, 'apenas a linha com document_id deve passar');
  assert.strictEqual(docs[0].document_id, 'doc-valid');
});

test('received: parseReceivedDocumentsJsonl rejeita JSON malformado', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var valid = JSON.stringify({ document_id: 'doc-1' });
  var text = valid + '\nistou nao e json\n{broken json\n' + valid;
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(text);
  assert.strictEqual(docs.length, 2, '2 validos; malformados ignorados');
});

test('received: parseReceivedDocumentsJsonl texto vazio retorna array vazio', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.ok(Array.isArray(RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl('')));
  assert.strictEqual(RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl('').length, 0);
  assert.strictEqual(RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl('   \n  \n').length, 0);
  assert.strictEqual(RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(null).length, 0);
  assert.strictEqual(RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(undefined).length, 0);
});

test('received: parseReceivedDocumentsJsonl rejeita quando document_id nao e string', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { document_id: 123, filename_original: 'a' };
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(JSON.stringify(doc));
  assert.strictEqual(docs.length, 0, 'document_id nao-string deve ser rejeitado');
});

test('received: parseReceivedDocumentsJsonl rejeita objeto sem document_id', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { filename_original: 'doc.pdf' };
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(JSON.stringify(doc));
  assert.strictEqual(docs.length, 0);
});

test('received: isValidReceivedDocument aceita doc flat valido', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument({
    document_id: 'doc-1',
    filename_original: 'NF.xml',
  }), true);
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument({ document_id: 'doc-1' }), true);
});

test('received: isValidReceivedDocument rejeita tipos errados nos campos opcionais', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument({
    document_id: 'doc-1', filename_original: 42,
  }), false, 'filename_original nao-string deve ser rejeitado');
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument({
    document_id: 'doc-1', drive_web_view_link: 99,
  }), false, 'drive_web_view_link nao-string deve ser rejeitado');
});

test('received: filterDocumentsWithoutPedido retorna array se input nao e array', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.ok(Array.isArray(RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido(null)));
  assert.strictEqual(RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido(null).length, 0);
  assert.ok(Array.isArray(RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido('x')));
  assert.strictEqual(RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido('x').length, 0);
});

test('received: filterDocumentsWithoutPedido exclui docs com pedido_manual preenchido', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var docs = [
    { document_id: 'd1' },
    { document_id: 'd2', pedido_manual: 'PED-25-2026' },
    { document_id: 'd3', pedido_manual: '' },
  ];
  var filtered = RAVATEX_DOCUMENTS.filterDocumentsWithoutPedido(docs);
  assert.strictEqual(filtered.length, 2, 'docs sem pedido_manual valido passam');
  assert.strictEqual(filtered[0].document_id, 'd1');
  assert.strictEqual(filtered[1].document_id, 'd3');
});

test('received: parser NAO afeta parseDocumentEventsJsonl (regressao)', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var fixture = loadFixture();
  var events = RAVATEX_DOCUMENTS.parseDocumentEventsJsonl(fixture.text);
  assert.strictEqual(events.length, 7, 'regressao: parseDocumentEventsJsonl deve continuar retornando 7');
});

test('received: parser NAO afeta filterEventsByPedido (regressao)', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var events = [
    { pedido_manual: 'PED-25-2026', event_type: 'a' },
    { pedido_manual: 'PED-26-2026', event_type: 'b' },
  ];
  var filtered = RAVATEX_DOCUMENTS.filterEventsByPedido(events, 'PED-25-2026');
  assert.strictEqual(filtered.length, 1, 'regressao: filterEventsByPedido continua OK');
  assert.strictEqual(filtered[0].event_type, 'a');
});

test('received: parser NAO afeta isValidDocumentEvent (regressao)', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidDocumentEvent({
    event_type: 'document.detected',
    pedido_manual: 'PED-25-2026',
    document: { document_id: 'abc' },
  }), true, 'regressao: evento valido continua passando');
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidDocumentEvent({
    pedido_manual: 'PED-25-2026',
  }), false, 'regressao: evento sem event_type continua falhando');
});

test('received: modulo continua sem chamada Supabase/Google/Drive', function () {
  var src = fs.readFileSync(MODULE, 'utf8');
  // Mesma correcao do teste "garantias": a etiqueta de proveniencia
  // 'supabase' e parte do contrato de origem, nao uma chamada.
  assert.ok(src.indexOf('window.supa') === -1, 'modulo referencia window.supa');
  assert.ok(src.indexOf('createClient') === -1, 'modulo instancia cliente Supabase');
  assert.ok(!/\.\s*(from|rpc)\s*\(/.test(src), 'modulo faz query Supabase');
  assert.ok(src.indexOf('googleapis') === -1);
  assert.ok(src.indexOf('google-auth') === -1);
  assert.ok(src.indexOf('fetch(') === -1);
});

// -------------------------------------------------------------------
// G12-F2: Suporte ao export documentos-mapeados.jsonl
// (campos extras alem do flat original: schema_version, status,
//  pedido_manual, received_at, detected_at, linked_at, accepted_at,
//  rejected_at, rejected_reason). Validador/parser devem aceitar e
//  preservar todos.
// -------------------------------------------------------------------

test('G12-F2: isValidReceivedDocument aceita doc no formato documentos-mapeados.jsonl', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var mapped = {
    schema_version: 1,
    document_id: 'doc-mapped-1',
    filename_original: 'NF-001.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_web_view_link: 'https://drive.google.com/file/d/1/view',
    status: 'pending',
    pedido_manual: '',
    received_at: '2026-07-08T10:00:00.000Z',
    detected_at: '2026-07-08T09:55:00.000Z',
    linked_at: null,
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
  };
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument(mapped), true,
    'doc no formato mapeados deve passar no validador');
});

test('G12-F2: parseReceivedDocumentsJsonl preserva todos os campos do export mapeados', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var mapped = {
    schema_version: 1,
    document_id: 'doc-mapped-2',
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    direcao_nf: 'saida',
    drive_web_view_link: 'https://drive.google.com/file/d/2/view',
    status: 'assigned',
    pedido_manual: 'PED-25-2026',
    received_at: '2026-07-08T11:00:00.000Z',
    detected_at: '2026-07-08T10:55:00.000Z',
    linked_at: '2026-07-08T10:58:00.000Z',
    accepted_at: null,
    rejected_at: null,
    rejected_reason: null,
  };
  var text = JSON.stringify(mapped);
  var docs = RAVATEX_DOCUMENTS.parseReceivedDocumentsJsonl(text);
  assert.strictEqual(docs.length, 1, '1 doc esperado');
  var parsed = docs[0];
  assert.strictEqual(parsed.document_id, mapped.document_id);
  assert.strictEqual(parsed.schema_version, 1, 'schema_version preservado');
  assert.strictEqual(parsed.status, 'assigned', 'status preservado');
  assert.strictEqual(parsed.pedido_manual, 'PED-25-2026', 'pedido_manual preservado');
  assert.strictEqual(parsed.received_at, mapped.received_at, 'received_at preservado');
  assert.strictEqual(parsed.detected_at, mapped.detected_at, 'detected_at preservado');
  assert.strictEqual(parsed.linked_at, mapped.linked_at, 'linked_at preservado');
  assert.strictEqual(parsed.accepted_at, null, 'accepted_at null preservado');
  assert.strictEqual(parsed.rejected_at, null, 'rejected_at null preservado');
  assert.strictEqual(parsed.rejected_reason, null, 'rejected_reason null preservado');
});

test('G12-F2: isValidReceivedDocument ainda exige document_id (rejeita mapeado sem id)', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var mappedSemId = {
    schema_version: 1,
    filename_original: 'NF.xml',
    status: 'pending',
    received_at: '2026-07-08T10:00:00.000Z',
  };
  assert.strictEqual(RAVATEX_DOCUMENTS.isValidReceivedDocument(mappedSemId), false,
    'sem document_id, mesmo com campos do mapeados, deve falhar');
});

// -------------------------------------------------------------------
// G14-B: mapReceivedDocToEventShape — bridge flat doc -> event shape
// -------------------------------------------------------------------

test('G14-B: mapReceivedDocToEventShape expoe funcao', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.equal(typeof RAVATEX_DOCUMENTS.mapReceivedDocToEventShape, 'function',
    'mapReceivedDocToEventShape ausente');
});

test('G14-B: mapReceivedDocToEventShape accepted -> document.accepted', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-acc-1',
    filename_original: 'NF-e.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_web_view_link: 'https://drive.google.com/file/d/1/view',
    status: 'accepted',
    pedido_manual: 'PED-25-2026',
    received_at: '2026-07-08T10:00:00.000Z',
    accepted_at: '2026-07-08T10:30:00.000Z',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.ok(ev, 'nao retornou null');
  assert.strictEqual(ev.event_type, 'document.accepted');
  assert.strictEqual(ev.status, 'accepted');
  assert.strictEqual(ev.pedido_manual, 'PED-25-2026');
  assert.strictEqual(ev.created_at, '2026-07-08T10:30:00.000Z',
    'created_at deve ser o timestamp mais recente');
  assert.ok(ev.document, 'deve ter document wrapper');
  assert.strictEqual(ev.document.document_id, 'doc-acc-1');
  assert.strictEqual(ev.document.tipo_documento, 'nf');
  assert.strictEqual(ev.document.formato, 'xml');
  assert.strictEqual(ev.document.direcao_nf, 'entrada');
  assert.strictEqual(ev.document.filename_original, 'NF-e.xml');
  assert.strictEqual(ev.document.drive_web_view_link, 'https://drive.google.com/file/d/1/view');
});

test('G14-B: mapReceivedDocToEventShape assigned -> document.linked', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-assign-1',
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    status: 'assigned',
    pedido_manual: 'PED-26-2026',
    detected_at: '2026-07-08T11:00:00.000Z',
    linked_at: '2026-07-08T11:05:00.000Z',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_type, 'document.linked');
  assert.strictEqual(ev.status, 'assigned');
  assert.strictEqual(ev.created_at, '2026-07-08T11:05:00.000Z');
});

test('G14-B: mapReceivedDocToEventShape rejected -> document.rejected', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-rej-1',
    filename_original: 'NF-duplicada.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    status: 'rejected',
    pedido_manual: 'PED-27-2026',
    received_at: '2026-07-08T12:00:00.000Z',
    rejected_at: '2026-07-08T12:15:00.000Z',
    rejected_reason: 'Duplicado',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_type, 'document.rejected');
  assert.strictEqual(ev.status, 'rejected');
  assert.strictEqual(ev.created_at, '2026-07-08T12:15:00.000Z');
  assert.strictEqual(ev.document.reason, 'Duplicado');
});

test('G14-B: mapReceivedDocToEventShape pending/default -> document.detected', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-pend-1',
    filename_original: 'L.pdf',
    tipo_documento: 'desconhecido',
    formato: 'desconhecido',
    status: 'pending',
    pedido_manual: null,
    received_at: '2026-07-08T13:00:00.000Z',
    detected_at: null,
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_type, 'document.detected');
  assert.strictEqual(ev.status, 'pending');
  assert.strictEqual(ev.pedido_manual, '');
  assert.strictEqual(ev.created_at, '2026-07-08T13:00:00.000Z');
});

test('G14-B: mapReceivedDocToEventShape status desconhecido mapeia para detected', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { document_id: 'doc-x', status: 'desconhecido', filename_original: 'x.txt' };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_type, 'document.detected');
});

test('G14-B: mapReceivedDocToEventShape status vazio mapeia para detected', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { document_id: 'doc-empty-status' };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_type, 'document.detected');
  assert.strictEqual(ev.status, 'pending');
});

test('G14-B: mapReceivedDocToEventShape pedido_manual null preservado como string vazia', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-no-pedido',
    filename_original: 'sem-pedido.pdf',
    status: 'pending',
    pedido_manual: null,
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.pedido_manual, '');
});

test('G14-B: mapReceivedDocToEventShape campos parciais nao quebram', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { document_id: 'doc-min' };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.ok(ev, 'nao deve retornar null');
  assert.strictEqual(ev.document.document_id, 'doc-min');
  assert.strictEqual(ev.document.filename_original, 'Documento');
  assert.strictEqual(ev.document.tipo_documento, '');
  assert.strictEqual(ev.document.formato, '');
  assert.strictEqual(ev.document.drive_web_view_link, '');
  assert.strictEqual(ev.document.reason, '');
  assert.strictEqual(ev.status, 'pending');
  assert.strictEqual(ev.event_type, 'document.detected');
  assert.strictEqual(ev.created_at, '');
});

test('G14-B: mapReceivedDocToEventShape created_at usa timestamp mais recente disponivel', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-ts',
    received_at: '2026-07-08T08:00:00.000Z',
    detected_at: '2026-07-08T08:10:00.000Z',
    linked_at: '2026-07-08T08:20:00.000Z',
    accepted_at: '2026-07-08T08:30:00.000Z',
    rejected_at: null,
    created_at: '2026-07-08T07:00:00.000Z',
    status: 'accepted',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.created_at, '2026-07-08T08:30:00.000Z',
    'deve usar accepted_at (mais recente)');
});

test('G14-B: mapReceivedDocToEventShape rejected_at vence accepted_at', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-rej-late',
    accepted_at: '2026-07-08T09:00:00.000Z',
    rejected_at: '2026-07-08T09:30:00.000Z',
    status: 'rejected',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.created_at, '2026-07-08T09:30:00.000Z');
});

test('G14-B: mapReceivedDocToEventShape sem timestamps usa string vazia', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = { document_id: 'doc-sem-ts', status: 'pending' };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.created_at, '');
});

test('G18-B: mapReceivedDocToEventShape usa accepted_ingestion_event_id para status accepted', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-accepted-id',
    status: 'accepted',
    accepted_ingestion_event_id: 'aaaaaaaa-bbbb-4ccc-dddd-111111111111',
    latest_ingestion_event_id: 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, 'aaaaaaaa-bbbb-4ccc-dddd-111111111111',
    'accepted status usa accepted_ingestion_event_id');
});

test('G18-B: mapReceivedDocToEventShape usa linked_ingestion_event_id para status assigned', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-assigned-id',
    status: 'assigned',
    linked_ingestion_event_id: 'bbbbbbbb-cccc-4ddd-eeee-222222222222',
    latest_ingestion_event_id: 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, 'bbbbbbbb-cccc-4ddd-eeee-222222222222',
    'assigned status usa linked_ingestion_event_id');
});

test('G18-B: mapReceivedDocToEventShape usa rejected_ingestion_event_id para status rejected', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-rejected-id',
    status: 'rejected',
    rejected_ingestion_event_id: 'cccccccc-dddd-4eee-ffff-333333333333',
    latest_ingestion_event_id: 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, 'cccccccc-dddd-4eee-ffff-333333333333',
    'rejected status usa rejected_ingestion_event_id');
});

test('G18-B: mapReceivedDocToEventShape usa detected_ingestion_event_id para status pending', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-pending-id',
    status: 'pending',
    detected_ingestion_event_id: 'dddddddd-eeee-4fff-aaaa-444444444444',
    latest_ingestion_event_id: 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, 'dddddddd-eeee-4fff-aaaa-444444444444',
    'pending status usa detected_ingestion_event_id');
});

test('G18-B: mapReceivedDocToEventShape fallback para latest_ingestion_event_id', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-fallback-id',
    status: 'accepted',
    latest_ingestion_event_id: 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, 'zzzzzzzz-yyyy-4xxx-wwww-999999999999',
    'fallback para latest_ingestion_event_id quando especifico ausente');
});

test('G18-B: mapReceivedDocToEventShape null/ausente deixa ingestion_event_id undefined', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-no-id',
    filename_original: 'test.pdf',
    status: 'accepted',
    received_at: '2026-07-08T10:00:00.000Z',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.ingestion_event_id, undefined,
    'sem ingestion_event_ids = undefined');
});

test('G18-B: mapReceivedDocToEventShape nao cria event_id falso', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-no-event',
    filename_original: 'test.pdf',
    status: 'accepted',
    received_at: '2026-07-08T10:00:00.000Z',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.event_id, undefined,
    'nao deve conter event_id');
});

test('G14-B: mapReceivedDocToEventShape null/undefined retorna null', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  assert.strictEqual(RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(null), null);
  assert.strictEqual(RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(undefined), null);
  assert.strictEqual(RAVATEX_DOCUMENTS.mapReceivedDocToEventShape('string'), null);
  assert.strictEqual(RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(42), null);
});

test('G14-B: mapReceivedDocToEventShape usa alias campos (tipo, direcao, filename)', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-alias',
    tipo: 'nf',
    direcao: 'saida',
    filename: 'alias-file.xml',
    status: 'accepted',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.document.tipo_documento, 'nf');
  assert.strictEqual(ev.document.direcao_nf, 'saida');
  assert.strictEqual(ev.document.filename_original, 'alias-file.xml');
});

test('G14-B: mapReceivedDocToEventShape reason usa rejected_reason com prioridade', function () {
  var RAVATEX_DOCUMENTS = loadModule();
  var doc = {
    document_id: 'doc-reason',
    status: 'rejected',
    rejected_reason: 'prioritario',
    reason: 'secundario',
  };
  var ev = RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(doc);
  assert.strictEqual(ev.document.reason, 'prioritario',
    'rejected_reason deve ter prioridade sobre reason');
});

// G20-B-R1: guardas de document_id
test('G20-B-R1: saveDocumentDecision rejeita document_id ausente', function () {
  var R = loadModule();
  var r1 = R.saveDocumentDecision('', { status: 'accepted' });
  assert.strictEqual(r1.ok, false, 'vazio rejeitado');
  var r2 = R.saveDocumentDecision(null, { status: 'accepted' });
  assert.strictEqual(r2.ok, false, 'null rejeitado');
  var r3 = R.saveDocumentDecision(undefined, { status: 'accepted' });
  assert.strictEqual(r3.ok, false, 'undefined rejeitado');
});

test('G20-B-R1: saveDocumentDecision rejeita document_id fallback doc-X', function () {
  var R = loadModule();
  var r1 = R.saveDocumentDecision('doc-0', { status: 'accepted' });
  assert.strictEqual(r1.ok, false, 'doc-0 rejeitado');
  assert.ok(r1.error.indexOf('fallback') >= 0, 'mensagem de erro cita fallback');
  var r2 = R.saveDocumentDecision('doc-123', { status: 'accepted' });
  assert.strictEqual(r2.ok, false, 'doc-123 rejeitado');
});

test('G20-B-R1: saveDocumentDecision rejeita status invalido', function () {
  var R = loadModule();
  var r = R.saveDocumentDecision('abc-def-ghi', { status: 'invalid' });
  assert.strictEqual(r.ok, false, 'status invalido rejeitado');
});

test('G20-B-R1: saveDocumentDecision rejeita rejeicao sem motivo', function () {
  var R = loadModule();
  var r1 = R.saveDocumentDecision('abc-def-ghi', { status: 'rejected' });
  assert.strictEqual(r1.ok, false, 'sem motivo rejeitado');
  var r2 = R.saveDocumentDecision('abc-def-ghi', { status: 'rejected', motivo: '' });
  assert.strictEqual(r2.ok, false, 'motivo vazio rejeitado');
  var r3 = R.saveDocumentDecision('abc-def-ghi', { status: 'rejected', motivo: '   ' });
  assert.strictEqual(r3.ok, false, 'motivo whitespace rejeitado');
});

test('G20-B-R1: getEffectiveDocumentStatus gera isDivergent boolean false sem decisao', function () {
  var R = loadModule();
  var r = R.getEffectiveDocumentStatus('abc-def-ghi', 'accepted');
  assert.strictEqual(r.isDivergent, false, 'isDivergent deve ser false');
  assert.strictEqual(r.isLocalDecision, false, 'isLocalDecision deve ser false');
  assert.strictEqual(r.effectiveStatus, 'accepted', 'efetivo = importado');
});

test('G20-B-R1: getEffectiveDocumentStatus retorna null para doc sem id', function () {
  var R = loadModule();
  var r1 = R.getEffectiveDocumentStatus({ status: 'pending' });
  assert.strictEqual(r1, null, 'doc sem document_id retorna null');
  var r2 = R.getEffectiveDocumentStatus('');
  assert.strictEqual(r2, null, 'string vazia retorna null');
});
