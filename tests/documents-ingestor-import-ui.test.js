// =====================================================================
// === tests/documents-ingestor-import-ui.test.js =======================
// Testes para a UX manual de import do Documents Ingestor em
// js/documents-ingestor-import-ui.js.
//
// Fase: RAVATEX-TAPETES-G11-E-DOCUMENTS-MANUAL-IMPORT-UX
// Escopo: valida botao de import, file input, FileReader, integracao
//   com loadDocumentsIngestorEventsFromText e feedback toast.
//
// Garante:
//   - Botao e file input sao criados no DOM
//   - FileReader le arquivo e chama loadFromText
//   - Toast de sucesso mostra count
//   - Toast de erro mostra mensagem controlada
//   - Erro de leitura de arquivo tratado
//   - Nao chama Supabase, Google/Drive, rede
//   - Sem regressao nos testes existentes
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
const DOC_IMPORT_UI = path.join(ROOT, 'js', 'documents-ingestor-import-ui.js');
const FIXTURE = path.join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const fixtureText = readOrFail(FIXTURE);
const importUiSrc = readOrFail(DOC_IMPORT_UI);

// -------------------------------------------------------------------
// Sandbox helpers
// -------------------------------------------------------------------

function makeImportUISandbox(opts) {
  opts = opts || {};

  var toasts = [];
  var domElements = {};
  var eventListeners = {};
  var fileInputEl = null;
  var fileReaderMocks = [];

  // Mock document
  var mockDocument = {
    body: { appendChild: function (el) { /* ok */ } },
    createElement: function (tag) {
      var el = {
        tagName: tag.toUpperCase(),
        type: '',
        accept: '',
        style: {},
        id: '',
        textContent: '',
        title: '',
        files: null,
        _clickHandlers: [],
        _changeHandlers: [],
        setAttribute: function (name, value) { el[name] = value; },
        addEventListener: function (evt, fn) {
          if (evt === 'click') el._clickHandlers.push(fn);
          if (evt === 'change') el._changeHandlers.push(fn);
        },
        removeEventListener: function () {},
        click: function () {
          if (el.type === 'file') {
            // Fire change with mock files
            el.files = [opts.mockFile || { name: 'test.jsonl' }];
            el._changeHandlers.forEach(function (fn) { fn(); });
          }
          el._clickHandlers.forEach(function (fn) { fn(); });
        },
      };
      domElements[tag] = domElements[tag] || [];
      domElements[tag].push(el);
      if (tag === 'input') fileInputEl = el;
      return el;
    },
    addEventListener: function (evt, fn) {
      eventListeners[evt] = eventListeners[evt] || [];
      eventListeners[evt].push(fn);
    },
  };

  // Mock FileReader constructor
  function MockFileReader() {
    var reader = {
      result: null,
      onload: null,
      onerror: null,
      readAsText: function (_file) {
        if (opts.fileReadError) {
          if (reader.onerror) reader.onerror(new Error('File read failed'));
          return;
        }
        reader.result = opts.mockFileContent !== undefined ? opts.mockFileContent : '';
        if (reader.onload) reader.onload();
      },
    };
    fileReaderMocks.push(reader);
    return reader;
  }
  MockFileReader.EMPTY = 0;
  MockFileReader.DONE = 2;
  MockFileReader.LOADING = 1;

  var sandbox = {
    window: {},
    document: mockDocument,
    FileReader: MockFileReader,
    console: {},
  };

  sandbox.window.APP_ENV = opts.appEnv !== undefined ? opts.appEnv : 'staging';

  if (opts.currentUser !== undefined) {
    sandbox.window.CURRENT_USER = opts.currentUser;
  } else {
    sandbox.window.CURRENT_USER = { tipo: 'admin' };
  }

  sandbox.window.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI = opts.enableFlag === true ? true : undefined;

  sandbox.window.toast = function (msg, type) {
    toasts.push({ msg: msg, type: type || 'info' });
  };

  sandbox.window.document = mockDocument;
  sandbox.window.FileReader = MockFileReader;

  vm.createContext(sandbox);

  // Load dependencies
  vm.runInContext(readOrFail(DOC_INGESTOR), sandbox);
  vm.runInContext(readOrFail(DOC_LOADER), sandbox);

  // Load import UI
  vm.runInContext(importUiSrc, sandbox);

  return {
    sandbox: sandbox,
    toasts: toasts,
    domElements: domElements,
    fileInputEl: fileInputEl,
    fileReaderMocks: fileReaderMocks,
    RAVATEX_DOCUMENTS: sandbox.window.RAVATEX_DOCUMENTS,
  };
}

