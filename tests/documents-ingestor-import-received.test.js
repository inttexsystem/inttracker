// =====================================================================
// === tests/documents-ingestor-import-received.test.js =================
// Testes para a UX manual de import de `documentos-recebidos.jsonl`
// em js/documents-ingestor-import-received.js.
//
// Fase: RAVATEX-TAPETES-G12-G3-RECEIVED-DOCUMENTS-IMPORT-BUTTON
// Escopo: valida botao de import, file input, FileReader, integracao
//   com loadReceivedDocumentsFromText, separacao do estado legado
//   (RAVATEX_DOCUMENTS_LOADED_EVENTS), feedback toast e guarda
//   admin/staging.
//
// Garante:
//   - Botao e file input sao criados no DOM
//   - FileReader le arquivo e chama loadReceivedDocumentsFromText
//   - Popula window.RAVATEX_DOCUMENTS_RECEIVED
//   - NAO sobrescreve window.RAVATEX_DOCUMENTS_LOADED_EVENTS (legado)
//   - Coexiste com o botao legado "Importar eventos" sem conflito
//   - Toast de sucesso mostra count e referencia a tela Documentos
//   - Toast de erro para JSONL invalido
//   - Erro de FileReader tratado
//   - Botao nao aparece em producao
//   - Botao nao aparece para usuario nao-admin sem flag
//   - Botao aparece com flag explicita em staging
//   - Polling detecta admin tardio (slow poll)
//   - Loader ausente -> console.warn + sem crash
//   - Nao chama Supabase, Google/Drive, rede
//   - Sem persistencia (localStorage/sessionStorage)
//   - index.html carrega o script uma vez, apos o import legado
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
const DOC_IMPORT_LEGACY = path.join(ROOT, 'js', 'documents-ingestor-import-ui.js');
const DOC_IMPORT_RECEIVED = path.join(ROOT, 'js', 'documents-ingestor-import-received.js');
const FIXTURE = path.join(ROOT, 'data', 'fixtures', 'document-events-sample.jsonl');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const fixtureText = readOrFail(FIXTURE);
const importReceivedSrc = readOrFail(DOC_IMPORT_RECEIVED);
const importLegacySrc = readOrFail(DOC_IMPORT_LEGACY);

// JSONL flat (formato do Ingestor G12-D1 / G12-G1)
const RECEIVED_JSONL = [
  JSON.stringify({
    document_id: 'doc-rcv-1',
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
    filename_original: 'romaneio.pdf',
    tipo_documento: 'romaneio',
    formato: 'pdf',
    direcao_nf: null,
    created_at: '2026-07-08T10:10:00.000Z',
  }),
  JSON.stringify({
    document_id: 'doc-rcv-3',
    filename_original: 'NF-002.pdf',
    tipo_documento: 'nf',
    formato: 'pdf',
    direcao_nf: 'saida',
    created_at: '2026-07-08T10:20:00.000Z',
  }),
].join('\n');

// -------------------------------------------------------------------
// Sandbox helpers
// -------------------------------------------------------------------

function makeImportReceivedSandbox(opts) {
  opts = opts || {};

  var toasts = [];
  var domElements = {};
  var eventListeners = {};
  var fileInputEl = null;
  var fileReaderMocks = [];

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

  // Carrega dependências: ingestor + loader
  vm.runInContext(readOrFail(DOC_INGESTOR), sandbox);
  vm.runInContext(readOrFail(DOC_LOADER), sandbox);

  // Carrega o import legado também (coexistência)
  if (opts.includeLegacy !== false) {
    vm.runInContext(importLegacySrc, sandbox);
  }

  // Carrega o import received (sob teste)
  vm.runInContext(importReceivedSrc, sandbox);

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

test('import-received: arquivo existe', function () {
  assert.ok(fs.existsSync(DOC_IMPORT_RECEIVED),
    'js/documents-ingestor-import-received.js ausente');
});

test('import-received: sintaxe JS valida', function () {
  require('node:child_process').execFileSync(
    process.execPath, ['--check', DOC_IMPORT_RECEIVED], { stdio: 'pipe' }
  );
});

test('import-received: expoe funcoes de diagnostico no namespace', function () {
  var rt = makeImportReceivedSandbox();
  assert.equal(typeof rt.RAVATEX_DOCUMENTS._importReceivedUIRecheck, 'function',
    '_importReceivedUIRecheck ausente');
  assert.equal(typeof rt.RAVATEX_DOCUMENTS._importReceivedUIHasButton, 'function',
    '_importReceivedUIHasButton ausente');
});

// -------------------------------------------------------------------
// 2. Testes de DOM: botao criado
// -------------------------------------------------------------------

test('import-received: cria botao de import no DOM', function () {
  var rt = makeImportReceivedSandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'botao de import de recebidos deve existir');
  assert.equal(importBtn.textContent, 'Importar recebidos', 'label do botao');
});

