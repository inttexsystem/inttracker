// =====================================================================
// === tests/documentos-recebidos.smoke.js =============================
// Smoke test da tela admin js/screens/documentos-recebidos.js
// (`screenDocumentosRecebidos`) e sua integração com
// `window.RAVATEX_DOCUMENTS_RECEIVED` (loader do G12-G1).
//
// Fase: RAVATEX-TAPETES-G12-G2-RECEIVED-DOCUMENTS-GLOBAL-SCREEN
//       + G12-F2-MAPPED-DOCUMENTS-CONSUMER-PATCH
// Escopo: valida a fila global de documentos recebidos, separada do
//   estado do Pedido Detail (RAVATEX_DOCUMENTS_LOADED_EVENTS).
//
// Garante:
//   - arquivo existe e sintaxe JS valida;
//   - expoe window.screenDocumentosRecebidos e
//     RAVATEX_SCREENS.documentosRecebidos;
//   - index.html carrega documentos-recebidos.js EXATAMENTE UMA VEZ;
//   - ordem: documents-ingestor + loader antes de common + tela antes
//     de boot;
//   - boot.js registra a rota '#/documentos/recebidos' (admin-only);
//   - ADMIN_MENU contem entrada "Documentos" -> '#/documentos/recebidos';
//   - tela renderiza empty state se RAVATEX_DOCUMENTS_RECEIVED ausente
//     ou vazio, no layout "Documentos Mapeados";
//   - acoes "Atualizar agora" e "Importar documentos" ficam no header;
//   - strip de varredura e compacta e tem toggle play/pause;
//   - rows usam icones especificos por formato (xml/pdf/etc.) antes do nome;
//   - tela renderiza card com 1+ documentos quando o estado esta
//     populado;
//   - badges de tipo/formato/direcao aparecem para os campos
//     preenchidos;
//   - status pill "Pendente" sempre visivel (default + pending);
//   - botao "Ver" chama window.open com noopener,noreferrer;
//   - documento sem drive_web_view_link mostra "Sem link";
//   - NAO le RAVATEX_DOCUMENTS_LOADED_EVENTS (estado legado continua
//     intocado);
//   - NAO referencia Supabase, Google/Drive, fetch, localStorage;
//   - G12-F2: tela usa received_at quando created_at nao existe;
//   - G12-F2: tela mapeia status (pending/assigned/accepted/rejected);
//   - G12-F2: tela continua aceitando formato antigo (regressao);
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCREEN = path.join(ROOT, 'js', 'screens', 'documentos-recebidos.js');
const INGESTOR = path.join(ROOT, 'js', 'documents-ingestor.js');
const LOADER = path.join(ROOT, 'js', 'documents-ingestor-loader.js');
const COMMON = path.join(ROOT, 'js', 'screens', 'common.js');
const BOOT = path.join(ROOT, 'js', 'boot.js');
const UI = path.join(ROOT, 'js', 'ui.js');
const INDEX = path.join(ROOT, 'index.html');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const screen = readOrFail(SCREEN);
const ingestor = readOrFail(INGESTOR);
const loader = readOrFail(LOADER);
const IMPORT_RECEIVED = path.join(ROOT, 'js', 'documents-ingestor-import-received.js');
const importReceivedSrc = readOrFail(IMPORT_RECEIVED);
const AUTO_LOAD = path.join(ROOT, 'js', 'documents-ingestor-auto-load.js');
const autoLoadSrc = readOrFail(AUTO_LOAD);
const READER = path.join(ROOT, 'js', 'documents-supabase-reader.js');
const readerSrc = readOrFail(READER);
const COMMAND = path.join(ROOT, 'js', 'documents-decision-command.js');
const commandSrc = readOrFail(COMMAND);
const VALIDATION_CMD = path.join(ROOT, 'js', 'documents-validation-command.js');
const validationCmdSrc = readOrFail(VALIDATION_CMD);
const LINKS = path.join(ROOT, 'js', 'documents-supabase-links.js');
const linksSrc = readOrFail(LINKS);
const CONTROLLER = path.join(ROOT, 'js', 'documents-decision-controller.js');
const controllerSrc = readOrFail(CONTROLLER);
const DECISION_MODAL = path.join(ROOT, 'js', 'screens', 'documentos-recebidos-decision-modal.js');
const decisionModalSrc = readOrFail(DECISION_MODAL);
const SCAN_TRIGGER = path.join(ROOT, 'js', 'documents-scan-trigger.js');
const scanTriggerSrc = readOrFail(SCAN_TRIGGER);
const READ_MODEL = path.join(ROOT, 'js', 'document-queue-read-model.js');
const readModelSrc = readOrFail(READ_MODEL);
const QUEUE_UI = path.join(ROOT, 'js', 'screens', 'documentos-recebidos-queue-ui.js');
const queueUISrc = readOrFail(QUEUE_UI);
const common = readOrFail(COMMON);
const boot = readOrFail(BOOT);
const ui = readOrFail(UI);
const index = readOrFail(INDEX);

// ---------------------------------------------------------------------
// 1. Existencia e sintaxe
// ---------------------------------------------------------------------

test('documentos-recebidos: arquivo existe', function () {
  assert.ok(fs.existsSync(SCREEN), 'js/screens/documentos-recebidos.js ausente');
});

test('documentos-recebidos: sintaxe JS valida', function () {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', SCREEN], { stdio: 'pipe' }
  );
});

test('documentos-recebidos: expoe window.screenDocumentosRecebidos', function () {
  assert.match(screen, /window\.screenDocumentosRecebidos\s*=\s*screenDocumentosRecebidos/,
    'tela nao expoe window.screenDocumentosRecebidos');
});

test('documentos-recebidos: expoe RAVATEX_SCREENS.documentosRecebidos', function () {
  assert.match(screen, /window\.RAVATEX_SCREENS\.documentosRecebidos\s*=/,
    'tela nao expoe RAVATEX_SCREENS.documentosRecebidos');
});

// ---------------------------------------------------------------------
// 2. index.html: ordem de scripts
// ---------------------------------------------------------------------

test('index.html: documentos-recebidos.js carregado EXATAMENTE UMA VEZ', function () {
  const re = /<script\s+src="js\/screens\/documentos-recebidos\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matches = index.match(re) || [];
  assert.equal(matches.length, 1, 'documentos-recebidos.js deve ser carregado 1 vez');
});

test('index.html: carrega webfont Tabler Icons para icones de arquivos', function () {
  assert.ok(index.indexOf('@tabler/icons-webfont@3.44.0/dist/tabler-icons.min.css') >= 0,
    'index deve carregar Tabler Icons webfont');
});

test('index.html: ordem documents-ingestor + loader < common < documentos-recebidos < boot', function () {
  const idxIngestor = index.indexOf('js/documents-ingestor.js');
  const idxLoader = index.indexOf('js/documents-ingestor-loader.js');
  const idxReader = index.indexOf('js/documents-supabase-reader.js');
  const idxCommon = index.indexOf('js/screens/common.js');
  const idxScreen = index.indexOf('js/screens/documentos-recebidos.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxIngestor > 0, 'ingestor ausente');
  assert.ok(idxLoader > 0, 'loader ausente');
  assert.ok(idxReader > 0, 'reader Supabase ausente');
  assert.ok(idxCommon > 0, 'common ausente');
  assert.ok(idxScreen > 0, 'documentos-recebidos ausente');
  assert.ok(idxBoot > 0, 'boot ausente');
  assert.ok(idxIngestor < idxLoader, 'ingestor antes do loader');
  assert.ok(idxLoader < idxReader, 'loader antes do reader');
  assert.ok(idxReader < idxCommon, 'reader antes do common');
  assert.ok(idxLoader < idxCommon, 'loader antes do common');
  assert.ok(idxCommon < idxScreen, 'common antes da tela');
  assert.ok(idxScreen < idxBoot, 'tela antes do boot');
});

test('index.html (G28-B4-B2): document-queue-read-model e queue-ui carregados uma vez cada', function () {
  const rmMatches = index.match(/js\/document-queue-read-model\.js/g) || [];
  const quMatches = index.match(/js\/screens\/documentos-recebidos-queue-ui\.js/g) || [];
  assert.equal(rmMatches.length, 1, 'document-queue-read-model.js uma vez');
  assert.equal(quMatches.length, 1, 'documentos-recebidos-queue-ui.js uma vez');
});

test('index.html (G28-B4-B2): read-model < queue-ui < documentos-recebidos < boot', function () {
  const idxReadModel = index.indexOf('js/document-queue-read-model.js');
  const idxQueueUI = index.indexOf('js/screens/documentos-recebidos-queue-ui.js');
  const idxScreen = index.indexOf('js/screens/documentos-recebidos.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxReadModel > 0, 'read-model presente');
  assert.ok(idxQueueUI > 0, 'queue-ui presente');
  assert.ok(idxScreen > 0, 'documentos-recebidos presente');
  assert.ok(idxBoot > 0, 'boot presente');
  assert.ok(idxReadModel < idxQueueUI, 'read-model antes do queue-ui');
  assert.ok(idxQueueUI < idxScreen, 'queue-ui antes da tela');
  assert.ok(idxScreen < idxBoot, 'tela antes do boot');
});

// ---------------------------------------------------------------------
// G28-B5-D4-R1: document decision wiring script-tag checks
// ---------------------------------------------------------------------

test('index.html (G28-B5-D4-R1): modulos de decisao carregados EXATAMENTE UMA VEZ', function () {
  const reCmd = /<script\s+src="js\/documents-decision-command\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matchesCmd = index.match(reCmd) || [];
  assert.equal(matchesCmd.length, 1, 'documents-decision-command.js deve ser carregado 1 vez');

  const reModal = /<script\s+src="js\/screens\/documentos-recebidos-decision-modal\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matchesModal = index.match(reModal) || [];
  assert.equal(matchesModal.length, 1, 'documentos-recebidos-decision-modal.js deve ser carregado 1 vez');

  const reCtrl = /<script\s+src="js\/documents-decision-controller\.js(?:\?[^"]*)?"\s*><\/script>/g;
  const matchesCtrl = index.match(reCtrl) || [];
  assert.equal(matchesCtrl.length, 1, 'documents-decision-controller.js deve ser carregado 1 vez');
});

test('index.html (G28-B5-D4-R1): ordem decisions < reader < command < modal < controller < screen', function () {
  const idxDecisions = index.indexOf('js/documents-supabase-decisions.js');
  const idxReader = index.indexOf('js/documents-supabase-reader.js');
  const idxCmd = index.indexOf('js/documents-decision-command.js');
  const idxModal = index.indexOf('js/screens/documentos-recebidos-decision-modal.js');
  const idxCtrl = index.indexOf('js/documents-decision-controller.js');
  const idxScreen = index.indexOf('js/screens/documentos-recebidos.js');

  assert.ok(idxDecisions > 0, 'decisions presente');
  assert.ok(idxReader > 0, 'reader presente');
  assert.ok(idxCmd > 0, 'command presente');
  assert.ok(idxModal > 0, 'modal presente');
  assert.ok(idxCtrl > 0, 'controller presente');
  assert.ok(idxScreen > 0, 'screen presente');

  assert.ok(idxDecisions < idxReader, 'decisions antes do reader');
  assert.ok(idxReader < idxCmd, 'reader antes do command');
  assert.ok(idxCmd < idxModal, 'command antes do modal');
  assert.ok(idxModal < idxCtrl, 'modal antes do controller');
  assert.ok(idxCtrl < idxScreen, 'controller antes da tela');
});

test('documentos-recebidos (G28-B4-B2): tela referencia o namespace queue-ui', function () {
  assert.ok(screen.indexOf('RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI') >= 0,
    'tela deve referenciar RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI');
});

test('documentos-recebidos-queue-ui: arquivo existe e sintaxe JS valida', function () {
  assert.ok(fs.existsSync(QUEUE_UI), 'js/screens/documentos-recebidos-queue-ui.js ausente');
  require('node:child_process').execFileSync(
    process.execPath, ['--check', QUEUE_UI], { stdio: 'pipe' }
  );
});

// ---------------------------------------------------------------------
// 3. boot.js registra a rota
// ---------------------------------------------------------------------

