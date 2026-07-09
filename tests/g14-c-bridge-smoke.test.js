// =====================================================================
// === tests/g14-c-bridge-smoke.test.js ================================
// Smoke real do fluxo RAVATEX_DOCUMENTS_RECEIVED -> Pedido Detail
// usando o JSONL real gerado pelo Documents Ingestor em:
//
//   D:\OneDrive\ProgramaXXo\Ravatex\documents-ingestor\data\exports\documentos-mapeados.jsonl
//
// Fase: RAVATEX-DOCUMENTS-G14-C-PEDIDO-DETAIL-RECEIVED-BRIDGE-SMOKE
// Modo: READ-ONLY. Nao altera codigo, nao cria fixtures, nao modifica
//   estado persistente. Usa o JSONL real como entrada imutavel.
//
// Escopo:
//   - verifica que o parser aceita o JSONL real sem erros;
//   - verifica que loadReceivedDocumentsFromText popula a global;
//   - verifica que a tela Documentos Mapeados renderiza 2 documentos
//     (1 com pedido_manual + 1 sem);
//   - verifica ausencia do bota legado "Importar eventos";
//   - verifica que o Pedido Detail consome o documento com pedido_manual
//     correspondente (PED-99-2026);
//   - verifica que o doc sem pedido_manual (L.pdf) NAO aparece no
//     Pedido Detail;
//   - verifica dedup por document_id em reimport.
//
// Pre-requisitos:
//   - Documents Ingestor (master, HEAD bedbe909) gerou o JSONL;
//   - Controle de Tapetes (work/app-next, HEAD 624d064) ja recebeu o
//     patch G14-B.
//
// Nao executa Supabase, Gmail, Drive real, fetch, ou escrita em disco.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const INGESTOR_PATH = path.join(ROOT, '..', 'documents-ingestor');
const REAL_JSONL = path.join(
  INGESTOR_PATH,
  'data',
  'exports',
  'documentos-mapeados.jsonl'
);

