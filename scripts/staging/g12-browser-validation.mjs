// =====================================================================
// === scripts/staging/g12-browser-validation.mjs ========================
// Validacao operacional da trilha G12 (received documents) no
// Controle de Tapetes. Read-only, sem side-effects em DB/Drive/Google.
//
// Simula um ambiente de browser real (staging + admin) carregando
// os modulos de producao no mesmo <script> order de index.html,
// exercitando os fluxos:
//
//   1. console probes (APP_ENV, CURRENT_USER, globals)
//   2. import legado (document-events.jsonl) -> popula LOADED_EVENTS
//   3. import novo (documentos-recebidos.jsonl) -> popula RECEIVED
//   4. tela Documentos -> renderiza a fila
//   5. Pedido Detail -> continua consumindo LOADED_EVENTS (legado)
//
// Saida: relatorio em stdout. Exit code 0 = passou.
//
// Uso:
//   node scripts/staging/g12-browser-validation.mjs
// =====================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function read(p) { return readFileSync(p, 'utf8'); }

const src = {
  ui: read(join(ROOT, 'js', 'ui.js')),
  ingestor: read(join(ROOT, 'js', 'documents-ingestor.js')),
  loader: read(join(ROOT, 'js', 'documents-ingestor-loader.js')),
  importLegacy: read(join(ROOT, 'js', 'documents-ingestor-import-ui.js')),
  importReceived: read(join(ROOT, 'js', 'documents-ingestor-import-received.js')),
  common: read(join(ROOT, 'js', 'screens', 'common.js')),
  docScreen: read(join(ROOT, 'js', 'screens', 'documentos-recebidos.js')),
  pedidoChainState: read(join(ROOT, 'js', 'screens', 'pedido-chain-state.js')),
  pedidoDetail: read(join(ROOT, 'js', 'screens', 'pedido-detail.js')),
  pedidoDetailData: read(join(ROOT, 'js', 'screens', 'pedido-detail-data.js')),
  pedidoDetailProgress: read(join(ROOT, 'js', 'screens', 'pedido-detail-progress.js')),
  pedidoDetailEvents: read(join(ROOT, 'js', 'screens', 'pedido-detail-events.js')),
  pedidoDetailRender: read(join(ROOT, 'js', 'screens', 'pedido-detail-render.js')),
  opDisplay: read(join(ROOT, 'js', 'op-display.js')),
};

const fixtureText = read(join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl'));

const RECEIVED_JSONL = [
  JSON.stringify({
    document_id: 'doc-rcv-1',
    gmail_message_id: 'msg-rcv-1',
    filename_original: 'NF-001.xml',
    tipo_documento: 'nf',
    formato: 'xml',
    direcao_nf: 'entrada',
    drive_file_id: 'drive-1',
    drive_web_view_link: 'https://drive.google.com/file/d/1/view',
    created_at: '2026-07-08T10:00:00.000Z',
  }),
  JSON.stringify({
    document_id: 'doc-rcv-2',
    gmail_message_id: 'msg-rcv-2',
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    direcao_nf: null,
    created_at: '2026-07-08T10:10:00.000Z',
  }),
  JSON.stringify({
    document_id: 'doc-rcv-3-no-link',
    gmail_message_id: 'msg-rcv-3',
    filename_original: 'NF-no-link.pdf',
    tipo_documento: 'nf',
    formato: 'pdf',
    direcao_nf: 'saida',
    drive_web_view_link: null,
    created_at: '2026-07-08T10:20:00.000Z',
  }),
].join('\n');

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this._attrs = {};
    this._listeners = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.type = '';
    this.files = null;
  }
  appendChild(n) { if (n != null) this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
  replaceChildren(...nodes) { this.children = nodes.filter(n => n != null); }
  click() {
    if (this.type === 'file' && (!this.files || this.files.length === 0)) {
      this.files = [{ name: 'fixture.jsonl' }];
    }
    (this._listeners.click || []).forEach(fn => fn());
    if (this.type === 'file') {
      (this._listeners.change || []).forEach(fn => fn());
    }
  }
}

