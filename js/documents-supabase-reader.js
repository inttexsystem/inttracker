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
    'fornecedor_id', 'sender_email', 'received_at', 'detected_at', 'linked_at', 'accepted_at',
    'email_message_id', 'email_received_at', 'email_received_at_source', 'email_received_at_estimated',
    'rejected_at', 'rejected_reason', 'ingestor_status', 'ingestor_state_at',
    'ingestor_event_id', 'ingestor_rejected_reason', 'schema_version', 'criado_em'
  ].join(', ');
  var DECISION_FIELDS = 'id, document_id, status, motivo, decidido_em, source, command_id';
  var EVIDENCE_FIELDS = 'document_id, evidence_version, technical_evidence, origin, created_at';
  var LINK_REVISION_FIELDS = 'id, document_id, pedido_id, version';
  var LINK_OP_FIELDS = 'revision_id, op_id';

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

  function validateEvidenceEnvelope(row) {
    var docId = row && row.document_id;
    if (typeof docId !== 'string' || !docId.trim()) {
      return { valid: false, reason: 'invalid_document_id' };
    }

    var version = row.evidence_version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return { valid: false, reason: 'invalid_evidence_version' };
    }

    var te = row.technical_evidence;
    if (!te || typeof te !== 'object' || Array.isArray(te)) {
      return { valid: false, reason: 'invalid_technical_evidence' };
    }

    var origin = row.origin;
    if (!origin || typeof origin !== 'object' || Array.isArray(origin)) {
      return { valid: false, reason: 'invalid_origin' };
    }

    var originVersion = origin.evidenceVersion;
    if (typeof originVersion !== 'number' || !Number.isInteger(originVersion) || originVersion < 1) {
      return { valid: false, reason: 'invalid_origin_evidence_version' };
    }

    if (originVersion !== version) {
      return { valid: false, reason: 'origin_evidence_version_mismatch' };
    }

    return { valid: true };
  }

  function attachTechnicalEvidences(documents, evidenceRows) {
    var evidenceByDocId = {};
    (evidenceRows || []).forEach(function (row) {
      if (!row || typeof row.document_id !== 'string' || !row.document_id) return;
      var docId = row.document_id;
      if (!evidenceByDocId[docId]) evidenceByDocId[docId] = [];
      evidenceByDocId[docId].push(row);
    });

    documents.forEach(function (doc) {
      var rows = evidenceByDocId[doc.document_id] || [];

      if (rows.length === 0) {
        doc._ravatex_technical_evidence = { state: 'missing' };
        return;
      }

      var maxVersion = -1;
      var maxRow = null;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var version = row.evidence_version;
        if (typeof version === 'number' && Number.isInteger(version) && version >= 1 && version > maxVersion) {
          maxVersion = version;
          maxRow = row;
        }
      }

      if (!maxRow) {
        doc._ravatex_technical_evidence = { state: 'invalid', evidenceVersion: null, reason: 'invalid_evidence_version' };
        return;
      }

      var validation = validateEvidenceEnvelope(maxRow);
      if (!validation.valid) {
        doc._ravatex_technical_evidence = {
          state: 'invalid',
          evidenceVersion: maxVersion,
          reason: validation.reason,
        };
        return;
      }

      doc._ravatex_technical_evidence = {
        state: 'available',
        evidenceVersion: maxVersion,
        technicalEvidence: maxRow.technical_evidence,
        origin: maxRow.origin,
        createdAt: maxRow.created_at,
      };
    });
  }

  // Read-only status enrichment for linked targets, so cancelled/inactive
  // targets can be surfaced as warnings by the read model. Failure degrades
  // to empty statuses; it never removes the revision.
  function loadTargetStatuses(pedidoIds, opIds) {
    var pedidoQuery = pedidoIds.length
      ? window.supa.from('pedidos').select('id, status').in('id', pedidoIds)
      : Promise.resolve({ data: [] });
    var opQuery = opIds.length
      ? window.supa.from('ops').select('id, status').in('id', opIds)
      : Promise.resolve({ data: [] });
    return Promise.all([pedidoQuery, opQuery])
      .then(function (res) {
        var pedidoStatus = {};
        var opStatus = {};
        (((res[0] || {}).data) || []).forEach(function (p) { if (p && p.id != null) pedidoStatus[p.id] = p.status; });
        (((res[1] || {}).data) || []).forEach(function (o) { if (o && o.id != null) opStatus[o.id] = o.status; });
        return { pedidoStatus: pedidoStatus, opStatus: opStatus };
      })
      .catch(function () { return { pedidoStatus: {}, opStatus: {} }; });
  }

  // Loads the active canonical link revision (+ typed OP children) for the
  // given candidate documents. On query failure returns { unavailable: true }
  // so the read model surfaces an explicit unavailable state — never a silent
  // "no links".
  function loadActiveLinkRevisions(documentIds) {
    return Promise.resolve()
      .then(function () {
        return window.supa.from('document_link_revisions')
          .select(LINK_REVISION_FIELDS)
          .in('document_id', documentIds)
          .eq('active', true);
      })
      .then(function (revRes) {
        if (revRes && revRes.error) return { unavailable: true };
        var revs = (revRes && revRes.data) || [];
        if (revs.length === 0) return { byDoc: {} };
        var revisionIds = revs.map(function (r) { return r.id; });
        return window.supa.from('document_link_revision_ops')
          .select(LINK_OP_FIELDS)
          .in('revision_id', revisionIds)
          .then(function (opRes) {
            if (opRes && opRes.error) return { unavailable: true };
            var opRows = (opRes && opRes.data) || [];
            var pedidoIds = [];
            var opIds = [];
            revs.forEach(function (r) { if (r.pedido_id) pedidoIds.push(r.pedido_id); });
            opRows.forEach(function (o) { opIds.push(o.op_id); });
            return loadTargetStatuses(pedidoIds, opIds).then(function (status) {
              var opsByRevision = {};
              opRows.forEach(function (o) {
                if (!opsByRevision[o.revision_id]) opsByRevision[o.revision_id] = [];
                opsByRevision[o.revision_id].push({ op_id: o.op_id, op_status: status.opStatus[o.op_id] || null });
              });
              var byDoc = {};
              revs.forEach(function (r) {
                byDoc[r.document_id] = {
                  state: 'available',
                  revision_id: r.id,
                  version: r.version,
                  pedido_id: r.pedido_id || null,
                  pedido_status: r.pedido_id ? (status.pedidoStatus[r.pedido_id] || null) : null,
                  op_links: opsByRevision[r.id] || [],
                };
              });
              return { byDoc: byDoc };
            });
          });
      })
      .catch(function () { return { unavailable: true }; });
  }

  function attachLinkRevisions(documents, linkData) {
    var unavailable = !!(linkData && linkData.unavailable);
    var byDoc = (linkData && linkData.byDoc) || {};
    documents.forEach(function (doc) {
      if (unavailable) {
        doc._ravatex_link_revision = { state: 'unavailable' };
        return;
      }
      doc._ravatex_link_revision = byDoc[doc.document_id] || {
        state: 'available',
        revision_id: null,
        version: null,
        pedido_id: null,
        pedido_status: null,
        op_links: [],
      };
    });
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
      sender_email: candidate.sender_email || null,
      from: candidate.sender_email || '',
      email_message_id: candidate.email_message_id,
      email_received_at: candidate.email_received_at,
      email_received_at_source: candidate.email_received_at_source,
      email_received_at_estimated: candidate.email_received_at_estimated === true,
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
        id: typeof decision.id === 'string' ? decision.id : null,
        status: decision.status,
        motivo: decision.motivo || '',
        decidido_em: decision.decidido_em || '',
        source: decision.source || '',
        command_id: typeof decision.command_id === 'string' ? decision.command_id : null,
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
        var candidates = candidatesResult.data || [];
        var documents = candidates.map(function (candidate) {
          return mapCandidate(candidate, decisionsByDocumentId);
        });

        var candidateDocIds = [];
        for (var i = 0; i < candidates.length; i++) {
          if (candidates[i] && candidates[i].document_id) {
            candidateDocIds.push(candidates[i].document_id);
          }
        }

        if (candidateDocIds.length === 0) {
          var setResultEmpty = ns.setReceivedDocuments(documents, { source: 'supabase' });
          if (!setResultEmpty || !setResultEmpty.ok) {
            return { ok: false, source: 'supabase', error: setResultEmpty && setResultEmpty.error || 'received_set_failed' };
          }
          return { ok: true, source: 'supabase', count: setResultEmpty.count, documents: window.RAVATEX_DOCUMENTS_RECEIVED };
        }

        var evidenceQuery;
        try {
          evidenceQuery = window.supa.from('document_technical_evidences')
            .select(EVIDENCE_FIELDS)
            .in('document_id', candidateDocIds);
        } catch (err) {
          return { ok: false, source: 'supabase', error: String(err) };
        }

        return Promise.all([evidenceQuery, loadActiveLinkRevisions(candidateDocIds)])
          .then(function (results) {
            var evidenceResult = results[0];
            var linkData = results[1];
            if (evidenceResult && evidenceResult.error) {
              return { ok: false, source: 'supabase', error: String(evidenceResult.error) };
            }

            attachTechnicalEvidences(documents, evidenceResult && evidenceResult.data);
            attachLinkRevisions(documents, linkData);

            var setResult = ns.setReceivedDocuments(documents, { source: 'supabase' });
            if (!setResult || !setResult.ok) {
              return { ok: false, source: 'supabase', error: setResult && setResult.error || 'received_set_failed' };
            }
            return { ok: true, source: 'supabase', count: setResult.count, documents: window.RAVATEX_DOCUMENTS_RECEIVED };
          });
      })
      .catch(function (err) {
        return { ok: false, source: 'supabase', error: String(err) };
      });
  };
})(window);