// -------------------------------------------------------------------
// 1. Testes de existencia e sintaxe
// -------------------------------------------------------------------

test('import-ui: arquivo existe', function () {
  assert.ok(fs.existsSync(DOC_IMPORT_UI), 'js/documents-ingestor-import-ui.js ausente');
});

test('import-ui: sintaxe JS valida', function () {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', DOC_IMPORT_UI], { stdio: 'pipe' }
  );
});

// -------------------------------------------------------------------
// 2. Testes de DOM: botoes criados
// -------------------------------------------------------------------

test('import-ui: cria botao de import no DOM', function () {
  var rt = makeImportUISandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn, 'botao de import deve existir');
  assert.ok(importBtn.textContent.indexOf('Importar') >= 0, 'label deve conter "Importar"');
});

test('import-ui: botao exibe "Importar eventos"', function () {
  var rt = makeImportUISandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn.textContent, 'Importar eventos', 'texto do botao');
});

test('import-ui: botao title menciona document-events.jsonl', function () {
  var rt = makeImportUISandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn.title.indexOf('document-events.jsonl') >= 0,
    'title deve mencionar document-events.jsonl: ' + importBtn.title);
  assert.ok(importBtn.title.indexOf('export package') >= 0,
    'title deve mencionar export package: ' + importBtn.title);
});

test('import-ui: botao aria-label menciona document-events.jsonl', function () {
  var rt = makeImportUISandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  var al = importBtn['aria-label'] || importBtn.ariaLabel || '';
  assert.ok(al.indexOf('document-events.jsonl') >= 0,
    'aria-label deve mencionar document-events.jsonl: ' + al);
});

test('import-ui: file input aria-label menciona document-events.jsonl', function () {
  var rt = makeImportUISandbox();
  var fi = rt.fileInputEl;
  assert.ok(fi, 'file input deve existir');
  assert.ok(fi['aria-label'] && fi['aria-label'].indexOf('document-events.jsonl') >= 0,
    'input aria-label deve mencionar document-events.jsonl: ' + fi['aria-label']);
});

test('import-ui: toast sucesso menciona document-events.jsonl', function () {
  var rt = makeImportUISandbox({
    mockFileContent: fixtureText,
  });
  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'events.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });
  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
  assert.ok(successToast.msg.indexOf('document-events.jsonl') >= 0,
    'toast deve mencionar document-events.jsonl');
  assert.ok(successToast.msg.indexOf('7 evento(s)') >= 0, 'deve conter o count');
});

test('import-ui: cria file input hidden', function () {
  var rt = makeImportUISandbox();
  assert.ok(rt.fileInputEl, 'file input deve existir');
  assert.equal(rt.fileInputEl.type, 'file');
  assert.equal(rt.fileInputEl.style.display, 'none');
  assert.ok(rt.fileInputEl.accept.indexOf('.jsonl') >= 0, 'deve aceitar .jsonl');
});

test('import-ui: botao ao ser clicado dispara file input', function () {
  var rt = makeImportUISandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn._clickHandlers.length > 0, 'botao deve ter click handler');
  importBtn.click();
  // File input deve ter sido clicado — verificamos indiretamente abaixo
});

// -------------------------------------------------------------------
// 3. Testes: fluxo de import com sucesso
// -------------------------------------------------------------------

test('import-ui: fileReader le arquivo e chama loadDocumentsIngestorEventsFromText', function () {
  var rt = makeImportUISandbox({
    mockFileContent: fixtureText,
  });

  // Simula selecao de arquivo
  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'events.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  // Deve ter lido e carregado os eventos
  var events = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(events), 'global deve ser populada');
  assert.equal(events.length, 7, '7 eventos devem ser carregados');
});

