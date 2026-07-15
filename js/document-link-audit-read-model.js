// =====================================================================
// === DOCUMENT LINK AUDIT READ MODEL (G28-B8) =========================
// Pure, read-only projection of the append-only canonical link-revision
// history of a SINGLE document into an ordered audit trail.
//
// Source (attached by js/documents-supabase-links.js loadDocumentLinkRevisionHistory):
//   history = { ok:true, revisions:[ {
//     revision_id, document_id, pedido_id, version, active, command_id,
//     created_by, created_at, revoked_by, revoked_at, revocation_reason,
//     restored_from_revision_id, op_ids:[...] } ... ] }
//   | { ok:false, error }                 (read failed — fail-closed)
//
// Contract (accepted G28-B6 / B8):
//   - Revisions are append-only: a correction/revocation/restoration creates a
//     NEW revision and revokes (never deletes) the previous one.
//   - Exactly one active revision per document (partial unique index). This
//     model flags any anomaly as integrity='multiple_active' rather than hiding it.
//   - document_candidates.pedido_id / pedido_manual are NOT links and are never
//     read here.
//
// States (explicit, never a silent "no history"):
//   loading      caller signalled data is still loading
//   unavailable  history source not available / read failed (fail-closed)
//   empty        history available, zero revisions
//   available    one or more revisions
//
// Entry kind (content + provenance of a single revision):
//   restored   revision was created by restoring a historical revision
//   linked     revision has a confirmed Pedido and/or OP(s)
//   unlinked   explicit empty state (no Pedido, no OP) — revocation/unlink
//
// No writes, no DOM, no network, no localStorage. Ordered newest-first
// (version desc; ties by created_at desc then revision_id).
// =====================================================================

(function (root) {
  'use strict';

  var AUDIT_STATE = {
    LOADING: 'loading',
    UNAVAILABLE: 'unavailable',
    EMPTY: 'empty',
    AVAILABLE: 'available',
  };

  var AUDIT_KIND = {
    RESTORED: 'restored',
    LINKED: 'linked',
    UNLINKED: 'unlinked',
  };

  function asString(value) {
    return typeof value === 'string' ? value : null;
  }

  function normalizeOpIds(raw) {
    var out = [];
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var v = raw[i];
        if (v === null || v === undefined) continue;
        out.push(v);
      }
    }
    out.sort(function (a, b) { return Number(a) - Number(b); });
    return out;
  }

  function entryKind(rev) {
    if (rev.restored_from_revision_id) return AUDIT_KIND.RESTORED;
    if (rev.pedido_id || rev.op_ids.length > 0) return AUDIT_KIND.LINKED;
    return AUDIT_KIND.UNLINKED;
  }

  function normalizeRevision(r) {
    var opIds = normalizeOpIds(r && r.op_ids);
    var version = (r && typeof r.version === 'number' && Number.isFinite(r.version)) ? r.version : null;
    return {
      revision_id: asString(r && r.revision_id) || null,
      document_id: asString(r && r.document_id) || null,
      version: version,
      active: !!(r && r.active === true),
      revoked: !!(r && (r.revoked_at || r.revoked_by || r.revocation_reason)),
      pedido_id: asString(r && r.pedido_id) || null,
      op_ids: opIds,
      actor: asString(r && r.created_by) || null,
      created_at: asString(r && r.created_at) || null,
      revoked_by: asString(r && r.revoked_by) || null,
      revoked_at: asString(r && r.revoked_at) || null,
      reason: asString(r && r.revocation_reason) || null,
      restored_from_revision_id: asString(r && r.restored_from_revision_id) || null,
      command_id: asString(r && r.command_id) || null,
      kind: null,
    };
  }

  // Deterministic newest-first ordering: highest version first; ties broken by
  // created_at (descending) then revision_id (stable, no reliance on input order).
  function orderRevisions(records) {
    return records.slice().sort(function (a, b) {
      var va = typeof a.version === 'number' ? a.version : -1;
      var vb = typeof b.version === 'number' ? b.version : -1;
      if (va !== vb) return vb - va;
      var ca = a.created_at || '';
      var cb = b.created_at || '';
      if (ca !== cb) return ca < cb ? 1 : -1;
      var ia = a.revision_id || '';
      var ib = b.revision_id || '';
      if (ia === ib) return 0;
      return ia < ib ? 1 : -1;
    });
  }

  // history: the object returned by loadDocumentLinkRevisionHistory, or any
  // { ok, revisions } shape. options.loading === true forces the loading state.
  function buildAuditTrail(history, options) {
    if (options && options.loading === true) {
      return { state: AUDIT_STATE.LOADING, entries: [], active_revision_id: null, active_count: 0, integrity: 'ok' };
    }

    // Fail-closed: anything other than an explicit ok=true with an array of
    // revisions is treated as unavailable — never a silent "no history".
    if (!history || typeof history !== 'object' || history.ok !== true || !Array.isArray(history.revisions)) {
      return { state: AUDIT_STATE.UNAVAILABLE, entries: [], active_revision_id: null, active_count: 0, integrity: 'ok' };
    }

    if (history.revisions.length === 0) {
      return { state: AUDIT_STATE.EMPTY, entries: [], active_revision_id: null, active_count: 0, integrity: 'ok' };
    }

    var normalized = [];
    for (var i = 0; i < history.revisions.length; i++) {
      var rev = normalizeRevision(history.revisions[i]);
      rev.kind = entryKind(rev);
      normalized.push(rev);
    }

    var ordered = orderRevisions(normalized);

    var activeCount = 0;
    var activeRevisionId = null;
    for (var j = 0; j < ordered.length; j++) {
      if (ordered[j].active) {
        activeCount++;
        if (activeRevisionId === null) activeRevisionId = ordered[j].revision_id;
      }
    }

    return {
      state: AUDIT_STATE.AVAILABLE,
      entries: ordered,
      active_revision_id: activeRevisionId,
      active_count: activeCount,
      integrity: activeCount > 1 ? 'multiple_active' : 'ok',
    };
  }

  // Convenience projection of the single active revision (for the modal's
  // "current links" section and the expected-active-revision id). Returns null
  // when the trail is not available or has no active revision.
  function activeRevisionOf(auditTrail) {
    if (!auditTrail || auditTrail.state !== AUDIT_STATE.AVAILABLE) return null;
    for (var i = 0; i < auditTrail.entries.length; i++) {
      if (auditTrail.entries[i].active) return auditTrail.entries[i];
    }
    return null;
  }

  var api = {
    buildAuditTrail: buildAuditTrail,
    activeRevisionOf: activeRevisionOf,
    constants: { AUDIT_STATE: AUDIT_STATE, AUDIT_KIND: AUDIT_KIND },
  };

  root.RAVATEX_DOCUMENT_LINK_AUDIT = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
