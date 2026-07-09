// =====================================================================
// === js/documents-ingestor-auto-load.js ==============================
// Auto-load controlado dos exports do Produtor Ingestor via fetch
// relativo same-origin. Substitui o import manual repetitivo quando
// os arquivos estaticos estao disponiveis no servidor.
//
// Fase: RAVATEX-DOCUMENTS-G22-B-DOCUMENTS-AUTO-LOAD-PATCH
// Escopo: fetch relativo de data/documents/latest.json +
//   data/documents/documentos-mapeados.jsonl, com skip por hash.
//   Sem polling, sem scheduler, sem backend.
//
// Gate:
//   - APP_ENV !== 'production'
//   - CURRENT_USER.tipo === 'admin'
//   - window.fetch disponivel
//
// Carregar via <script src="js/documents-ingestor-auto-load.js">
// DEPOIS de js/documents-ingestor-loader.js.
//
// API exposta:
//   RAVATEX_DOCUMENTS.autoLoadDocuments() -> Promise<{
//     ok: boolean,
//     reason?: string,
//     skipped?: boolean,
//     count?: number,
//     hash?: string,
//     error?: string,
//   }>
//
// Nao chama Supabase, Google/Drive, Gmail. Nao persiste nada alem
// da metadata ja salva pelo import-received. Nao faz fetch automatico
// no bootstrap (apenas em chamada explicita).
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS;
  if (!ns || typeof ns.loadReceivedDocumentsFromText !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Documents Auto-Load] '
        + 'RAVATEX_DOCUMENTS.loadReceivedDocumentsFromText ausente. '
        + 'Verifique se js/documents-ingestor.js e js/documents-ingestor-loader.js '
        + 'foram carregados antes deste script.');
    }
    return;
  }

  var AUTO_LOADED_KEY = 'RAVATEX_DOCUMENTS_AUTO_LOADED';
  var LATEST_URL = 'data/documents/latest.json';
  var DOCUMENTS_URL = 'data/documents/documentos-mapeados.jsonl';
  var METADATA_KEY = 'RAVATEX_DOCUMENTS_RECEIVED_METADATA';

  // -------------------------------------------------------------------
  // Gate: permitido?
  // -------------------------------------------------------------------

  function shouldAutoLoad() {
    if (typeof window.APP_ENV === 'string' && window.APP_ENV === 'production') {
      return false;
    }
    var user = window.CURRENT_USER;
    if (!user || user.tipo !== 'admin') {
      return false;
    }
    if (typeof window.fetch !== 'function') {
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------
  // Hash armazenado no localStorage (via metadata do import-received)
  // -------------------------------------------------------------------

  function getStoredHash() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(METADATA_KEY);
      if (!raw) return null;
      var meta = JSON.parse(raw);
      return meta && typeof meta.hash === 'string' && meta.hash ? meta.hash : null;
    } catch (_e) {
      return null;
    }
  }

  // -------------------------------------------------------------------
  // Salva metadata simples apos auto-load (sem fileName — nao e import
  // manual). Reutiliza a mesma chave do import-received para que a
  // tela leia o card normalmente.
  // -------------------------------------------------------------------

  function saveAutoLoadMetadata(opts) {
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
      // Ambiente restrito.
    }
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

  // -------------------------------------------------------------------
  // Auto-load principal
  // -------------------------------------------------------------------

  ns.autoLoadDocuments = function autoLoadDocuments() {
    if (!shouldAutoLoad()) {
      return Promise.resolve({ ok: false, reason: 'not-allowed' });
    }

    if (window[AUTO_LOADED_KEY]) {
      return Promise.resolve({ ok: false, reason: 'already-loaded' });
    }
    window[AUTO_LOADED_KEY] = true;

    return window.fetch(LATEST_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('latest.json HTTP ' + res.status);
        return res.json();
      })
      .then(function (latest) {
        if (!latest || typeof latest.hash !== 'string' || !latest.hash) {
          throw new Error('latest.json sem campo hash valido');
        }

        var storedHash = getStoredHash();
        if (latest.hash === storedHash) {
          return { ok: true, skipped: true, hash: latest.hash };
        }

        return window.fetch(DOCUMENTS_URL)
          .then(function (res2) {
            if (!res2.ok) throw new Error('documentos-mapeados.jsonl HTTP ' + res2.status);
            return res2.text();
          })
          .then(function (jsonlText) {
            if (typeof jsonlText !== 'string' || !jsonlText.trim()) {
              throw new Error('documentos-mapeados.jsonl esta vazio');
            }
            return ns.loadReceivedDocumentsFromText(jsonlText);
          })
          .then(function (loadResult) {
            if (!loadResult || !loadResult.ok) {
              throw new Error(loadResult && loadResult.error ? loadResult.error : 'falha ao carregar JSONL');
            }

            var received = window.RAVATEX_DOCUMENTS_RECEIVED;
            var statusCounts = computeStatusCounts(received);

            saveAutoLoadMetadata({
              fileName: 'documentos-mapeados.jsonl',
              count: loadResult.count,
              hash: latest.hash,
              statusCounts: statusCounts,
            });

            return { ok: true, count: loadResult.count, hash: latest.hash };
          });
      })
      .then(function (result) {
        if (result && result.ok && !result.skipped) {
          window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION = true;
        }
        return result;
      })
      .catch(function (err) {
        window[AUTO_LOADED_KEY] = false;
        return { ok: false, error: String(err) };
      });
  };

  ns.autoLoadDocumentsReset = function autoLoadDocumentsReset() {
    window[AUTO_LOADED_KEY] = false;
  };

})(window);
