// =====================================================================
// === tests/documents-ingestor-import-received.test.js =================
// Testes para a UX de import do arquivo JSONL flat exportado pelo
// Documents Ingestor em js/documents-ingestor-import-received.js.
// Aceita tanto `documentos-recebidos.jsonl` (G12-D1, antigo) quanto
// `documentos-mapeados.jsonl` (G12-F1, com campos extras).
//
// Fase: RAVATEX-TAPETES-G12-G3-RECEIVED-DOCUMENTS-IMPORT-BUTTON
//       + G12-R1 (refactor: botao inline na tela, sem auto-floating)
//       + G12-F2-MAPPED-DOCUMENTS-CONSUMER-PATCH (copy generica,
//         sem induzir usuario a usar apenas o arquivo antigo)
//
// Garante:
//   - Botao NAO aparece flutuando por padrao (G12-R1)
//   - API createReceivedImportButton() retorna { button, fileInput, mount }
//   - Botao pode ser montado inline em qualquer container
//   - FileReader le arquivo e chama loadReceivedDocumentsFromText
//   - Popula window.RAVATEX_DOCUMENTS_RECEIVED
//   - NAO sobrescreve window.RAVATEX_DOCUMENTS_LOADED_EVENTS (legado)
//   - Coexiste com o botao legado "Importar eventos" sem conflito
//   - Toast de sucesso mostra count (sem citar arquivo especifico)
//   - Toast de erro para JSONL invalido (copy generica do Ingestor)
//   - Erro de FileReader tratado
//   - Guarda admin/staging mantida
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
const DOC_SCREEN = path.join(ROOT, 'js', 'screens', 'documentos-recebidos.js');
const UI = path.join(ROOT, 'js', 'ui.js');
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
    body: {
      appendChild: function (el) { /* ok - no-op */ },
      children: [],
    },
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
  sandbox.window.RAVATEX_ENABLE_DOCUMENTS_EVENTS_IMPORT_UI = opts.enableEventsFlag === true ? true : undefined;
  sandbox.window.RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT = opts.floatingFlag === true ? true : undefined;

  sandbox.window.toast = function (msg, type) {
    toasts.push({ msg: msg, type: type || 'info' });
  };

  sandbox.window.document = mockDocument;
  sandbox.window.FileReader = MockFileReader;

  if (opts.localStorage) {
    sandbox.localStorage = opts.localStorage;
  }

  vm.createContext(sandbox);

  // Carrega UI primeiro (para que window.el esteja disponivel)
  vm.runInContext(readOrFail(UI), sandbox);
  // Carrega dependencias: ingestor + loader
  vm.runInContext(readOrFail(DOC_INGESTOR), sandbox);
  vm.runInContext(readOrFail(DOC_LOADER), sandbox);

  // Carrega o import legado tambem (coexistência)
  if (opts.includeLegacy !== false) {
    vm.runInContext(importLegacySrc, sandbox);
  }

  // Carrega o import received (sob teste) - G12-R1: NAO auto-cria
  // botao flutuante por padrao
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

// Helper: cria container para montar botao inline (fake).
function makeContainer() {
  return {
    tagName: 'DIV',
    children: [],
    appendChild: function (el) { if (el != null) this.children.push(el); return el; },
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

test('import-received: expoe API createReceivedImportButton', function () {
  var rt = makeImportReceivedSandbox();
  assert.equal(typeof rt.RAVATEX_DOCUMENTS.createReceivedImportButton, 'function',
    'createReceivedImportButton ausente');
});

// -------------------------------------------------------------------
// 2. G12-R1: botao NAO aparece flutuando por padrao
// -------------------------------------------------------------------

test('import-received (G12-R1): NAO cria botao flutuante por padrao', function () {
  var rt = makeImportReceivedSandbox();
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined,
    'botao flutuante NAO deve existir por padrao (G12-R1)');
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS._importReceivedUIHasButton(), false,
    '_importReceivedUIHasButton deve retornar false sem auto-bootstrap');
});