const INGESTOR = path.join(ROOT, 'js', 'documents-ingestor.js');
const LOADER = path.join(ROOT, 'js', 'documents-ingestor-loader.js');
const IMPORT_RECEIVED = path.join(ROOT, 'js', 'documents-ingestor-import-received.js');
const SCREEN = path.join(ROOT, 'js', 'screens', 'documentos-recebidos.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const DETAIL_PROGRESS = path.join(ROOT, 'js', 'screens', 'pedido-detail-progress.js');
const DETAIL_RENDER = path.join(ROOT, 'js', 'screens', 'pedido-detail-render.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const realJsonl = readOrFail(REAL_JSONL);
const ingestorSrc = readOrFail(INGESTOR);
const loaderSrc = readOrFail(LOADER);
const importReceivedSrc = readOrFail(IMPORT_RECEIVED);
const screenSrc = readOrFail(SCREEN);
const commonSrc = readOrFail(COMMON);
const uiSrc = readOrFail(UI);
const detailProgressSrc = readOrFail(DETAIL_PROGRESS);
const detailRenderSrc = readOrFail(DETAIL_RENDER);

// ---------------------------------------------------------------------
// 0. Validacoes estaticas sobre o JSONL real
// ---------------------------------------------------------------------

test('G14-C: JSONL real existe no caminho esperado', function () {
  assert.ok(fs.existsSync(REAL_JSONL),
    'JSONL real nao encontrado em: ' + REAL_JSONL);
});

test('G14-C: JSONL real tem 2 linhas', function () {
  const lines = realJsonl.split('\n').filter(function (l) { return l.trim(); });
  assert.equal(lines.length, 2,
    'esperado 2 linhas; encontrado: ' + lines.length);
});

test('G14-C: cada linha e JSON valido e tem document_id', function () {
  const lines = realJsonl.split('\n').filter(function (l) { return l.trim(); });
  for (let i = 0; i < lines.length; i++) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch (e) {
      assert.fail('linha ' + i + ' nao e JSON valido: ' + e.message);
    }
    assert.ok(obj.document_id, 'linha ' + i + ' sem document_id');
    assert.ok(obj.filename_original, 'linha ' + i + ' sem filename_original');
  }
});

test('G14-C: linha 1 (teste-nfe-entrada.xml) tem pedido_manual e status accepted', function () {
  const obj = JSON.parse(realJsonl.split('\n')[0]);
  assert.equal(obj.filename_original, 'teste-nfe-entrada.xml');
  assert.equal(obj.status, 'accepted');
  assert.equal(obj.pedido_manual, 'PED-99-2026');
  assert.equal(obj.tipo_documento, 'nf');
  assert.equal(obj.formato, 'xml');
  assert.equal(obj.direcao_nf, 'entrada');
});

test('G14-C: linha 2 (L.pdf) tem pedido_manual null e status pending', function () {
  const obj = JSON.parse(realJsonl.split('\n')[1]);
  assert.equal(obj.filename_original, 'L.pdf');
  assert.equal(obj.status, 'pending');
  assert.equal(obj.pedido_manual, null);
});

// ---------------------------------------------------------------------
// 1. Sandbox minimalista para validar o loader + ingestor
// ---------------------------------------------------------------------

function makeIngestorSandbox() {
  const sb = { window: {}, console: console };
  vm.createContext(sb);
  vm.runInContext(ingestorSrc, sb, { filename: 'js/documents-ingestor.js' });
  vm.runInContext(loaderSrc, sb, { filename: 'js/documents-ingestor-loader.js' });
  return sb;
}

test('G14-C: parser aceita JSONL real sem perda de dados', function () {
  const sb = makeIngestorSandbox();
  const result = sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  assert.equal(result.ok, true, 'parse falhou: ' + (result.error || '?'));
  assert.equal(result.count, 2, 'esperado 2 docs no estado global');
});

test('G14-C: parser preserva campos G12-F2 (status, pedido_manual, received_at, accepted_at, linked_at)', function () {
  const sb = makeIngestorSandbox();
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  const docs = sb.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.equal(docs.length, 2);
  const d0 = docs[0];
  assert.equal(d0.schema_version, 1, 'schema_version preservado');
  assert.equal(d0.status, 'accepted');
  assert.equal(d0.pedido_manual, 'PED-99-2026');
  assert.ok(d0.received_at, 'received_at preservado');
  assert.ok(d0.accepted_at, 'accepted_at preservado');
  assert.ok(d0.linked_at, 'linked_at preservado');
});

// ---------------------------------------------------------------------
// 2. mapReceivedDocToEventShape aplicado ao JSONL real
// ---------------------------------------------------------------------

test('G14-C: mapReceivedDocToEventShape converte teste-nfe-entrada.xml com shape correto', function () {
  const sb = makeIngestorSandbox();
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  const docs = sb.window.RAVATEX_DOCUMENTS_RECEIVED;
  const d0 = docs[0]; // teste-nfe-entrada.xml
  const ev = sb.window.RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(d0);
  assert.ok(ev, 'mapper retornou null');
  assert.equal(ev.event_type, 'document.accepted', 'status accepted -> event_type accepted');
  assert.equal(ev.status, 'accepted');
  assert.equal(ev.pedido_manual, 'PED-99-2026');
  assert.equal(ev.document.document_id, d0.document_id);
  assert.equal(ev.document.filename_original, 'teste-nfe-entrada.xml');
  assert.equal(ev.document.tipo_documento, 'nf');
  assert.equal(ev.document.direcao_nf, 'entrada');
  assert.equal(ev.document.drive_web_view_link, d0.drive_web_view_link);
  // created_at deve ser accepted_at (mais recente)
  assert.ok(ev.created_at, 'created_at deve ser preenchido');
  assert.ok(ev.created_at.indexOf('2026-07-07 21:28:30') >= 0,
    'created_at deve usar accepted_at mais recente: ' + ev.created_at);
});

test('G14-C: mapReceivedDocToEventShape converte L.pdf como pending (detected)', function () {
  const sb = makeIngestorSandbox();
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  const docs = sb.window.RAVATEX_DOCUMENTS_RECEIVED;
  const d1 = docs[1]; // L.pdf
  const ev = sb.window.RAVATEX_DOCUMENTS.mapReceivedDocToEventShape(d1);
  assert.equal(ev.event_type, 'document.detected');
  assert.equal(ev.status, 'pending');
  assert.equal(ev.pedido_manual, '', 'pedido_manual null -> string vazia');
  assert.equal(ev.document.filename_original, 'L.pdf');
});

// ---------------------------------------------------------------------
// 3. Render da tela Documentos Mapeados com JSONL real
// ---------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    this._attrs = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
  }
  appendChild(n) { if (n != null) this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  replaceChildren() { this.children = []; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function findAll(node, pred, out) {
  out = out || [];
  if (node && pred(node)) out.push(node);
  if (node && node.children) {
    for (const c of node.children) findAll(c, pred, out);
  }
  return out;
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function makeScreenSandbox() {
  const documentMock = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sb = {
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.CURRENT_USER = { nome: 'Admin', tipo: 'admin' };
  sb.logout = () => {};
  vm.createContext(sb);
  vm.runInContext(uiSrc, sb, { filename: 'js/ui.js' });
  vm.runInContext(ingestorSrc, sb, { filename: 'js/documents-ingestor.js' });
  vm.runInContext(loaderSrc, sb, { filename: 'js/documents-ingestor-loader.js' });
  vm.runInContext(importReceivedSrc, sb, { filename: 'js/documents-ingestor-import-received.js' });
  vm.runInContext(commonSrc, sb, { filename: 'js/screens/common.js' });
  vm.runInContext(screenSrc, sb, { filename: 'js/screens/documentos-recebidos.js' });
  return sb;
}

function importRealJsonlIntoSandbox(sb) {
  // Simula o clique no botao "Importar documentos": le o JSONL real e
  // chama o mesmo codigo que FileReader chamaria.
  const result = sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  if (!result.ok) {
    throw new Error('import falhou: ' + result.error);
  }
  return result;
}

test('G14-C: tela Documentos Mapeados renderiza 2 linhas com JSONL real', function () {
  const sb = makeScreenSandbox();
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, function (n) {
    return n._attrs && n._attrs['data-row'] === 'documento-recebido';
  });
  assert.equal(rows.length, 2,
    'esperado 2 rows (teste-nfe-entrada.xml + L.pdf); encontrado: ' + rows.length);
});

test('G14-C: tela renderiza nome teste-nfe-entrada.xml com status Aceito', function () {
  const sb = makeScreenSandbox();
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, function (n) {
    return n._attrs && n._attrs['data-row'] === 'documento-recebido';
  });
  const aceito = rows.find(function (r) {
    return textOf(r).indexOf('teste-nfe-entrada.xml') >= 0;
  });
  assert.ok(aceito, 'row com teste-nfe-entrada.xml nao encontrada');
  const statusPill = findAll(aceito, function (n) {
    return n._attrs && n._attrs['data-field'] === 'status';
  })[0];
  assert.ok(statusPill, 'pill de status ausente');
  assert.equal(textOf(statusPill), 'Aceito',
    'status pill deve ser "Aceito" para accepted');
});

test('G14-C: tela renderiza L.pdf com status Pendente', function () {
  const sb = makeScreenSandbox();
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, function (n) {
    return n._attrs && n._attrs['data-row'] === 'documento-recebido';
  });
  const lrow = rows.find(function (r) {
    return textOf(r).indexOf('L.pdf') >= 0;
  });
  assert.ok(lrow, 'row com L.pdf nao encontrada');
  const statusPill = findAll(lrow, function (n) {
    return n._attrs && n._attrs['data-field'] === 'status';
  })[0];
  assert.equal(textOf(statusPill), 'Pendente',
    'status pill deve ser "Pendente" para pending');
});

test('G14-C: botao "Importar documentos" presente no header (inline)', function () {
  const sb = makeScreenSandbox();
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const importBtns = findAll(result, function (n) {
    return n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline';
  });
  assert.equal(importBtns.length, 1, 'botao "Importar documentos" ausente no header');
  assert.ok(textOf(importBtns[0]).indexOf('Importar documentos') >= 0,
    'label do botao deve ser "Importar documentos"');
});

test('G14-C: botao legado "Importar eventos" NAO aparece na tela Documentos', function () {
  const sb = makeScreenSandbox();
  // Sem flag explicita: o botao legado NAO deve estar visivel em lugar nenhum.
  delete sb.window.RAVATEX_ENABLE_DOCUMENTS_EVENTS_IMPORT_UI;
  delete sb.window.RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT;
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.equal(allText.indexOf('Importar eventos'), -1,
    'botao legado "Importar eventos" NAO deve aparecer na tela Documentos Mapeados');
  // Tambem verifica que o ID classico do botao legado nao foi criado
  const legacyBtn = findAll(result, function (n) {
    return n.id === 'rv-docs-import-btn';
  });
  assert.equal(legacyBtn.length, 0,
    'botao legado (id=rv-docs-import-btn) NAO deve existir na DOM');
});

test('G14-C: botao "Importar documentos" nao e flutuante (fixed) por padrao', function () {
  const sb = makeScreenSandbox();
  importRealJsonlIntoSandbox(sb);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const importBtns = findAll(result, function (n) {
    return n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline';
  });
  const cssText = importBtns[0]._attrs.style || '';
  assert.equal(cssText.indexOf('position:fixed'), -1,
    'botao "Importar documentos" NAO deve ser position:fixed; cssText=' + cssText);
});

// ---------------------------------------------------------------------
// 4. Pedido Detail consome documento com pedido_manual correspondente
// ---------------------------------------------------------------------

function makePedidoDetailSandbox() {
  const sb = { window: {}, console: console };
  sb.window.el = function (tag, attrs) {
    const children = [];
    for (let i = 2; i < arguments.length; i++) {
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
  vm.createContext(sb);
  vm.runInContext(ingestorSrc, sb, { filename: 'js/documents-ingestor.js' });
  // Carrega o loader (apenas expoe funcoes; NAO popula LOADED_EVENTS nem RECEIVED).
  // Carregar o loader e necessario para que loadReceivedDocumentsFromText exista no sandbox
  // e possamos simular o clique no botao "Importar documentos".
  vm.runInContext(loaderSrc, sb, { filename: 'js/documents-ingestor-loader.js' });
  const opDisplaySrc = readOrFail(path.join(ROOT, 'js', 'op-display.js'));
  const chainStateSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-chain-state.js'));
  const screenSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail.js'));
  const detailDataSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-data.js'));
  const detailEventsSrc = readOrFail(path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js'));
  const bundle = [opDisplaySrc, chainStateSrc, screenSrc, detailDataSrc,
    detailProgressSrc, detailEventsSrc, detailRenderSrc].join('\n\n');
  vm.runInContext(bundle, sb, { filename: 'pedido-detail-bundle.js' });
  return sb;
}

function makePedidoState(ns, numero, ano) {
  const s = ns.createInitialState();
  s.pedido = { id: 'ped-' + numero, numero: numero, status: 'recebido', metros_total: 0 };
  s.pedido.criado_em = ano + '-01-15T10:00:00.000Z';
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

test('G14-C: Pedido Detail (PED-99-2026) renderiza teste-nfe-entrada.xml via bridge', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocsLoaded, true,
    'ingestorDocsLoaded deve ser true via bridge do JSONL real');
  assert.equal(view.ingestorDocumentRows.length, 1,
    'Pedido 99 deve mostrar exatamente 1 doc (L.pdf fica de fora)');
  const row = view.ingestorDocumentRows[0];
  assert.equal(row.label, 'teste-nfe-entrada.xml',
    'nome do doc deve ser teste-nfe-entrada.xml');
  assert.equal(row.status, 'accepted',
    'status deve ser accepted (Aceito)');
  assert.ok(row.driveLink && row.driveLink.indexOf('drive.google.com') >= 0,
    'driveLink deve apontar para Google Drive');
  assert.equal(row.driveLink, 'https://drive.google.com/file/d/1ao8qFfl-Y5Wuiy0xYxu5eWBcN9VMPsVh/view?usp=drivesdk',
    'driveLink deve ser o link real do JSONL');
  // Badges: NF, XML, Entrada
  assert.ok(row.badges.length >= 1, 'pelo menos 1 badge esperado');
  const tipoBadge = row.badges[0];
  assert.equal(tipoBadge.label, 'NF', 'primeira badge deve ser NF');
  // Status meta
  assert.ok(row.statusMeta, 'statusMeta deve existir');
  assert.equal(row.statusMeta.label, 'Aceito', 'statusMeta label = Aceito');
});

test('G14-C: L.pdf (sem pedido_manual) NAO aparece no Pedido Detail de PED-99-2026', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  const hasLPdf = view.ingestorDocumentRows.some(function (r) {
    return r.label === 'L.pdf';
  });
  assert.equal(hasLPdf, false,
    'L.pdf (sem pedido_manual) NAO deve aparecer no Pedido Detail de PED-99-2026');
});

test('G14-C: L.pdf (sem pedido_manual) NAO aparece em Pedido Detail de outro pedido tambem', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  // Pedido 50 (nao tem doc vinculado) — L.pdf nao deve aparecer
  const s = makePedidoState(ns, 50, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocumentRows.length, 0,
    'Pedido 50 sem docs vinculados NAO deve mostrar L.pdf');
});

test('G14-C: timeline do Pedido Detail fica vazia (bridge flat nao cria eventos)', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorTimeline.length, 0,
    'bridge flat nao cria timeline de eventos');
});