test('boot.js: registra rota #/documentos/recebidos com role admin', function () {
  assert.match(
    boot,
    /'#\/documentos\/recebidos'\s*:\s*\{\s*render\s*:\s*window\.screenDocumentosRecebidos[^}]*roles\s*:\s*\[\s*['"]admin['"]\s*\]/i,
    "rota #/documentos/recebidos deve ser registrada com role admin e render=screenDocumentosRecebidos"
  );
});

// ---------------------------------------------------------------------
// 4. ADMIN_MENU contem "Documentos"
// ---------------------------------------------------------------------

test('common.js: ADMIN_MENU contem entrada Documentos -> #/documentos/recebidos', function () {
  assert.match(common, /\{\s*href:\s*'#\/documentos\/recebidos'[^}]*label:\s*'Documentos'/,
    'ADMIN_MENU deve ter entrada Documentos apontando para #/documentos/recebidos');
});

// ---------------------------------------------------------------------
// 5. Garantias: sem Supabase/Drive/fetch/persist
// ---------------------------------------------------------------------

test('documentos-recebidos: nao cria query Supabase diretamente', function () {
  assert.equal(/supa\.from\s*\(/.test(screen), false, 'supa.from em documentos-recebidos');
  assert.equal(/window\.supa/.test(screen), false, 'window.supa em documentos-recebidos');
});

test('documentos-recebidos: conecta o trigger sem chamar RPC diretamente', function () {
  assert.match(screen, /requestDocumentScan/);
  assert.equal(/window\.supa\s*\.rpc/.test(screen), false, 'a tela delega a RPC ao modulo dedicado');
  assert.match(scanTriggerSrc, /solicitar_document_scan/);
});

test('documentos-recebidos: botao de verificacao e exclusivo de admin', function () {
  const admin = makeScreenSandbox([]);
  const adminTree = vm.runInContext('window.screenDocumentosRecebidos()', admin);
  assert.ok(findAll(adminTree, findAction('verificar-novos-documentos')).length === 1,
    'admin deve ver o botao de verificacao');

  const nonAdmin = makeScreenSandbox([]);
  nonAdmin.CURRENT_USER = { nome: 'Cliente', tipo: 'cliente' };
  const nonAdminTree = vm.runInContext('window.screenDocumentosRecebidos()', nonAdmin);
  assert.equal(findAll(nonAdminTree, findAction('verificar-novos-documentos')).length, 0,
    'nao-admin nao deve ver o botao de verificacao');
});

test('documentos-recebidos: NAO referencia Google/Drive API', function () {
  assert.equal(/googleapis/.test(screen), false, 'googleapis em documentos-recebidos');
  assert.equal(/google-auth/.test(screen), false, 'google-auth em documentos-recebidos');
});

test('documentos-recebidos: NAO faz fetch nem XMLHttpRequest', function () {
  assert.equal(/fetch\s*\(/.test(screen), false, 'fetch em documentos-recebidos');
  assert.equal(/XMLHttpRequest/.test(screen), false, 'XHR em documentos-recebidos');
});

test('documentos-recebidos: referencia localStorage (G16-B metadata)', function () {
  // G16-B: a tela agora usa localStorage para ler metadata do ultimo import.
  assert.ok(/localStorage/.test(screen), 'a tela referencia localStorage para metadata');
  assert.equal(/sessionStorage/.test(screen), false, 'sessionStorage nao e usado');
});

// ---------------------------------------------------------------------
// 6. Runtime: render da tela em vm.Context
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
  appendChild(n) { if (n != null) { this.children.push(n); n.parentNode = this; } return n; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  removeChild(n) { var idx = this.children.indexOf(n); if (idx >= 0) this.children.splice(idx, 1); return n; }
  replaceChildren() { this.children = []; }
  remove() { this._removed = true; }
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

function findRow(node) {
  return (node && node._attrs && node._attrs['data-row'] === 'documento-recebido');
}

function findAction(action) {
  return function (node) {
    return !!(node && node._attrs && node._attrs['data-action'] === action);
  };
}

function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function makeScreenSandbox(received) {
  const documentMock = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  var sessionStorageMock = (function () {
    var _data = {};
    return {
      getItem: function (k) { return _data.hasOwnProperty(k) ? _data[k] : null; },
      setItem: function (k, v) { _data[k] = String(v); },
      removeItem: function (k) { delete _data[k]; },
      clear: function () { _data = {}; },
    };
  })();

  const sandbox = {
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    sessionStorage: sessionStorageMock,
    crypto: {
      // Distinct ids per call (the atomic validation lifecycle mints two).
      randomUUID: (function () {
        var n = 0;
        return function () { n++; return '1111' + String(n).padStart(4, '0') + '-1111-4111-8111-111111111111'; };
      })(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.CURRENT_USER = { nome: 'Admin', tipo: 'admin' };
  sandbox.logout = () => {};

  vm.createContext(sandbox);
  // Carrega ui.js (window.el real)
  vm.runInContext(ui, sandbox, { filename: 'js/ui.js' });
  // Carrega ingestor + loader (para garantir que RAVATEX_DOCUMENTS existe)
  vm.runInContext(ingestor, sandbox, { filename: 'js/documents-ingestor.js' });
  vm.runInContext(loader, sandbox, { filename: 'js/documents-ingestor-loader.js' });
  vm.runInContext(readerSrc, sandbox, { filename: 'js/documents-supabase-reader.js' });
  // Carrega auto-load (G22-B)
  vm.runInContext(autoLoadSrc, sandbox, { filename: 'js/documents-ingestor-auto-load.js' });
  // Carrega import-received (G12-R1: expoe createReceivedImportButton)
  vm.runInContext(importReceivedSrc, sandbox, { filename: 'js/documents-ingestor-import-received.js' });
  // Carrega command lifecycle, controller e modal (G28-D-B cloud decision)
  vm.runInContext(commandSrc, sandbox, { filename: 'js/documents-decision-command.js' });
  // Carrega o lifecycle atomico de validacao+vinculos (G28-B6)
  vm.runInContext(validationCmdSrc, sandbox, { filename: 'js/documents-validation-command.js' });
  vm.runInContext(controllerSrc, sandbox, { filename: 'js/documents-decision-controller.js' });
  vm.runInContext(decisionModalSrc, sandbox, { filename: 'js/screens/documentos-recebidos-decision-modal.js' });
  // Carrega common (shellLayout + ADMIN_MENU)
  vm.runInContext(common, sandbox, { filename: 'js/screens/common.js' });
  // Carrega a tela
  vm.runInContext(screen, sandbox, { filename: 'js/screens/documentos-recebidos.js' });

  if (received !== undefined) {
    sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = received;
  } else {
    delete sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  }

  return sandbox;
}

function makeScreenSandboxWithQueueUI(received) {
  const sb = makeScreenSandbox(received);
  // Sobrescreve a tela para garantir que ela veja o queue-ui;
  // carrega read-model (global createDocumentQueueItem) e queue-ui antes.
  vm.runInContext(readModelSrc, sb, { filename: 'js/document-queue-read-model.js' });
  vm.runInContext(queueUISrc, sb, { filename: 'js/screens/documentos-recebidos-queue-ui.js' });
  vm.runInContext(screen, sb, { filename: 'js/screens/documentos-recebidos.js' });
  if (received !== undefined) {
    sb.window.RAVATEX_DOCUMENTS_RECEIVED = received;
  }
  return sb;
}

test('runtime: screenDocumentosRecebidos renderiza empty state sem documentos', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map((n) => textOf(n)));
  assert.ok(allText.indexOf('Nenhum documento recebido') >= 0,
    'empty state deve aparecer quando RAVATEX_DOCUMENTS_RECEIVED e vazio');
  assert.ok(allText.indexOf('Documentos Mapeados') >= 0,
    'header novo deve aparecer');
  assert.ok(allText.indexOf('Importe a lista gerada pelo Documents Ingestor') >= 0,
    'subtitulo explica o fluxo de import (G12-R3)');
  // Nenhuma row data-document-id
  const rows = findAll(result, findRow);
  assert.equal(rows.length, 0, 'sem rows quando empty state');
});

test('runtime: screenDocumentosRecebidos renderiza empty state quando global ausente', function () {
  const sb = makeScreenSandbox(undefined);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map((n) => textOf(n)));
  assert.ok(allText.indexOf('Nenhum documento recebido') >= 0,
    'empty state aparece se RAVATEX_DOCUMENTS_RECEIVED nao definido');
});

test('runtime: screenDocumentosRecebidos renderiza card com 1 documento', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-x',
      gmail_message_id: 'msg-x',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      direcao_nf: 'entrada',
      drive_file_id: 'drive-x',
      drive_web_view_link: 'https://drive.google.com/file/d/x/view',
      created_at: '2026-07-08T10:30:00.000Z',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, findRow);
  assert.equal(rows.length, 1, '1 row esperada');
  const row = rows[0];
  assert.equal(row._attrs['data-document-id'], 'doc-x', 'data-document-id do row');
  const rowText = textOf(row);
  assert.ok(rowText.indexOf('NF-001.xml') >= 0, 'filename aparece no row');
  assert.ok(rowText.indexOf('NF') >= 0, 'badge tipo NF aparece');
  assert.ok(rowText.indexOf('XML') >= 0, 'badge formato XML aparece');
  assert.ok(rowText.indexOf('Entrada') >= 0, 'badge direcao Entrada aparece');
  assert.ok(rowText.indexOf('Pendente') >= 0, 'status Pendente aparece');
  // Sem queueItem: mostra Indisponivel, nao acoes raw
  const semLink = findAll(row, findAction('sem-link'));
  assert.equal(semLink.length, 1, 'placeholder Indisponivel esperado');
  assert.equal(textOf(semLink[0]), 'Indisponível', 'label do placeholder');
  const verBtn = findAll(row, findAction('ver-documento-drive'));
  assert.equal(verBtn.length, 0, 'sem botao Ver sem queueItem');
  const downloadBtn = findAll(row, findAction('baixar-documento-drive'));
  assert.equal(downloadBtn.length, 0, 'sem botao Baixar sem queueItem');
});

test('runtime: sem queueItem nao ha Ver nem Baixar, apenas Indisponivel', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-open',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive.google.com/file/d/open/view',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'sem Ver sem queueItem');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 0, 'sem Baixar sem queueItem');
  const semLink = findAll(result, findAction('sem-link'));
  assert.equal(semLink.length, 1, 'Indisponivel sem queueItem');
  assert.equal(textOf(semLink[0]), 'Indisponível', 'label do placeholder');
});

test('runtime: sem queueItem nao ha Ver nem Baixar com file_id', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-download',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_file_id: 'drive-download-id',
      drive_web_view_link: 'https://drive.google.com/file/d/drive-download-id/view',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'sem Ver sem queueItem');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 0, 'sem Baixar sem queueItem');
  const semLink = findAll(result, findAction('sem-link'));
  assert.equal(semLink.length, 1, 'Indisponivel sem queueItem');
  assert.equal(textOf(semLink[0]), 'Indisponível', 'label do placeholder');
});

test('runtime: documento sem queuItem mostra "Indisponível"', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-no-link',
      filename_original: 'NF-no-link.pdf',
      tipo_documento: 'nf',
      formato: 'pdf',
      drive_web_view_link: null,
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const semLink = findAll(result, findAction('sem-link'));
  assert.equal(semLink.length, 1, 'placeholder Indisponivel aparece');
  assert.equal(textOf(semLink[0]), 'Indisponível', 'label do placeholder');
  const verBtns = findAll(result, findAction('ver-documento-drive'));
  assert.equal(verBtns.length, 0, 'sem botao Ver para doc sem queueItem');
  const downloadBtns = findAll(result, findAction('baixar-documento-drive'));
  assert.equal(downloadBtns.length, 0, 'sem botao Baixar para doc sem queueItem');
});

test('runtime: documento com direcao nula NAO mostra badge direcao', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-no-dir',
      filename_original: 'romaneio.pdf',
      tipo_documento: 'romaneio',
      formato: 'pdf',
      direcao_nf: null,
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map((n) => textOf(n)));
  assert.ok(allText.indexOf('Romaneio') >= 0, 'badge tipo Romaneio aparece');
  assert.ok(allText.indexOf('PDF') >= 0, 'badge formato PDF aparece');
  assert.ok(allText.indexOf('Entrada') === -1, 'sem badge Entrada');
  assert.ok(allText.indexOf('Saida') === -1, 'sem badge Saida');
});

test('runtime: renderiza 3 documentos com todos os campos', function () {
  const sb = makeScreenSandbox([
    { document_id: 'a', filename_original: 'NF-a.xml', tipo_documento: 'nf', formato: 'xml', direcao_nf: 'entrada', drive_web_view_link: 'https://drive/a' },
    { document_id: 'b', filename_original: 'romaneio-b.pdf', tipo_documento: 'romaneio', formato: 'pdf', drive_web_view_link: null },
    { document_id: 'c', filename_original: 'NF-c.pdf', tipo_documento: 'nf', formato: 'pdf', direcao_nf: 'saida', drive_web_view_link: 'https://drive/c' },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, findRow);
  assert.equal(rows.length, 3, '3 rows esperados');
  const verBtns = findAll(result, findAction('ver-documento-drive'));
  assert.equal(verBtns.length, 0, '0 botoes Ver sem queueItem');
  const downloadBtns = findAll(result, findAction('baixar-documento-drive'));
  assert.equal(downloadBtns.length, 0, '0 botoes Baixar sem queueItem');
  const semLinks = findAll(result, findAction('sem-link'));
  assert.equal(semLinks.length, 3, '3 placeholders Indisponivel (todos sem queueItem)');
});

test('runtime: tela usa shellLayout(ADMIN_MENU, container)', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // shellLayout retorna <div> com header + flex(aside + main)
  assert.equal(result.tagName, 'DIV', 'shellLayout retorna <div>');
  const flexDiv = result.children.find((c) => c.tagName === 'DIV');
  assert.ok(flexDiv, 'flex div esperado');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  assert.ok(aside, 'aside esperado (menu lateral)');
  const links = aside.children.filter((c) => c.tagName === 'A');
  // ADMIN_MENU agora tem 11 itens (10 originais + Documentos)
  assert.equal(links.length, 11, 'menu admin deve ter 11 itens apos G12-G2');
});

test('runtime: NAO le RAVATEX_DOCUMENTS_LOADED_EVENTS (legado continua intacto)', function () {
  const sb = makeScreenSandbox([
    { document_id: 'rcv-1', filename_original: 'rcv.xml', tipo_documento: 'nf', formato: 'xml', drive_web_view_link: 'https://drive/1' },
  ]);
  // Semeia o estado legado
  sb.window.RAVATEX_DOCUMENTS_LOADED_EVENTS = [
    { event_type: 'document.linked', pedido_manual: 'PED-25-2026', document: { document_id: 'legacy-1' } },
  ];
  const container = new FakeNode('div');
  sb.container = container;
  vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Estado legado deve estar INTACTO
  assert.equal(sb.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 1,
    'estado legado NAO pode ser afetado pela tela global');
  assert.equal(sb.window.RAVATEX_DOCUMENTS_LOADED_EVENTS[0].event_type, 'document.linked',
    'evento legado preservado');
});

// ---------------------------------------------------------------------
// 8. G12-R1: botao inline (NAO flutuante) + texto explicito
// ---------------------------------------------------------------------

test('G12-R1: tela renderiza botao inline de import (NAO flutuante)', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Botao inline dentro da tela, com id customizado (rv-docs-received-import-btn-inline)
  const inlineBtn = findAll(result, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(inlineBtn.length, 1, 'botao inline com id customizado presente');
  // NAO deve haver botao flutuante rv-docs-received-import-btn (sem sufixo)
  const floatingBtn = findAll(result, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn');
  assert.equal(floatingBtn.length, 0, 'botao flutuante NAO aparece dentro da tela');
});

test('G12-R1: botao inline aparece mesmo com RECEIVED vazio e mesmo com docs', function () {
  const sbEmpty = makeScreenSandbox([]);
  const c1 = new FakeNode('div');
  sbEmpty.container = c1;
  const r1 = vm.runInContext('window.screenDocumentosRecebidos(container)', sbEmpty);
  const inline1 = findAll(r1, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(inline1.length, 1, 'botao inline presente no empty state');

  const sbFilled = makeScreenSandbox([{
    document_id: 'd1', filename_original: 'NF.xml', tipo_documento: 'nf', formato: 'xml',
    drive_web_view_link: 'https://drive/d1', created_at: '2026-07-08T10:00:00.000Z',
  }]);
  const c2 = new FakeNode('div');
  sbFilled.container = c2;
  const r2 = vm.runInContext('window.screenDocumentosRecebidos(container)', sbFilled);
  const inline2 = findAll(r2, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(inline2.length, 1, 'botao inline presente com 1 doc');
});

test('G12-R1: botao inline NAO e flutuante (position != fixed)', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const inlineBtn = findAll(result, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(inlineBtn.length, 1);
  const btn = inlineBtn[0];
  // Nao deve ser position:fixed (G12-R1: inline, nao flutuante)
  var cssText = (btn._attrs && btn._attrs.style) || '';
  // O botao inline e criado por createReceivedImportButton (G12-R3 refactor)
  // que nao define position:fixed. Verifica ausencia.
  if (cssText && cssText.indexOf && cssText.indexOf('fixed') >= 0) {
    assert.fail('botao inline NAO deve ser position:fixed; cssText=' + cssText);
  }
});

test('G12-R1: tela contem section data-section="documentos-recebidos-import-action"', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const sections = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-action');
  assert.equal(sections.length, 1, 'section de import action presente');
  // No redesign, o botao fica no header, antes da strip e do empty state.
  var allText = JSON.stringify(findAll(result, () => true).map(textOf));
  var importIdx = allText.indexOf('Importar');
  var scanIdx = allText.indexOf('Varredura');
  var emptyIdx = allText.indexOf('Nenhum documento recebido');
  assert.ok(importIdx >= 0 && scanIdx >= 0 && emptyIdx >= 0, 'textos principais presentes');
  assert.ok(importIdx < scanIdx, 'botao de import fica no header, antes da strip');
  assert.ok(scanIdx < emptyIdx, 'strip vem antes da tabela/empty state');
});

test('redesign: nao renderiza faixa de arquivos aceitos no topo', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);

  const lists = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-importable-files');
  assert.equal(lists.length, 0, 'nao deve haver faixa/lista visual de arquivos aceitos');
});