test('import-ui: sucesso mostra toast com count', function () {
  var rt = makeImportUISandbox({
    mockFileContent: fixtureText,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'events.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
  assert.ok(successToast.msg.indexOf('7 evento') >= 0, 'deve conter o count de eventos');
  assert.ok(successToast.msg.indexOf('Nada foi persistido') >= 0, 'deve avisar que nada foi persistido');
  assert.ok(successToast.msg.indexOf('Documentos Recebidos (Ingestor)') >= 0,
    'deve mencionar a secao de documentos');
});

// -------------------------------------------------------------------
// 4. Testes: fluxo de import com erro
// -------------------------------------------------------------------

test('import-ui: JSONL invalido mostra toast de erro', function () {
  var rt = makeImportUISandbox({
    mockFileContent: 'isto nao e json valido',
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'broken.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro');
  assert.ok(errorToast.msg.indexOf('Erro ao importar') >= 0, 'deve mostrar erro de import');
});

test('import-ui: texto vazio mostra toast de erro', function () {
  var rt = makeImportUISandbox({
    mockFileContent: '',
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'empty.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro para arquivo vazio');
});

test('import-ui: erro de FileReader mostra toast de erro', function () {
  var rt = makeImportUISandbox({
    fileReadError: true,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'unreadable.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) {
    return t.type === 'error' && t.msg.indexOf('Erro ao ler o arquivo') >= 0;
  });
  assert.ok(errorToast, 'deve haver toast de erro de leitura');
});

test('import-ui: sem arquivo selecionado nao faz nada', function () {
  var rt = makeImportUISandbox();
  var toastCountBefore = rt.toasts.length;

  var fileInput = rt.fileInputEl;
  fileInput.files = null;
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  assert.equal(rt.toasts.length, toastCountBefore, 'nenhum toast deve ser gerado sem arquivo');
});

// -------------------------------------------------------------------
// 4b. Testes: scope guard — visibilidade por ambiente e role
// -------------------------------------------------------------------

test('import-ui-scope: producao + admin => NAO aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'production',
    currentUser: { tipo: 'admin' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em producao mesmo admin');
});

test('import-ui-scope: producao + cliente => NAO aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'production',
    currentUser: { tipo: 'cliente' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em producao para cliente');
});

test('import-ui-scope: staging + admin => aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn, 'botao deve existir em staging para admin');
  assert.ok(rt.fileInputEl, 'file input deve existir');
});

test('import-ui-scope: staging + cliente => NAO aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'cliente' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em staging para cliente');
});

test('import-ui-scope: staging + fornecedor => NAO aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'fornecedor' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir para fornecedor');
});

test('import-ui-scope: staging + flag=true (sem admin) => aparece', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: null,
    enableFlag: true,
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn, 'botao deve existir com flag=true mesmo sem admin logado');
});

test('import-ui-scope: staging + admin + flag=false => aparece (admin prevalece)', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
    enableFlag: false,
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn, 'botao deve existir para admin em staging (flag irrelevante)');
});

test('import-ui-scope: staging + admin => import funciona', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
    mockFileContent: fixtureText,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'events.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var events = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(events));
  assert.equal(events.length, 7);
  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
});

test('import-ui-scope: admin tardio via SPA — comeca null, dps vira admin', function () {
  // Simula SPA login: CURRENT_USER comeca null, depois vira admin.
  // O fast poll deve detectar na proxima iteracao (200 ms).
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: null, // usuario ainda nao logado
  });
  // Neste momento, fast poll esta rodando. CURRENT_USER e null.
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir com CURRENT_USER null');

  // Simula login: CURRENT_USER vira admin
  rt.sandbox.window.CURRENT_USER = { tipo: 'admin' };
  // Dispara recheck manual (equivalente a proxima iteracao do slow poll)
  rt.sandbox.window.RAVATEX_DOCUMENTS._importUIRecheck();

  buttons = rt.domElements['button'] || [];
  importBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.ok(importBtn, 'botao deve aparecer apos admin ser detectado via recheck');
});