test('import-received (G12-R1): NAO cria botao flutuante em producao', function () {
  var rt = makeImportReceivedSandbox({ appEnv: 'production', currentUser: { tipo: 'admin' } });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'em producao, sem botao');
});

test('import-received (G12-R1): NAO cria botao flutuante para nao-admin sem flag', function () {
  var rt = makeImportReceivedSandbox({ currentUser: { tipo: 'cliente' } });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.equal(importBtn, undefined, 'sem flag, sem botao flutuante');
});

test('import-received (G12-F2): flag RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT restaura flutuante', function () {
  var rt = makeImportReceivedSandbox({ floatingFlag: true });
  var buttons = rt.domElements['button'] || [];
  var importBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn'; });
  assert.ok(importBtn, 'com flag explicita, botao flutuante opcional aparece');
  assert.equal(importBtn.textContent, 'Importar', 'label do botao compacto');
});

// -------------------------------------------------------------------
// 3. G12-R1: API createReceivedImportButton para uso inline
// -------------------------------------------------------------------

test('import-received (G12-R1): createReceivedImportButton retorna button+fileInput+mount', function () {
  var rt = makeImportReceivedSandbox();
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-inline-test' });
  assert.ok(pair, 'par deve existir');
  assert.ok(pair.button, 'button deve existir');
  assert.ok(pair.fileInput, 'fileInput deve existir');
  assert.equal(typeof pair.mount, 'function', 'mount deve ser funcao');
  assert.equal(typeof pair.mountBody, 'function', 'mountBody deve ser funcao');
  assert.equal(pair.button.id, 'btn-inline-test', 'id customizada respeitada');
  assert.equal(pair.button.textContent, 'Importar', 'label padrao compacto');
  assert.equal(pair.fileInput.type, 'file', 'file input type=file');
  assert.ok(pair.fileInput.accept.indexOf('.jsonl') >= 0, 'accept inclui .jsonl');
  assert.equal(pair.fileInput.style.display, 'none', 'file input escondido');
});

test('import-received (G12-F2): botao inline usa copy generica (Documents Ingestor)', function () {
  var rt = makeImportReceivedSandbox();
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton();
  // G12-F2: copy NAO induz o usuario a usar apenas o formato antigo
  assert.equal(pair.button.title.indexOf('documentos-recebidos.jsonl'), -1,
    'title NAO menciona apenas o arquivo antigo: ' + pair.button.title);
  var al = pair.button['aria-label'] || pair.button.ariaLabel || '';
  assert.equal(al.indexOf('documentos-recebidos.jsonl'), -1,
    'aria-label NAO menciona apenas o arquivo antigo: ' + al);
  var fil = pair.fileInput['aria-label'] || pair.fileInput.ariaLabel || '';
  assert.equal(fil.indexOf('documentos-recebidos.jsonl'), -1,
    'input aria-label NAO menciona apenas o arquivo antigo: ' + fil);
  // Copy generica esperada
  assert.ok(pair.button.title.indexOf('JSONL') >= 0
    && pair.button.title.indexOf('Documents Ingestor') >= 0,
    'title usa copy generica do Ingestor: ' + pair.button.title);
  assert.ok(fil.indexOf('JSONL') >= 0
    && fil.indexOf('Documents Ingestor') >= 0,
    'input aria-label usa copy generica do Ingestor: ' + fil);
});

test('import-received (G12-R1): mount() anexa button+input ao container', function () {
  var rt = makeImportReceivedSandbox();
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-mount-test' });
  var container = makeContainer();
  pair.mount(container);
  assert.equal(container.children.length, 2, 'container tem 2 children (input + button)');
  assert.equal(container.children[0].type, 'file', 'primeiro filho e file input');
  assert.equal(container.children[1].id, 'btn-mount-test', 'segundo filho e button');
});

