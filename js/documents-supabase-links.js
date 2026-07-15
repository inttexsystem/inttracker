// =====================================================================
// === SUPABASE DOCUMENT CANONICAL LINKS ===============================
// Adapter module for the canonical human-confirmed document link
// revisions (Documento -> Pedido 0..1 / OP 0..N) via RPC.
//
// Writers:
//   - registerDocumentLinksInCloud   -> registrar_vinculos_documento
//       (B6 link; B8 correction/revocation via the optional envelope.reason)
//   - applyDocumentValidationInCloud -> registrar_decisao_e_vinculos_documento (atomic)
//   - restoreDocumentLinksInCloud    -> restaurar_vinculos_documento (B8)
// Readers (read-only, no writes):
//   - loadActiveDocumentLinkRevision      -> active revision + OP children
//   - loadDocumentLinkRevisionHistory     -> full append-only revision history (B8 audit)
//   - loadLinkableTargets                 -> pedidos + OPs for the picker
//
// No localStorage, no in-memory overrides, no legacy fallback, no
// alternate RPC aliases, no duplicate browser writers, no service-role.
//
// Carregar via <script src="js/documents-supabase-links.js?v=...">
// DEPOIS de js/documents-supabase-decisions.js e ANTES das telas que
// usam o namespace RAVATEX_DOCUMENTS.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  var UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  function isUuid(v) {
    return typeof v === 'string' && UUID_PATTERN.test(v);
  }

  function normalizeOpIds(raw) {
    // Accept an array of positive integers (BIGINT ids); drop nulls; keep ints.
    if (raw === null || raw === undefined) return { ok: true, opIds: [] };
    if (!Array.isArray(raw)) return { ok: false, error: 'invalid_op_ids' };
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var v = raw[i];
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim() !== '' && /^[0-9]+$/.test(v.trim())) {
        v = parseInt(v.trim(), 10);
      }
      if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
        return { ok: false, error: 'invalid_op_ids' };
      }
      out.push(v);
    }
    return { ok: true, opIds: out };
  }

  function rpcResult(r) {
    if (r && r.error) {
      return { ok: false, error: (r.error && r.error.message) || 'supabase_error' };
    }
    if (r && r.data) return r.data;
    return { ok: false, error: 'supabase_error' };
  }

  // -------------------------------------------------------------------
  // Writer: register the complete desired link state (canonical revision)
  // -------------------------------------------------------------------
  ns.registerDocumentLinksInCloud = function registerDocumentLinksInCloud(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return Promise.resolve({ ok: false, error: 'invalid_envelope' });
    }
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }

    var documentId = typeof envelope.documentId === 'string' ? envelope.documentId.trim() : '';
    if (!documentId) return Promise.resolve({ ok: false, error: 'document_id_required' });

    if (!envelope.commandId || !isUuid(envelope.commandId)) {
      return Promise.resolve({ ok: false, error: 'command_id_required' });
    }

    var pedidoId = envelope.pedidoId;
    if (pedidoId !== null && pedidoId !== undefined) {
      if (!isUuid(pedidoId)) return Promise.resolve({ ok: false, error: 'invalid_pedido_id' });
    } else {
      pedidoId = null;
    }

    var norm = normalizeOpIds(envelope.opIds);
    if (!norm.ok) return Promise.resolve({ ok: false, error: norm.error });

    var expectedRevId = envelope.expectedActiveRevisionId;
    if (expectedRevId !== null && expectedRevId !== undefined) {
      if (!isUuid(expectedRevId)) return Promise.resolve({ ok: false, error: 'invalid_expected_active_revision_id' });
    } else {
      expectedRevId = null;
    }

    var params = {
      p_document_id: documentId,
      p_pedido_id: pedidoId,
      p_op_ids: norm.opIds,
      p_command_id: envelope.commandId,
      p_expected_active_revision_id: expectedRevId,
    };

    // B8 correction / revocation: an optional human reason is recorded as the
    // revocation_reason of the superseded revision. Sent only when present so
    // the accepted B6 call shape (five params) is preserved when it is absent.
    var reason = typeof envelope.reason === 'string' ? envelope.reason.trim() : '';
    if (reason) params.p_reason = reason;

    return Promise.resolve()
      .then(function () {
        return window.supa.rpc('registrar_vinculos_documento', params);
      })
      .then(rpcResult)
      .catch(function () {
        return { ok: false, error: 'network' };
      });
  };

  // -------------------------------------------------------------------
  // Writer (B8): restore a historical link revision. Delegates to the
  // restaurar_vinculos_documento RPC, which reuses the single canonical
  // writer (no compatibility logic duplicated; historical row never mutated).
  // -------------------------------------------------------------------
  ns.restoreDocumentLinksInCloud = function restoreDocumentLinksInCloud(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return Promise.resolve({ ok: false, error: 'invalid_envelope' });
    }
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }

    var documentId = typeof envelope.documentId === 'string' ? envelope.documentId.trim() : '';
    if (!documentId) return Promise.resolve({ ok: false, error: 'document_id_required' });

    if (!envelope.sourceRevisionId || !isUuid(envelope.sourceRevisionId)) {
      return Promise.resolve({ ok: false, error: 'source_revision_id_required' });
    }
    if (!envelope.commandId || !isUuid(envelope.commandId)) {
      return Promise.resolve({ ok: false, error: 'command_id_required' });
    }

    var expectedRevId = envelope.expectedActiveRevisionId;
    if (expectedRevId !== null && expectedRevId !== undefined) {
      if (!isUuid(expectedRevId)) return Promise.resolve({ ok: false, error: 'invalid_expected_active_revision_id' });
    } else {
      expectedRevId = null;
    }

    var params = {
      p_document_id: documentId,
      p_source_revision_id: envelope.sourceRevisionId,
      p_command_id: envelope.commandId,
      p_expected_active_revision_id: expectedRevId,
    };
    var reason = typeof envelope.reason === 'string' ? envelope.reason.trim() : '';
    if (reason) params.p_reason = reason;

    return Promise.resolve()
      .then(function () {
        return window.supa.rpc('restaurar_vinculos_documento', params);
      })
      .then(rpcResult)
      .catch(function () {
        return { ok: false, error: 'network' };
      });
  };

  // -------------------------------------------------------------------
  // Writer: atomic "Validar e vincular" (links + decision in one tx)
  // -------------------------------------------------------------------
  ns.applyDocumentValidationInCloud = function applyDocumentValidationInCloud(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return Promise.resolve({ ok: false, error: 'invalid_envelope' });
    }
    if (!window.supa || typeof window.supa.rpc !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }

    var documentId = typeof envelope.documentId === 'string' ? envelope.documentId.trim() : '';
    if (!documentId) return Promise.resolve({ ok: false, error: 'document_id_required' });

    var decision = envelope.decision;
    if (decision !== 'accepted' && decision !== 'rejected') {
      return Promise.resolve({ ok: false, error: 'invalid_decision' });
    }

    var motivo = typeof envelope.motivo === 'string' ? envelope.motivo.trim() : '';
    if (decision === 'rejected' && !motivo) {
      return Promise.resolve({ ok: false, error: 'motivo_required' });
    }
    if (decision === 'accepted') motivo = null;

    if (!envelope.linkCommandId || !isUuid(envelope.linkCommandId)) {
      return Promise.resolve({ ok: false, error: 'link_command_id_required' });
    }
    if (!envelope.decisionCommandId || !isUuid(envelope.decisionCommandId)) {
      return Promise.resolve({ ok: false, error: 'decision_command_id_required' });
    }
    if (envelope.linkCommandId === envelope.decisionCommandId) {
      return Promise.resolve({ ok: false, error: 'command_ids_must_differ' });
    }

    var pedidoId = envelope.pedidoId;
    if (pedidoId !== null && pedidoId !== undefined) {
      if (!isUuid(pedidoId)) return Promise.resolve({ ok: false, error: 'invalid_pedido_id' });
    } else {
      pedidoId = null;
    }

    var norm = normalizeOpIds(envelope.opIds);
    if (!norm.ok) return Promise.resolve({ ok: false, error: norm.error });

    var expectedRevId = envelope.expectedActiveRevisionId;
    if (expectedRevId !== null && expectedRevId !== undefined) {
      if (!isUuid(expectedRevId)) return Promise.resolve({ ok: false, error: 'invalid_expected_active_revision_id' });
    } else {
      expectedRevId = null;
    }

    var expectedDecId = envelope.expectedActiveDecisionId;
    if (expectedDecId !== null && expectedDecId !== undefined) {
      if (!isUuid(expectedDecId)) return Promise.resolve({ ok: false, error: 'invalid_expected_active_decision_id' });
    } else {
      expectedDecId = null;
    }

    return Promise.resolve()
      .then(function () {
        return window.supa.rpc('registrar_decisao_e_vinculos_documento', {
          p_document_id: documentId,
          p_pedido_id: pedidoId,
          p_op_ids: norm.opIds,
          p_link_command_id: envelope.linkCommandId,
          p_expected_active_revision_id: expectedRevId,
          p_decision: decision,
          p_motivo: motivo,
          p_decision_command_id: envelope.decisionCommandId,
          p_expected_active_decision_id: expectedDecId,
        });
      })
      .then(rpcResult)
      .catch(function () {
        return { ok: false, error: 'network' };
      });
  };

  // -------------------------------------------------------------------
  // Reader: active link revision + OP children for a single document.
  // Read-only. No fallback that turns unavailable into "no links".
  // -------------------------------------------------------------------
  ns.loadActiveDocumentLinkRevision = function loadActiveDocumentLinkRevision(documentId) {
    if (!window.supa || typeof window.supa.from !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }
    var docId = typeof documentId === 'string' ? documentId.trim() : '';
    if (!docId) return Promise.resolve({ ok: false, error: 'document_id_required' });

    return Promise.resolve()
      .then(function () {
        return window.supa.from('document_link_revisions')
          .select('id, document_id, pedido_id, version, active, created_at')
          .eq('document_id', docId)
          .eq('active', true)
          .limit(1);
      })
      .then(function (r) {
        if (r && r.error) return { ok: false, error: (r.error && r.error.message) || 'supabase_error' };
        var rows = (r && r.data) || [];
        if (rows.length === 0) return { ok: true, revision: null };
        var rev = rows[0];
        return window.supa.from('document_link_revision_ops')
          .select('op_id')
          .eq('revision_id', rev.id)
          .then(function (opr) {
            if (opr && opr.error) return { ok: false, error: (opr.error && opr.error.message) || 'supabase_error' };
            var opIds = ((opr && opr.data) || []).map(function (x) { return x.op_id; });
            return {
              ok: true,
              revision: {
                revision_id: rev.id,
                document_id: rev.document_id,
                pedido_id: rev.pedido_id || null,
                version: rev.version,
                op_ids: opIds,
              },
            };
          });
      })
      .catch(function (err) {
        return { ok: false, error: String(err) };
      });
  };

  // -------------------------------------------------------------------
  // Reader (B8 audit): the full append-only revision history of a single
  // document (active + revoked), each with its typed OP children and every
  // audit field. Read-only. Fail-closed: a query failure returns
  // { ok:false, error } — never a silent empty history.
  // -------------------------------------------------------------------
  var HISTORY_REVISION_FIELDS = [
    'id', 'document_id', 'pedido_id', 'version', 'active', 'command_id',
    'created_by', 'created_at', 'revoked_by', 'revoked_at', 'revocation_reason',
    'restored_from_revision_id',
  ].join(', ');

  ns.loadDocumentLinkRevisionHistory = function loadDocumentLinkRevisionHistory(documentId) {
    if (!window.supa || typeof window.supa.from !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }
    var docId = typeof documentId === 'string' ? documentId.trim() : '';
    if (!docId) return Promise.resolve({ ok: false, error: 'document_id_required' });

    return Promise.resolve()
      .then(function () {
        return window.supa.from('document_link_revisions')
          .select(HISTORY_REVISION_FIELDS)
          .eq('document_id', docId)
          .order('version', { ascending: false });
      })
      .then(function (r) {
        if (r && r.error) return { ok: false, error: (r.error && r.error.message) || 'supabase_error' };
        var revs = (r && r.data) || [];
        if (revs.length === 0) return { ok: true, revisions: [] };
        var revisionIds = revs.map(function (x) { return x.id; });
        return window.supa.from('document_link_revision_ops')
          .select('revision_id, op_id')
          .in('revision_id', revisionIds)
          .then(function (opr) {
            if (opr && opr.error) return { ok: false, error: (opr.error && opr.error.message) || 'supabase_error' };
            var opsByRevision = {};
            ((opr && opr.data) || []).forEach(function (o) {
              if (!o || o.revision_id == null) return;
              if (!opsByRevision[o.revision_id]) opsByRevision[o.revision_id] = [];
              opsByRevision[o.revision_id].push(o.op_id);
            });
            var revisions = revs.map(function (rev) {
              var opIds = (opsByRevision[rev.id] || []).slice().sort(function (a, b) { return a - b; });
              return {
                revision_id: rev.id,
                document_id: rev.document_id,
                pedido_id: rev.pedido_id || null,
                version: rev.version,
                active: rev.active === true,
                command_id: rev.command_id || null,
                created_by: rev.created_by || null,
                created_at: rev.created_at || null,
                revoked_by: rev.revoked_by || null,
                revoked_at: rev.revoked_at || null,
                revocation_reason: rev.revocation_reason || null,
                restored_from_revision_id: rev.restored_from_revision_id || null,
                op_ids: opIds,
              };
            });
            return { ok: true, revisions: revisions };
          });
      })
      .catch(function (err) {
        return { ok: false, error: String(err) };
      });
  };

  // -------------------------------------------------------------------
  // Reader: linkable targets for the modal picker.
  // pedidos (id, numero, status) and OPs (id + canonical pedido via lote).
  // Read-only admin projection under existing RLS.
  // -------------------------------------------------------------------
  ns.loadLinkableTargets = function loadLinkableTargets() {
    if (!window.supa || typeof window.supa.from !== 'function') {
      return Promise.resolve({ ok: false, error: 'supabase_unavailable' });
    }

    var pedidosQuery;
    var opsQuery;
    try {
      pedidosQuery = window.supa.from('pedidos')
        .select('id, numero, status')
        .order('numero', { ascending: false });
      opsQuery = window.supa.from('ops')
        .select('id, numero, ano, tipo, status, lote_id, lotes:lote_id(pedido_id)')
        .order('id', { ascending: false });
    } catch (err) {
      return Promise.resolve({ ok: false, error: String(err) });
    }

    return Promise.all([pedidosQuery, opsQuery])
      .then(function (results) {
        var pr = results[0] || {};
        var opr = results[1] || {};
        if (pr.error || opr.error) {
          return { ok: false, error: String((pr.error || opr.error).message || pr.error || opr.error) };
        }
        var pedidos = (pr.data || []).map(function (p) {
          return { id: p.id, numero: p.numero, status: p.status };
        });
        var ops = (opr.data || []).map(function (o) {
          var canonicalPedido = null;
          if (o.lotes && typeof o.lotes === 'object') {
            canonicalPedido = o.lotes.pedido_id || null;
          } else if (Array.isArray(o.lotes) && o.lotes.length > 0) {
            canonicalPedido = o.lotes[0].pedido_id || null;
          }
          return {
            id: o.id,
            numero: o.numero,
            ano: o.ano,
            tipo: o.tipo,
            status: o.status,
            pedido_id: canonicalPedido,
          };
        });
        return { ok: true, pedidos: pedidos, ops: ops };
      })
      .catch(function (err) {
        return { ok: false, error: String(err) };
      });
  };

  window.RAVATEX_DOCUMENTS = ns;
})(window);
