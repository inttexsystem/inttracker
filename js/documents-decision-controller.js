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

  var TRANSPORT_ERRORS = { network: true, supabase_unavailable: true };
  var TERMINAL_ERRORS = {
    input_error: true,
    auth_error: true,
    admin_required: true,
    invalid_envelope: true,
    invalid_expected_active_decision_id: true,
  };

  function defensiveCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

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
      for (var k in extra) {
        if (extra.hasOwnProperty(k)) r[k] = extra[k];
      }
    }
    return r;
  }

  function mapOutcome(adapterResult, commandId) {
    var outcome = adapterResult && adapterResult.outcome;
    var error = adapterResult && adapterResult.error;
    var isOk = adapterResult && adapterResult.ok === true;

    if (isOk && (outcome === 'created' || outcome === 'replayed' || outcome === 'active_decision_exists')) {
      return buildResult(STATE.SUCCEEDED, {
        messageKey: 'decision_' + (outcome === 'created' ? 'created' : outcome === 'replayed' ? 'replayed' : 'exists'),
        closeModal: true,
        retryAllowed: false,
        refreshRequired: outcome !== 'created',
        outcome: outcome,
        commandId: commandId,
      });
    }

    if (outcome === 'active_decision_exists' || outcome === 'stale_active_decision' || outcome === 'candidate_not_found') {
      return buildResult(STATE.STALE, {
        ok: false,
        messageKey: outcome,
        closeModal: true,
        retryAllowed: false,
        refreshRequired: true,
        outcome: outcome,
        error: error,
        commandId: commandId,
      });
    }

    if (outcome === 'command_conflict') {
      return buildResult(STATE.CONFLICT, {
        ok: false,
        messageKey: 'command_conflict',
        closeModal: true,
        retryAllowed: false,
        refreshRequired: true,
        outcome: outcome,
        error: error,
        commandId: commandId,
      });
    }

    if (error && TRANSPORT_ERRORS[error]) {
      return buildResult(STATE.UNCERTAIN, {
        ok: false,
        messageKey: 'network_error',
        closeModal: false,
        retryAllowed: true,
        commandId: commandId,
        outcome: outcome,
        error: error,
      });
    }

    if (error && TERMINAL_ERRORS[error]) {
      return buildResult(STATE.FAILED, {
        ok: false,
        messageKey: error,
        closeModal: false,
        retryAllowed: false,
        outcome: outcome,
        error: error,
        commandId: commandId,
      });
    }

    return buildResult(STATE.FAILED, {
      ok: false,
      messageKey: 'unknown_error',
      closeModal: false,
      retryAllowed: false,
      outcome: outcome,
      error: error || 'unknown',
      commandId: commandId,
    });
  }

  function createDocumentDecisionController(options) {
    if (!options || !options.commandLifecycle || !options.decisionAdapter) {
      throw new Error('commandLifecycle and decisionAdapter required');
    }

    var lifecycle = options.commandLifecycle;
    var adapter = options.decisionAdapter;

    var _state = STATE.IDLE;
    var _documentId = null;
    var _expectedActiveDecisionId = null;
    var _commandId = null;

    function setState(s) { _state = s; }

    function reset() {
      _documentId = null;
      _expectedActiveDecisionId = null;
      _commandId = null;
      setState(STATE.IDLE);
    }

    function applyOutcome(adapterResult) {
      var mapped = mapOutcome(adapterResult, _commandId);
      var s = mapped.state;

      if (s === STATE.SUCCEEDED || s === STATE.FAILED) {
        try { lifecycle.resolveCommand(_commandId); } catch (_) {}
      } else if (s === STATE.STALE || s === STATE.CONFLICT) {
        try { lifecycle.markStale(_commandId); } catch (_) {}
      } else if (s === STATE.UNCERTAIN) {
        try { lifecycle.markUncertain(_commandId); } catch (_) {}
      }

      setState(s);
      return mapped;
    }

    function getState() {
      return defensiveCopy({
        state: _state,
        documentId: _documentId,
        expectedActiveDecisionId: _expectedActiveDecisionId,
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
      var active = snapshot.activeDecision;
      _expectedActiveDecisionId = (active && typeof active.id === 'string') ? active.id : null;
      _commandId = null;
      setState(STATE.EDITING);
      return buildResult(STATE.EDITING, { closeModal: false });
    }

    function submit(draft) {
      if (_state !== STATE.EDITING) {
        return Promise.resolve(buildResult(_state, { ok: false, messageKey: 'invalid_state', error: 'invalid_state' }));
      }

      if (!draft || typeof draft !== 'object') {
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'invalid_input', error: 'invalid_input' }));
      }

      var decision = draft.decision;
      if (decision !== 'accepted' && decision !== 'rejected') {
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'invalid_decision', error: 'invalid_decision' }));
      }

      var motivo = typeof draft.motivo === 'string' ? draft.motivo.trim() : '';
      if (decision === 'rejected' && !motivo) {
        setState(STATE.FAILED);
        return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'motivo_required', error: 'motivo_required' }));
      }
      if (decision === 'accepted') motivo = null;

      setState(STATE.SUBMITTING);

      var prepInput = {
        documentId: _documentId,
        decision: decision,
        motivo: motivo,
        expectedActiveDecisionId: _expectedActiveDecisionId,
      };

      var prepR;
      try { prepR = lifecycle.prepareCommand(prepInput); } catch (e) { setState(STATE.FAILED); return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'lifecycle_error', error: 'lifecycle_error' })); }
      if (!prepR.ok) { setState(STATE.FAILED); return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: prepR.error, error: prepR.error })); }

      _commandId = prepR.commandId;

      var markR;
      try { markR = lifecycle.markSubmitting(_commandId); } catch (e) { setState(STATE.FAILED); return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: 'lifecycle_error', error: 'lifecycle_error' })); }
      if (!markR.ok) { setState(STATE.FAILED); return Promise.resolve(buildResult(STATE.FAILED, { ok: false, messageKey: markR.error, error: markR.error })); }

      var envelope = prepR.envelope;
      var adapterPromise;
      try { adapterPromise = Promise.resolve(adapter.register(envelope)); } catch (e) { try { lifecycle.markUncertain(_commandId); } catch (_) {} setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network' })); }

      return adapterPromise.then(function (adapterResult) {
        return defensiveCopy(applyOutcome(adapterResult));
      }).catch(function () {
        try { lifecycle.markUncertain(_commandId); } catch (_) {}
        setState(STATE.UNCERTAIN);
        return buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network' });
      });
    }

    function retry() {
      if (_state !== STATE.UNCERTAIN) {
        return Promise.resolve(buildResult(_state, { ok: false, messageKey: 'retry_invalid_state', error: 'invalid_state' }));
      }
      if (!_commandId) {
        setState(STATE.EDITING);
        return Promise.resolve(buildResult(STATE.EDITING, { ok: false, messageKey: 'no_command', error: 'no_command' }));
      }

      setState(STATE.SUBMITTING);

      var pendingR;
      try { pendingR = lifecycle.getPendingCommand(); } catch (e) { setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'lifecycle_error', error: 'lifecycle_error', retryAllowed: true, commandId: _commandId })); }
      if (!pendingR.ok || !pendingR.envelope) { setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'no_pending', error: 'no_pending', retryAllowed: true, commandId: _commandId })); }

      var markR;
      try { markR = lifecycle.markSubmitting(_commandId); } catch (e) { setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'lifecycle_error', error: 'lifecycle_error', retryAllowed: true, commandId: _commandId })); }
      if (!markR.ok) { setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: markR.error, error: markR.error, retryAllowed: true, commandId: _commandId })); }

      var envelope = pendingR.envelope;
      var adapterPromise;
      try { adapterPromise = Promise.resolve(adapter.register(envelope)); } catch (e) { try { lifecycle.markUncertain(_commandId); } catch (_) {} setState(STATE.UNCERTAIN); return Promise.resolve(buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network' })); }

      return adapterPromise.then(function (adapterResult) {
        return defensiveCopy(applyOutcome(adapterResult));
      }).catch(function () {
        try { lifecycle.markUncertain(_commandId); } catch (_) {}
        setState(STATE.UNCERTAIN);
        return buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'network_error', retryAllowed: true, commandId: _commandId, error: 'network' });
      });
    }

    function cancel() {
      if (_state === STATE.IDLE) return buildResult(STATE.IDLE, { closeModal: true });
      if (_state === STATE.SUBMITTING) return buildResult(STATE.SUBMITTING, { ok: false, messageKey: 'cannot_cancel', error: 'cannot_cancel' });
      if (_state === STATE.UNCERTAIN) return buildResult(STATE.UNCERTAIN, { ok: false, messageKey: 'cannot_cancel', error: 'cannot_cancel', retryAllowed: true, commandId: _commandId });
      if (_state === STATE.STALE || _state === STATE.CONFLICT) return buildResult(_state, { ok: false, messageKey: 'cannot_cancel', error: 'cannot_cancel', refreshRequired: true });
      if (_state === STATE.FAILED) {
        if (_commandId) { try { lifecycle.discardBeforeSend(_commandId); } catch (_) {} }
        reset();
        return buildResult(STATE.IDLE, { closeModal: true });
      }
      if (_state === STATE.EDITING) {
        if (_commandId) { try { lifecycle.discardBeforeSend(_commandId); } catch (_) {} }
        reset();
        return buildResult(STATE.IDLE, { closeModal: true });
      }
      reset();
      return buildResult(STATE.IDLE, { closeModal: true });
    }

    function restorePending(activeDecision) {
      var getR;
      try { getR = lifecycle.getPendingCommand(); } catch (e) { reset(); return buildResult(STATE.IDLE); }
      var recR;
      try { recR = lifecycle.reconcilePendingCommand(activeDecision || null); } catch (e) { reset(); return buildResult(STATE.IDLE); }
      if (!recR.ok) { reset(); return buildResult(STATE.IDLE); }

      var outcome = recR.outcome;
      if (outcome === 'confirmed') {
        reset();
        return buildResult(STATE.SUCCEEDED, { messageKey: 'confirmed', closeModal: true });
      }
      if (outcome === 'stale') {
        if (getR.ok && getR.envelope) { _documentId = getR.envelope.documentId; _commandId = getR.envelope.commandId; _expectedActiveDecisionId = getR.envelope.expectedActiveDecisionId; }
        setState(STATE.STALE);
        return buildResult(STATE.STALE, { messageKey: 'stale', refreshRequired: true });
      }
      if (outcome === 'retry_available') {
        if (getR.ok && getR.envelope) { _documentId = getR.envelope.documentId; _commandId = getR.envelope.commandId; _expectedActiveDecisionId = getR.envelope.expectedActiveDecisionId; }
        setState(STATE.UNCERTAIN);
        return buildResult(STATE.UNCERTAIN, { messageKey: 'retry_available', retryAllowed: true, commandId: _commandId });
      }
      if (outcome === 'prepared') {
        if (getR.ok && getR.envelope) { _documentId = getR.envelope.documentId; _commandId = getR.envelope.commandId; _expectedActiveDecisionId = getR.envelope.expectedActiveDecisionId; }
        setState(STATE.EDITING);
        return buildResult(STATE.EDITING, { messageKey: 'pending_editing' });
      }
      reset();
      return buildResult(STATE.IDLE);
    }

    function acknowledge() {
      var wasUncertain = _state === STATE.UNCERTAIN;
      var wasStale = _state === STATE.STALE || _state === STATE.CONFLICT;
      reset();
      return buildResult(STATE.IDLE, { closeModal: true, refreshRequired: wasUncertain || wasStale });
    }

    return {
      open: open,
      getState: getState,
      submit: submit,
      retry: retry,
      cancel: cancel,
      restorePending: restorePending,
      acknowledge: acknowledge,
    };
  }

  ns.createDocumentDecisionController = createDocumentDecisionController;
  window.RAVATEX_DOCUMENTS = ns;
})(window);