// ---------------------------------------------------------------------
// 5. Reimport nao duplica
// ---------------------------------------------------------------------

test('G14-C: reimportar o mesmo JSONL nao duplica no estado global', function () {
  const sb = makeIngestorSandbox();
  const r1 = sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  assert.equal(r1.ok, true);
  assert.equal(r1.count, 2);
  const r2 = sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  assert.equal(r2.ok, true);
  assert.equal(r2.count, 2, '2 docs apos reimport (dedup por document_id)');
  const docs = sb.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.equal(docs.length, 2, 'estado global continua com 2 docs');
  // Verifica que os IDs sao os mesmos
  const ids = docs.map(function (d) { return d.document_id; });
  const unique = Array.from(new Set(ids));
  assert.equal(unique.length, 2, 'document_ids sao unicos');
});

test('G14-C: reimportar o mesmo JSONL nao duplica no Pedido Detail', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  // Reimport (simula duplo clique no botao "Importar documentos")
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocumentRows.length, 1,
    'apos 2 imports do mesmo JSONL, Pedido Detail ainda mostra 1 doc (sem duplicar)');
  // Verifica que o bridge faz dedup por document_id
  const labels = view.ingestorDocumentRows.map(function (r) { return r.label; });
  const uniqueLabels = Array.from(new Set(labels));
  assert.equal(uniqueLabels.length, view.ingestorDocumentRows.length,
    'todos os labels sao unicos no Pedido Detail');
});