const toasts = [];
const fileReaders = [];
const allElements = [];

const documentMock = {
  createElement: (t) => {
    const el = new FakeNode(t);
    allElements.push(el);
    return el;
  },
  createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
  querySelector: () => new FakeNode('div'),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  body: {
    appendChild: (el) => { /* ok */ },
    children: [],
  },
  documentElement: { tagName: 'HTML' },
};

class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
    fileReaders.push(this);
  }
  readAsText(_file) {
    this.result = MockFileReader._nextContent;
    if (this.onload) this.onload();
  }
}
MockFileReader.EMPTY = 0;
MockFileReader.DONE = 2;
MockFileReader.LOADING = 1;
MockFileReader._nextContent = '';

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  document: documentMock,
  FileReader: MockFileReader,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

sandbox.APP_ENV = 'staging';
sandbox.CURRENT_USER = { nome: 'Admin G12', tipo: 'admin' };
sandbox.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI = true;

sandbox.toast = (msg, type) => { toasts.push({ msg, type: type || 'info' }); };

vm.createContext(sandbox);

vm.runInContext(src.ui, sandbox, { filename: 'js/ui.js' });
vm.runInContext(src.ingestor, sandbox, { filename: 'js/documents-ingestor.js' });
vm.runInContext(src.loader, sandbox, { filename: 'js/documents-ingestor-loader.js' });
vm.runInContext(src.importLegacy, sandbox, { filename: 'js/documents-ingestor-import-ui.js' });
vm.runInContext(src.importReceived, sandbox, { filename: 'js/documents-ingestor-import-received.js' });
vm.runInContext(src.common, sandbox, { filename: 'js/screens/common.js' });
vm.runInContext(src.docScreen, sandbox, { filename: 'js/screens/documentos-recebidos.js' });

// ui.js define uma funcao toast propria. Sobrescrevemos pela nossa
// coletora (a que empurra para o array `toasts`) APOS todos os modulos
// carregarem, para que o comportamento da import UI seja captado.
sandbox.toast = (msg, type) => { toasts.push({ msg, type: type || 'info' }); };

// Inicializa as globais como arrays vazios para que os probes
// "Array.isArray(...)" retornem true. setDocumentsIngestorEvents([])
// e setReceivedDocuments([]) escrevem [] no estado correspondente.
get('window.RAVATEX_DOCUMENTS.setDocumentsIngestorEvents([])');
get('window.RAVATEX_DOCUMENTS.setReceivedDocuments([])');

const lines = [];
const ok = (msg) => lines.push('[ OK ] ' + msg);
const fail = (msg) => lines.push('[FAIL] ' + msg);

function get(name) { return vm.runInContext(name, sandbox); }

lines.push('=================================================================');
lines.push('RAVATEX-TAPETES-G12 BROWSER VALIDATION');
lines.push('=================================================================');

// 1. Console probes
lines.push('');
lines.push('--- 1. CONSOLE PROBES ---');
const probes = [
  ['window.APP_ENV', get('window.APP_ENV'), 'staging'],
  ['window.CURRENT_USER.tipo', get('window.CURRENT_USER.tipo'), 'admin'],
  ['Array.isArray(LOADED_EVENTS)', get('Array.isArray(window.RAVATEX_DOCUMENTS_LOADED_EVENTS)'), true],
  ['Array.isArray(RECEIVED)', get('Array.isArray(window.RAVATEX_DOCUMENTS_RECEIVED)'), true],
  ['typeof loadDocumentsIngestorEventsFromText', get('typeof window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText'), 'function'],
  ['typeof loadReceivedDocumentsFromText', get('typeof window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText'), 'function'],
  ['typeof screenDocumentosRecebidos', get('typeof window.screenDocumentosRecebidos'), 'function'],
  ['typeof screenPedidoDetalhe', get('typeof window.screenPedidoDetalhe'), 'undefined'],
];
for (const [name, val, expected] of probes) {
  if (val === expected) ok(name + ' = ' + JSON.stringify(val));
  else fail(name + ' = ' + JSON.stringify(val) + ' (esperado: ' + JSON.stringify(expected) + ')');
}

