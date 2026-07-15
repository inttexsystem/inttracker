// =====================================================================
// === DOCUMENT LINK ADMIN CONTROLLER (G28-B8) =========================
// Orchestrates the human administrative operations over the canonical
// link revisions of a single document:
//   correction   replace the complete active link set (new revision)
//   revocation   explicit unlink -> canonical empty-link revision
//   restoration  copy a historical revision's link set into a new revision
//
// It does NOT introduce a competing writer. It routes to the canonical
// adapters (registerDocumentLinksInCloud / restoreDocumentLinksInCloud),
// which call the single canonical RPC boundary. The existing decision
// controller and the "Validar e vincular" atomic path are untouched.
//
// Client idempotency: one in-flight command id per operation, reused on
// retry so a transport-uncertain resend converges on the server (replayed).
// A NEW operation mints a fresh command id (a divergent reuse of the same id
// is a server-side command_conflict, surfaced as CONFLICT).
//
// Optimistic concurrency: every mutation carries the expected active
// revision id captured at open(); a stale expectation fails closed.
//
// Pure orchestration: no DOM, no Supabase, no localStorage. Dependency
// injected: { linksAdapter:{register, restore}, newCommandId }.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  var STATE = {
    IDLE: 'idle',
    EDITING: 'editing',
    SUBMITTING: 'submitting',
    SUCCEEDED: 'succeeded',
    UNCERTAIN: 'uncertain',
    STALE: 'stale',
    CONFLICT: 'conflict',
    FAILED: 'failed',
  };

  var SUCCESS_OUTCOMES = { created: true, updated: true, replayed: true, no_change: true };
  var STALE_OUTCOMES = { stale_active_revision: true, active_revision_exists: true };
  var CONFLICT_OUTCOMES = { command_conflict: true };
  // Business rejections where the desired/historical target is no longer valid.
  var TARGET_FAILURES = {
    pedido_not_found: true, pedido_not_linkable: true,
    op_not_found: true, op_not_linkable: true, op_pedido_mismatch: true, op_not_avulsa: true,
    duplicate_op: true, candidate_not_found: true,
    restore_source_not_found: true, restore_source_mismatch: true,
    input_error: true,
  };
  var TRANSPORT_ERRORS = { network: true, supabase_unavailable: true };
  var TERMINAL_ERRORS = {
    admin_required: true, auth_error: true, invalid_envelope: true,
    document_id_required: true, command_id_required: true, source_revision_id_required: true,
    invalid_pedido_id: true, invalid_op_ids: true, invalid_expected_active_revision_id: true,
  };

  function defensiveCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

  function buildResult(state, extra) {
    var r = {
      ok: true,
      state: state,
      messageKey: null,
      closeModal: false,
      refreshRequired: false,
      retryAllowed: false,
      commandId: null,
      outcome: null,
      error: null,
    };
    if (extra) {
      for (var k in extra) { if (extra.hasOwnProperty(k)) r[k] = extra[k]; }
    }
    return r;
  }

  function mapOutcome(adapterResult, commandId) {
    var outcome = adapterResult && adapterResult.outcome;
    var error = adapterResult && adapterResult.error;
    var isOk = !!(adapterResult && adapterResult.ok === true);

    if (isOk && SUCCESS_OUTCOMES[outcome]) {
      return buildResult(STATE.SUCCEEDED, {
        messageKey: 'link_' + outcome,
        closeModal: true,
        refreshRequired: true,
        outcome: outcome,
        commandId: commandId,
      });
    }

    if (STALE_OUTCOMES[outcome]) {
      return buildResult(STATE.STALE, {
        ok: false, messageKey: 'stale_active_revision', closeModal: true,
        refreshRequired: true, outcome: outcome, error: error || outcome, commandId: commandId,
      });
    }

    if (CONFLICT_OUTCOMES[outcome]) {
      return buildResult(STATE.CONFLICT, {
        ok: false, messageKey: 'command_conflict', closeModal: true,
        refreshRequired: true, outcome: outcome, error: error || outcome, commandId: commandId,
      });
    }

    if (outcome && TARGET_FAILURES[outcome]) {
      return buildResult(STATE.FAILED, {
        ok: false, messageKey: outcome, closeModal: false, refreshRequired: true,
        outcome: outcome, error: error || outcome, commandId: commandId,
      });
    }

    if (error && TRANSPORT_ERRORS[error]) {
      return buildResult(STATE.UNCERTAIN, {
        ok: false, messageKey: 'network_error', closeModal: false,
        retryAllowed: true, outcome: outcome, error: error, commandId: commandId,
      });
    }

    if (error && (TARGET_FAILURES[error] || TERMINAL_ERRORS[error])) {
      return buildResult(STATE.FAILED, {
        ok: false, messageKey: error, closeModal: false,
        outcome: outcome, error: error, commandId: commandId,
      });
    }

    return buildResult(STATE.FAILED, {
      ok: false, messageKey: 'unknown_error', closeModal: false,
      outcome: outcome || null, error: error || 'unknown', commandId: commandId,
    });
  }

  function normalizeOpIds(raw) {
    var out = [];
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var v = raw[i];
        if (typeof v === 'string' && /^[0-9]+$/.test(v.trim())) v = parseInt(v.trim(), 10);
        if (typeof v === 'number' && Number.isInteger(v) && v > 0 && out.indexOf(v) === -1) out.push(v);
      }
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function createDocumentLinkAdminController(options) {
    if (!options || !options.linksAdapter ||
        typeof options.linksAdapter.register !== 'function' ||
        typeof options.linksAdapter.restore !== 'function' ||
        typeof options.newCommandId !== 'function') {
      throw new Error('linksAdapter.register, linksAdapter.restore and newCommandId required');
    }

    var adapter = options.linksAdapter;
    var mintCommandId = options.newCommandId;

    var _state = STATE.IDLE;
    var _documentId = null;
    var _expectedActiveRevisionId = null;
    var _commandId = null;
    var _pendingEnvelope = null;   // { channel:'register'|'restore', envelope }

    function setState(s) { _state = s; }

    function reset() {
      _documentId = null;
      _expectedActiveRevisionId = null;
      _commandId = null;
      _pendingEnvelope = null;
      setState(STATE.IDLE);
    }

    function getState() {
      return defensiveCopy({
        state: _state,
        documentId: _documentId,
        expectedActiveRevisionId: _expectedActiveRevisionId,
        commandId: _commandId,
      });
    }

    function open(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        setState(STATE.FAILED);
        return buildResult(STATE.FAILED, { ok: false, messageKey: 'invalid_snapshot', error: 'invalid_snapshot' });
      }
      var docId = typeof snapshot.documentId === 'string' ? snapshot.documentId.trim() : '';
      if (!docId) {
        setState(STATE.FAILED);
        return buildResult(STATE.FAILED, { ok: false, messageKey: 'invalid_document_id', error: 'invalid_document_id' });
      }
      _documentId = docId;
      _expectedActiveRevisionId = (typeof snapshot.activeRevisionId === 'string' && snapshot.activeRevisionId)
        ? snapshot.activeRevisionId : null;
      _commandId = null;
      _pendingEnvelope = null;
      setState(STATE.EDITING);
      return buildResult(STATE.EDITING, { closeModal: false });
    }

    // Validate + build the channel/envelope for an intent. Returns { ok, channel,
    // envelope } or { ok:false, error }.
    function buildEnvelope(intent) {
      if (!intent || typeof intent !== 'object') return { ok: false, error: 'invalid_input' };
      var kind = intent.kind;
      var reason = typeof intent.reason === 'string' ? intent.reason.trim() : '';
      // A human reason is required for every B8 administrative mutation so the
      // audit trail always records why the active state changed.
      if (!reason) return { ok: false, error: 'reason_required' };

      if (kind === 'correct') {
        var pedidoId = (intent.pedidoId === null || intent.pedidoId === undefined || intent.pedidoId === '')
          ? null : intent.pedidoId;
        return {
          ok: true, channel: 'register',
          envelope: {
            documentId: _documentId,
            pedidoId: pedidoId,
            opIds: normalizeOpIds(intent.opIds),
            reason: reason,
            commandId: _commandId,
            expectedActiveRevisionId: _expectedActiveRevisionId,
          },
        };
      }

      if (kind === 'unlink') {
        // Explicit empty-link state: no Pedido, no OPs.
        return {
          ok: true, channel: 'register',
          envelope: {
            documentId: _documentId,
            pedidoId: null,
            opIds: [],
            reason: reason,
            commandId: _commandId,
            expectedActiveRevisionId: _expectedActiveRevisionId,
          },
        };
      }

      if (kind === 'restore') {
        if (typeof intent.sourceRevisionId !== 'string' || !intent.sourceRevisionId) {
          return { ok: false, error: 'source_revision_id_required' };
        }
        return {
          ok: true, channel: 'restore',
          envelope: {
            documentId: _documentId,
            sourceRevisionId: intent.sourceRevisionId,
            reason: reason,
            commandId: _commandId,
            expectedActiveRevisionId: _expectedActiveRevisionId,
          },
        };
      }

      return { ok: false, error: 'invalid_kind' };
    }

    function send(channel, envelope) {
      var call;
      try {
        call = channel === 'restore' ? adapter.restore(envelope) : adapter.register(envelope);
      } catch (e) {
        setState(STATE.UNCERTAIN);
        return Promise.resolve(buildResult(STATE.UNCERTAIN, {
          ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network',
        }));
      }
      return Promise.resolve(call).then(function (adapterResult) {
        var mapped = mapOutcome(adapterResult, _commandId);
        if (mapped.state === STATE.SUCCEEDED || mapped.state === STATE.FAILED ||
            mapped.state === STATE.STALE || mapped.state === STATE.CONFLICT) {
          _pendingEnvelope = null;
        }
        setState(mapped.state);
        return defensiveCopy(mapped);
      }).catch(function () {
        setState(STATE.UNCERTAIN);
        return buildResult(STATE.UNCERTAIN, {
          ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network',
        });
      });
    }

    // Submit a fresh administrative operation. Mints a new command id.
    function submit(intent) {
      if (_state !== STATE.EDITING) {
        return Promise.resolve(buildResult(_state, { ok: false, messageKey: 'invalid_state', error: 'invalid_state' }));
      }
      if (!_documentId) {
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'invalid_document_id', error: 'invalid_document_id' }));
      }

      var commandId;
      try { commandId = mintCommandId(); } catch (e) { commandId = null; }
      if (typeof commandId !== 'string' || !commandId) {
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'command_id_unavailable', error: 'command_id_unavailable' }));
      }
      _commandId = commandId;

      var built = buildEnvelope(intent);
      if (!built.ok) {
        _commandId = null;
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: built.error, error: built.error }));
      }

      _pendingEnvelope = { channel: built.channel, envelope: built.envelope };
      setState(STATE.SUBMITTING);
      return send(built.channel, built.envelope);
    }

    // Resend the same in-flight command (same command id) after a transport
    // uncertainty. The server converges idempotently (replayed / no_change).
    function retry() {
      if (_state !== STATE.UNCERTAIN) {
        return Promise.resolve(buildResult(_state, { ok: false, messageKey: 'retry_invalid_state', error: 'invalid_state' }));
      }
      if (!_pendingEnvelope || !_commandId) {
        setState(STATE.EDITING);
        return Promise.resolve(buildResult(STATE.EDITING, { ok: false, messageKey: 'no_command', error: 'no_command' }));
      }
      setState(STATE.SUBMITTING);
      return send(_pendingEnvelope.channel, _pendingEnvelope.envelope);
    }

    function cancel() {
      if (_state === STATE.SUBMITTING) {
        return buildResult(STATE.SUBMITTING, { ok: false, messageKey: 'cannot_cancel', error: 'cannot_cancel' });
      }
      if (_state === STATE.UNCERTAIN) {
        return buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'cannot_cancel', error: 'cannot_cancel', retryAllowed: true, commandId: _commandId });
      }
      reset();
      return buildResult(STATE.IDLE, { closeModal: true });
    }

    function acknowledge() {
      var wasUncertain = _state === STATE.UNCERTAIN;
      var wasStaleOrConflict = _state === STATE.STALE || _state === STATE.CONFLICT;
      reset();
      return buildResult(STATE.IDLE, { closeModal: true, refreshRequired: wasUncertain || wasStaleOrConflict });
    }

    return {
      open: open,
      getState: getState,
      submit: submit,
      retry: retry,
      cancel: cancel,
      acknowledge: acknowledge,
    };
  }

  ns.createDocumentLinkAdminController = createDocumentLinkAdminController;
  window.RAVATEX_DOCUMENTS = ns;
})(typeof window !== 'undefined' ? window : this);