test('import-received: botao title menciona documentos-recebidos.jsonl', function () {
  var rt = makeImportReceivedSandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn.title.indexOf('documentos-recebidos.jsonl') >= 0,
    'title deve mencionar documentos-recebidos.jsonl: ' + importBtn.title);
});

test('import-received: botao aria-label menciona documentos-recebidos.jsonl', function () {
  var rt = makeImportReceivedSandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  var al = importBtn['aria-label'] || importBtn.ariaLabel || '';
  assert.ok(al.indexOf('documentos-recebidos.jsonl') >= 0,
    'aria-label deve mencionar documentos-recebidos.jsonl: ' + al);
});

test('import-received: file input aria-label menciona documentos-recebidos.jsonl', function () {
  var rt = makeImportReceivedSandbox();
  var fi = rt.fileInputEl;
  assert.ok(fi, 'file input deve existir');
  assert.ok(fi['aria-label'] && fi['aria-label'].indexOf('documentos-recebidos.jsonl') >= 0,
    'input aria-label deve mencionar documentos-recebidos.jsonl: ' + fi['aria-label']);
});

test('import-received: cria file input hidden com accept .jsonl', function () {
  var rt = makeImportReceivedSandbox();
  assert.ok(rt.fileInputEl, 'file input deve existir');
  assert.equal(rt.fileInputEl.type, 'file');
  assert.equal(rt.fileInputEl.style.display, 'none');
  assert.ok(rt.fileInputEl.accept.indexOf('.jsonl') >= 0, 'deve aceitar .jsonl');
  assert.ok(rt.fileInputEl.id === 'rv-docs-received-import-input',
    'id do input deve ser rv-docs-received-import-input');
});

// -------------------------------------------------------------------
// 3. Testes: fluxo de import com sucesso
// -------------------------------------------------------------------

test('import-received: fileReader le arquivo e chama loadReceivedDocumentsFromText', function () {
  var rt = makeImportReceivedSandbox({
    mockFileContent: RECEIVED_JSONL,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var received = rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.ok(Array.isArray(received), 'RAVATEX_DOCUMENTS_RECEIVED deve ser populado');
  assert.equal(received.length, 3, '3 documentos devem ser carregados');
  assert.equal(received[0].document_id, 'doc-rcv-1');
  assert.equal(received[2].filename_original, 'NF-002.pdf');
});

test('import-received: NAO altera RAVATEX_DOCUMENTS_LOADED_EVENTS (estado legado)', function () {
  var rt = makeImportReceivedSandbox({
    mockFileContent: RECEIVED_JSONL,
  });

  // Semeia o estado legado (consumido pelo Pedido Detail)
  rt.sandbox.window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(fixtureText);
  var legacyBefore = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.equal(legacyBefore.length, 7, 'estado legado deve ter 7 eventos pre-populados');
  var sampleLegacy = legacyBefore[0];

  // Carrega recebidos pelo botao novo
  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  // Estado legado deve estar INTACTO
  var legacyAfter = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.ok(Array.isArray(legacyAfter), 'estado legado deve continuar array');
  assert.equal(legacyAfter.length, 7, 'estado legado NAO pode mudar de tamanho');
  assert.strictEqual(legacyAfter[0], sampleLegacy,
    'estado legado NAO pode ser sobrescrito pelo import de recebidos');
  assert.notStrictEqual(legacyAfter, rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED,
    'devem ser referencias distintas');

  // Estado novo populado
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3,
    'RAVATEX_DOCUMENTS_RECEIVED deve ter 3 docs');
});

test('import-received: toast sucesso menciona count e tela Documentos', function () {
  var rt = makeImportReceivedSandbox({
    mockFileContent: RECEIVED_JSONL,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
  assert.ok(successToast.msg.indexOf('3 documento') >= 0,
    'toast deve conter count: ' + successToast.msg);
  assert.ok(successToast.msg.indexOf('documentos-recebidos.jsonl') >= 0,
    'toast deve mencionar o arquivo: ' + successToast.msg);
  assert.ok(successToast.msg.indexOf('Documentos') >= 0,
    'toast deve mencionar a tela Documentos: ' + successToast.msg);
  assert.ok(successToast.msg.indexOf('Nada foi persistido') >= 0,
    'toast deve avisar que nada foi persistido');
});

// -------------------------------------------------------------------
// 4. Testes: fluxo de import com erro
// -------------------------------------------------------------------

test('import-received: JSONL invalido mostra toast de erro', function () {
  var rt = makeImportReceivedSandbox({
    mockFileContent: 'isto nao e json valido',
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'broken.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro');
  assert.ok(errorToast.msg.indexOf('Erro ao importar') >= 0,
    'toast deve mostrar "Erro ao importar": ' + errorToast.msg);
});

test('import-received: texto vazio mostra toast de erro', function () {
  var rt = makeImportReceivedSandbox({
    mockFileContent: '',
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'empty.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro para arquivo vazio');
});

test('import-received: erro de FileReader mostra toast de erro', function () {
  var rt = makeImportReceivedSandbox({
    fileReadError: true,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'unreadable.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) {
    return t.type === 'error' && t.msg.indexOf('Erro ao ler') >= 0;
  });
  assert.ok(errorToast, 'deve haver toast de erro de leitura');
});

test('import-received: sem arquivo selecionado nao faz nada', function () {
  var rt = makeImportReceivedSandbox();
  var toastCountBefore = rt.toasts.length;

  var fileInput = rt.fileInputEl;
  fileInput.files = null;
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  assert.equal(rt.toasts.length, toastCountBefore, 'nenhum toast deve ser gerado sem arquivo');
});

// -------------------------------------------------------------------
// 5. Testes: scope guard - visibilidade por ambiente e role
// -------------------------------------------------------------------

test('import-received-scope: producao + admin => NAO aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'production',
    currentUser: { tipo: 'admin' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em producao mesmo admin');
});

test('import-received-scope: producao + cliente => NAO aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'production',
    currentUser: { tipo: 'cliente' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em producao para cliente');
});

test('import-received-scope: staging + admin => aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'botao deve existir em staging para admin');
  assert.ok(rt.fileInputEl, 'file input deve existir');
});

test('import-received-scope: staging + cliente => NAO aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'cliente' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir em staging para cliente');
});

test('import-received-scope: staging + fornecedor => NAO aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'fornecedor' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir para fornecedor');
});