test('redesign: acoes ficam no header e strip de varredura e compacta com play/pause', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);

  const refreshBtns = findAll(result, findAction('atualizar-documentos'));
  assert.equal(refreshBtns.length, 1, 'botao Atualizar presente no header');
  const importBtns = findAll(result, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(importBtns.length, 1, 'botao Importar presente no header');

  const strips = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-scan-strip');
  assert.equal(strips.length, 1, 'strip de varredura presente');
  const stripStyle = strips[0]._attrs.style || '';
  assert.ok(stripStyle.indexOf('min-height:34px') >= 0, 'strip tem altura compacta: ' + stripStyle);
  assert.ok(stripStyle.indexOf('padding:2px 2px 10px') >= 0, 'strip tem padding compacto: ' + stripStyle);
  assert.ok(stripStyle.indexOf('flex-wrap:nowrap') >= 0, 'strip nao deve quebrar linha: ' + stripStyle);
  assert.equal(stripStyle.indexOf('background:#fff'), -1, 'strip nao deve ter background de card: ' + stripStyle);
  assert.equal(stripStyle.indexOf('border:1px solid'), -1, 'strip nao deve ter borda de card: ' + stripStyle);

  const toggles = findAll(result, findAction('toggle-varredura'));
  assert.equal(toggles.length, 1, 'botao play/pause presente na frente de Varredura ativa');
  assert.equal(toggles[0]._listeners.click.length, 1, 'toggle play/pause tem click handler');
  const toggleStyle = toggles[0]._attrs.style || '';
  assert.ok(toggleStyle.indexOf('border:none') >= 0, 'play/pause nao deve ter contorno: ' + toggleStyle);
  assert.ok(toggleStyle.indexOf('background:transparent') >= 0, 'play/pause e apenas icone: ' + toggleStyle);
  const pauseIcons = findAll(strips[0], (n) => n._attrs && n._attrs['data-icon'] === 'lucide-pause');
  assert.equal(pauseIcons.length, 1, 'varredura ativa usa icone Lucide pause');
  assert.ok(textOf(strips[0]).indexOf('Tipos mapeados:') >= 0, 'strip mostra Tipos mapeados');
  assert.ok(textOf(strips[0]).indexOf('Origem:') >= 0, 'strip mostra Origem antes da ultima execucao');
  assert.ok(textOf(strips[0]).indexOf('Última execução:') >= 0, 'strip mostra Ultima execucao');
  assert.ok(stripStyle.indexOf('margin-bottom:8px') >= 0, 'strip tem respiro reduzido: ' + stripStyle);
});

test('redesign: strip alterna varredura e tipos mapeados ativos/inativos', function () {
  const sb = makeScreenSandbox([]);
  sb.window.setApp = function () {};
  const container = new FakeNode('div');
  sb.container = container;
  let result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  let strip = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-scan-strip')[0];
  assert.ok(textOf(strip).indexOf('Varredura') >= 0, 'mostra rotulo Varredura');
  assert.equal(
    findAll(strip, (n) => n._attrs && n._attrs['data-icon'] === 'lucide-pause').length,
    1, 'comeca ativa (icone pause)');

  const scanToggle = findAll(result, findAction('toggle-varredura'))[0];
  scanToggle._listeners.click[0]();
  result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  strip = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-scan-strip')[0];
  assert.ok(textOf(strip).indexOf('Varredura') >= 0, 'rotulo Varredura permanece ao pausar');
  const playIcons = findAll(strip, (n) => n._attrs && n._attrs['data-icon'] === 'lucide-play');
  assert.equal(playIcons.length, 1, 'varredura inativa usa icone Lucide play');

  const typeButtons = findAll(strip, findAction('toggle-tipo-mapeado'));
  assert.equal(typeButtons.length, 10, 'dez tipos mapeados disponiveis');
  const pdfBtn = typeButtons.filter((n) => n._attrs && n._attrs['data-mapped-type'] === 'pdf')[0];
  assert.ok(pdfBtn, 'botao PDF presente');
  assert.equal(pdfBtn._attrs['aria-pressed'], 'true', 'PDF comeca ativo');
  assert.equal(textOf(pdfBtn), 'PDF', 'botao PDF mostra apenas o rotulo de texto');
  const pdfTablerIcons = findAll(pdfBtn, (n) => n.className && n.className.indexOf('ti ') >= 0);
  assert.equal(pdfTablerIcons.length, 0, 'tipos mapeados usam so texto, sem icone Tabler');

  pdfBtn._listeners.click[0]();
  result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  strip = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-scan-strip')[0];
  const inactivePdf = findAll(strip, (n) => n._attrs && n._attrs['data-mapped-type'] === 'pdf')[0];
  assert.equal(inactivePdf._attrs['aria-pressed'], 'false', 'PDF fica inativo apos clique');
  assert.ok((inactivePdf._attrs.style || '').indexOf('opacity:.62') >= 0,
    'tipo inativo ganha aparencia apagada: ' + (inactivePdf._attrs.style || ''));
});

test('redesign: filtros nao duplicam chevron e Limpar acompanha a altura da linha', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);

  const selects = findAll(result, (n) => n.tagName === 'SELECT');
  assert.equal(selects.length, 5, 'cinco selects de filtro esperados (tipo, pedido, periodo, origem, evidencia)');
  selects.forEach(function (selectNode) {
    const style = selectNode._attrs.style || '';
    assert.ok(style.indexOf('appearance:none') >= 0, 'select deve esconder chevron nativo: ' + style);
    assert.ok(style.indexOf('-webkit-appearance:none') >= 0, 'select deve esconder chevron nativo no WebKit: ' + style);
  });

  const clearBtns = findAll(result, findAction('limpar-filtros'));
  assert.equal(clearBtns.length, 1, 'botao Limpar presente');
  const clearStyle = clearBtns[0]._attrs.style || '';
  assert.ok(clearStyle.indexOf('min-height:49px') >= 0, 'Limpar acompanha altura dos filtros: ' + clearStyle);
});

test('redesign: rows usam icones especificos por formato antes do nome do arquivo', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-xml',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
    },
    {
      document_id: 'doc-pdf',
      filename_original: 'L.pdf',
      tipo_documento: 'romaneio',
      formato: 'desconhecido',
      drive_web_view_link: 'https://drive/y',
    },
    { document_id: 'doc-jsonl', filename_original: 'documentos-mapeados.jsonl', formato: 'jsonl' },
    { document_id: 'doc-csv', filename_original: 'planilha.csv', formato: 'csv' },
    { document_id: 'doc-xls', filename_original: 'planilha.xlsx', formato: 'xlsx' },
    { document_id: 'doc-doc', filename_original: 'contrato.docx', formato: 'docx' },
    { document_id: 'doc-txt', filename_original: 'notas.txt', formato: 'txt' },
    { document_id: 'doc-png', filename_original: 'imagem.png', formato: 'png' },
    { document_id: 'doc-jpg', filename_original: 'foto.jpg', formato: 'jpg' },
    { document_id: 'doc-zip', filename_original: 'pacote.zip', formato: 'zip' },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);

  const xmlIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-xml');
  const pdfIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-pdf');
  const jsonIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-json');
  const csvIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-csv');
  const xlsIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-xls');
  const docIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-doc');
  const txtIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-txt');
  const pngIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-png');
  const jpgIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-jpg');
  const zipIcons = findAll(result, (n) => n._attrs && n._attrs['data-icon'] === 'arquivo-zip');
  assert.equal(xmlIcons.length, 1, 'icone XML especifico presente');
  assert.equal(pdfIcons.length, 1, 'icone PDF especifico presente mesmo com formato desconhecido');
  assert.ok(xmlIcons[0].className.indexOf('ti ti-file-type-xml') >= 0,
    'icone XML usa Tabler file-type-xml: ' + xmlIcons[0].className);
  assert.ok(pdfIcons[0].className.indexOf('ti ti-file-type-pdf') >= 0,
    'icone PDF usa Tabler file-type-pdf: ' + pdfIcons[0].className);
  assert.ok(jsonIcons[0].className.indexOf('ti ti-json') >= 0, 'JSONL usa Tabler JSON');
  assert.ok(csvIcons[0].className.indexOf('ti ti-file-type-csv') >= 0, 'CSV usa Tabler file-type-csv');
  assert.ok(xlsIcons[0].className.indexOf('ti ti-file-type-xls') >= 0, 'XLS usa Tabler file-type-xls');
  assert.ok(docIcons[0].className.indexOf('ti ti-file-type-doc') >= 0, 'DOC usa Tabler file-type-doc');
  assert.ok(txtIcons[0].className.indexOf('ti ti-file-type-txt') >= 0, 'TXT usa Tabler file-type-txt');
  assert.ok(pngIcons[0].className.indexOf('ti ti-file-type-png') >= 0, 'PNG usa Tabler file-type-png');
  assert.ok(jpgIcons[0].className.indexOf('ti ti-file-type-jpg') >= 0, 'JPG usa Tabler file-type-jpg');
  assert.ok(zipIcons[0].className.indexOf('ti ti-file-type-zip') >= 0, 'ZIP usa Tabler file-type-zip');

  const rows = findAll(result, findRow);
  assert.equal(rows.length, 10, 'dez rows renderizadas');
  assert.ok(textOf(rows[0]).indexOf('NF-001.xml') >= 0, 'row XML mantem filename');
  assert.ok(textOf(rows[1]).indexOf('L.pdf') >= 0, 'row PDF mantem filename');
});

test('G12-R3: header instrui a importar a lista do Documents Ingestor', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map(textOf));
  assert.ok(allText.indexOf('Importe a lista gerada pelo Documents Ingestor') >= 0,
    'subtitulo instrui importacao via Documents Ingestor: ' + allText.slice(0, 400));
  assert.ok(allText.indexOf('documentos mapeados') >= 0,
    'subtitulo menciona o objetivo (documentos mapeados)');
  // G12-R3: copy NAO afirma mais "carregado automaticamente do Gmail".
  assert.equal(allText.indexOf('automaticamente'), -1,
    'subtitulo NAO deve sugerir auto-load: ' + allText.slice(0, 400));
  assert.ok(allText.indexOf('Origem') >= 0 && allText.indexOf('Gmail') >= 0,
    'strip compacta mostra Origem Gmail');
});

test('G25-B1: card exibe colunas Status, Pedido e Datas', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-cols',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      direcao_nf: 'entrada',
      drive_web_view_link: 'https://drive/x',
      pedido_manual: 'PED-25-2026',
      created_at: '2026-07-08T10:30:00.000Z',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map(textOf));

  // Cabecalho de colunas presente
  const colsHeader = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-columns');
  assert.equal(colsHeader.length, 1, 'cabecalho de colunas presente');
  const colsText = textOf(colsHeader[0]);
  assert.ok(colsText.indexOf('STATUS') >= 0, 'cabecalho tem STATUS');
  assert.ok(colsText.indexOf('PEDIDO') >= 0, 'cabecalho tem PEDIDO');
  assert.ok(colsText.indexOf('DATAS') >= 0, 'cabecalho tem DATAS');
  assert.ok(colsText.indexOf('AÇÕES') >= 0, 'cabecalho tem AÇÕES');
  assert.ok((colsHeader[0]._attrs.style || '').indexOf('minmax(260px,1.45fr)') >= 0,
    'coluna Documento deve priorizar o remetente no grid: ' + (colsHeader[0]._attrs.style || ''));
  assert.ok((colsHeader[0]._attrs.style || '').indexOf('148px') >= 0,
    'coluna Acoes deve comportar quatro botoes: ' + (colsHeader[0]._attrs.style || ''));

  // Cada row exibe os tres campos
  const rows = findAll(result, findRow);
  assert.equal(rows.length, 1);
  const row = rows[0];
  const rowText = textOf(row);
  assert.ok(rowText.indexOf('PED-25-2026') >= 0, 'pedido_manual aparece no row');
  assert.ok(rowText.indexOf('Pendente') >= 0, 'status Pendente padrao aparece');
  // Processamento aparece mesmo para documento legado.
  assert.ok(/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(rowText),
    'Recebido em formatado dd/mm HH:MM: ' + rowText);
});

test('G12-R3: row sem pedido_manual mostra placeholder "Nao mapeado"', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-no-ped',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/y',
      // sem pedido_manual
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  assert.ok(row, 'row existe');
  const pedidoCell = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'pedido')[0];
  assert.ok(pedidoCell, 'celula de pedido existe');
  assert.equal(pedidoCell._attrs['data-pedido'], '',
    'data-pedido vazio quando nao ha pedido_manual');
  assert.ok(textOf(pedidoCell).indexOf('Não mapeado') >= 0,
    'placeholder "Nao mapeado" aparece: ' + textOf(pedidoCell));
});

test('G12-R3: row com pedido_manual exibe chip de pedido', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-with-ped',
      filename_original: 'NF-002.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/z',
      pedido_manual: 'PED-99-2026',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const pedidoCell = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'pedido')[0];
  assert.ok(pedidoCell, 'celula de pedido existe');
  assert.equal(pedidoCell._attrs['data-pedido'], 'PED-99-2026',
    'data-pedido igual a pedido_manual');
  assert.ok(textOf(pedidoCell).indexOf('PED-99-2026') >= 0,
    'label com chave do pedido aparece');
});

test('G12-R1: empty state instrui a usar o botao acima', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map(textOf));
  assert.ok(allText.indexOf('Use o botão Importar documentos acima para carregar') >= 0,
    'empty state instrui a usar o botao Importar documentos acima');
});

// ---------------------------------------------------------------------
// 9. G12-F2: suporte ao export documentos-mapeados.jsonl
//    A tela usa received_at como data principal, com fallback para
//    created_at, e mapeia status para labels operacionais.
// ---------------------------------------------------------------------

