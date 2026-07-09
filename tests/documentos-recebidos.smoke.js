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
  const idxCommon = index.indexOf('js/screens/common.js');
  const idxScreen = index.indexOf('js/screens/documentos-recebidos.js');
  const idxBoot = index.indexOf('js/boot.js');
  assert.ok(idxIngestor > 0, 'ingestor ausente');
  assert.ok(idxLoader > 0, 'loader ausente');
  assert.ok(idxCommon > 0, 'common ausente');
  assert.ok(idxScreen > 0, 'documentos-recebidos ausente');
  assert.ok(idxBoot > 0, 'boot ausente');
  assert.ok(idxIngestor < idxLoader, 'ingestor antes do loader');
  assert.ok(idxLoader < idxCommon, 'loader antes do common');
  assert.ok(idxCommon < idxScreen, 'common antes da tela');
  assert.ok(idxScreen < idxBoot, 'tela antes do boot');
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

test('documentos-recebidos: NAO referencia Supabase', function () {
  assert.equal(/supa\.from\s*\(/.test(screen), false, 'supa.from em documentos-recebidos');
  assert.equal(/supabase/.test(screen), false, 'supabase em documentos-recebidos');
  assert.equal(/window\.supa/.test(screen), false, 'window.supa em documentos-recebidos');
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
  appendChild(n) { if (n != null) this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
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
  const sandbox = {
    document: documentMock,
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
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
  // Carrega import-received (G12-R1: expoe createReceivedImportButton)
  vm.runInContext(importReceivedSrc, sandbox, { filename: 'js/documents-ingestor-import-received.js' });
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
  // Botao Ver
  const verBtn = findAll(row, findAction('ver-documento-drive'));
  assert.equal(verBtn.length, 1, '1 botao Ver esperado');
  const btn = verBtn[0];
  assert.equal(textOf(btn), 'Ver', 'label do botao');
  const downloadBtn = findAll(row, findAction('baixar-documento-drive'));
  assert.equal(downloadBtn.length, 1, '1 botao Baixar esperado');
  assert.equal(textOf(downloadBtn[0]), 'Baixar', 'label do botao Baixar');
});

test('runtime: botao Ver chama window.open com noopener,noreferrer', function () {
  let openedUrl = null;
  let openedTarget = null;
  let openedFeatures = null;
  const sb = makeScreenSandbox([
    {
      document_id: 'doc-open',
      filename_original: 'NF-001.xml',
      tipo_documento: 'nf',
      formato: 'xml',
      drive_web_view_link: 'https://drive.google.com/file/d/open/view',
    },
  ]);
  sb.window.open = function (url, target, features) {
    openedUrl = url;
    openedTarget = target;
    openedFeatures = features;
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const btn = findAll(result, findAction('ver-documento-drive'))[0];
  assert.ok(btn, 'botao Ver existe');
  assert.equal(btn._listeners.click.length, 1, '1 click handler');
  btn._listeners.click[0]();
  assert.equal(openedUrl, 'https://drive.google.com/file/d/open/view',
    'window.open deve receber o drive_web_view_link');
  assert.equal(openedTarget, '_blank', 'alvo _blank');
  assert.ok(openedFeatures && openedFeatures.indexOf('noopener') >= 0,
    'features deve conter noopener: ' + openedFeatures);
  assert.ok(openedFeatures && openedFeatures.indexOf('noreferrer') >= 0,
    'features deve conter noreferrer: ' + openedFeatures);
});

test('runtime: botao Baixar fica depois de Ver e abre link de download do Drive', function () {
  let openedUrl = null;
  let openedTarget = null;
  let openedFeatures = null;
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
  sb.window.open = function (url, target, features) {
    openedUrl = url;
    openedTarget = target;
    openedFeatures = features;
  };
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const actions = findAll(row, (n) => n._attrs && (
    n._attrs['data-action'] === 'ver-documento-drive'
    || n._attrs['data-action'] === 'baixar-documento-drive'
  ));
  assert.equal(actions.length, 2, 'Ver e Baixar presentes');
  assert.equal(actions[0]._attrs['data-action'], 'ver-documento-drive', 'Ver vem antes');
  assert.equal(actions[1]._attrs['data-action'], 'baixar-documento-drive', 'Baixar vem depois');
  actions[1]._listeners.click[0]();
  assert.equal(openedUrl, 'https://drive.google.com/uc?export=download&id=drive-download-id',
    'window.open deve receber link de download do Drive');
  assert.equal(openedTarget, '_blank', 'alvo _blank');
  assert.ok(openedFeatures && openedFeatures.indexOf('noopener') >= 0,
    'features deve conter noopener: ' + openedFeatures);
  assert.ok(openedFeatures && openedFeatures.indexOf('noreferrer') >= 0,
    'features deve conter noreferrer: ' + openedFeatures);
});

test('runtime: documento sem drive_web_view_link mostra "Sem link"', function () {
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
  assert.equal(semLink.length, 1, 'placeholder Sem link aparece');
  assert.equal(textOf(semLink[0]), 'Sem link', 'label do placeholder');
  const verBtns = findAll(result, findAction('ver-documento-drive'));
  assert.equal(verBtns.length, 0, 'sem botao Ver para doc sem link');
  const downloadBtns = findAll(result, findAction('baixar-documento-drive'));
  assert.equal(downloadBtns.length, 0, 'sem botao Baixar para doc sem link');
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
  assert.equal(verBtns.length, 2, '2 botoes Ver esperados (a e c)');
  const downloadBtns = findAll(result, findAction('baixar-documento-drive'));
  assert.equal(downloadBtns.length, 2, '2 botoes Baixar esperados (a e c)');
  const semLinks = findAll(result, findAction('sem-link'));
  assert.equal(semLinks.length, 1, '1 placeholder Sem link esperado (b)');
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
  var importIdx = allText.indexOf('Importar documentos');
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
  assert.equal(refreshBtns.length, 1, 'botao Atualizar agora presente no header');
  const importBtns = findAll(result, (n) => n.tagName === 'BUTTON' && n.id === 'rv-docs-received-import-btn-inline');
  assert.equal(importBtns.length, 1, 'botao Importar documentos presente no header');

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
  assert.equal(selects.length, 3, 'tres selects de filtro esperados');
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

test('G12-R3: card exibe colunas Status, Pedido e Recebido em', function () {
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
  assert.ok(colsText.indexOf('RECEBIDO EM') >= 0, 'cabecalho tem RECEBIDO EM');
  assert.ok(colsText.indexOf('AÇÕES') >= 0, 'cabecalho tem AÇÕES');
  assert.ok((colsHeader[0]._attrs.style || '').indexOf('minmax(190px,1.05fr)') >= 0,
    'coluna Tipo deve ceder espaco para Acoes no grid: ' + (colsHeader[0]._attrs.style || ''));
  assert.ok((colsHeader[0]._attrs.style || '').indexOf('148px') >= 0,
    'coluna Acoes deve comportar quatro botoes: ' + (colsHeader[0]._attrs.style || ''));

  // Cada row exibe os tres campos
  const rows = findAll(result, findRow);
  assert.equal(rows.length, 1);
  const row = rows[0];
  const rowText = textOf(row);
  assert.ok(rowText.indexOf('PED-25-2026') >= 0, 'pedido_manual aparece no row');
  assert.ok(rowText.indexOf('Pendente') >= 0, 'status Pendente padrao aparece');
  // Recebido em aparece formatado (dd/mm HH:MM)
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

test('G12-F2: tela usa received_at quando created_at nao existe', function () {
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
  // Recebido em formatado dd/mm HH:MM
  assert.ok(/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(rowText),
    'Recebido em formatado a partir de received_at: ' + rowText);
});

test('G12-F2: tela prioriza received_at quando created_at tambem existe', function () {
  // received_at e 30min depois de created_at. A tela deve usar received_at.
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
      received_at: sampleIso,
      created_at: '2026-07-08T10:00:00.000Z',
    },
  ]);
  const container = new FakeNode('div');
  sb.container = container;
  const result = vm.runInContext('window.screenDocumentosRecebidos(container)', sb);
  const row = findAll(result, findRow)[0];
  const recebidoEm = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'recebido-em')[0];
  assert.ok(recebidoEm, 'celula recebido-em existe');
  // received_at aparece (offset local), created_at NAO aparece
  assert.ok(textOf(recebidoEm).indexOf(localHHMM) >= 0,
    'celula deve usar received_at (' + localHHMM + '), nao created_at: ' + textOf(recebidoEm));
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
  const recebidoEm = findAll(row, (n) => n._attrs && n._attrs['data-field'] === 'recebido-em')[0];
  assert.ok(textOf(recebidoEm).length > 0, 'data formatada a partir de created_at');
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