// 2. Botoes de import: ambos aparecem (admin + staging)
lines.push('');
lines.push('--- 2. BOTOES DE IMPORT (admin + staging) ---');
const legacyBtn = allElements.find(el => el.tagName === 'BUTTON' && el.id === 'rv-docs-import-btn');
const receivedBtn = allElements.find(el => el.tagName === 'BUTTON' && el.id === 'rv-docs-received-import-btn');
if (legacyBtn) ok('botao legado presente: rv-docs-import-btn');
else fail('botao legado AUSENTE: rv-docs-import-btn');
if (receivedBtn) ok('botao novo presente: rv-docs-received-import-btn');
else fail('botao novo AUSENTE: rv-docs-received-import-btn');
if (legacyBtn && receivedBtn) {
  // Distinguibilidade visual: cor diferente (lendo de cssText)
  const legacyCss = (legacyBtn.style.cssText || '');
  const receivedCss = (receivedBtn.style.cssText || '');
  const legacyColor = legacyCss.indexOf('#2563eb') >= 0;
  const receivedColor = receivedCss.indexOf('#18794a') >= 0;
  if (legacyColor && receivedColor) ok('botoes visualmente distinguiveis (azul #2563eb vs verde #18794a)');
  else fail('cores: legacy=' + legacyCss.slice(0, 80) + ' received=' + receivedCss.slice(0, 80));
  if (legacyBtn.textContent !== receivedBtn.textContent) {
    ok('labels distintos: "' + legacyBtn.textContent + '" vs "' + receivedBtn.textContent + '"');
  } else {
    fail('labels iguais: ' + legacyBtn.textContent);
  }
}

// 3. Import legado (document-events.jsonl)
lines.push('');
lines.push('--- 3. IMPORT LEGADO: document-events.jsonl ---');
const legacyInput = allElements.find(el => el.tagName === 'INPUT' && el.id === 'rv-docs-import-input');
const receivedInput = allElements.find(el => el.tagName === 'INPUT' && el.id === 'rv-docs-received-import-input');

if (legacyInput) {
  toasts.length = 0;
  MockFileReader._nextContent = fixtureText;
  // Dispara o fluxo real: click no botao -> fileInput.click() -> change handler
  legacyBtn.click();
  const loadedEvents = get('window.RAVATEX_DOCUMENTS_LOADED_EVENTS');
  const received = get('window.RAVATEX_DOCUMENTS_RECEIVED');
  if (Array.isArray(loadedEvents) && loadedEvents.length === 7) {
    ok('RAVATEX_DOCUMENTS_LOADED_EVENTS populado com 7 eventos (legado)');
  } else {
    fail('RAVATEX_DOCUMENTS_LOADED_EVENTS.length = ' + (loadedEvents && loadedEvents.length) + ' (esperado: 7)');
  }
  const successToast = toasts.find(t => t.type === 'success');
  if (successToast && successToast.msg.indexOf('document-events.jsonl') >= 0) {
    ok('toast sucesso menciona document-events.jsonl: "' + successToast.msg.slice(0, 80) + '..."');
  } else {
    fail('toast sucesso do legado (count=' + toasts.length + '): ' + JSON.stringify(toasts));
  }
  if (!received || received.length === 0) {
    ok('RAVATEX_DOCUMENTS_RECEIVED NAO populado pelo legado (isolamento OK)');
  } else {
    fail('RECEIVED foi populado pelo legado: ' + received.length);
  }
}

