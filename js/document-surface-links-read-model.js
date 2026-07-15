// =====================================================================
// === DOCUMENT SURFACE LINKS READ MODEL (G28-B7) ======================
// Pure, read-only reverse projection: "which received documents are
// canonically linked to a given Pedido / OP".
//
// Single canonical source consumed by the product surfaces (Pedido
// detail, OP detail, ...). Every surface must consume THIS projection so
// they all read the same canonical link (master plan §1.9).
//
// Canonical link source (attached by js/documents-supabase-reader.js):
//   documentRecord._ravatex_link_revision =
//     { state:'available', revision_id, version, pedido_id, pedido_status,
//       op_links:[{op_id, op_status}] }
//     | { state:'unavailable' }   (link query failed — fail-closed)
//
// Contract (accepted G28-B6):
//   - Documento -> Pedido 0..1 confirmed (revision.pedido_id).
//   - Documento -> OP 0..N confirmed (revision.op_links[].op_id).
//   - document_candidates.pedido_id is NOT a confirmed link and is never read.
//   - pedido_manual is an Ingestor suggestion only and is never read here.
//
// States (explicit, never a silent "no links"):
//   loading      caller signalled data is still loading
//   invalid      target id missing/invalid
//   unavailable  canonical link source not available this session
//   empty        canonical available, zero confirmed links to the target
//   available    one or more confirmed links to the target
//
// No writes, no DOM, no network, no localStorage, no pedido_manual/CNPJ/
// technical-evidence inference. Reads only the already-loaded in-memory
// received documents produced by the B6-verified reader.
// =====================================================================