test('import-received-scope: staging + flag=true (sem admin) => aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: null,
    enableFlag: true,
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'botao deve existir com flag=true mesmo sem admin logado');
});

test('import-received-scope: local + admin => aparece', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'local',
    currentUser: { tipo: 'admin' },
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'botao deve existir em local para admin');
});

test('import-received-scope: staging + admin + import funciona', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
    mockFileContent: RECEIVED_JSONL,
  });

  var fileInput = rt.fileInputEl;
  fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var received = rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.ok(Array.isArray(received));
  assert.equal(received.length, 3);
  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
});

test('import-received-scope: admin tardio via SPA - comeca null, dps vira admin', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: null,
  });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'botao nao deve existir com CURRENT_USER null');

  // Simula login: CURRENT_USER vira admin
  rt.sandbox.window.CURRENT_USER = { tipo: 'admin' };
  // Dispara recheck manual (equivalente a proxima iteracao do slow poll)
  rt.sandbox.window.RAVATEX_DOCUMENTS._importReceivedUIRecheck();

  buttons = rt.domElements['button'] || [];
  importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'botao deve aparecer apos admin ser detectado via recheck');
});

test('import-received-scope: admin tardio - _importReceivedUIHasButton confirma estado', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: null,
  });
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS._importReceivedUIHasButton(), false,
    'sem admin, sem botao');
  rt.sandbox.window.CURRENT_USER = { tipo: 'admin' };
  rt.sandbox.window.RAVATEX_DOCUMENTS._importReceivedUIRecheck();
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS._importReceivedUIHasButton(), true,
    'com admin, botao criado');
});

test('import-received-scope: loader ausentes - erro controlado, sem crash', function () {
  var warnings = [];
  var sandbox = {
    window: { APP_ENV: 'staging', CURRENT_USER: { tipo: 'admin' }, toast: function () {} },
    document: {
      body: { appendChild: function () {} },
      createElement: function () {
        return {
          style: {}, addEventListener: function () {}, setAttribute: function () {},
          click: function () {},
        };
      },
      addEventListener: function () {},
    },
    console: { warn: function (msg) { warnings.push(msg); } },
  };
  vm.createContext(sandbox);
  // NAO carrega documents-ingestor.js nem loader
  vm.runInContext(importReceivedSrc, sandbox);

  assert.ok(warnings.length >= 1, 'deve emitir console.warn');
  assert.ok(warnings.join(' ').indexOf('RAVATEX_DOCUMENTS') >= 0,
    'warn deve mencionar RAVATEX_DOCUMENTS');
  assert.ok(warnings.join(' ').indexOf('loadReceivedDocumentsFromText') >= 0,
    'warn deve mencionar loadReceivedDocumentsFromText');
});