test('G25-B1: received_at legado nao e usado como data do e-mail', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-mapped-date',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      direcao_nf: 'entrada',
      drive_web_view_link: 'https://drive/x',
      received_at: '2026-07-08T10:30:00.000Z',
      // sem created_at
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const rowText = textOf(row);
  assert.ok(rowText.indexOf('Recebido: indisponível') >= 0,
    'received_at legado nao pode ser apresentado como Gmail: ' + rowText);
});

test('G25-B1: tela usa email_received_at e exibe processamento separadamente', function () {
  // email_received_at e 30min depois de created_at. A tela deve expor ambos.
  // O fuso local do runner pode variar (UTC-3 tipico), entao calculamos
  // o offset dinamicamente para que o teste seja deterministico.
  const sampleIso = '2026-07-08T10:30:00.000Z';
  const localHHMM = (function () {
    const d = new Date(sampleIso);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  })();
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-both-dates',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      email_received_at: sampleIso,
      created_at: '2026-07-08T10:00:00.000Z',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const recebidoEmail = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'recebido-no-email')[0];
  const processado = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'processado-pelo-ingestor')[0];
  assert.ok(recebidoEmail, 'celula recebido-no-email existe');
  assert.ok(processado, 'celula processado-pelo-ingestor existe');
  assert.ok(textOf(recebidoEmail).indexOf(localHHMM) >= 0,
    'celula deve usar email_received_at (' + localHHMM + '): ' + textOf(recebidoEmail));
});

test('G12-F2: tela mostra status:pending como Pendente', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-pending',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      status: 'pending',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.ok(statusPill, 'pill de status existe');
  assert.equal(textOf(statusPill), 'Pendente', 'label Pendente');
  assert.equal(statusPill._attrs['data-status'], 'pending', 'data-status=pending');
});

test('G12-F2: tela mostra status:assigned como Atrelado', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-assigned',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      status: 'assigned',
      pedido_manual: 'PED-25-2026',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.ok(statusPill, 'pill de status existe');
  assert.equal(textOf(statusPill), 'Atrelado', 'label Atrelado');
  assert.equal(statusPill._attrs['data-status'], 'assigned', 'data-status=assigned');
});

test('G12-F2: tela mostra status:accepted como Aceito', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-accepted',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      status: 'accepted',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.ok(statusPill, 'pill de status existe');
  assert.equal(textOf(statusPill), 'Aceito', 'label Aceito');
  assert.equal(statusPill._attrs['data-status'], 'accepted', 'data-status=accepted');
});

test('G12-F2: tela mostra status:rejected como Rejeitado', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-rejected',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      status: 'rejected',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.ok(statusPill, 'pill de status existe');
  assert.equal(textOf(statusPill), 'Rejeitado', 'label Rejeitado');
  assert.equal(statusPill._attrs['data-status'], 'rejected', 'data-status=rejected');
});

test('G12-F2: status desconhecido cai para Pendente (fallback seguro)', function () {
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-bogus',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive/x',
      status: 'valor-desconhecido',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.ok(statusPill, 'pill de status existe mesmo com status invalido');
  assert.equal(textOf(statusPill), 'Pendente', 'fallback Pendente para status invalido');
});

test('G12-F2: tela continua aceitando formato antigo (sem status, sem received_at)', function () {
  // Regressao: o formato documentos-recebidos.jsonl antigo nao tinha
  // status nem received_at. A tela deve continuar renderizando sem
  // quebrar.
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-legacy-1',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      direcao_nf: 'entrada',
      drive_web_view_link: 'https://drive/x',
      created_at: '2026-07-07T12:00:00.000Z',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  assert.ok(row, 'row do formato antigo renderiza');
  const statusPill = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'status')[0];
  assert.equal(textOf(statusPill), 'Pendente', 'status padrao sem status field');
  const recebidoEmail = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'recebido-no-email')[0];
  const processado = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'processado-pelo-ingestor')[0];
  assert.ok(textOf(recebidoEmail).indexOf('indisponível') >= 0, 'legado marcado como indisponível');
  assert.ok(textOf(processado).length > 0, 'processamento continua navegável para legado');
});

test('G12-F2: header traz subtitulo conciso sem citar os arquivos jsonl', function () {
  const sb = makeScreenSandbox([]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const allText = JSON.stringify(findAll(result, () => true).map(textOf));
  assert.ok(allText.indexOf('Importe a lista gerada pelo Documents Ingestor') >= 0,
    'subtitulo conciso presente: ' + allText.slice(0, 400));
  assert.equal(allText.indexOf('documentos-recebidos.jsonl'), -1,
    'subtitulo enxuto NAO cita nome de arquivo jsonl');
  assert.equal(allText.indexOf('documentos-mapeados.jsonl'), -1,
    'subtitulo enxuto NAO cita nome de arquivo jsonl');
});

// ---------------------------------------------------------------------
// 10. G16-B: metadata card do ultimo import
// ---------------------------------------------------------------------

test('G16-B: metadata card NAO aparece quando nao ha metadata', function () {
  const sb = makeScreenSandbox([]);
  delete sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 0, 'card de metadata NAO aparece sem metadata');
});

test('G16-B: metadata card aparece com metadata valida no window', function () {
  const sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T15:30:00.000Z',
    fileName: 'documentos-mapeados.jsonl',
    count: 3,
    hash: '1a2b3c4d',
    statusCounts: { accepted: 1, assigned: 1, pending: 1, rejected: 0, unknown: 0 },
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1, 'card de metadata presente');
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Último import') >= 0, 'mostra rotulo Ultimo import');
  assert.ok(cardText.indexOf('documentos-mapeados.jsonl') >= 0, 'mostra nome do arquivo');
  assert.ok(cardText.indexOf('3 documento') >= 0, 'mostra count');
  assert.ok(cardText.indexOf('Snapshot manual') >= 0, 'mostra aviso de snapshot manual');
  assert.ok(cardText.indexOf('1a2b3c4d') >= 0, 'mostra hash curto');
  assert.ok(cardText.indexOf('1 Aceito') >= 0, 'mostra accepted count singular');
  assert.ok(cardText.indexOf('1 Atribuído') >= 0, 'mostra assigned count singular');
  assert.ok(cardText.indexOf('1 Pendente') >= 0, 'mostra pending count singular');
});

test('G16-B: metadata card mostra chip "Defasado" para import >24h', function () {
  const sb = makeScreenSandbox([]);
  var twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: twoDaysAgo,
    fileName: 'antigo.jsonl',
    count: 1,
    hash: 'ff00ff00',
    statusCounts: { accepted: 0, assigned: 0, pending: 1, rejected: 0, unknown: 0 },
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1, 'card aparece mesmo com metadata antiga');
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Defasado') >= 0, 'chip Defasado visivel para import antigo');
  assert.ok(cardText.indexOf('mais de 24h') >= 0, 'aviso de 24h no texto');
  assert.ok(cardText.indexOf('Reimporte para dados atuais') >= 0, 'instru para reimportar');
});

test('G16-B: metadata card mostra chip "Atualizado" para import <24h', function () {
  const sb = makeScreenSandbox([]);
  var oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: oneHourAgo,
    fileName: 'recente.jsonl',
    count: 2,
    hash: 'abc12345',
    statusCounts: { accepted: 2, assigned: 0, pending: 0, rejected: 0, unknown: 0 },
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1);
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Atualizado') >= 0, 'chip Atualizado para import recente');
  assert.equal(cardText.indexOf('mais de 24h'), -1, 'sem aviso de 24h quando recente');
});

test('G16-B: metadata card tolera JSON corrompido (retorna null, sem card)', function () {
  const sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = null;
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 0, 'card NAO aparece com metadata null');
});

test('G16-B: metadata card sem fileName nao quebra', function () {
  const sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T10:00:00.000Z',
    count: 5,
    hash: 'bbbbbbbb',
    statusCounts: { accepted: 5, assigned: 0, pending: 0, rejected: 0, unknown: 0 },
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1, 'card aparece sem fileName');
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Último import') >= 0, 'mostra Ultimo import');
  assert.ok(cardText.indexOf('5 documento') >= 0, 'mostra count');
});

test('G16-B: metadata card com statusCounts vazias nao quebra', function () {
  const sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T08:00:00.000Z',
    count: 0,
    hash: '00000000',
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1, 'card aparece com statusCounts vazias');
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Snapshot manual') >= 0, 'aviso de snapshot aparece');
});

test('G16-B: metadata card exibe status Rejeitados quando existem', function () {
  const sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T12:00:00.000Z',
    fileName: 'rejected.jsonl',
    count: 4,
    hash: 'deadbeef',
    statusCounts: { accepted: 1, assigned: 0, pending: 1, rejected: 2, unknown: 0 },
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const cards = findAll(result, (n) => n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata');
  assert.equal(cards.length, 1);
  const cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('2 Rejeitados') >= 0, 'mostra Rejeitados count');
  assert.ok(cardText.indexOf('1 Aceito') >= 0, 'mostra Aceitos count singular');
  assert.ok(cardText.indexOf('1 Pendente') >= 0, 'mostra Pendentes count singular');
});

// G20-B: Decision helpers smoke (statusOverrides fallback)
test('G20-B: row sem decisao local NAO mostra badge de decisao', function () {
  const sb = makeScreenSandbox([{ document_id: 'doc-no-decision', filename_original: 'test.pdf', status: 'pending' }]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, (n) => n._attrs && n._attrs['data-row'] === 'documento-recebido');
  assert.equal(rows.length, 1, '1 row');
  const rowText = textOf(rows[0]);
  assert.ok(rowText.indexOf('Pendente') >= 0, 'mostra Pendente');
  assert.strictEqual(rowText.indexOf('Divergente'), -1, 'sem badge divergente');
  assert.strictEqual(rowText.indexOf('Decisão local'), -1, 'sem badge decisao local');
});

test('G20-B: botao legado Importar eventos segue ausente com statusOverrides ativos', function () {
  const sb = makeScreenSandbox([{ document_id: 'doc-legacy', status: 'pending' }]);
  sb.statusOverrides = { 'doc-legacy': 'accepted' };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const legacyBtns = findAll(result, (n) => n._attrs && n._attrs['data-action'] === 'importar-eventos');
  assert.equal(legacyBtns.length, 0, 'Importar eventos ausente');
});