test('import-received (G12-R1): botao inline funciona -> popula RECEIVED via FileReader', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-flow' });
  var container = makeContainer();
  pair.mount(container);

  // Simula FileReader
  pair.fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var received = rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED;
  assert.ok(Array.isArray(received), 'RAVATEX_DOCUMENTS_RECEIVED populado');
  assert.equal(received.length, 3, '3 documentos carregados');
  assert.equal(received[0].document_id, 'doc-rcv-1');
});

test('import-received (G12-R1): NAO altera RAVATEX_DOCUMENTS_LOADED_EVENTS (legado)', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  rt.sandbox.window.RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(fixtureText);
  var legacyBefore = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.equal(legacyBefore.length, 7, 'estado legado pre-populado');

  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-flow' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var legacyAfter = rt.sandbox.window.RAVATEX_DOCUMENTS_LOADED_EVENTS;
  assert.equal(legacyAfter.length, 7, 'legado NAO alterado pelo novo import');
  assert.strictEqual(legacyAfter[0], legacyBefore[0], 'evento legado preservado');
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3, 'novo estado populado');
});

test('import-received (G12-F2): toast sucesso mostra count e "Nada foi persistido" (sem nome de arquivo)', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-toast' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'documentos-recebidos.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var successToast = rt.toasts.find(function (t) { return t.type === 'success'; });
  assert.ok(successToast, 'deve haver toast de sucesso');
  assert.ok(successToast.msg.indexOf('3 documento') >= 0, 'count no toast');
  // G12-F2: toast NAO cita um arquivo especifico
  assert.equal(successToast.msg.indexOf('documentos-recebidos.jsonl'), -1,
    'toast de sucesso NAO cita o arquivo antigo especifico: ' + successToast.msg);
  assert.equal(successToast.msg.indexOf('documentos-mapeados.jsonl'), -1,
    'toast de sucesso NAO cita o arquivo novo especifico: ' + successToast.msg);
  assert.ok(successToast.msg.indexOf('Nada foi persistido') >= 0, 'aviso de persistencia no toast');
});

test('import-received (G12-F2): JSONL invalido mostra toast de erro com copy do Ingestor', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: 'isto nao e json' });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-err' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'broken.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro');
  // G12-F2: copy agora menciona "Arquivo incompativel" + "Documents Ingestor"
  // sem induzir o usuario a usar apenas o arquivo antigo
  assert.ok(errorToast.msg.indexOf('Arquivo incompativel') >= 0,
    'mensagem inicia com "Arquivo incompativel": ' + errorToast.msg);
  assert.ok(errorToast.msg.indexOf('Documents Ingestor') >= 0,
    'mensagem menciona Documents Ingestor: ' + errorToast.msg);
  assert.equal(errorToast.msg.indexOf('documentos-recebidos.jsonl'), -1,
    'mensagem NAO cita apenas o arquivo antigo: ' + errorToast.msg);
  assert.ok(errorToast.msg.indexOf('Motivo:') >= 0,
    'detalha o motivo do erro');
});

test('import-received (G12-R1): texto vazio mostra toast de erro', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: '' });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-empty' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'empty.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro para arquivo vazio');
});

test('import-received (G12-R1): erro de FileReader mostra toast de erro', function () {
  var rt = makeImportReceivedSandbox({ fileReadError: true });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-freaderr' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'unreadable.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) {
    return t.type === 'error' && t.msg.indexOf('Erro ao ler') >= 0;
  });
  assert.ok(errorToast, 'deve haver toast de erro de leitura');
});

test('import-received (G12-R1): sem arquivo selecionado nao faz nada', function () {
  var rt = makeImportReceivedSandbox();
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-noop' });
  var container = makeContainer();
  pair.mount(container);
  var toastCountBefore = rt.toasts.length;
  pair.fileInput.files = null;
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });
  assert.equal(rt.toasts.length, toastCountBefore, 'nenhum toast sem arquivo');
});

