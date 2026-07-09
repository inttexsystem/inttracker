// =====================================================================
// === SUPABASE DOCUMENTS READER =======================================
// Leitura admin-only de documentos mapeados, convertida para o shape
// flat ja consumido pela tela Documentos Mapeados e pelo Pedido Detail.
// Sem RPCs e sem operacoes de escrita.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS;
  if (!ns || typeof ns.setReceivedDocuments !== 'function') {
    return;
  }

  var CANDIDATE_FIELDS = [
    'document_id', 'filename_original', 'tipo_documento', 'formato', 'direcao_nf',
    'drive_file_id', 'drive_web_view_link', 'status', 'pedido_manual', 'pedido_id',
    'fornecedor_id', 'received_at', 'detected_at', 'linked_at', 'accepted_at',
    'rejected_at', 'rejected_reason', 'ingestor_status', 'ingestor_state_at',
    'ingestor_event_id', 'ingestor_rejected_reason', 'schema_version', 'criado_em'
  ].join(', ');
  var DECISION_FIELDS = 'document_id, status, motivo, decidido_em, source';

  function asString(value) {
    return typeof value === 'string' ? value : null;
  }

  function mapDecisions(rows) {
    var byDocumentId = {};
    (rows || []).forEach(function (decision) {
      if (!decision || decision.ativo === false) return;
      var documentId = asString(decision.document_id);
      if (!documentId || byDocumentId[documentId]) return;
      byDocumentId[documentId] = decision;
    });
    return byDocumentId;
  }

  function hasCompleteCanonicalBase(candidate) {
    var status = candidate && candidate.ingestor_status;
    if (status !== 'pending' && status !== 'assigned' && status !== 'accepted' && status !== 'rejected') {
      return false;
    }
    if (!asString(candidate.ingestor_state_at) || !asString(candidate.ingestor_event_id)) return false;
    if (status === 'rejected') {
      return typeof candidate.ingestor_rejected_reason === 'string'
        && !!candidate.ingestor_rejected_reason.trim();
    }
    return true;
  }

  function mapCandidate(candidate, decisionsByDocumentId) {
    var decision = candidate && decisionsByDocumentId[candidate.document_id];
    var status = decision && (decision.status === 'accepted' || decision.status === 'rejected')
      ? decision.status : candidate.status;
    var rejectedReason = candidate.rejected_reason;

    if (decision && decision.status === 'rejected' && typeof decision.motivo === 'string') {
      rejectedReason = decision.motivo;
    }

    return {
      document_id: candidate.document_id,
      filename_original: candidate.filename_original,
      tipo_documento: candidate.tipo_documento,
      formato: candidate.formato,
      direcao_nf: candidate.direcao_nf,
      drive_file_id: candidate.drive_file_id,
      drive_web_view_link: candidate.drive_web_view_link,
      status: status,
      pedido_manual: candidate.pedido_manual,
      pedido_id: candidate.pedido_id,
      fornecedor_id: candidate.fornecedor_id,
      received_at: candidate.received_at,
      detected_at: candidate.detected_at,
      linked_at: candidate.linked_at,
      accepted_at: candidate.accepted_at,
      rejected_at: candidate.rejected_at,
      rejected_reason: rejectedReason,
      schema_version: candidate.schema_version,
      created_at: candidate.criado_em,
      _ravatex_source: 'supabase',
      _ravatex_decision_source: decision ? 'server' : null,
      _ravatex_can_undo_server_decision: !!decision && hasCompleteCanonicalBase(candidate),
      _ravatex_server_decision: decision ? {
        status: decision.status,
        motivo: decision.motivo || '',
        decidido_em: decision.decidido_em || '',
        source: decision.source || '',
      } : null,
    };
  }

  ns.loadReceivedDocumentsFromSupabase = function loadReceivedDocumentsFromSupabase() {
    if (!window.supa || typeof window.supa.from !== 'function') {
      return Promise.resolve({ ok: false, source: 'supabase', error: 'supabase_unavailable' });
    }

    var candidatesQuery;
    var decisionsQuery;
    try {
      candidatesQuery = window.supa.from('document_candidates')
        .select(CANDIDATE_FIELDS)
        .order('criado_em', { ascending: false });
      decisionsQuery = window.supa.from('document_decisions')
        .select(DECISION_FIELDS)
        .eq('ativo', true)
        .order('decidido_em', { ascending: false });
    } catch (err) {
      return Promise.resolve({ ok: false, source: 'supabase', error: String(err) });
    }

    return Promise.all([candidatesQuery, decisionsQuery])
      .then(function (results) {
        var candidatesResult = results[0] || {};
        var decisionsResult = results[1] || {};
        if (candidatesResult.error || decisionsResult.error) {
          return {
            ok: false,
            source: 'supabase',
            error: String(candidatesResult.error || decisionsResult.error),
          };
        }

        var decisionsByDocumentId = mapDecisions(decisionsResult.data || []);
        var documents = (candidatesResult.data || []).map(function (candidate) {
          return mapCandidate(candidate, decisionsByDocumentId);
        });
        var setResult = ns.setReceivedDocuments(documents, { source: 'supabase' });
        if (!setResult || !setResult.ok) {
          return { ok: false, source: 'supabase', error: setResult && setResult.error || 'received_set_failed' };
        }
        return { ok: true, source: 'supabase', count: setResult.count, documents: window.RAVATEX_DOCUMENTS_RECEIVED };
      })
      .catch(function (err) {
        return { ok: false, source: 'supabase', error: String(err) };
      });
  };
})(window);