// G20-B-R1: guarda document_id nas ações
test('G20-B-R1: doc sem document_id NAO mostra botoes Aceitar/Rejeitar', function () {
  const sb = makeScreenSandbox([{ filename_original: 'no-id.pdf', status: 'pending' }]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const rows = findAll(result, (n) => n._attrs && n._attrs['data-row'] === 'documento-recebido');
  assert.equal(rows.length, 1, '1 row');
  const rowText = textOf(rows[0]);
  assert.ok(rowText.indexOf('Pendente') >= 0, 'mostra Pendente');
  assert.strictEqual(rowText.indexOf('Aceitar'), -1, 'sem botao Aceitar');
  assert.strictEqual(rowText.indexOf('Rejeitar'), -1, 'sem botao Rejeitar');
});

test('G20-B-R1: doc com document_id mostra botoes Aceitar/Rejeitar', function () {
  const sb = makeScreenSandbox([{ _ravatex_source: 'manual', document_id: 'cda18ef9-d1d9-4f5a-8956-74875cd60b05', filename_original: 'ok.pdf', status: 'pending' }]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const acceptBtns = findAll(result, (n) => n._attrs && n._attrs['data-action'] === 'aceitar-documento');
  const rejectBtns = findAll(result, (n) => n._attrs && n._attrs['data-action'] === 'rejeitar-documento');
  assert.ok(acceptBtns.length > 0 || rejectBtns.length > 0, 'pelo menos um botao deve aparecer');
});

test('G20-B-R1: doc sem document_id NAO mostra botao Desfazer', function () {
  const sb = makeScreenSandbox([{ filename_original: 'no-id.pdf', status: 'pending' }]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const undos = findAll(result, (n) => n._attrs && n._attrs['data-action'] === 'desfazer-decisao-documento');
  assert.equal(undos.length, 0, 'sem botao Desfazer');
});

// ---------------------------------------------------------------------
// G22-B: auto-load documents tests
// ---------------------------------------------------------------------

test('G22-B: refreshBtn referencia autoLoadDocuments', function () {
  var src = readOrFail(SCREEN);
  assert.ok(src.indexOf('autoLoadDocuments') >= 0,
    'refreshBtn deve referenciar autoLoadDocuments');
});

test('G22-B: tela contem autoLoadAttempted na primeira renderizacao', function () {
  var src = readOrFail(SCREEN);
  assert.ok(src.indexOf('autoLoadAttempted') >= 0,
    'tela deve conter flag autoLoadAttempted');
});

test('G22-B: tela NAO faz fetch diretamente (fetch delegado ao auto-load)', function () {
  var src = readOrFail(SCREEN);
  assert.equal(/fetch\s*\(/.test(src), false,
    'tela nao deve chamar fetch diretamente; usa autoLoadDocuments');
});

test('G22-B: metadata card mostra Auto-sincronizado com flag de sessao', function () {
  var sb = makeScreenSandbox([]);
  sb.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION = true;
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T15:30:00.000Z',
    fileName: 'documentos-mapeados.jsonl',
    count: 3,
    hash: '1a2b3c4d',
    statusCounts: { accepted: 1, assigned: 1, pending: 1, rejected: 0, unknown: 0 },
  };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var cards = findAll(result, function (n) { return n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata'; });
  assert.equal(cards.length, 1, 'card presente');
  var cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Auto-sincronizado') >= 0,
    'mostra Auto-sincronizado quando auto-load ativo');
  assert.ok(cardText.indexOf('fetch relativo') >= 0,
    'menciona fetch relativo');
  assert.ok(cardText.indexOf('Auto-sync') >= 0,
    'mostra chip Auto-sync');
});

test('G22-B: metadata card NAO mostra Auto-sincronizado sem flag de sessao', function () {
  var sb = makeScreenSandbox([{ document_id: 'doc-meta-1', filename_original: 'f.xml', tipo_documento: 'nf', formato: 'xml', drive_web_view_link: 'https://drive/x' }]);
  sb.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION = false;
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: '2026-07-09T10:00:00.000Z',
    fileName: 'manual.jsonl',
    count: 1,
    hash: 'ffffffff',
    statusCounts: { accepted: 0, assigned: 0, pending: 1, rejected: 0, unknown: 0 },
  };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var cards = findAll(result, function (n) { return n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata'; });
  assert.equal(cards.length, 1);
  var cardText = textOf(cards[0]);
  assert.equal(cardText.indexOf('Auto-sincronizado'), -1, 'sem Auto-sincronizado sem flag');
  assert.ok(cardText.indexOf('Snapshot manual') >= 0,
    'mantem Snapshot manual quando nao ha auto-load');
});

test('G22-B: metadata card sem flag mantem comportamento antigo para defasado', function () {
  var sb = makeScreenSandbox([]);
  var twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  sb.window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION = undefined;
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = {
    importedAt: twoDaysAgo,
    fileName: 'antigo.jsonl',
    count: 1,
    hash: 'ff00ff00',
    statusCounts: { accepted: 0, assigned: 0, pending: 1, rejected: 0, unknown: 0 },
  };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var cards = findAll(result, function (n) { return n._attrs && n._attrs['data-section'] === 'documentos-recebidos-import-metadata'; });
  var cardText = textOf(cards[0]);
  assert.ok(cardText.indexOf('Defasado') >= 0, 'chip Defasado mantido');
  assert.ok(cardText.indexOf('Snapshot manual') >= 0, 'Snapshot manual mantido');
  assert.equal(cardText.indexOf('Auto-sincronizado'), -1, 'sem auto-sync sem flag');
});

test('G22-B: autoLoadDocuments carregado no namespace', function () {
  var sb = makeScreenSandbox([]);
  assert.equal(typeof sb.window.RAVATEX_DOCUMENTS.autoLoadDocuments, 'function',
    'autoLoadDocuments deve estar disponivel apos carregar auto-load');
  assert.equal(typeof sb.window.RAVATEX_DOCUMENTS.autoLoadDocumentsReset, 'function',
    'autoLoadDocumentsReset deve estar disponivel');
});

test('G22-B: header subtitulo mantido apos alteracoes G22-B', function () {
  var sb = makeScreenSandbox([]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var allText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(allText.indexOf('Importe a lista gerada pelo Documents Ingestor') >= 0,
    'subtitulo enxuto preservado');
});

test('G23-C-B: tela tenta o reader Supabase antes do fallback delegado', function () {
  assert.ok(screen.indexOf('loadReceivedDocumentsFromSupabase') >= 0,
    'tela deve usar o reader no namespace');
  assert.equal(/window\.supa/.test(screen), false,
    'a tela nao deve criar query Supabase diretamente');
});

// ---------------------------------------------------------------------
// G23-D-B: decisao em nuvem (aceitar/rejeitar via RPC decidir_documento)
// ---------------------------------------------------------------------

const SUPA_DOC_ID = '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18';

function makeSupaDoc(overrides) {
  return Object.assign({
    document_id: SUPA_DOC_ID,
    filename_original: 'NF-cloud.xml', tipo_documento: 'nf', formato: 'xml',
    status: 'pending', pedido_manual: 'PED-99-2026', _ravatex_source: 'supabase',
  }, overrides || {});
}

function flushAsync() {
  return new Promise(function (resolve) { setTimeout(resolve, 10); });
}

test('G23-D-B: documento Supabase pending mostra botoes de decisao em nuvem', function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Botoes reais de nuvem
  assert.equal(findAll(result, findAction('aceitar-documento-nuvem')).length, 1, 'aceitar nuvem presente');
  assert.equal(findAll(result, findAction('rejeitar-documento-nuvem')).length, 1, 'rejeitar nuvem presente');
  // Nao usa acoes locais nem o placeholder antigo
  assert.equal(findAll(result, findAction('aceitar-documento')).length, 0, 'sem acao local aceitar');
  assert.equal(findAll(result, findAction('rejeitar-documento')).length, 0, 'sem acao local rejeitar');
  assert.equal(findAll(result, findAction('decisao-nuvem-pendente')).length, 0, 'placeholder removido');
  assert.equal(findAll(result, findAction('desfazer-decisao-documento')).length, 0, 'sem Desfazer local para Supabase');
  // Nao mostra chip de decisao local / divergente para docs Supabase
  var allText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.equal(allText.indexOf('Decisão local'), -1, 'sem chip Decisão local');
  assert.equal(allText.indexOf('Divergente'), -1, 'sem chip Divergente');
});

test('G23-D-B/G28-B6: aceitar nuvem abre modal, confirmar chama acao atomica e recarrega reader', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var atomicCalls = [];
  var reloadCalls = 0;
  var setAppCalls = 0;
  // Controller still requires the decision adapter (reject path).
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true, outcome: 'created' }); };
  // Accept now routes through the atomic "Validar e vincular" action.
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function (envelope) {
    atomicCalls.push(envelope);
    return Promise.resolve({ ok: true, outcome: 'applied' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () { setAppCalls++; };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var btn = findAll(result, findAction('aceitar-documento-nuvem'))[0];
  assert.ok(btn, 'botao aceitar nuvem existe');
  btn._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  assert.ok(acceptRadio, 'radio accept no modal');
  assert.ok(confirmBtn, 'botao confirmar no modal');
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls.length, 1, 'acao atomica chamada');
  assert.equal(atomicCalls[0].documentId, SUPA_DOC_ID, 'documentId correto');
  assert.equal(atomicCalls[0].decision, 'accepted', 'decision accepted');
  assert.equal(atomicCalls[0].motivo, null, 'motivo null');
  assert.notEqual(atomicCalls[0].linkCommandId, atomicCalls[0].decisionCommandId, 'command ids distintos');
  assert.equal(reloadCalls, 1, 'reader recarregado apos sucesso');
  assert.ok(setAppCalls >= 1, 'rerender chamado');
});

test('G23-D-B: rejeitar nuvem cancelado NAO chama adapter', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var adapterCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { adapterCalls++; return Promise.resolve({ ok: true }); };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('rejeitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var cancelBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-cancel'; })[0];
  assert.ok(cancelBtn, 'botao cancelar no modal');
  cancelBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls, 0, 'adapter nao chamado');
});

test('G23-D-B: rejeitar nuvem com motivo vazio mostra erro no modal e NAO chama adapter', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var adapterCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { adapterCalls++; return Promise.resolve({ ok: true }); };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('rejeitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var rejectRadio = findAll(sb.window.document.body, function (n) { return n.value === 'rejected'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  assert.ok(rejectRadio, 'radio reject no modal');
  rejectRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  var errorEl = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-error'; })[0];
  assert.ok(errorEl, 'elemento de erro no modal');
  assert.ok(errorEl.textContent.length > 0, 'mensagem de erro exibida');
  assert.equal(adapterCalls, 0, 'adapter nao chamado');
});

