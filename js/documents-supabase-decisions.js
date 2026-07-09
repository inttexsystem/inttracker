// =====================================================================
// === SUPABASE DOCUMENTS DECISIONS ====================================
// Wrapper admin-only para decidir documentos de origem Supabase via a
// RPC public.decidir_documento(p_document_id, p_status, p_motivo).
//
// Fase: RAVATEX-DOCUMENTS-G23-D-B-CLOUD-DOCUMENT-DECISIONS-PATCH
// Escopo: apenas a chamada da RPC e a normalizacao do resultado.
//   Sem DOM, sem acesso direto a tabelas, sem escrita direta e sem
//   credencial de servico. Nao toca em armazenamento local do browser.
//   A decisao em nuvem substitui a decisao local apenas para documentos
//   com _ravatex_source === 'supabase'.
//
// Carregar via <script src="js/documents-supabase-decisions.js?v=...">
// DEPOIS de js/documents-supabase-reader.js e ANTES das telas que usam
// o namespace RAVATEX_DOCUMENTS.
//
// Atencao: a RPC retorna a chave `error` (nao `erro`). O resultado de
//   r.data e preservado como veio, para que a UI leia r.data.error.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  ns.decideDocumentInCloud = function decideDocumentInCloud(documentId, status, motivo) {
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }

    var docId = typeof documentId === 'string' ? documentId.trim() : '';
    if (!docId) {
      return Promise.resolve({ ok: false, error: 'document_id_required' });
    }

    if (status !== 'accepted' && status !== 'rejected') {
      return Promise.resolve({ ok: false, error: 'invalid_status' });
    }

    var motivoTrimmed = typeof motivo === 'string' ? motivo.trim() : '';
    if (status === 'rejected' && !motivoTrimmed) {
      return Promise.resolve({ ok: false, error: 'motivo_required' });
    }

    return Promise.resolve()
      .then(function () {
        return window.supa.rpc('decidir_documento', {
          p_document_id: docId,
          p_status: status,
          p_motivo: motivoTrimmed || null,
        });
      })
      .then(function (r) {
        if (r && r.error) {
          return { ok: false, error: (r.error && r.error.message) || 'supabase_error' };
        }
        if (r && r.data) {
          // Preserva o payload da RPC como veio (ok, error, status,
          // decision_id, candidate_updated). A UI le r.data.error.
          return r.data;
        }
        return { ok: false, error: 'supabase_error' };
      })
      .catch(function () {
        return { ok: false, error: 'network' };
      });
  };

  window.RAVATEX_DOCUMENTS = ns;
})(window);