// ---------------------------------------------------------------------
// 6. Evidencia final: resumo do smoke
// ---------------------------------------------------------------------

test('G14-C EVIDENCIA: fluxo completo importa + exibe + dedup', function () {
  // Este teste existe apenas para registrar a "passagem" do smoke.
  // Ele re-executa o fluxo completo e imprime o resultado em formato
  // legivel para coleta de evidencia.
  const sbIngestor = makeIngestorSandbox();
  const r1 = sbIngestor.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(realJsonl);
  assert.equal(r1.ok, true, 'import do JSONL real deve ser OK');
  const docsLoaded = sbIngestor.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.equal(docsLoaded.length, 2);

  const sbScreen = makeScreenSandbox();
  importRealJsonlIntoSandbox(sbScreen);
  const container = new FakeNode('div');
  sbScreen.container = container;
  const screenResult = vm.runInContext('window.screenDocumentosRecebidos(container)', sbScreen);
  const rows = findAll(screenResult, function (n) {
    return n._attrs && n._attrs['data-row'] === 'documento-recebido';
  });
  assert.equal(rows.length, 2, 'tela Documentos Mapeados renderiza 2 rows');

  const sbPedido = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sbPedido);
  const ns = sbPedido.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocumentRows.length, 1,
    'Pedido Detail (PED-99-2026) mostra 1 doc');

  // Reimport no Pedido Detail - ainda 1 doc
  importRealJsonlIntoSandbox(sbPedido);
  const s2 = makePedidoState(ns, 99, 2026);
  const view2 = ns.computeViewModel(s2);
  assert.equal(view2.ingestorDocumentRows.length, 1,
    'apos reimport, ainda 1 doc (dedup por document_id)');

  // Registro estruturado para coleta de evidencia
  const evidence = {
    jsonlPath: REAL_JSONL,
    jsonlLines: realJsonl.split('\n').filter(function (l) { return l.trim(); }).length,
    docsAfterImport: docsLoaded.length,
    documentRowsOnScreen: rows.length,
    documentRowLabels: rows.map(function (r) { return textOf(r).split('\n').join(' ').slice(0, 80); }),
    pedido99View: {
      ingestorDocsLoaded: view.ingestorDocsLoaded,
      ingestorDocumentRows: view.ingestorDocumentRows.length,
      rowLabel: view.ingestorDocumentRows[0] ? view.ingestorDocumentRows[0].label : null,
      rowStatus: view.ingestorDocumentRows[0] ? view.ingestorDocumentRows[0].status : null,
    },
    pedido99ViewAfterReimport: {
      ingestorDocumentRows: view2.ingestorDocumentRows.length,
    },
  };
  console.log('G14-C EVIDENCE:', JSON.stringify(evidence, null, 2));
});