// -------------------------------------------------------------------
// 6. Testes: coexistência com o botao legado "Importar eventos"
// -------------------------------------------------------------------

test('import-received-coexistence: botao legado e novo funcionam independentemente', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
  });

  var buttons = rt.domElements['button'] || [];
  var legacyBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  var receivedBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(legacyBtn, 'botao legado deve existir');
  assert.ok(receivedBtn, 'botao de recebidos deve existir');
  assert.notStrictEqual(legacyBtn, receivedBtn, 'botoes devem ser distintos');
  assert.equal(legacyBtn.textContent, 'Importar eventos');
  assert.equal(receivedBtn.textContent, 'Importar recebidos');
});

test('import-received-coexistence: arquivos sao independentes (sem cross-talk)', function () {
  var rt = makeImportReceivedSandbox({
    appEnv: 'staging',
    currentUser: { tipo: 'admin' },
  });

  var inputs = rt.domElements['input'] || [];
  var legacyInput = inputs.find(function (i) { return i.id === 'rv-docs-import-input'; });
  var receivedInput = inputs.find(function (i) { return i.id === 'rv-docs-received-import-input'; });
  assert.ok(legacyInput, 'input legado deve existir');
  assert.ok(receivedInput, 'input de recebidos deve existir');
  assert.notStrictEqual(legacyInput, receivedInput, 'inputs devem ser distintos');

  // Importar via legado -> atualiza LOADED_EVENTS, NAO toca RECEIVED
  rt.sandbox.window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(fixtureText);
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7);
  assert.ok(!rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED
    || rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length === 0,
    'RECEIVED NAO deve ser afetado pelo import legado');

  // Limpar RECEIVED e importar via novo -> atualiza RECEIVED, NAO toca LOADED_EVENTS
  rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED = [];
  rt.sandbox.window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText(RECEIVED_JSONL);
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3);
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS.length, 7,
    'LOADED_EVENTS NAO deve ser afetado pelo import de recebidos');
});

// -------------------------------------------------------------------
// 7. Testes de seguranca
// -------------------------------------------------------------------

test('import-received: NAO referencia Supabase', function () {
  var src = readOrFail(DOC_IMPORT_RECEIVED);
  assert.ok(src.indexOf('supabase') === -1, 'import-received referencia supabase');
  assert.ok(src.indexOf('window.supa') === -1, 'import-received referencia window.supa');
});

test('import-received: NAO referencia Google/Drive', function () {
  var src = readOrFail(DOC_IMPORT_RECEIVED);
  assert.ok(src.indexOf('googleapis') === -1, 'import-received referencia googleapis');
});

test('import-received: NAO faz fetch ou XMLHttpRequest', function () {
  var src = readOrFail(DOC_IMPORT_RECEIVED);
  assert.ok(src.indexOf('fetch(') === -1, 'import-received contem fetch');
  assert.ok(src.indexOf('XMLHttpRequest') === -1, 'import-received contem XMLHttpRequest');
});

test('import-received: NAO persiste em localStorage/sessionStorage', function () {
  var src = readOrFail(DOC_IMPORT_RECEIVED);
  assert.ok(src.indexOf('localStorage') === -1, 'import-received referencia localStorage');
  assert.ok(src.indexOf('sessionStorage') === -1, 'import-received referencia sessionStorage');
});

// -------------------------------------------------------------------
// 8. Testes: index.html carrega o script
// -------------------------------------------------------------------

test('import-received: index.html carrega documents-ingestor-import-received.js uma vez', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var matches = index.match(/js\/documents-ingestor-import-received\.js/g) || [];
  assert.equal(matches.length, 1, 'import-received.js carregado ' + matches.length + ' vez(es)');
});

test('import-received: import-received.js carregado depois do loader', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxLoader = index.indexOf('js/documents-ingestor-loader.js');
  var idxReceived = index.indexOf('js/documents-ingestor-import-received.js');
  assert.ok(idxReceived > idxLoader, 'import-received.js deve vir depois do loader');
});

test('import-received: import-received.js carregado depois do import legado', function () {
  var index = readOrFail(path.join(ROOT, 'index.html'));
  var idxLegacy = index.indexOf('js/documents-ingestor-import-ui.js');
  var idxReceived = index.indexOf('js/documents-ingestor-import-received.js');
  assert.ok(idxReceived > idxLegacy, 'import-received.js deve vir depois do import legado');
});