// -------------------------------------------------------------------
// 4. Coexistência com o botao legado
// -------------------------------------------------------------------

test('import-received (G12-F4): botao legado azul NAO aparece por padrao', function () {
  var rt = makeImportReceivedSandbox();
  var buttons = rt.domElements['button'] || [];
  var legacyBtn = buttons.find(function (b) { return b.id === 'rv-docs-import-btn'; });
  assert.equal(legacyBtn, undefined, 'botao legado nao deve aparecer sem flag de eventos');

  // Novo e inline: precisa ser criado explicitamente
  var inlineBtn = buttons.find(function (b) { return b.id === 'rv-docs-received-import-btn' });
  assert.equal(inlineBtn, undefined, 'botao novo NAO esta no DOM (apenas inline)');

  // Mas a API existe
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'inline-test' });
  var container = makeContainer();
  pair.mount(container);
  assert.equal(container.children.length, 2, 'botao novo + input anexados ao container');
});

test('import-received (G12-F4): botao inline nao conflita com legado quando flag de eventos esta ativa', function () {
  var rt = makeImportReceivedSandbox({ enableEventsFlag: true });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'inline-distinct' });
  var container = makeContainer();
  pair.mount(container);

  var allBtns = [];
  function walk(n) {
    if (n.tagName === 'BUTTON' && n.id) allBtns.push(n.id);
    if (n.children) for (var i = 0; i < n.children.length; i++) walk(n.children[i]);
  }
  // Walk em todos os elementos criados
  for (var tag in rt.domElements) {
    for (var i = 0; i < rt.domElements[tag].length; i++) walk(rt.domElements[tag][i]);
  }
  // Deve ter 2 IDs distintos
  assert.ok(allBtns.indexOf('rv-docs-import-btn') >= 0, 'id legado presente');
  assert.ok(allBtns.indexOf('inline-distinct') >= 0, 'id inline presente');
  assert.notStrictEqual(
    allBtns.indexOf('rv-docs-import-btn'),
    allBtns.indexOf('inline-distinct'),
    'IDs sao distintos'
  );
});

// -------------------------------------------------------------------
// 5. Loader ausente
// -------------------------------------------------------------------

test('import-received (G12-R1): loader ausentes - erro controlado, sem crash', function () {
  var warnings = [];
  var sandbox2 = {
    window: { APP_ENV: 'staging', CURRENT_USER: { tipo: 'admin' }, toast: function () {} },
    document: {
      body: { appendChild: function () {} },
      createElement: function () {
        return { style: {}, addEventListener: function () {}, setAttribute: function () {}, click: function () {} };
      },
      addEventListener: function () {},
    },
    console: { warn: function (msg) { warnings.push(msg); } },
  };
  vm.createContext(sandbox2);
  vm.runInContext(importReceivedSrc, sandbox2);

  assert.ok(warnings.length >= 1, 'deve emitir console.warn');
  assert.ok(warnings.join(' ').indexOf('RAVATEX_DOCUMENTS') >= 0,
    'warn deve mencionar RAVATEX_DOCUMENTS');
});

// -------------------------------------------------------------------
// 6. Seguranca
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

// -------------------------------------------------------------------
// 6. G16-B: metadata do ultimo import em localStorage
// -------------------------------------------------------------------

test('import-received (G16-B): salva metadata em localStorage apos import bem-sucedido', function () {
  var store = {};
  var ls = {
    getItem: function (key) { return key in store ? store[key] : null; },
    setItem: function (key, val) { store[key] = val; },
  };
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL, localStorage: ls });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-meta-test' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'mapeados.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var raw = store['RAVATEX_DOCUMENTS_RECEIVED_METADATA'];
  assert.ok(raw, 'metadata deve ser salva em localStorage');
  var meta = JSON.parse(raw);
  assert.equal(typeof meta.importedAt, 'string', 'importedAt presente');
  assert.ok(meta.importedAt.length > 0, 'importedAt nao vazio');
  assert.equal(meta.fileName, 'mapeados.jsonl', 'fileName e o nome do arquivo');
  assert.equal(meta.count, 3, 'count igual a 3');
  assert.equal(typeof meta.hash, 'string', 'hash presente');
  assert.ok(meta.hash.length > 0, 'hash nao vazio');
  assert.ok(meta.statusCounts && typeof meta.statusCounts === 'object', 'statusCounts e objeto');
});

