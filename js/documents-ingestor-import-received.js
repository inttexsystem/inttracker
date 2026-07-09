// =====================================================================
// === js/documents-ingestor-import-received.js =========================
// UX para importar o arquivo JSONL flat exportado pelo Documents
// Ingestor. Aceita tanto `documentos-recebidos.jsonl` (formato
// G12-D1) quanto `documentos-mapeados.jsonl` (formato G12-F1 com
// campos extras: schema_version, status, pedido_manual, received_at,
// detected_at, linked_at, accepted_at, rejected_at, rejected_reason).
// Cria um botao (inline na tela, NAO flutuante) que abre dialogo de
// arquivo, le via FileReader e chama `loadReceivedDocumentsFromText`
// do loader dedicado (G12-G1).
//
// Estado populado: window.RAVATEX_DOCUMENTS_RECEIVED.
// NAO toca window.RAVATEX_DOCUMENTS_LOADED_EVENTS (estado legado
// consumido pelo Pedido Detail).
//
// Fase: RAVATEX-TAPETES-G12-G3-RECEIVED-DOCUMENTS-IMPORT-BUTTON
//       + G12-R1 (refactor: botao inline na tela, sem flutuante)
//       + G16-B (metadata do ultimo import em localStorage)
// Escopo: UX manual, local, read-only. Sem rede, sem Supabase, sem
//   Google/Drive, sem persistencia do array de documentos. Apenas
//   metadata do último import é persistida em localStorage.
//   Sem watcher, sem auto-load.
//
// Restricao de superficie (mesma politica do import legado):
//   - Nunca visivel em producao (APP_ENV === 'production').
//   - Em staging/dev/local, visivel apenas quando:
//     * usuario e admin (CURRENT_USER.tipo === 'admin'), OU
//     * flag RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true.
//   - CURRENT_USER pode ser populado assincronamente; um poll curto
//     aguarda ate ~10s apos o carregamento da pagina.
//
// Comportamento desde G12-R1:
//   - Botao NAO aparece flutuando o tempo todo.
//   - Botao aparece APENAS dentro da tela #/documentos/recebidos,
//     montado pelo screenDocumentosRecebidos.
//   - Auto-flutuante opcional via flag
//     RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT === true
//     (padrao: false). Mantido para diagnostico, mas nao e o padrao.
//
// Separacao do import legado:
//   - Botao legado (Importar eventos) -> document-events.jsonl
//     -> RAVATEX_DOCUMENTS_LOADED_EVENTS (Pedido Detail).
//   - Este botao -> documentos-recebidos.jsonl OU documentos-mapeados.jsonl
//     -> RAVATEX_DOCUMENTS_RECEIVED (tela global G12-G2 + G12-F2).
//   - Os dois coexistem; cada um escreve em seu proprio estado.
//
// Compatibilidade dual (G12-F2):
//   - documentos-recebidos.jsonl: formato antigo (G12-D1), sem status/pedido_manual.
//   - documentos-mapeados.jsonl:  formato novo (G12-F1), com schema_version,
//     status, pedido_manual, received_at, detected_at, linked_at, accepted_at,
//     rejected_at, rejected_reason.
//   - O parser/validador do loader preserva todos os campos extras;
//     a tela faz fallback received_at||created_at e status||'pending'.
//
// Persistencia de metadata (G16-B):
//   - Apos import bem-sucedido, salva em localStorage a chave
//     RAVATEX_DOCUMENTS_RECEIVED_METADATA com: importedAt, fileName,
//     count, hash (DJB2 sobre o texto), statusCounts.
//   - O array RAVATEX_DOCUMENTS_RECEIVED continua volatil (em memoria).
//   - Erro de import NAO sobrescreve metadata anterior.
//   - localStorage corrompido ou indisponivel e ignorado silenciosamente.
//
// API exposta:
//   RAVATEX_DOCUMENTS.createReceivedImportButton(opts) ->
//     { button, fileInput }   (cria elementos; chama .mount(container)
//                              para anexar a um container especifico,
//                              ou .mountBody() para o body).
//
// Depende de:
//   - js/documents-ingestor-loader.js
//     (window.RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText)
//   - js/ui.js (window.toast)
//
// Carregar via <script src="js/documents-ingestor-import-received.js">
// DEPOIS de documents-ingestor-loader.js.
// =====================================================================

