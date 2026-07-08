// =====================================================================
// === js/documents-ingestor-import-ui.js ===============================
// UX manual para importar eventos JSONL do Documents Ingestor.
// Adiciona um botao flutuante que abre dialogo de arquivo, le via
// FileReader e chama loadDocumentsIngestorEventsFromText.
//
// Fase: RAVATEX-TAPETES-G11-E-DOCUMENTS-MANUAL-IMPORT-UX
// Escopo: UX manual, local, read-only. Sem rede, sem Supabase, sem
//   Google/Drive, sem persistencia, sem watcher.
//
// Restricao de superficie (G11-E-R1 + G11-E-R2):
//   - Nunca visivel em producao (APP_ENV === 'production').
//   - Em staging/dev/local, visivel apenas quando:
//     * usuario e admin (CURRENT_USER.tipo === 'admin'), OU
//     * flag RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true.
//   - CURRENT_USER e populado assincronamente; um poll curto aguarda
//     ate ~10 s apos o carregamento da pagina.
//
// Depende de:
//   - js/documents-ingestor-loader.js (RAVATEX_DOCUMENTS.loadFromText)
//   - js/ui.js (window.toast)
// Carregar via <script src="js/documents-ingestor-import-ui.js?v=...>
// DEPOIS de documents-ingestor-loader.js.
//
// Nao carrega nada automaticamente. Nao persiste. Nao chama rede.
// =====================================================================

(function (window) {
  'use strict';

  var docs = window.RAVATEX_DOCUMENTS;
  if (!docs || typeof docs.loadDocumentsIngestorEventsFromText !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Documents Ingestor Import UI] '
        + 'RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText ausente. '
        + 'Verifique se js/documents-ingestor.js e js/documents-ingestor-loader.js '
        + 'foram carregados antes deste script.');
    }
    return;
  }

  var IMPORT_BUTTON_ID = 'rv-docs-import-btn';
  var _uiCreated = false;
  var _fastPollTimer = null;
  var _slowPollTimer = null;
  var _fastPollAttempts = 0;
  var FAST_POLL_MAX = 50;        // ~10 s com intervalo de 200 ms
  var SLOW_POLL_INTERVAL = 10000; // 10 s, indefinido

  // -------------------------------------------------------------------
  // Decisao de visibilidade
  // -------------------------------------------------------------------

  function shouldShowImportUI() {
    // Nunca em producao
    if (window.APP_ENV === 'production') return false;
    // Flag explicita (dev/local override)
    if (window.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true) return true;
    // Admin logado
    var user = window.CURRENT_USER;
    if (user && user.tipo === 'admin') return true;
    // CURRENT_USER ainda nao foi populado — pode ser admin
    if (!user) return null;
    // Usuario nao-admin
    return false;
  }

  function tryCreateImportUI() {
    if (_uiCreated) return true;
    var decision = shouldShowImportUI();
    if (decision === true) {
      createImportUI();
      _uiCreated = true;
      stopAllPolls();
      return true;
    }
    // decision === null: CURRENT_USER ainda nao setado, continue polling
    // decision === false: usuario claramente nao autorizado, pare tudo
    if (decision === false) {
      stopAllPolls();
    }
    return false;
  }

  function startFastPoll() {
    if (_fastPollTimer) return;
    _fastPollAttempts = 0;
    _fastPollTimer = setInterval(function () {
      _fastPollAttempts++;
      var decision = shouldShowImportUI();
      if (decision === true) {
        tryCreateImportUI();
        clearInterval(_fastPollTimer);
        _fastPollTimer = null;
        return;
      }
      if (decision === false) {
        // Usuario nao-admin — para tudo
        stopAllPolls();
        return;
      }
      // decision === null: CURRENT_USER ainda nao setado
      if (_fastPollAttempts >= FAST_POLL_MAX) {
        clearInterval(_fastPollTimer);
        _fastPollTimer = null;
        if (!_uiCreated) {
          startSlowPoll();
        }
      }
    }, 200);
  }

  function startSlowPoll() {
    if (_uiCreated) return;
    var decision = shouldShowImportUI();
    if (decision === true) {
      tryCreateImportUI();
      return;
    }
    // decision === false: usuario claramente nao-autorizado, para tudo
    if (decision === false) return;
    // decision === null: CURRENT_USER nao setado, agenda retentativa
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

  // -------------------------------------------------------------------
  // Criacao da UI de import
  // -------------------------------------------------------------------

  function createImportUI() {
    // Hidden file input
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jsonl,.txt,application/jsonl,text/plain';
    fileInput.style.display = 'none';
    fileInput.id = 'rv-docs-import-input';
    fileInput.setAttribute('aria-label', 'Selecionar document-events.jsonl do export package do Documents Ingestor');

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var text = typeof reader.result === 'string' ? reader.result : '';
        var result = docs.loadDocumentsIngestorEventsFromText(text);

        if (result.ok) {
          var msg = result.count + ' evento(s) carregado(s) de document-events.jsonl. '
            + 'Abra ou recarregue o Pedido para ver "Documentos Recebidos (Ingestor)". '
            + 'Nada foi persistido.';
          window.toast(msg, 'success');
        } else {
          window.toast('Erro ao importar: ' + (result.error || 'Falha desconhecida.'), 'error');
        }

        // Limpa o input para permitir reimportar o mesmo arquivo
        fileInput.value = '';
      };

      reader.onerror = function () {
        window.toast('Erro ao ler o arquivo selecionado.', 'error');
        fileInput.value = '';
      };

      reader.readAsText(file);
    });

    document.body.appendChild(fileInput);

    // Floating button
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = IMPORT_BUTTON_ID;
    btn.setAttribute('aria-label', 'Selecionar document-events.jsonl do export package do Documents Ingestor');
    btn.title = 'Selecionar document-events.jsonl do export package do Documents Ingestor';
    btn.textContent = 'Importar eventos';
    btn.style.cssText =
      'position:fixed;bottom:16px;right:16px;z-index:100;'
      + 'background:#2563eb;color:#fff;border:none;border-radius:6px;'
      + 'padding:8px 16px;font-size:13px;font-weight:600;'
      + 'font-family:inherit;cursor:pointer;box-shadow:0 2px 8px rgba(37,99,235,.35);'
      + 'transition:opacity .2s;opacity:.85;';

    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '.85'; });

    btn.addEventListener('click', function () {
      fileInput.click();
    });

    document.body.appendChild(btn);
  }

  // -------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------

  // Exposto para diagnostico/teste
  docs._importUIRecheck = function () {
    tryCreateImportUI();
  };
  docs._importUIHasButton = function () {
    return _uiCreated;
  };

  try {
    if (document.body) {
      if (!tryCreateImportUI()) {
        startFastPoll();
      }
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', function () {
        if (!tryCreateImportUI()) {
          startFastPoll();
        }
      });
    }
  } catch (_e) {
    // Melhor esforco: nao quebrar outros scripts.
  }

})(window);