test('import-received (G16-B): window.RAVATEX_DOCUMENTS_RECEIVED_METADATA exposto', function () {
  var store = {};
  var ls = {
    getItem: function (key) { return key in store ? store[key] : null; },
    setItem: function (key, val) { store[key] = val; },
  };
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL, localStorage: ls });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-window-test' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'test.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  assert.ok(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA, 'metadata no window global');
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA.fileName, 'test.jsonl');
});

test('import-received (G16-B): hash muda quando conteudo muda', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-hash1' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'docs.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var meta1 = rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
  assert.ok(meta1, 'metadata salva');
  var hash1 = meta1.hash;

  // Reimporta com conteudo diferente
  var altContent = JSON.stringify({
    document_id: 'alt-1',
    filename_original: 'alt.xml',
    tipo_documento: 'nf',
    formato: 'xml',
  });
  var rt2 = makeImportReceivedSandbox({ mockFileContent: altContent });
  var pair2 = rt2.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-hash2' });
  var container2 = makeContainer();
  pair2.mount(container2);
  pair2.fileInput.files = [{ name: 'alt.jsonl' }];
  pair2.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var meta2 = rt2.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
  assert.ok(meta2, 'metadata salva');
  assert.notStrictEqual(meta2.hash, hash1, 'hash muda com conteudo diferente');
});

test('import-received (G16-B): metadata tem statusCounts corretas', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-status' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'status-test.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var meta = rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
  assert.ok(meta, 'metadata existe');
  assert.equal(meta.count, 3, '3 documentos');
  assert.equal(typeof meta.statusCounts.pending, 'number', 'pending count existe');
  assert.equal(typeof meta.statusCounts.assigned, 'number', 'assigned count existe');
  assert.equal(typeof meta.statusCounts.accepted, 'number', 'accepted count existe');
  assert.equal(typeof meta.statusCounts.rejected, 'number', 'rejected count existe');
  // RECEIVED_JSONL nao tem status, entao tudo pending
  assert.equal(meta.statusCounts.pending, 3, '3 pending (sem status nos fixtures)');
  assert.equal(meta.statusCounts.assigned, 0, '0 assigned');
  assert.equal(meta.statusCounts.accepted, 0, '0 accepted');
  assert.equal(meta.statusCounts.rejected, 0, '0 rejected');
});

test('import-received (G16-B): import invalido NAO sobrescreve metadata anterior', function () {
  var store = {};
  var ls = {
    getItem: function (key) { return key in store ? store[key] : null; },
    setItem: function (key, val) { store[key] = val; },
  };

  // Primeiro import: bem-sucedido
  var rt1 = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL, localStorage: ls });
  var pair1 = rt1.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-ok' });
  var container1 = makeContainer();
  pair1.mount(container1);
  pair1.fileInput.files = [{ name: 'ok.jsonl' }];
  pair1.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var metaBefore = JSON.parse(store['RAVATEX_DOCUMENTS_RECEIVED_METADATA']);
  assert.ok(metaBefore, 'metadata do primeiro import');
  assert.equal(metaBefore.fileName, 'ok.jsonl');

  // Segundo import: falha (content vazio -> loadReceivedDocumentsFromText retorna erro)
  var rt2 = makeImportReceivedSandbox({ mockFileContent: '', localStorage: ls });
  var pair2 = rt2.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-bad' });
  var container2 = makeContainer();
  pair2.mount(container2);
  pair2.fileInput.files = [{ name: 'invalid.jsonl' }];
  pair2.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var metaAfter = JSON.parse(store['RAVATEX_DOCUMENTS_RECEIVED_METADATA']);
  assert.ok(metaAfter, 'metadata ainda existe');
  assert.equal(metaAfter.fileName, 'ok.jsonl', 'fileName preservado apos erro');
});