test('G20-B: Pedido Detail bridge reflete decisao local quando localStorage tem override', function () {
  const ls = { data: {} };
  ls.getItem = function (k) { return this.data[k] != null ? String(this.data[k]) : null; };
  ls.setItem = function (k, v) { this.data[k] = String(v); };
  ls.removeItem = function (k) { delete this.data[k]; };

  const sb = makePedidoDetailSandbox();
  sb.localStorage = ls;
  importRealJsonlIntoSandbox(sb);

  const firstDoc = sb.window.RAVATEX_DOCUMENTS_RECEIVED[0];
  const docId = firstDoc.document_id;
  const saveR = vm.runInContext(
    'window.RAVATEX_DOCUMENTS.saveDocumentDecision(' + JSON.stringify(docId) + ', { status: "rejected", motivo: "teste bridge" })',
    sb
  );
  assert.ok(saveR && saveR.ok, 'decisao salva');

  const eff = vm.runInContext(
    'window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus(' + JSON.stringify(docId) + ', "accepted")',
    sb
  );
  assert.equal(eff.importedStatus, 'accepted', 'importado accepted');
  assert.equal(eff.effectiveStatus, 'rejected', 'efetivo rejected');
  assert.ok(eff.isLocalDecision, 'e decisao local');
  assert.ok(eff.isDivergent, 'e divergente');

  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.equal(view.ingestorDocsLoaded, true, 'ingestorDocsLoaded true');
  assert.equal(view.ingestorDocumentRows.length, 1, '1 doc');
  const row = view.ingestorDocumentRows[0];
  assert.ok(row.isLocalDecision, 'isLocalDecision true no Pedido Detail');
  assert.equal(row.status, 'rejected', 'status reflete decisao local rejected');
});

test('G20-B: Pedido Detail bridge mantem status importado quando nao ha decisao local', function () {
  const sb = makePedidoDetailSandbox();
  importRealJsonlIntoSandbox(sb);
  const ns = sb.window.RAVATEX_SCREENS.pedidoDetail;
  const s = makePedidoState(ns, 99, 2026);
  const view = ns.computeViewModel(s);
  assert.ok(view.ingestorDocsLoaded, 'ingestorDocsLoaded true');
  const row = view.ingestorDocumentRows[0];
  assert.equal(row.status, 'accepted', 'status importado accepted preservado');
  assert.strictEqual(row.isLocalDecision, undefined, 'sem isLocalDecision');
});