test('G23-D-B: rejeitar nuvem com motivo valido chama adapter', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var adapterCalls = [];
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function (envelope) {
    adapterCalls.push(envelope);
    return Promise.resolve({ ok: true, outcome: 'created' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('rejeitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var rejectRadio = findAll(sb.window.document.body, function (n) { return n.value === 'rejected'; })[0];
  var motivoTa = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-motivo'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  rejectRadio.checked = true;
  motivoTa.value = 'Arquivo ilegivel';
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(adapterCalls.length, 1, 'adapter chamado');
  assert.equal(adapterCalls[0].decision, 'rejected', 'decision rejected');
  assert.equal(adapterCalls[0].motivo, 'Arquivo ilegivel', 'motivo repassado');
  assert.equal(reloadCalls, 1, 'reader recarregado');
});

test('G23-D-B: erro admin_required mostra erro no modal e NAO recarrega reader', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var reloadCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: false, error: 'admin_required' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++;
    return Promise.resolve({ ok: true });
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  var errorEl = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-error'; })[0];
  assert.ok(errorEl, 'elemento de erro no modal');
  assert.ok(errorEl.textContent.length > 0, 'mensagem de erro exibida');
  assert.equal(reloadCalls, 0, 'nao recarrega reader');
});

test('G23-D-B/G28-B6: doc Supabase usa acao atomica, NAO saveDocumentDecision/removeDocumentDecision', async function () {
  var sb = makeScreenSandbox([makeSupaDoc()]);
  var atomicCalls = 0;
  var saveCalls = 0;
  var removeCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.registerDocumentDecisionInCloud = function () { return Promise.resolve({ ok: true, outcome: 'created' }); };
  sb.window.RAVATEX_DOCUMENTS.applyDocumentValidationInCloud = function () { atomicCalls++; return Promise.resolve({ ok: true, outcome: 'applied' }); };
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function () { saveCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; return { ok: true }; };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () { return Promise.resolve({ ok: true }); };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('aceitar-documento-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  var acceptRadio = findAll(sb.window.document.body, function (n) { return n.value === 'accepted'; })[0];
  var confirmBtn = findAll(sb.window.document.body, function (n) { return n.id === 'r8x-dm-confirm'; })[0];
  acceptRadio.checked = true;
  confirmBtn._listeners.click[0]();
  await flushAsync();
  assert.equal(atomicCalls, 1, 'acao atomica chamada para doc Supabase');
  assert.equal(saveCalls, 0, 'nao grava decisao local');
  assert.equal(removeCalls, 0, 'nao remove decisao local');
});

test('G23-D-B: doc manual continua usando saveDocumentDecision (localStorage), sem nuvem', function () {
  var sb = makeScreenSandbox([{
    _ravatex_source: 'manual',
    document_id: 'cda18ef9-d1d9-4f5a-8956-74875cd60b05',
    filename_original: 'manual.pdf', tipo_documento: 'nf', formato: 'pdf', status: 'pending',
  }]);
  var saveCalls = [];
  sb.window.RAVATEX_DOCUMENTS.saveDocumentDecision = function (id, decision) {
    saveCalls.push({ id: id, decision: decision }); return { ok: true };
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Doc manual usa acoes locais, nao as de nuvem
  assert.equal(findAll(result, findAction('aceitar-documento-nuvem')).length, 0, 'sem acao de nuvem para doc manual');
  var acc = findAll(result, findAction('aceitar-documento'))[0];
  assert.ok(acc, 'doc manual mostra acao local aceitar-documento');
  acc._listeners.click[0]();
  assert.equal(saveCalls.length, 1, 'usou saveDocumentDecision (localStorage)');
  assert.equal(saveCalls[0].decision.status, 'accepted', 'decisao local accepted');
});

// ---------------------------------------------------------------------
// G23-E-E: undo de decisao em nuvem via RPC, sem estado local
// ---------------------------------------------------------------------

test('G23-E-E: mostra Desfazer decisao somente para decisao server com base segura', function () {
  var safe = makeScreenSandbox([makeSupaDoc({
    status: 'accepted', _ravatex_can_undo_server_decision: true,
  })]);
  var safeContainer = new FakeNode('div');
  safe.container = safeContainer;
  var safeResult = vm.runInContext('window.screenDocumentosRecebidos(container)', safe);
  assert.equal(findAll(safeResult, findAction('desfazer-decisao-nuvem')).length, 1, 'undo nuvem presente');
  assert.equal(findAll(safeResult, findAction('aceitar-documento-nuvem')).length, 0, 'sem decidir novamente');

  var unsafe = makeScreenSandbox([makeSupaDoc({ status: 'accepted', _ravatex_can_undo_server_decision: false })]);
  var unsafeContainer = new FakeNode('div');
  unsafe.container = unsafeContainer;
  var unsafeResult = vm.runInContext('window.screenDocumentosRecebidos(container)', unsafe);
  assert.equal(findAll(unsafeResult, findAction('desfazer-decisao-nuvem')).length, 0, 'sem undo sem base segura');
});

test('G23-E-E: desfazer nuvem chama wrapper, recarrega reader e nao usa localStorage', async function () {
  var sb = makeScreenSandbox([makeSupaDoc({ status: 'rejected', _ravatex_can_undo_server_decision: true })]);
  var calls = [];
  var reloadCalls = 0;
  var removeCalls = 0;
  var setAppCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.undoDocumentDecisionInCloud = function (id, motivo) {
    calls.push({ id: id, motivo: motivo }); return Promise.resolve({ ok: true, restored_status: 'assigned' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () {
    reloadCalls++; return Promise.resolve({ ok: true });
  };
  sb.window.RAVATEX_DOCUMENTS.removeDocumentDecision = function () { removeCalls++; return { ok: true }; };
  sb.window.toast = function () {};
  sb.window.setApp = function () { setAppCalls++; };
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('desfazer-decisao-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  assert.deepEqual(calls, [{ id: SUPA_DOC_ID, motivo: null }]);
  assert.equal(reloadCalls, 1, 'reader recarregado');
  assert.ok(setAppCalls >= 1, 'rerender chamado');
  assert.equal(removeCalls, 0, 'nao remove decisao local');
});

test('G23-E-E: erro de base indisponivel mostra toast e nao recarrega', async function () {
  var sb = makeScreenSandbox([makeSupaDoc({ status: 'accepted', _ravatex_can_undo_server_decision: true })]);
  var reloadCalls = 0;
  var toasts = [];
  sb.window.RAVATEX_DOCUMENTS.undoDocumentDecisionInCloud = function () {
    return Promise.resolve({ ok: false, error: 'base_status_unavailable' });
  };
  sb.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromSupabase = function () { reloadCalls++; return Promise.resolve({ ok: true }); };
  sb.window.toast = function (msg, kind) { toasts.push({ msg: msg, kind: kind }); };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  findAll(result, findAction('desfazer-decisao-nuvem'))[0]._listeners.click[0]();
  await flushAsync();
  assert.equal(reloadCalls, 0);
  assert.ok(toasts.some(function (toast) { return toast.kind === 'error' && toast.msg.indexOf('canônico') >= 0; }));
});

test('G22-B: botao Atualizar presente e funcional', function () {
  var sb = makeScreenSandbox([]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var refreshBtns = findAll(result, function (n) { return n._attrs && n._attrs['data-action'] === 'atualizar-documentos'; });
  assert.equal(refreshBtns.length, 1, 'botao Atualizar presente');
  assert.ok(refreshBtns[0].children && refreshBtns[0].children.length >= 2,
    'botao tem icone SVG + texto');
});

test('G24-B4-R1: primeiro clique admin chama trigger uma vez e mostra feedback imediato', function () {
  var sb = makeScreenSandbox([]);
  var calls = [];
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function (options) {
    calls.push(options);
    return new Promise(function () {});
  };
  sb.window.toast = undefined;
  sb.window.setApp = function (tree) { latestTree = tree; };
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var button = findAll(result, findAction('verificar-novos-documentos'))[0];
  assert.equal(Object.prototype.hasOwnProperty.call(button._attrs, 'disabled'), false,
    'botao inicial nao pode receber atributo disabled');
  button._listeners.click[0]();
  assert.equal(calls.length, 1, 'primeiro clique deve chamar requestDocumentScan uma vez');
  assert.equal(typeof calls[0].onUpdate, 'function');
  assert.equal(typeof calls[0].onComplete, 'function');
  var feedback = findAll(latestTree, function (node) {
    return node._attrs && node._attrs['data-section'] === 'document-scan-feedback';
  });
  assert.equal(feedback.length, 1, 'feedback deve ser renderizado no DOM');
  assert.ok(textOf(feedback[0]).indexOf('Solicitacao enviada') >= 0,
    'feedback inicial nao pode depender de toast');
});

test('G24-B4-R1: sessao perdida apos render nao encerra o clique silenciosamente', function () {
  var sb = makeScreenSandbox([]);
  var calls = 0;
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function () { calls += 1; return new Promise(function () {}); };
  sb.window.toast = undefined;
  sb.window.setApp = function (tree) { latestTree = tree; };
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var button = findAll(result, findAction('verificar-novos-documentos'))[0];
  sb.window.CURRENT_USER = null;
  button._listeners.click[0]();
  assert.equal(calls, 0, 'sessao invalida nao deve chamar a RPC');
  var feedback = findAll(latestTree, function (node) {
    return node._attrs && node._attrs['data-section'] === 'document-scan-feedback';
  });
  assert.ok(textOf(feedback[0]).indexOf('Sessao expirada') >= 0,
    'guard de sessao deve informar o bloqueio no DOM');
});

test('G24-B4-R1: request ativa mostra feedback persistente e bloqueia segunda RPC', function () {
  var sb = makeScreenSandbox([]);
  var calls = 0;
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function () { calls += 1; return new Promise(function () {}); };
  sb.window.toast = undefined;
  sb.window.setApp = function (tree) { latestTree = tree; };
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var button = findAll(result, findAction('verificar-novos-documentos'))[0];
  button._listeners.click[0]();
  button._listeners.click[0]();
  assert.equal(calls, 1, 'request ativa nao pode disparar uma segunda RPC');
  var feedback = findAll(latestTree, function (node) {
    return node._attrs && node._attrs['data-section'] === 'document-scan-feedback';
  });
  assert.ok(textOf(feedback[0]).indexOf('ja esta sendo acompanhada') >= 0);
});

test('G24-B4-R1: falha da RPC aparece no DOM sem depender de toast', async function () {
  var sb = makeScreenSandbox([]);
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function () {
    return Promise.resolve({ ok: false, error: 'migration_unavailable' });
  };
  sb.window.toast = undefined;
  sb.window.setApp = function (tree) { latestTree = tree; };
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  findAll(result, findAction('verificar-novos-documentos'))[0]._listeners.click[0]();
  await flushAsync();
  var feedback = findAll(latestTree, function (node) {
    return node._attrs && node._attrs['data-section'] === 'document-scan-feedback';
  });
  assert.ok(textOf(feedback[0]).indexOf('ainda nao foi aplicada') >= 0,
    'falha da RPC deve ficar visivel no DOM');
});

test('G24-B5: hidratacao retoma request ativa via polling, sem solicitar novo scan', async function () {
  var sb = makeScreenSandbox([]);
  var solicitarCalls = 0;
  var pollCalls = [];
  var lookupCalls = 0;
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function () { solicitarCalls += 1; return new Promise(function () {}); };
  sb.window.RAVATEX_DOCUMENTS.getActiveDocumentScanRequest = function (source) {
    lookupCalls += 1;
    return Promise.resolve({ ok: true, request: { id: 'req-hydra', source: source, status: 'running' } });
  };
  sb.window.RAVATEX_DOCUMENTS.pollDocumentScanRequest = function (id, options) {
    pollCalls.push({ id: id, options: options });
    return new Promise(function () {});
  };
  sb.window.setApp = function (tree) { latestTree = tree; };
  vm.runInContext('window.screenDocumentosRecebidos()', sb);
  await flushAsync();
  assert.equal(lookupCalls, 1, 'consulta a request ativa exatamente uma vez');
  assert.equal(solicitarCalls, 0, 'hidratacao nao chama requestDocumentScan (solicitar_document_scan)');
  assert.equal(pollCalls.length, 1, 'inicia no maximo um polling');
  assert.equal(pollCalls[0].id, 'req-hydra', 'polling usa o id da request ativa');
  assert.equal(typeof pollCalls[0].options.onUpdate, 'function');
  assert.equal(typeof pollCalls[0].options.onComplete, 'function');
  var button = findAll(latestTree, findAction('verificar-novos-documentos'))[0];
  assert.ok(Object.prototype.hasOwnProperty.call(button._attrs, 'disabled'),
    'botao fica desabilitado enquanto a request ativa e acompanhada');
  assert.ok(textOf(button).indexOf('Verificando e-mails') >= 0,
    'botao reflete o status ativo retomado (running)');
});

test('G24-B5: hidratacao sem request ativa nao inicia polling nem altera o botao', async function () {
  var sb = makeScreenSandbox([]);
  var pollCalls = 0;
  sb.window.RAVATEX_DOCUMENTS.getActiveDocumentScanRequest = function () {
    return Promise.resolve({ ok: true, request: null });
  };
  sb.window.RAVATEX_DOCUMENTS.pollDocumentScanRequest = function () { pollCalls += 1; return new Promise(function () {}); };
  sb.window.setApp = function () {};
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  await flushAsync();
  assert.equal(pollCalls, 0, 'sem request ativa nao inicia polling');
  var button = findAll(result, findAction('verificar-novos-documentos'))[0];
  assert.equal(Object.prototype.hasOwnProperty.call(button._attrs, 'disabled'), false,
    'botao permanece habilitado');
  assert.ok(textOf(button).indexOf('Verificar') >= 0,
    'botao mantem o rotulo padrao');
});

test('G24-B5: status ativo nao e duplicado entre botao e feedback', function () {
  var sb = makeScreenSandbox([]);
  var latestTree = null;
  sb.window.RAVATEX_DOCUMENTS.requestDocumentScan = function (options) {
    // Simula o trigger emitindo o primeiro update de status ativo.
    options.onUpdate({ id: 'req-1', source: 'gmail', status: 'requested' });
    return new Promise(function () {});
  };
  sb.window.toast = undefined;
  sb.window.setApp = function (tree) { latestTree = tree; };
  var result = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  findAll(result, findAction('verificar-novos-documentos'))[0]._listeners.click[0]();
  // Apos o onUpdate, o feedback nao pode espelhar o status ja exibido no botao.
  var feedback = findAll(latestTree, function (node) {
    return node._attrs && node._attrs['data-section'] === 'document-scan-feedback';
  });
  assert.equal(feedback.length, 0, 'feedback nao deve repetir o status ativo (fonte unica: o botao)');
  var button = findAll(latestTree, findAction('verificar-novos-documentos'))[0];
  assert.ok(textOf(button).indexOf('Solicitacao aguardando executor') >= 0,
    'botao exibe o status ativo como fonte unica');
});

test('G25-B1: separa recebimento Gmail do processamento e marca fallback/legado', function () {
  var sb = makeScreenSandbox([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18', filename_original: 'interno.pdf',
      email_received_at: '2026-07-09T09:00:00.000Z', email_received_at_source: 'gmail_internal_date',
      email_received_at_estimated: false, created_at: '2026-07-09T12:00:00.000Z', status: 'pending',
    },
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb19', filename_original: 'header.pdf',
      email_received_at: '2026-07-09T10:00:00.000Z', email_received_at_source: 'header_date',
      email_received_at_estimated: true, created_at: '2026-07-09T12:00:00.000Z', status: 'pending',
    },
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb20', filename_original: 'legacy.pdf',
      received_at: '2026-07-09T08:00:00.000Z', created_at: '2026-07-09T12:00:00.000Z', status: 'pending',
    },
  ]);
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rendered = textOf(tree);
  assert.ok(rendered.indexOf('Recebido: 09/07 06:00') >= 0, 'internalDate shown as email timestamp');
  assert.ok(rendered.indexOf('Processado: 09/07 09:00') >= 0, 'processing shown separately');
  assert.ok(rendered.indexOf('data estimada') >= 0, 'header fallback labelled');
  assert.ok(rendered.indexOf('Recebido: indisponível') >= 0, 'legacy does not use received_at as email date');
  assert.ok(rendered.indexOf('documento legado') >= 0, 'legacy label shown');
});

test('G25-B1-UX-A: mostra remetente e compacta labels e acoes sem perder acessibilidade', function () {
  var sb = makeScreenSandbox([{
    document_id: 'doc-sender', filename_original: 'nota.pdf', sender_email: 'fornecedor@empresa.com.br',
    email_received_at: '2026-07-09T09:00:00.000Z', created_at: '2026-07-09T12:00:00.000Z', status: 'pending',
  }, {
    document_id: 'doc-sender-legacy', filename_original: 'legado.pdf', created_at: '2026-07-09T12:00:00.000Z', status: 'pending',
  }]);
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rendered = textOf(tree);
  assert.ok(rendered.indexOf('Remetente: fornecedor@empresa.com.br') >= 0);
  assert.ok(rendered.indexOf('Remetente: indisponível') >= 0);
  assert.ok(rendered.indexOf('Recebido:') >= 0);
  assert.ok(rendered.indexOf('Processado:') >= 0);
  assert.equal(rendered.indexOf('Recebido no e-mail:'), -1);
  assert.equal(rendered.indexOf('Processado pelo Ingestor:'), -1);

  var refresh = findAll(tree, findAction('atualizar-documentos'))[0];
  var scan = findAll(tree, findAction('verificar-novos-documentos'))[0];
  var importBtn = findAll(tree, function (n) { return n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline'; })[0];
  assert.equal(textOf(refresh), 'Atualizar');
  assert.equal(textOf(scan), 'Verificar');
  assert.equal(textOf(importBtn), 'Importar');
  assert.equal(refresh._attrs['aria-label'], 'Atualizar agora');
  assert.equal(refresh._attrs.title, 'Atualizar agora');
  assert.equal(scan._attrs['aria-label'], 'Verificar novos documentos');
  assert.equal(scan._attrs.title, 'Verificar novos documentos');
  assert.equal(importBtn._attrs['aria-label'], 'Importar documentos');
  assert.equal(importBtn.title, 'Importar documentos');
  assert.equal(refresh._listeners.click.length, 1);
  assert.equal(scan._listeners.click.length, 1);
  assert.equal(importBtn._listeners.click.length, 1);
});

// ---------------------------------------------------------------------
// 10. G28-B4-B2: integracao com queue-ui
// ---------------------------------------------------------------------

function findSelectByOptionValue(tree, value) {
  return findAll(tree, (n) => n.tagName === 'SELECT').find(function (s) {
    return (s.children || []).some(function (opt) { return opt._attrs && opt._attrs.value === value; });
  });
}

test('G28-B4-B2: sandbox com queue-ui expoe namespace e filtra por origem (canonical_remote)', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 's1', filename_original: 'NF-s.xml', tipo_documento: 'nf', formato: 'xml', _ravatex_source: 'supabase' },
    { document_id: 'l1', filename_original: 'NF-l.xml', tipo_documento: 'nf', formato: 'xml', _ravatex_source: 'manual' },
    { document_id: 'u1', filename_original: 'NF-u.xml', tipo_documento: 'nf', formato: 'xml', _ravatex_source: 'bogus' },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 3, 'tres documentos renderizados');

  var sourceSelect = findSelectByOptionValue(tree, 'canonical_remote');
  assert.ok(sourceSelect, 'select de origem presente com canonical_remote');
  sourceSelect.value = 'canonical_remote';
  sourceSelect._listeners.change[0]();
  tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  rows = findAll(tree, findRow);
  assert.equal(rows.length, 1, 'apenas canonical_remote apos filtro');
  assert.equal(rows[0]._attrs['data-document-id'], 's1');
});

test('G28-B4-B2: filtro por evidencia tecnica', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 'av', filename_original: 'av.pdf', tipo_documento: 'nf', _ravatex_source: 'supabase',
      _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-09T14:00:00.000Z' } },
    { document_id: 'ms', filename_original: 'ms.pdf', tipo_documento: 'nf', _ravatex_source: 'supabase',
      _ravatex_technical_evidence: null },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var evidenceSelect = findSelectByOptionValue(tree, 'remote_unavailable');
  assert.ok(evidenceSelect, 'select de evidencia presente');
  evidenceSelect.value = 'available';
  evidenceSelect._listeners.change[0]();
  tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 1, 'apenas available apos filtro');
  assert.equal(rows[0]._attrs['data-document-id'], 'av');
});

test('G28-B4-B2: filteredDocs usa index-based reconnection com IDs duplicados', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 'dup-id', filename_original: 'first.xml', tipo_documento: 'nf', formato: 'xml', _ravatex_source: 'supabase', status: 'pending' },
    { document_id: 'dup-id', filename_original: 'second.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase', status: 'accepted' },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 2, 'dois documentos com mesmo ID sao renderizados');
  assert.ok(textOf(rows[0]).indexOf('first.xml') >= 0, 'primeiro row = first.xml');
  assert.ok(textOf(rows[1]).indexOf('second.pdf') >= 0, 'segundo row = second.pdf');
});

test('G28-B4-B2: filteredDocs com ID em branco nao altera cardinalidade', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: '', filename_original: 'blank-id-1.xml', tipo_documento: 'nf', formato: 'xml', _ravatex_source: 'supabase' },
    { document_id: '', filename_original: 'blank-id-2.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase' },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 2, 'dois documentos com ID em branco');
  assert.ok(textOf(rows[0]).indexOf('blank-id-1') >= 0, 'primeiro = blank-id-1');
  assert.ok(textOf(rows[1]).indexOf('blank-id-2') >= 0, 'segundo = blank-id-2');
});

test('G28-B4-B2: filteredDocs retorna na ordem visivel da queue UI', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 'a', filename_original: 'a.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase', status: 'accepted' },
    { document_id: 'b', filename_original: 'b.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase', status: 'pending' },
    { document_id: 'c', filename_original: 'c.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase', status: 'accepted' },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  // Usa tab accepted para so mostrar accepted
  var tabBtns = findAll(tree, function (n) { return n._attrs && n._attrs['data-tab'] === 'accepted'; });
  assert.equal(tabBtns.length, 1, 'botao accepted existe');
  tabBtns[0]._listeners.click[0]();
  tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 2, 'dois accepted visiveis');
  assert.ok(textOf(rows[0]).indexOf('a.pdf') >= 0, 'primeiro = a.pdf');
  assert.ok(textOf(rows[1]).indexOf('c.pdf') >= 0, 'segundo = c.pdf');
});

test('G28-B4-B2: screen NAO duplica status/pedido derivacao (usa queue UI como fonte unica)', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 'd1', filename_original: 'd1.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase', status: 'pending' },
  ]);
  sb.window.setApp = function () {};
  vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var queueUI = sb.window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI;
  assert.ok(queueUI, 'queue UI disponivel');
  var entry = queueUI.buildQueue()[0];
  // A tela deve usar queueItem.review e queueItem.pedido, nao o doc.status/doc.pedido raw
  assert.equal(entry.queueItem.review.state, 'pending', 'review state via queue item');
  assert.equal(entry.queueItem.pedido.state, 'no_confirmed_link', 'pedido state via queue item');
});