(function (window) {
  'use strict';

  var docs = window.RAVATEX_DOCUMENTS;
  if (!docs || typeof docs.loadReceivedDocumentsFromText !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Documents Ingestor Import Received] '
        + 'RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText ausente. '
        + 'Verifique se js/documents-ingestor.js e js/documents-ingestor-loader.js '
        + 'foram carregados antes deste script.');
    }
    return;
  }

  var _floatingButton = null;
  var _fastPollTimer = null;
  var _slowPollTimer = null;
  var _fastPollAttempts = 0;
  var FAST_POLL_MAX = 50;
  var SLOW_POLL_INTERVAL = 10000;

  var METADATA_KEY = 'RAVATEX_DOCUMENTS_RECEIVED_METADATA';

  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  function normalizeStatusForCount(status) {
    var raw = String(status || '').toLowerCase();
    if (raw === 'accepted' || raw === 'aceito') return 'accepted';
    if (raw === 'assigned' || raw === 'atrelado' || raw === 'vinculado') return 'assigned';
    if (raw === 'rejected' || raw === 'rejeitado') return 'rejected';
    if (raw === 'pending' || raw === 'pendente' || raw === 'pending_app_acceptance' || !raw) return 'pending';
    return 'unknown';
  }

  function computeStatusCounts(received) {
    var counts = { accepted: 0, assigned: 0, pending: 0, rejected: 0, unknown: 0 };
    if (!Array.isArray(received)) return counts;
    for (var i = 0; i < received.length; i++) {
      var s = normalizeStatusForCount(received[i] && received[i].status);
      if (counts[s] != null) counts[s]++;
    }
    return counts;
  }

  function saveReceivedMetadata(opts) {
    var meta = {
      importedAt: new Date().toISOString(),
      fileName: opts.fileName || '',
      count: opts.count || 0,
      hash: opts.hash || '',
      statusCounts: opts.statusCounts || { accepted: 0, assigned: 0, pending: 0, rejected: 0, unknown: 0 },
    };
    try {
      window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = meta;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
      }
    } catch (_ignored) {
      // Ambiente restrito (sandbox de teste, worker, etc.).
    }
  }

  function loadReceivedMetadata() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(METADATA_KEY);
        if (raw) {
          var meta = JSON.parse(raw);
          if (meta && typeof meta.importedAt === 'string') {
            window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = meta;
            return;
          }
        }
      }
    } catch (_ignored) {
      // localStorage corrompido ou JSON inválido: ignorar.
    }
    window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = null;
  }

  loadReceivedMetadata();

  function shouldShowImportUI() {
    if (window.APP_ENV === 'production') return false;
    if (window.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true) return true;
    var user = window.CURRENT_USER;
    if (user && user.tipo === 'admin') return true;
    if (!user) return null;
    return false;
  }

  function shouldAutoFloat() {
    if (window.APP_ENV === 'production') return false;
    if (window.RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT !== true) return false;
    return shouldShowImportUI() === true;
  }

  // Cria os elementos de UI (file input + button) SEM anexa-los a nada.
  // O chamador decide onde montar via .mount(container) ou .mountBody().
  function createReceivedImportElements(opts) {
    opts = opts || {};
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jsonl,.txt,application/jsonl,text/plain';
    fileInput.style.display = 'none';
    fileInput.id = 'rv-docs-received-import-input';
    if (!opts.buttonId) fileInput.id = 'rv-docs-received-import-input';
    fileInput.setAttribute('aria-label', 'Selecionar arquivo JSONL de documentos exportados do Documents Ingestor');

    var toast = (typeof window.toast === 'function') ? window.toast : function (msg) { console.log(msg); };

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var text = typeof reader.result === 'string' ? reader.result : '';
        var result = docs.loadReceivedDocumentsFromText(text);

        if (result && result.ok) {
          toast(result.count + ' documento(s) carregado(s). '
            + 'Nada foi persistido.', 'success');

          var received = window.RAVATEX_DOCUMENTS_RECEIVED;
          var statusCounts = computeStatusCounts(received);
          var h = simpleHash(text);
          saveReceivedMetadata({
            fileName: file && file.name ? file.name : '',
            count: result.count,
            hash: h,
            statusCounts: statusCounts,
          });
        } else {
          toast(
            'Arquivo incompativel. '
            + 'Selecione o export do Documents Ingestor '
            + '(JSONL flat, 1 documento por linha, com document_id). '
            + 'Motivo: ' + ((result && result.error) || 'falha desconhecida.'),
            'error'
          );
        }

        fileInput.value = '';
      };

      reader.onerror = function () {
        toast('Erro ao ler o arquivo selecionado.', 'error');
        fileInput.value = '';
      };

      reader.readAsText(file);
    });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = opts.buttonId || 'rv-docs-received-import-btn';
    btn.setAttribute('aria-label', 'Selecionar arquivo JSONL de documentos exportados do Documents Ingestor');
    btn.title = 'Selecionar arquivo JSONL de documentos exportados do Documents Ingestor';
    btn.textContent = 'Importar documentos';
    btn.style.cssText =
      'background:#18794a;color:#fff;border:none;border-radius:4px;'
      + 'padding:8px 16px;font-size:13px;font-weight:600;'
      + 'font-family:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(24,121,74,.3);'
      + 'transition:opacity .2s;opacity:.95;';

    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '.95'; });

    btn.addEventListener('click', function () {
      fileInput.click();
    });

    return {
      button: btn,
      fileInput: fileInput,
      mount: function (container) {
        if (!container) return;
        container.appendChild(fileInput);
        container.appendChild(btn);
      },
      mountBody: function () {
        if (document.body) {
          document.body.appendChild(fileInput);
          document.body.appendChild(btn);
        }
      },
    };
  }

  // API exposta para a tela Documentos montar o botao inline.
  docs.createReceivedImportButton = function (opts) {
    return createReceivedImportElements(opts);
  };

  // API de diagnostico (ja existia).
  docs._importReceivedUIRecheck = function () {
    if (shouldAutoFloat() && !_floatingButton) {
      _floatingButton = createReceivedImportElements();
      _floatingButton.mountBody();
    }
  };
  docs._importReceivedUIHasButton = function () {
    return !!_floatingButton;
  };

  // Auto-bootstrap flutuante: DESLIGADO por padrao desde G12-R1.
  // Para reativar, defina window.RAVATEX_ENABLE_FLOATING_RECEIVED_IMPORT = true.
  function tryAutoFloat() {
    if (!shouldAutoFloat()) return false;
    if (_floatingButton) return true;
    _floatingButton = createReceivedImportElements({ buttonId: 'rv-docs-received-import-btn' });
    _floatingButton.mountBody();
    _floatingButton.button.style.position = 'fixed';
    _floatingButton.button.style.bottom = '16px';
    _floatingButton.button.style.right = '200px';
    _floatingButton.button.style.zIndex = '100';
    return true;
  }

  function startFastPoll() {
    if (_fastPollTimer) return;
    _fastPollAttempts = 0;
    _fastPollTimer = setInterval(function () {
      _fastPollAttempts++;
      if (tryAutoFloat()) {
        clearInterval(_fastPollTimer);
        _fastPollTimer = null;
        return;
      }
      var decision = shouldShowImportUI();
      if (decision === false) {
        stopAllPolls();
        return;
      }
      if (_fastPollAttempts >= FAST_POLL_MAX) {
        clearInterval(_fastPollTimer);
        _fastPollTimer = null;
        if (!_floatingButton) {
          startSlowPoll();
        }
      }
    }, 200);
  }

  function startSlowPoll() {
    if (_floatingButton) return;
    if (!shouldAutoFloat() && shouldShowImportUI() !== null) return;
    _slowPollTimer = setTimeout(function () {
      _slowPollTimer = null;
      startSlowPoll();
    }, SLOW_POLL_INTERVAL);
  }

  function stopAllPolls() {
    if (_fastPollTimer) {
      clearInterval(_fastPollTimer);
      _fastPollTimer = null;
    }
    if (_slowPollTimer) {
      clearTimeout(_slowPollTimer);
      _slowPollTimer = null;
    }
  }

  try {
    if (document.body) {
      if (!tryAutoFloat()) {
        startFastPoll();
      }
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', function () {
        if (!tryAutoFloat()) {
          startFastPoll();
        }
      });
    }
  } catch (_e) {
    // Melhor esforco: nao quebrar outros scripts.
  }

})(window);