(function (window) {
  'use strict';

  var SURFACE_LINK_STATE = {
    LOADING: 'loading',
    INVALID: 'invalid',
    UNAVAILABLE: 'unavailable',
    EMPTY: 'empty',
    AVAILABLE: 'available',
  };

  var UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  function isUuid(v) {
    return typeof v === 'string' && UUID_PATTERN.test(v.trim());
  }

  function asString(value) {
    return typeof value === 'string' ? value : null;
  }

  function resolveDocuments(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'documents')) {
      return options.documents;
    }
    return window.RAVATEX_DOCUMENTS_RECEIVED;
  }

  function resolveGlobalSource(options) {
    if (options && typeof options.globalSource === 'string') return options.globalSource;
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE === 'string') {
      return window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE;
    }
    return '';
  }

  function resolveRemoteAvailability(options) {
    if (options && typeof options.globalRemoteAvailability === 'string') {
      return options.globalRemoteAvailability;
    }
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY === 'string') {
      return window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
    }
    return null;
  }

  // Canonical links are only trustworthy when the collection came from the
  // Supabase reader and the remote projection was available. Legacy/manual/
  // unknown collections or a remote-unavailable session cannot assert
  // canonical linkage — the surface must show "unavailable", never "none".
  function isCanonicalCollectionAvailable(options) {
    var source = resolveGlobalSource(options);
    if (source !== 'supabase') return false;
    var remote = resolveRemoteAvailability(options);
    if (remote === 'unavailable') return false;
    return true;
  }

  function isSupabaseDoc(doc) {
    return doc && doc._ravatex_source === 'supabase';
  }

  function linkRevisionOf(doc) {
    var rev = doc && doc._ravatex_link_revision;
    return (rev && typeof rev === 'object') ? rev : null;
  }

  // Effective review status for display (accepted/rejected/pending/unknown).
  // Server decision wins; otherwise the candidate status.
  function effectiveStatus(doc) {
    var decision = doc && doc._ravatex_server_decision;
    if (decision && typeof decision === 'object' && decision.status) {
      return decision.status;
    }
    return asString(doc && doc.status) || 'unknown';
  }

  function projectDoc(doc, revision, matchedOpIds, targetCancelled) {
    var opLinks = (revision && Array.isArray(revision.op_links)) ? revision.op_links : [];
    var opIds = [];
    for (var i = 0; i < opLinks.length; i++) {
      if (opLinks[i] && (typeof opLinks[i].op_id === 'number' || typeof opLinks[i].op_id === 'string')) {
        opIds.push(opLinks[i].op_id);
      }
    }
    return {
      document_id: asString(doc.document_id) || '',
      filename_original: asString(doc.filename_original) || '',
      tipo_documento: asString(doc.tipo_documento) || '',
      formato: asString(doc.formato) || '',
      direcao_nf: asString(doc.direcao_nf) || null,
      status: effectiveStatus(doc),
      drive_web_view_link: asString(doc.drive_web_view_link) || null,
      link_version: revision && typeof revision.version === 'number' ? revision.version : null,
      pedido_id: revision ? (asString(revision.pedido_id) || null) : null,
      pedido_status: revision ? (asString(revision.pedido_status) || null) : null,
      op_ids: opIds,
      matched_op_ids: matchedOpIds || null,
      target_cancelled: !!targetCancelled,
    };
  }

  // Shared engine. `match(doc, revision)` returns null when the doc is not
  // linked to the target, or a { matchedOpIds, targetCancelled } descriptor
  // when it is.
  function buildLinkedDocuments(options, matchFor) {
    if (options && options.loading === true) {
      return { state: SURFACE_LINK_STATE.LOADING, confirmed: [] };
    }
    if (!matchFor) {
      return { state: SURFACE_LINK_STATE.INVALID, confirmed: [] };
    }

    var docs = resolveDocuments(options);
    if (!Array.isArray(docs)) {
      return { state: SURFACE_LINK_STATE.UNAVAILABLE, reason: 'documents_unavailable', confirmed: [] };
    }
    if (!isCanonicalCollectionAvailable(options)) {
      return { state: SURFACE_LINK_STATE.UNAVAILABLE, reason: 'non_canonical_source', confirmed: [] };
    }

    // Fail-closed: if the reader marked the link source unavailable for any
    // Supabase document, we cannot assert the confirmed set for anyone.
    for (var i = 0; i < docs.length; i++) {
      if (isSupabaseDoc(docs[i])) {
        var rev = linkRevisionOf(docs[i]);
        if (rev && rev.state === 'unavailable') {
          return { state: SURFACE_LINK_STATE.UNAVAILABLE, reason: 'link_source_unavailable', confirmed: [] };
        }
      }
    }

    var confirmed = [];
    for (var j = 0; j < docs.length; j++) {
      var doc = docs[j];
      if (!isSupabaseDoc(doc)) continue;
      var revision = linkRevisionOf(doc);
      if (!revision || revision.state !== 'available') continue;
      var descriptor = matchFor(doc, revision);
      if (!descriptor) continue;
      confirmed.push(projectDoc(doc, revision, descriptor.matchedOpIds, descriptor.targetCancelled));
    }

    if (confirmed.length === 0) {
      return { state: SURFACE_LINK_STATE.EMPTY, confirmed: [] };
    }
    return { state: SURFACE_LINK_STATE.AVAILABLE, confirmed: confirmed };
  }

  // Documents whose active canonical revision confirms this Pedido (0..1).
  function buildLinkedDocumentsForPedido(pedidoId, options) {
    var target = isUuid(pedidoId) ? String(pedidoId).trim() : null;
    if (!target) {
      if (options && options.loading === true) {
        return { state: SURFACE_LINK_STATE.LOADING, confirmed: [] };
      }
      return { state: SURFACE_LINK_STATE.INVALID, confirmed: [] };
    }
    return buildLinkedDocuments(options, function (doc, revision) {
      var revPedido = asString(revision.pedido_id);
      if (!revPedido || revPedido !== target) return null;
      return { matchedOpIds: null, targetCancelled: revision.pedido_status === 'cancelado' };
    });
  }

  // Documents whose active canonical revision confirms this OP (part of 0..N).
  function buildLinkedDocumentsForOp(opId, options) {
    var target = null;
    if (typeof opId === 'number' && Number.isInteger(opId) && opId > 0) {
      target = opId;
    } else if (typeof opId === 'string' && /^[0-9]+$/.test(opId.trim())) {
      target = parseInt(opId.trim(), 10);
    }
    if (target === null || target <= 0) {
      if (options && options.loading === true) {
        return { state: SURFACE_LINK_STATE.LOADING, confirmed: [] };
      }
      return { state: SURFACE_LINK_STATE.INVALID, confirmed: [] };
    }
    return buildLinkedDocuments(options, function (doc, revision) {
      var opLinks = Array.isArray(revision.op_links) ? revision.op_links : [];
      var matched = false;
      var cancelled = false;
      for (var k = 0; k < opLinks.length; k++) {
        var link = opLinks[k];
        if (!link) continue;
        if (Number(link.op_id) === target) {
          matched = true;
          if (link.op_status === 'cancelada') cancelled = true;
          break;
        }
      }
      if (!matched) return null;
      return { matchedOpIds: [target], targetCancelled: cancelled };
    });
  }

  var api = {
    buildLinkedDocumentsForPedido: buildLinkedDocumentsForPedido,
    buildLinkedDocumentsForOp: buildLinkedDocumentsForOp,
    constants: { SURFACE_LINK_STATE: SURFACE_LINK_STATE },
  };

  window.RAVATEX_DOCUMENT_SURFACE_LINKS = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