test('G28-B4-B2: legacy fallback mantem acoes locais e nao vira pending', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb21', filename_original: 'legado.pdf', tipo_documento: 'nf', _ravatex_source: 'manual' },
  ]);
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var rows = findAll(tree, findRow);
  assert.equal(rows.length, 1);
  // Botoes locais de aceitar/rejeitar presentes (nao botoes de nuvem)
  assert.equal(findAll(rows[0], findAction('aceitar-documento')).length, 1, 'aceitar local presente');
  assert.equal(findAll(rows[0], findAction('rejeitar-documento')).length, 1, 'rejeitar local presente');
  assert.equal(findAll(rows[0], findAction('aceitar-documento-nuvem')).length, 0, 'sem aceitar nuvem para legacy');
});

// ---------------------------------------------------------------------
// G28-B4-B2: queue-ui state bar (UI-state boundary)
// ---------------------------------------------------------------------

test('G28-B4-B2: tela referencia getUIState e buildQueueUIStateBar', function () {
  var src = readOrFail(SCREEN);
  assert.ok(src.indexOf('getUIState') >= 0, 'tela referencia getUIState');
  assert.ok(src.indexOf('buildQueueUIStateBar') >= 0, 'tela define buildQueueUIStateBar');
});

test('G28-B4-B2: queue-ui expoe getUIState no namespace', function () {
  var qSrc = readOrFail(QUEUE_UI);
  assert.ok(qSrc.indexOf('getUIState') >= 0, 'queue-ui expoe getUIState');
  assert.ok(qSrc.indexOf('getUIState: getUIState') >= 0, 'getUIState no namespace publico');
});

test('G28-B4-B2: state bar renderiza source-empty com data-marker correto', function () {
  var sb = makeScreenSandboxWithQueueUI([]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var stateBars = findAll(tree, function (n) {
    return n._attrs && n._attrs['data-section'] === 'queue-ui-state';
  });
  assert.equal(stateBars.length, 1, 'state bar presente com source-empty');
  assert.equal(stateBars[0]._attrs['data-marker'], 'queue-ui-state-source-empty');
  assert.equal(stateBars[0]._attrs.role, 'status');
  assert.equal(stateBars[0]._attrs['aria-live'], 'polite');
  assert.equal(stateBars[0]._attrs['aria-label'], 'Status: nenhum documento recebido');
  assert.ok(textOf(stateBars[0]).indexOf('Nenhum documento recebido') >= 0);
});

test('G28-B4-B2: state bar NAO renderiza quando estado e ok (documentos + remoto disponivel)', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 's1', filename_original: 'doc.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase' },
  ]);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var stateBars = findAll(tree, function (n) {
    return n._attrs && n._attrs['data-section'] === 'queue-ui-state';
  });
  assert.equal(stateBars.length, 0, 'state bar nao aparece quando nao ha estado especial');
});

test('G28-B4-B2: state bar renderiza remote-unavailable quando remoto indisponivel sem fallback', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 's1', filename_original: 'doc.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'supabase' },
  ]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var stateBars = findAll(tree, function (n) {
    return n._attrs && n._attrs['data-section'] === 'queue-ui-state';
  });
  assert.equal(stateBars.length, 1, 'state bar presente com remote-unavailable');
  assert.equal(stateBars[0]._attrs['data-marker'], 'queue-ui-state-remote-unavailable');
  assert.equal(stateBars[0]._attrs.role, 'status');
  assert.ok(textOf(stateBars[0]).indexOf('Conexão remota indisponível') >= 0);
  assert.ok(textOf(stateBars[0]).indexOf('fallback') === -1, 'nao menciona fallback quando nao ha');
  assert.ok(stateBars[0]._attrs.style.indexOf('background:#fdecec') >= 0, 'erro remoto usa tom de erro');
});

test('G28-B4-B2: state bar renderiza remote-unavailable-legacy-fallback quando ha registros legacy', function () {
  var sb = makeScreenSandboxWithQueueUI([
    { document_id: 'l1', filename_original: 'legacy.pdf', tipo_documento: 'nf', formato: 'pdf', _ravatex_source: 'manual' },
  ]);
  sb.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var stateBars = findAll(tree, function (n) {
    return n._attrs && n._attrs['data-section'] === 'queue-ui-state';
  });
  assert.equal(stateBars.length, 1, 'state bar presente com legacy fallback');
  assert.equal(stateBars[0]._attrs['data-marker'], 'queue-ui-state-remote-unavailable-legacy-fallback');
  assert.ok(textOf(stateBars[0]).indexOf('fallback local') >= 0);
  assert.ok(stateBars[0]._attrs.style.indexOf('background:#fdf0e6') >= 0, 'fallback usa tom de aviso distinto');
});

test('G28-B4-B2: state bar distingue remote-unavailable de remote-unavailable-legacy-fallback', function () {
  // Supabase-only → remote-unavailable
  var sbSupabase = makeScreenSandboxWithQueueUI([
    { document_id: 's1', filename_original: 's.pdf', _ravatex_source: 'supabase' },
  ]);
  sbSupabase.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  sbSupabase.window.setApp = function () {};
  var treeS = vm.runInContext('window.screenDocumentosRecebidos()', sbSupabase);
  var barsS = findAll(treeS, function (n) { return n._attrs && n._attrs['data-section'] === 'queue-ui-state'; });
  assert.equal(barsS.length, 1);
  assert.equal(barsS[0]._attrs['data-marker'], 'queue-ui-state-remote-unavailable');

  // Manual-only → remote-unavailable-legacy-fallback
  var sbManual = makeScreenSandboxWithQueueUI([
    { document_id: 'l1', filename_original: 'l.pdf', _ravatex_source: 'manual' },
  ]);
  sbManual.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  sbManual.window.setApp = function () {};
  var treeM = vm.runInContext('window.screenDocumentosRecebidos()', sbManual);
  var barsM = findAll(treeM, function (n) { return n._attrs && n._attrs['data-section'] === 'queue-ui-state'; });
  assert.equal(barsM.length, 1);
  assert.equal(barsM[0]._attrs['data-marker'], 'queue-ui-state-remote-unavailable-legacy-fallback');

  assert.notEqual(barsS[0]._attrs['data-marker'], barsM[0]._attrs['data-marker'],
    'markers devem ser distintos para estados diferentes');
});

test('G28-B4-B2: state bar source-empty e filter-empty tem markers distintos', function () {
  // source-empty
  var sbEmpty = makeScreenSandboxWithQueueUI([]);
  sbEmpty.window.setApp = function () {};
  var treeEmpty = vm.runInContext('window.screenDocumentosRecebidos()', sbEmpty);
  var barEmpty = findAll(treeEmpty, function (n) { return n._attrs && n._attrs['data-section'] === 'queue-ui-state'; });
  assert.equal(barEmpty.length, 1);
  assert.equal(barEmpty[0]._attrs['data-marker'], 'queue-ui-state-source-empty');
  assert.ok(textOf(barEmpty[0]).indexOf('Nenhum documento recebido') >= 0);

  // filter-empty e testado indiretamente via codigo: getUIState distingue
  // source-empty de filter-empty no modulo de testes unitarios. O smoke
  // garante que o marker de source-empty esta correto.
  var src = readOrFail(QUEUE_UI);
  assert.ok(src.indexOf('queue-ui-state-filter-empty') >= 0, 'filter-empty marker presente no codigo');
  assert.ok(src.indexOf('queue-ui-state-source-empty') >= 0, 'source-empty marker presente no codigo');
});

test('G28-B4-B2: state bar usa aria-live="polite" e role="status" para acessibilidade', function () {
  var src = readOrFail(SCREEN);
  var barIdx = src.indexOf('buildQueueUIStateBar');
  assert.ok(barIdx >= 0);
  var barSection = src.slice(barIdx, barIdx + 1400);
  assert.ok(barSection.indexOf("role: 'status'") >= 0, 'role status presente');
  assert.ok(barSection.indexOf("'aria-live': 'polite'") >= 0, 'aria-live polite presente');
  assert.ok(barSection.indexOf("'aria-label'") >= 0, 'aria-label presente');
  assert.ok(barSection.indexOf("'data-marker'") >= 0, 'data-marker presente');
});

test('G28-B4-B2: tela nao reintroduz filtragem por raw record no caminho principal', function () {
  var src = readOrFail(SCREEN);
  var filteredDocsIdx = src.indexOf('function filteredDocs');
  assert.ok(filteredDocsIdx >= 0, 'filteredDocs existe');
  var filteredBody = src.slice(filteredDocsIdx, filteredDocsIdx + 1200);
  // Deve usar queueUI.filterQueue quando queueItem disponivel
  assert.ok(filteredBody.indexOf('queueUI.filterQueue') >= 0, 'filteredDocs usa queueUI.filterQueue');
  // O caminho sem queueUI (fallback) existe mas so e usado quando nao ha queueUI
  var docStatusCheck = filteredBody.indexOf("doc.status !== ui.tab");
  assert.ok(docStatusCheck >= 0 || filteredBody.indexOf("doc.status") === -1,
    'filteredDocs tem fallback legado mas o caminho principal usa queue UI');
});

// =====================================================================
// 11. G28-B4-B3: Row state indicators (evidence, review, pedido, source, alerts)
// =====================================================================

test('G28-B4-B3: row renderiza indicadores de evidencia, revisao, pedido e origem', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb18',
      filename_original: 'NF-99.xml', tipo_documento: 'nf', formato: 'xml',
      direcao_nf: 'entrada', drive_file_id: 'drive-99',
      drive_web_view_link: 'https://drive.example/99',
      status: 'pending', pedido_manual: 'PED-99-2026', pedido_id: null,
      _ravatex_technical_evidence: null, _ravatex_server_decision: null,
      _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var row = findAll(result, findRow)[0];
  assert.ok(row, 'row existe');
  var rowText = textOf(row);

  assert.ok(rowText.indexOf('Evidência ausente') >= 0, 'evidencia ausente: ' + rowText.slice(0, 600));
  assert.ok(rowText.indexOf('Pendente de revisão') >= 0, 'revisao pendente: ' + rowText.slice(0, 600));
  assert.ok(rowText.indexOf('Pedido sugerido') >= 0, 'pedido sugerido: ' + rowText.slice(0, 600));
  assert.ok(rowText.indexOf('Supabase') >= 0, 'origem supabase: ' + rowText.slice(0, 600));
});

test('G28-B4-B3: row com evidencia invalida mostra alerta e indicador', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb19',
      filename_original: 'NF-inv.xml', tipo_documento: 'nf', formato: 'xml',
      drive_web_view_link: null, status: 'pending',
      _ravatex_technical_evidence: { state: 'invalid' },
      _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Evidência inválida') >= 0, 'indicador evidencia invalida: ' + rowText.slice(0, 600));
});

test('G28-B4-B3: row com revisao rejected mostra Rejeitado', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb20',
      filename_original: 'rej.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_web_view_link: null, status: 'rejected',
      _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Rejeitado') >= 0, 'revisao rejected: ' + rowText.slice(0, 400));
});

test('G28-B4-B3: row legacy mostra Revisao indisponivel e Fallback legado', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb21',
      filename_original: 'legacy.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'pending', _ravatex_source: 'manual',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Revisão indisponível') >= 0, 'legacy review: ' + rowText.slice(0, 400));
  assert.ok(rowText.indexOf('Fallback legado') >= 0, 'legado source: ' + rowText.slice(0, 400));
  assert.ok(rowText.indexOf('Vínculo indisponível') >= 0, 'pedido unavailable: ' + rowText.slice(0, 400));
  assert.ok(rowText.indexOf('Evidência ausente') === -1, 'legacy nao tem missing evidence: ' + rowText.slice(0, 400));
});

test('G28-B4-B3: legacy evidencia unavailable e nunca missing', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb22',
      filename_original: 'legacy-ev.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'accepted', _ravatex_source: 'manual',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Não disponível nesta origem') >= 0, 'legacy evidence: ' + rowText.slice(0, 400));
  assert.equal(rowText.indexOf('Evidência ausente'), -1, 'legacy nao e missing');
});

test('G28-B4-B3: indicadores sao spans nao botoes', function () {
  var docs = [
    { document_id: 'ev-avail', filename_original: 'ev-avail.pdf', _ravatex_source: 'supabase', status: 'pending',
      _ravatex_technical_evidence: { state: 'available', evidenceVersion: 1, createdAt: '2026-07-10T10:00:00.000Z' } },
    { document_id: 'ev-miss', filename_original: 'ev-miss.pdf', _ravatex_source: 'supabase', status: 'pending' },
    { document_id: 'ev-inv', filename_original: 'ev-inv.pdf', _ravatex_source: 'supabase', status: 'pending',
      _ravatex_technical_evidence: { state: 'invalid' } },
    { document_id: 'ev-unav', filename_original: 'ev-unav.pdf', _ravatex_source: 'manual' },
    { document_id: 'rv-acc', filename_original: 'rv-acc.pdf', _ravatex_source: 'supabase', status: 'accepted' },
    { document_id: 'rv-rej', filename_original: 'rv-rej.pdf', _ravatex_source: 'supabase', status: 'rejected' },
    { document_id: 'rv-unk', filename_original: 'rv-unk.pdf', _ravatex_source: 'supabase', _ravatex_server_decision: { status: 'weird' } },
    { document_id: 'ped-conf', filename_original: 'ped-conf.pdf', _ravatex_source: 'supabase', status: 'pending', _ravatex_link_revision: { state: 'available', revision_id: 'rev-conf', pedido_id: 'PED-42-2026', op_links: [] } },
    { document_id: 'ped-sug', filename_original: 'ped-sug.pdf', _ravatex_source: 'supabase', status: 'pending', pedido_manual: 'PED-99-2026', pedido_id: null },
    { document_id: 'src-unk', filename_original: 'src-unk.pdf', _ravatex_source: 'bogus' },
  ];
  var sb = makeScreenSandboxWithQueueUI(docs);
  sb.window.setApp = function () {};
  var tree = vm.runInContext('window.screenDocumentosRecebidos()', sb);
  var allSpans = findAll(tree, function (n) { return n.tagName === 'SPAN'; });
  var buttons = findAll(tree, function (n) { return n.tagName === 'BUTTON'; });
  var rowText = JSON.stringify(findAll(tree, findRow).map(textOf));

  var indicators = [
    'Evidência disponível', 'Evidência ausente', 'Evidência inválida', 'Não disponível nesta origem',
    'Pendente de revisão', 'Aceito', 'Rejeitado', 'Estado desconhecido', 'Revisão indisponível',
    'Revisão pendente',
    'Pedido referenciado', 'Pedido sugerido', 'Sem vínculo confirmado', 'Vínculo indisponível',
    'Supabase', 'Fallback legado', 'Origem desconhecida',
  ];
  indicators.forEach(function (label) {
    assert.ok(rowText.indexOf(label) >= 0, 'indicator "' + label + '" in row text');
    var labelInButton = buttons.some(function (b) { return textOf(b).trim() === label; });
    assert.ok(!labelInButton, 'indicator "' + label + '" NOT in any button text');
    var matching = allSpans.filter(function (s) { return textOf(s) === label; });
    assert.ok(matching.length >= 1, 'indicator "' + label + '" in at least one SPAN');
    var withA11y = matching.filter(function (s) {
      return s._attrs && s._attrs.title && s._attrs.title.length > 0
        && s._attrs['aria-label'] && s._attrs['aria-label'].length > 0;
    });
    assert.ok(withA11y.length >= 1, 'SPAN for "' + label + '" has nonempty title and aria-label');
  });

  var sbRu = makeScreenSandboxWithQueueUI([
    { document_id: 'ru', filename_original: 'ru.pdf', _ravatex_source: 'supabase' },
  ]);
  sbRu.window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
  sbRu.window.setApp = function () {};
  var ruTree = vm.runInContext('window.screenDocumentosRecebidos()', sbRu);
  var ruText = JSON.stringify(findAll(ruTree, function () { return true; }).map(textOf));
  assert.ok(ruText.indexOf('Consulta indisponível') >= 0, 'remote_unavailable shows "Consulta indisponível"');
  assert.equal(ruText.indexOf('Evidência ausente'), -1, 'remote_unavailable NOT "Evidência ausente"');
});

