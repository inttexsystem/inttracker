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
    return;
  }

  var IMPORT_BUTTON_ID = 'rv-docs-import-btn';
  var _uiCreated = false;
  var _pollTimer = null;
  var _pollAttempts = 0;
  var MAX_POLL_ATTEMPTS = 50; // ~10 s com intervalo de 200 ms

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
      return true;
    }
    // decision === null: CURRENT_USER ainda nao setado, continue polling
    // decision === false: usuario claramente nao autorizado
    if (decision === false) {
      stopPoll();
    }
    return false;
  }

  function startPoll() {
    if (_pollTimer) return;
    _pollAttempts = 0;
    _pollTimer = setInterval(function () {
      _pollAttempts++;
      if (tryCreateImportUI() || _pollAttempts >= MAX_POLL_ATTEMPTS) {
        stopPoll();
      }
    }, 200);
  }

  function stopPoll() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
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
    fileInput.setAttribute('aria-label', 'Selecionar arquivo JSONL do Documents Ingestor');

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var text = typeof reader.result === 'string' ? reader.result : '';
        var result = docs.loadDocumentsIngestorEventsFromText(text);

        if (result.ok) {
          var msg = result.count + ' evento(s) do Documents Ingestor carregado(s). '
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
    btn.setAttribute('aria-label', 'Importar eventos do Documents Ingestor');
    btn.title = 'Importar JSONL do Documents Ingestor';
    btn.textContent = 'Importar docs';
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

  try {
    if (document.body) {
      if (!tryCreateImportUI()) {
        // CURRENT_USER provavelmente ainda nao foi populado.
        // Poll ate o usuario ser carregado ou timeout.
        startPoll();
        // Tambem observa CURRENT_USER diretamente quando for sobrescrito
        // por loadCurrentUser (setCurrentUser reatribui window.CURRENT_USER).
        // Usamos um Object.defineProperty ou setInterval simples.
      }
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', function () {
        if (!tryCreateImportUI()) {
          startPoll();
        }
      });
    }
  } catch (_e) {
    // Melhor esforco: nao quebrar outros scripts.
  }

})(window);