// 4. Import novo (documentos-recebidos.jsonl)
lines.push('');
lines.push('--- 4. IMPORT NOVO: documentos-recebidos.jsonl ---');
if (receivedInput) {
  toasts.length = 0;
  MockFileReader._nextContent = RECEIVED_JSONL;
  // Dispara o fluxo real: click no botao -> fileInput.click() -> change handler
  receivedBtn.click();
  const received = get('window.RAVATEX_DOCUMENTS_RECEIVED');
  const loadedEvents = get('window.RAVATEX_DOCUMENTS_LOADED_EVENTS');
  if (Array.isArray(received) && received.length === 3) {
    ok('RAVATEX_DOCUMENTS_RECEIVED populado com 3 docs (novo)');
  } else {
    fail('RAVATEX_DOCUMENTS_RECEIVED.length = ' + (received && received.length) + ' (esperado: 3)');
  }
  if (Array.isArray(loadedEvents) && loadedEvents.length === 7) {
    ok('RAVATEX_DOCUMENTS_LOADED_EVENTS preservado com 7 eventos (legado intacto)');
  } else {
    fail('LOADED_EVENTS foi alterado: ' + (loadedEvents && loadedEvents.length));
  }
  const successToast = toasts.find(t => t.type === 'success');
  if (successToast && successToast.msg.indexOf('documentos-recebidos.jsonl') >= 0
      && successToast.msg.indexOf('Documentos') >= 0
      && successToast.msg.indexOf('Nada foi persistido') >= 0) {
    ok('toast sucesso distinto: "' + successToast.msg.slice(0, 110) + '..."');
  } else {
    fail('toast sucesso do novo: ' + JSON.stringify(toasts));
  }
}

// 5. Tela Documentos (#/documentos/recebidos)
lines.push('');
lines.push('--- 5. TELA DOCUMENTOS (#/documentos/recebidos) ---');
const container = new FakeNode('div');
sandbox.container = container;
const screen = vm.runInContext('window.screenDocumentosRecebidos(container)', sandbox);
function findAll(node, pred, out) {
  out = out || [];
  if (node && pred(node)) out.push(node);
  if (node && node.children) for (const c of node.children) findAll(c, pred, out);
  return out;
}
function textOf(n) {
  if (n && n.children && n.children.length) return n.children.map(textOf).join('');
  return (n && n.textContent) || '';
}
function hasRowAttr(name, value) {
  return function (n) { return n && n._attrs && n._attrs[name] === value; };
}

const rows = findAll(screen, hasRowAttr('data-row', 'documento-recebido'));
if (rows.length === 3) ok('renderizou 3 rows com data-row="documento-recebido"');
else fail('rows: ' + rows.length + ' (esperado: 3)');

const verBtns = findAll(screen, hasRowAttr('data-action', 'ver-documento-drive'));
const semLinks = findAll(screen, hasRowAttr('data-action', 'sem-link'));
if (verBtns.length === 1) ok('1 botao Ver (doc-rcv-1 com drive_web_view_link)');
else fail('botoes Ver: ' + verBtns.length + ' (esperado: 1)');
if (semLinks.length === 2) ok('2 placeholders Sem link (doc-rcv-2 e doc-rcv-3-no-link)');
else fail('placeholders Sem link: ' + semLinks.length + ' (esperado: 2)');

// Verifica badge Pendente
const allText = JSON.stringify(findAll(screen, () => true).map(textOf));
if (allText.indexOf('Pendente') >= 0) ok('badge "Pendente" presente');
else fail('badge "Pendente" AUSENTE');
if (allText.indexOf('NF-001.xml') >= 0) ok('filename doc-rcv-1 renderizado');
else fail('filename doc-rcv-1 AUSENTE');
if (allText.indexOf('NF') >= 0) ok('badge tipo NF presente');
else fail('badge tipo NF AUSENTE');
if (allText.indexOf('XML') >= 0) ok('badge formato XML presente');
else fail('badge formato XML AUSENTE');
if (allText.indexOf('Entrada') >= 0) ok('badge direcao Entrada presente');
else fail('badge direcao Entrada AUSENTE');

