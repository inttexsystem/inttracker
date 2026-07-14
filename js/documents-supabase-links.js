// =====================================================================
// === SUPABASE DOCUMENT CANONICAL LINKS ===============================
// Adapter module for the canonical human-confirmed document link
// revisions (Documento -> Pedido 0..1 / OP 0..N) via RPC.
//
// Writers:
//   - registerDocumentLinksInCloud   -> registrar_vinculos_documento
//   - applyDocumentValidationInCloud -> registrar_decisao_e_vinculos_documento (atomic)
// Readers (read-only, no writes):
//   - loadActiveDocumentLinkRevision -> active revision + OP children
//   - loadLinkableTargets            -> pedidos + OPs for the picker
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

    return Promise.resolve()
      .then(function () {
        return window.supa.rpc('registrar_vinculos_documento', {
          p_document_id: documentId,
          p_pedido_id: pedidoId,
          p_op_ids: norm.opIds,
          p_command_id: envelope.commandId,
          p_expected_active_revision_id: expectedRevId,
        });
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
