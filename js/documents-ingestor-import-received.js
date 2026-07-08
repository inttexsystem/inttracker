// =====================================================================
// === js/documents-ingestor-import-received.js =========================
// UX manual para importar `documentos-recebidos.jsonl` (formato flat
// do Ingestor G12-D1). Adiciona um botao flutuante que abre dialogo
// de arquivo, le via FileReader e chama
// `loadReceivedDocumentsFromText` do loader dedicado (G12-G1).
//
// Estado populado: window.RAVATEX_DOCUMENTS_RECEIVED.
// NAO toca window.RAVATEX_DOCUMENTS_LOADED_EVENTS (estado legado
// consumido pelo Pedido Detail).
//
// Fase: RAVATEX-TAPETES-G12-G3-RECEIVED-DOCUMENTS-IMPORT-BUTTON
// Escopo: UX manual, local, read-only. Sem rede, sem Supabase, sem
//   Google/Drive, sem persistencia, sem watcher, sem auto-load.
//
// Restricao de superficie (mesma politica do import legado):
//   - Nunca visivel em producao (APP_ENV === 'production').
//   - Em staging/dev/local, visivel apenas quando:
//     * usuario e admin (CURRENT_USER.tipo === 'admin'), OU
//     * flag RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true.
//   - CURRENT_USER pode ser populado assincronamente; um poll curto
//     aguarda ate ~10s apos o carregamento da pagina.
//
// Separacao do import legado:
//   - Botao legado (Importar eventos) -> document-events.jsonl
//     -> RAVATEX_DOCUMENTS_LOADED_EVENTS (Pedido Detail).
//   - Este botao -> documentos-recebidos.jsonl
//     -> RAVATEX_DOCUMENTS_RECEIVED (tela global G12-G2).
//   - Os dois coexistem; cada um escreve em seu proprio estado.
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

  var IMPORT_BUTTON_ID = 'rv-docs-received-import-btn';
  var _uiCreated = false;
  var _fastPollTimer = null;
  var _slowPollTimer = null;
  var _fastPollAttempts = 0;
  var FAST_POLL_MAX = 50;
  var SLOW_POLL_INTERVAL = 10000;

  function shouldShowImportUI() {
    if (window.APP_ENV === 'production') return false;
    if (window.RAVATEX_ENABLE_DOCUMENTS_IMPORT_UI === true) return true;
    var user = window.CURRENT_USER;
    if (user && user.tipo === 'admin') return true;
    if (!user) return null;
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
        stopAllPolls();
        return;
      }
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
    if (decision === false) return;
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

  function createImportUI() {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jsonl,.txt,application/jsonl,text/plain';
    fileInput.style.display = 'none';
    fileInput.id = 'rv-docs-received-import-input';
    fileInput.setAttribute('aria-label', 'Selecionar documentos-recebidos.jsonl do export global do Documents Ingestor');

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var text = typeof reader.result === 'string' ? reader.result : '';
        var result = docs.loadReceivedDocumentsFromText(text);

        if (result && result.ok) {
          var msg = result.count + ' documento(s) carregado(s) de documentos-recebidos.jsonl. '
            + 'Abra Documentos para visualizar a fila. '
            + 'Nada foi persistido.';
          window.toast(msg, 'success');
        } else {
          window.toast('Erro ao importar: ' + ((result && result.error) || 'Falha desconhecida.'), 'error');
        }

        fileInput.value = '';
      };

      reader.onerror = function () {
        window.toast('Erro ao ler o arquivo selecionado.', 'error');
        fileInput.value = '';
      };

      reader.readAsText(file);
    });

    document.body.appendChild(fileInput);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = IMPORT_BUTTON_ID;
    btn.setAttribute('aria-label', 'Selecionar documentos-recebidos.jsonl do export global do Documents Ingestor');
    btn.title = 'Selecionar documentos-recebidos.jsonl do export global do Documents Ingestor';
    btn.textContent = 'Importar recebidos';
    btn.style.cssText =
      'position:fixed;bottom:16px;right:200px;z-index:100;'
      + 'background:#18794a;color:#fff;border:none;border-radius:6px;'
      + 'padding:8px 16px;font-size:13px;font-weight:600;'
      + 'font-family:inherit;cursor:pointer;box-shadow:0 2px 8px rgba(24,121,74,.35);'
      + 'transition:opacity .2s;opacity:.85;';

    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '.85'; });

    btn.addEventListener('click', function () {
      fileInput.click();
    });

    document.body.appendChild(btn);
  }

  docs._importReceivedUIRecheck = function () {
    tryCreateImportUI();
  };
  docs._importReceivedUIHasButton = function () {
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