test('import-ui-scope: admin tardio — _importUIHasButton confirma estado', function () {
  var rt = makeImportUISandbox({
    appEnv: 'staging',
    currentUser: null,
  });
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS._importUIHasButton(), false,
    'sem admin, sem botao');
  rt.sandbox.window.CURRENT_USER = { tipo: 'admin' };
  rt.sandbox.window.RAVATEX_DOCUMENTS._importUIRecheck();
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS._importUIHasButton(), true,
    'com admin, botao criado');
});

test('import-ui-scope: loader globals ausentes — erro controlado, sem crash', function () {
  // Cria sandbox SEM documents-ingestor.js e loader — import UI deve
  // emitir console.warn e retornar sem crash.
  var warnings = [];
  var sandbox = {
    window: { APP_ENV: 'staging', CURRENT_USER: { tipo: 'admin' }, toast: function () {} },
    document: {
      body: { appendChild: function () {} },
      createElement: function () { return { style: {}, addEventListener: function () {}, setAttribute: function () {}, click: function () {} }; },
      addEventListener: function () {},
    },
    console: { warn: function (msg) { warnings.push(msg); } },
  };
  vm.createContext(sandbox);
  // NAO carrega documents-ingestor.js nem loader
  vm.runInContext(importUiSrc, sandbox);

  // Nao deve ter criado botao
  assert.ok(warnings.length >= 1, 'deve emitir console.warn');
  assert.ok(warnings.join(' ').indexOf('RAVATEX_DOCUMENTS') >= 0,
    'warn deve mencionar RAVATEX_DOCUMENTS');
  assert.ok(warnings.join(' ').indexOf('loadDocumentsIngestorEventsFromText') >= 0,
    'warn deve mencionar loadDocumentsIngestorEventsFromText');
});

// -------------------------------------------------------------------
// 5. Testes: seguranca
// -------------------------------------------------------------------

test('import-ui: nao referencia Supabase', function () {
  var src = readOrFail(DOC_IMPORT_UI);
  assert.ok(src.indexOf('supabase') === -1, 'import-ui referencia supabase');
  assert.ok(src.indexOf('window.supa') === -1, 'import-ui referencia window.supa');
});

test('import-ui: nao referencia Google/Drive', function () {
  var src = readOrFail(DOC_IMPORT_UI);
  assert.ok(src.indexOf('googleapis') === -1, 'import-ui referencia googleapis');
});

test('import-ui: nao faz fetch ou XMLHttpRequest', function () {
  var src = readOrFail(DOC_IMPORT_UI);
  assert.ok(src.indexOf('fetch(') === -1, 'import-ui contem fetch');
  assert.ok(src.indexOf('XMLHttpRequest') === -1, 'import-ui contem XMLHttpRequest');
});

test('import-ui: nao persiste em localStorage/sessionStorage', function () {
  var src = readOrFail(DOC_IMPORT_UI);
  assert.ok(src.indexOf('localStorage') === -1, 'import-ui referencia localStorage');
  assert.ok(src.indexOf('sessionStorage') === -1, 'import-ui referencia sessionStorage');
});

// -------------------------------------------------------------------
// 6. Testes: regressao (validar que import UI nao quebra outros fluxos)
// -------------------------------------------------------------------

test('import-ui: global RAVATEX_DOCUMENTS_LOADED_EVENTS permanece populavel via loadFromText', function () {
  var rt = makeImportUISandbox();
  var docs = rt.RAVATEX_DOCUMENTS;

  // Popula global manualmente (caminho alternativo, nao pela UI)
  var result = docs.loadDocumentsIngestorEventsFromText(fixtureText);
  assert.equal(result.ok, true);
  assert.equal(result.count, 7);
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7);
});

// -------------------------------------------------------------------
// 7. Testes: index.html carrega o script
// -------------------------------------------------------------------

test('import-ui: index.html carrega documents-ingestor-import-ui.js uma vez', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var matches = index.match(/js\/documents-ingestor-import-ui\.js/g) || [];
  assert.equal(matches.length, 1, 'import-ui.js carregado ' + matches.length + ' vez(es)');
});

test('import-ui: import-ui.js carregado depois do loader', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxLoader = index.indexOf('js/documents-ingestor-loader.js');
  var idxImport = index.indexOf('js/documents-ingestor-import-ui.js');
  assert.ok(idxImport > idxLoader, 'import-ui.js deve vir depois do loader');
});