// Verifica que shellLayout envolveu o conteudo
const header = screen.children.find(c => c.tagName === 'HEADER');
if (header) ok('shellLayout presente (HEADER renderizado)');
else fail('shellLayout AUSENTE');

// 6. Pedido Detail: so consome LOADED_EVENTS
lines.push('');
lines.push('--- 6. PEDIDO DETAIL: isolamento do estado legado ---');
const pedidoBundle = [
  src.opDisplay, src.pedidoChainState, src.pedidoDetail, src.pedidoDetailData,
  src.pedidoDetailProgress, src.pedidoDetailEvents, src.pedidoDetailRender,
].join('\n\n');
vm.runInContext(pedidoBundle, sandbox, { filename: 'pedido-detail-bundle.js' });

const ns = sandbox.window.RAVATEX_SCREENS.pedidoDetail;
if (ns && typeof ns.createInitialState === 'function') {
  const s = ns.createInitialState();
  s.pedido = { id: 'ped-g12', numero: 25, status: 'recebido', metros_total: 0 };
  s.pedido.criado_em = '2026-01-15T10:00:00.000Z';
  s.itens = []; s.ops = []; s.entregaItens = []; s.entregasById = {};
  s.opLatexEntregas = []; s.expedicoes = []; s.expedicaoItens = [];
  s.modelosById = {}; s.coresById = {};

  const view = ns.computeViewModel(s);
  if (view.ingestorDocsLoaded === true) ok('Pedido Detail reconheceu o estado legado carregado');
  else fail('Pedido Detail NAO reconheceu estado legado: ' + view.ingestorDocsLoaded);
  if (view.ingestorDocumentRows.length === 3) ok('Pedido Detail consolida 3 docs (legado)');
  else fail('Pedido Detail docs: ' + view.ingestorDocumentRows.length);
  if (view.ingestorTimeline.length === 7) ok('Pedido Detail timeline tem 7 eventos (legado)');
  else fail('Pedido Detail timeline: ' + view.ingestorTimeline.length);
  if (!('receivedDocumentRows' in view)) {
    ok('Pedido Detail NAO tem coluna receivedDocumentRows (isolamento OK)');
  } else {
    fail('Pedido Detail tem receivedDocumentRows (vazamento!)');
  }
  // Confirma que LOADED_EVENTS ainda tem 7
  const stillLegacy = get('window.RAVATEX_DOCUMENTS_LOADED_EVENTS');
  if (Array.isArray(stillLegacy) && stillLegacy.length === 7) {
    ok('LOADED_EVENTS permanece com 7 eventos apos Pedido Detail');
  } else {
    fail('LOADED_EVENTS nao preservado: ' + (stillLegacy && stillLegacy.length));
  }
  // Confirma que RECEIVED ainda tem 3
  const stillReceived = get('window.RAVATEX_DOCUMENTS_RECEIVED');
  if (Array.isArray(stillReceived) && stillReceived.length === 3) {
    ok('RECEIVED permanece com 3 docs apos Pedido Detail');
  } else {
    fail('RECEIVED nao preservado: ' + (stillReceived && stillReceived.length));
  }
}

// Resumo
lines.push('');
lines.push('--- RESUMO ---');
const passed = lines.filter(l => l.startsWith('[ OK ]')).length;
const failed = lines.filter(l => l.startsWith('[FAIL]')).length;
lines.push('Passou: ' + passed);
lines.push('Falhou: ' + failed);
lines.push('Estado final:');
lines.push('  RAVATEX_DOCUMENTS_LOADED_EVENTS.length = ' + (get('window.RAVATEX_DOCUMENTS_LOADED_EVENTS') || []).length);
lines.push('  RAVATEX_DOCUMENTS_RECEIVED.length       = ' + (get('window.RAVATEX_DOCUMENTS_RECEIVED') || []).length);

console.log(lines.join('\n'));
process.exit(failed === 0 ? 0 : 1);