test('import-received (G16-B): localStorage indisponivel nao quebra import', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: RECEIVED_JSONL });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'g16b-nols' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'test.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  // Ao menos window global foi populada
  assert.ok(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED_METADATA, 'metadata no window');
  assert.equal(rt.sandbox.window.RAVATEX_DOCUMENTS_RECEIVED.length, 3, 'docs carregados mesmo sem localStorage');
});

// -------------------------------------------------------------------
// 7. index.html
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

test('import-received: index.html NAO referencia documentos-recebidos.js (nao ha auto-floating)', function () {
  // G12-R1: o botao so aparece dentro da tela. O script da tela
  // (documentos-recebidos.js) e o unico lugar onde createReceivedImportButton
  // e chamado. Esta assercao documenta o novo padrao.
  var index = readOrFail(path.join(ROOT, 'index.html'));
  // O modulo de import nao depende da tela
  var importReceivedIdx = index.indexOf('js/documents-ingestor-import-received.js');
  var screenIdx = index.indexOf('js/screens/documentos-recebidos.js');
  assert.ok(importReceivedIdx > 0, 'import-received.js presente no index');
  assert.ok(screenIdx > 0, 'documentos-recebidos.js presente no index');
  // E ambos carregam antes do boot.js
  var bootIdx = index.indexOf('js/boot.js');
  assert.ok(importReceivedIdx < bootIdx, 'import-received.js antes do boot.js');
  assert.ok(screenIdx < bootIdx, 'documentos-recebidos.js antes do boot.js');
});

// -------------------------------------------------------------------
// 8. G12-R3: mensagem de erro de arquivo incompativel mais clara
// -------------------------------------------------------------------

test('import-received (G12-F2): JSONL do Ingestor (formato de eventos) e rejeitado como incompativel', function () {
  // Carrega um JSONL no formato errado (eventos de Pedido, nao flat docs)
  // e espera mensagem clara apontando o motivo.
  var wrongFormat = fixtureText; // document-events-sample.jsonl (formato wrapper {event_type,...})
  var rt = makeImportReceivedSandbox({ mockFileContent: wrongFormat });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-wrong' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'document-events.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro');
  // G12-F2: copy agora e generica, nao cita um arquivo especifico
  assert.ok(errorToast.msg.indexOf('Arquivo incompativel') >= 0,
    'mensagem sinaliza formato incompativel');
  assert.ok(errorToast.msg.indexOf('Motivo:') >= 0, 'detalha o motivo');
});

test('import-received (G12-F2): toast de erro NAO usa copy generica antiga "Erro ao importar"', function () {
  var rt = makeImportReceivedSandbox({ mockFileContent: 'isto nao e json' });
  var pair = rt.RAVATEX_DOCUMENTS.createReceivedImportButton({ buttonId: 'btn-old-msg' });
  var container = makeContainer();
  pair.mount(container);
  pair.fileInput.files = [{ name: 'broken.jsonl' }];
  pair.fileInput._changeHandlers.forEach(function (fn) { fn(); });

  var errorToast = rt.toasts.find(function (t) { return t.type === 'error'; });
  assert.ok(errorToast, 'deve haver toast de erro');
  // G12-R3: copy antiga foi removida
  assert.equal(errorToast.msg.indexOf('Erro ao importar:'), -1,
    'copy antiga "Erro ao importar:" removida (G12-R3)');
  // G12-F2: copy nova NAO induz usuario a usar um arquivo especifico
  assert.equal(errorToast.msg.indexOf('documentos-recebidos.jsonl'), -1,
    'copy nova NAO cita apenas o arquivo antigo: ' + errorToast.msg);
});