test('G28-B4-B3: acoes Drive e decisao preservadas', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb24',
      filename_original: 'drive-actions.xml', tipo_documento: 'nf', formato: 'xml',
      drive_file_id: 'drive-x', drive_web_view_link: 'https://drive.example/x',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var ver = findAll(result, findAction('ver-documento-drive'));
  var baixar = findAll(result, findAction('baixar-documento-drive'));
  assert.equal(ver.length, 1, 'botao Ver preservado');
  assert.equal(baixar.length, 1, 'botao Baixar preservado');
});

test('G28-B4-B3: source desconhecida com pedido indisponivel', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb25',
      filename_original: 'unknown.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'pending', _ravatex_source: 'bogus',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Origem desconhecida') >= 0, 'origem desconhecida: ' + rowText.slice(0, 400));
  assert.ok(rowText.indexOf('Vínculo indisponível') >= 0, 'vinculo indisponivel: ' + rowText.slice(0, 400));
});

test('G28-B4-B3: pedido no_confirmed_link com supabase disponivel', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb26',
      filename_original: 'noconfirm.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'pending', pedido_manual: null, pedido_id: null,
      _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var rowText = JSON.stringify(findAll(result, function () { return true; }).map(textOf));
  assert.ok(rowText.indexOf('Sem vínculo confirmado') >= 0, 'no_confirmed_link: ' + rowText.slice(0, 400));
});

// =====================================================================
// 12. G28-B4-B4: Source-file state gating and validation presentation
// =====================================================================

test('G28-B4-B4: drive_available com web link exibe Ver e Baixar', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb30',
      filename_original: 'b4-view.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_file_id: 'drive-30', drive_web_view_link: 'https://drive.example/30',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 1, 'Ver presente');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 1, 'Baixar presente');
  assert.equal(findAll(result, function (n) { return n._attrs && n._attrs['data-source-file-state']; }).length, 0, 'nenhum span de estado source-file');
});

test('G28-B4-B4: drive_available com file_id apenas mostra Baixar, sem Ver', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb31',
      filename_original: 'b4-dl.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_file_id: 'drive-31',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'Ver ausente sem web link');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 1, 'Baixar presente via driveId');
  assert.equal(findAll(result, function (n) { return n._attrs && n._attrs['data-source-file-state']; }).length, 0, 'nenhum span de estado source-file');
});

test('G28-B4-B4: unsupported source mostra label estatico nao interativo', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb32',
      filename_original: 'b4-unsup.pdf', tipo_documento: 'nf', formato: 'pdf',
      gmail_message_id: 'msg-32',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Nenhum botao de acao Drive
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'sem Ver');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 0, 'sem Baixar');
  assert.equal(findAll(result, findAction('sem-link')).length, 0, 'sem Sem link antigo');
  // Span estatico com label de unsupported
  var sfSpans = findAll(result, function (n) { return n._attrs && n._attrs['data-source-file-state']; });
  assert.equal(sfSpans.length, 1, 'span de estado source-file presente');
  assert.equal(sfSpans[0]._attrs['data-source-file-state'], 'unsupported');
  assert.equal(textOf(sfSpans[0]), 'Acesso ao arquivo não suportado nesta origem');
  // A label deve usar wrapping para caber na coluna de 148px
  assert.equal(sfSpans[0]._attrs.style.indexOf('white-space:nowrap'), -1,
    'unsupported label deve usar wrapping, nao nowrap');
  // Nao e um botao
  assert.notEqual(sfSpans[0].tagName, 'BUTTON', 'nao e um botao');
  // Nao tem onclick
  assert.equal(sfSpans[0]._listeners.click, undefined, 'sem click handler');
});

test('G28-B4-B4: missing source mostra label estatico nao interativo', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb33',
      filename_original: 'b4-miss.pdf', tipo_documento: 'nf', formato: 'pdf',
      // Sem drive fields, sem gmail_message_id, sem local_path → missing
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'sem Ver');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 0, 'sem Baixar');
  assert.equal(findAll(result, findAction('sem-link')).length, 0, 'sem Sem link antigo');
  var sfSpans = findAll(result, function (n) { return n._attrs && n._attrs['data-source-file-state']; });
  assert.equal(sfSpans.length, 1, 'span de estado source-file presente');
  assert.equal(sfSpans[0]._attrs['data-source-file-state'], 'missing');
  assert.equal(textOf(sfSpans[0]), 'Arquivo não disponível');
  assert.notEqual(sfSpans[0].tagName, 'BUTTON', 'nao e um botao');
  assert.equal(sfSpans[0]._listeners.click, undefined, 'sem click handler');
});

test('G28-B4-B4: filename/sender/MIME/localpath nao criam acoes se state nao permite', function () {
  // Documento com gmail_message_id (unsupported) — nao pode ter acoes Drive
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb34',
      filename_original: 'b4-raw.pdf', tipo_documento: 'nf', formato: 'pdf',
      sender_email: 'fornecedor@example.com',
      gmail_message_id: 'msg-34',
      // Sem drive fields
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 0, 'sem Ver');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 0, 'sem Baixar');
  // Label estatico aparece
  var sfSpans = findAll(result, function (n) { return n._attrs && n._attrs['data-source-file-state']; });
  assert.equal(sfSpans.length, 1, 'span source-file state presente');
  assert.equal(sfSpans[0]._attrs['data-source-file-state'], 'unsupported');
});

test('G28-B4-B4: validation review_pending aparece como texto nao interativo na coluna status', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb35',
      filename_original: 'b4-val.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var row = findAll(result, findRow)[0];
  assert.ok(row, 'row existe');
  var rowText = textOf(row);
  assert.ok(rowText.indexOf('Revisão pendente') >= 0, 'validation review_pending aparece: ' + rowText.slice(0, 400));
  // Nao e um botao
  var matchingSpans = findAll(row, function (n) { return n.tagName === 'SPAN' && textOf(n) === 'Revisão pendente'; });
  assert.ok(matchingSpans.length >= 1, 'em ao menos um SPAN');
  assert.equal(findAll(row, function (n) { return n.tagName === 'BUTTON' && textOf(n).trim() === 'Revisão pendente'; }).length, 0, 'nao em BUTTON');
});

test('G28-B4-B4: validation review_unavailable aparece como texto nao interativo', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb36',
      filename_original: 'b4-val-unav.pdf', tipo_documento: 'nf', formato: 'pdf',
      status: 'accepted', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var row = findAll(result, findRow)[0];
  assert.ok(row, 'row existe');
  var rowText = textOf(row);
  // accepted decision → validation review_unavailable
  assert.ok(rowText.indexOf('Revisão indisponível') >= 0, 'validation review_unavailable aparece: ' + rowText.slice(0, 400));
  var matchingSpans = findAll(row, function (n) { return n.tagName === 'SPAN' && textOf(n) === 'Revisão indisponível'; });
  assert.ok(matchingSpans.length >= 1, 'em ao menos um SPAN');
  assert.equal(findAll(row, function (n) { return n.tagName === 'BUTTON' && textOf(n).trim() === 'Revisão indisponível'; }).length, 0, 'nao em BUTTON');
});

test('G28-B4-B4: decisoes existentes permanecem inalteradas', function () {
  // Verifica que os botoes de decisao (aceitar/rejeitar nuvem e local)
  // continuam funcionando apos as mudancas B4-B4
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb37',
      filename_original: 'b4-decision.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_web_view_link: 'https://drive.example/37',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  // Botoes de decisao em nuvem preservados
  assert.equal(findAll(result, findAction('aceitar-documento-nuvem')).length, 1, 'aceitar nuvem presente');
  assert.equal(findAll(result, findAction('rejeitar-documento-nuvem')).length, 1, 'rejeitar nuvem presente');
  // Botoes de acao Drive preservados
  assert.equal(findAll(result, findAction('ver-documento-drive')).length, 1, 'Ver presente');
  assert.equal(findAll(result, findAction('baixar-documento-drive')).length, 1, 'Baixar presente');
  // Nenhum sem-link
  assert.equal(findAll(result, findAction('sem-link')).length, 0, 'sem Sem link');
});

test('G28-B4-B4: raw locators nao criam acoes quando queueItem nega drive_available', function () {
  var doc = {
    document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb40',
    filename_original: 'raw-blocked.pdf', tipo_documento: 'nf', formato: 'pdf',
    drive_file_id: 'drive-40', drive_web_view_link: 'https://drive.example/40',
    status: 'pending',
  };
  var sb = makeScreenSandboxWithQueueUI([doc]);
  sb.window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI.buildQueue = function () {
    return [{
      index: 0,
      queueItem: {
        identity: { document_id: doc.document_id, filename_original: doc.filename_original, tipo_documento: doc.tipo_documento },
        source_file: { state: 'unsupported' },
        source: { collection_source: 'supabase' },
        pedido: { state: 'no_confirmed_link' },
        review: { state: 'pending' },
        technical_evidence: { state: 'missing' },
        validation: { review: 'review_pending' },
        filter_values: {},
        alerts: [],
      },
    }];
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var tree = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(tree, findAction('ver-documento-drive')).length, 0, 'sem Ver (blocked by queueItem)');
  assert.equal(findAll(tree, findAction('baixar-documento-drive')).length, 0, 'sem Baixar (blocked by queueItem)');
  var sfSpans = findAll(tree, function (n) { return n._attrs && n._attrs['data-source-file-state']; });
  assert.equal(sfSpans.length, 1, 'span source-file state presente');
  assert.equal(sfSpans[0]._attrs['data-source-file-state'], 'unsupported');
  assert.notEqual(sfSpans[0].tagName, 'BUTTON', 'nao e um botao');
  assert.ok(sfSpans[0]._attrs.title && sfSpans[0]._attrs.title.length > 0, 'title presente');
  assert.ok(sfSpans[0]._attrs['aria-label'] && sfSpans[0]._attrs['aria-label'].length > 0, 'aria-label presente');
});

test('G28-B4-B4: sem queueItem mostra Indisponivel sem acoes derivadas de raw locators', function () {
  var sb = makeScreenSandbox([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb41',
      filename_original: 'no-qi.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_file_id: 'drive-41', drive_web_view_link: 'https://drive.example/41',
      status: 'pending',
    },
  ]);
  var container = new FakeNode('div');
  sb.container = container;
  var tree = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(tree, findAction('ver-documento-drive')).length, 0, 'sem Ver');
  assert.equal(findAll(tree, findAction('baixar-documento-drive')).length, 0, 'sem Baixar');
  var semLinks = findAll(tree, findAction('sem-link'));
  assert.equal(semLinks.length, 1, 'placeholder Indisponivel presente');
  assert.equal(textOf(semLinks[0]), 'Indisponível', 'label do placeholder');
  assert.notEqual(semLinks[0].tagName, 'BUTTON', 'nao e um botao');
  assert.equal(semLinks[0]._listeners.click, undefined, 'sem click handler');
});

test('G28-B4-B4: file_id constroi link de download correto e chama window.open com noopener,noreferrer', function () {
  var openedUrl = null;
  var openedFeatures = null;
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb44',
      filename_original: 'b4-dl-test.pdf', tipo_documento: 'nf', formato: 'pdf',
      drive_file_id: 'drive-44',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  sb.window.open = function (url, target, features) {
    openedUrl = url;
    openedFeatures = features;
  };
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var tree = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  var baixar = findAll(tree, findAction('baixar-documento-drive'))[0];
  assert.ok(baixar, 'botao Baixar existe');
  baixar._listeners.click[0]();
  assert.equal(openedUrl, 'https://drive.google.com/uc?export=download&id=drive-44',
    'download link construido de drive_file_id');
  assert.ok(openedFeatures && openedFeatures.indexOf('noopener') >= 0, 'noopener presente');
  assert.ok(openedFeatures && openedFeatures.indexOf('noreferrer') >= 0, 'noreferrer presente');
});

test('G28-B4-B4: local_path e Gmail-like nao criam acoes, apenas label estatico', function () {
  var sb = makeScreenSandboxWithQueueUI([
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb42',
      filename_original: 'b4-local.pdf', tipo_documento: 'nf', formato: 'pdf',
      local_path: '/tmp/doc.pdf',
      status: 'pending', _ravatex_source: 'supabase',
    },
    {
      document_id: '96ed4f0e-26b2-4c2f-9186-65f72bf5fb43',
      filename_original: 'b4-gmail.pdf', tipo_documento: 'nf', formato: 'pdf',
      gmail_message_id: 'msg-43',
      status: 'pending', _ravatex_source: 'supabase',
    },
  ]);
  sb.window.setApp = function () {};
  var container = new FakeNode('div');
  sb.container = container;
  var tree = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  assert.equal(findAll(tree, findAction('ver-documento-drive')).length, 0, 'sem Ver para source unsupported');
  assert.equal(findAll(tree, findAction('baixar-documento-drive')).length, 0, 'sem Baixar para source unsupported');
  var sfSpans = findAll(tree, function (n) { return n._attrs && n._attrs['data-source-file-state']; });
  assert.equal(sfSpans.length, 2, 'dois spans source-file');
  sfSpans.forEach(function (span) {
    assert.equal(span._attrs['data-source-file-state'], 'unsupported', 'ambos sao unsupported');
    assert.ok(span._attrs.title && span._attrs.title.length > 0, 'title presente');
    assert.ok(span._attrs['aria-label'] && span._attrs['aria-label'].length > 0, 'aria-label presente');
    assert.notEqual(span.tagName, 'BUTTON', 'nao e botao');
    assert.equal(span._listeners.click, undefined, 'sem click handler');
  });
  var allText = JSON.stringify(findAll(tree, function () { return true; }).map(textOf));
  assert.ok(allText.indexOf('Acesso ao arquivo não suportado nesta origem') >= 0,
    'label de unsupported visivel');
});
