// =====================================================================
// === DOCUMENT VALIDATION COMMAND LIFECYCLE ===========================
// Client-side idempotency for the atomic "Validar e vincular" action.
// Persists a single in-flight envelope carrying TWO independent command
// ids (link + decision) plus the desired link state and the decision, so
// a retry reuses the same command ids and the server-side idempotency
// converges (no duplicate revision, no duplicate decision).
//
// Mirrors the accepted decision-command lifecycle pattern. sessionStorage
// only; no Supabase, no RPC, no service-role.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  var STORAGE_KEY = 'RAVATEX_DOCUMENT_VALIDATION_PENDING_V1';
  var ENVELOPE_VERSION = 1;
  var DEFAULT_TTL_MS = 86400000;
  var UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  var VALID_STATES = { prepared: true, submitting: true, uncertain: true };

  function getStorage(options) {
    if (options && options.storage) return options.storage;
    try { return window.sessionStorage; } catch (_) {
      return {
        getItem: function () { throw new Error('storage_unavailable'); },
        setItem: function () { throw new Error('storage_unavailable'); },
        removeItem: function () { throw new Error('storage_unavailable'); },
      };
    }
  }
  function getCrypto(options) { return (options && options.crypto) || window.crypto; }
  function getNow(options) { return (options && typeof options.now === 'function') ? options.now() : Date.now(); }
  function getTTL(options) { return (options && typeof options.ttlMs === 'number') ? options.ttlMs : DEFAULT_TTL_MS; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function generateUUID(crypto) {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (crypto && typeof crypto.getRandomValues === 'function') {
      var buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      var hex = '';
      for (var i = 0; i < 16; i++) { var s = buf[i].toString(16); hex += s.length === 1 ? '0' + s : s; }
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }
    return null;
  }

  function normalizeOpIds(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var v = raw[i];
      if (typeof v === 'string' && /^[0-9]+$/.test(v.trim())) v = parseInt(v.trim(), 10);
      if (typeof v === 'number' && Number.isInteger(v) && v > 0 && out.indexOf(v) === -1) out.push(v);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function validateInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_input' };
    var documentId = typeof input.documentId === 'string' ? input.documentId.trim() : '';
    if (!documentId) return { ok: false, error: 'invalid_document_id' };
    if (input.decision !== 'accepted' && input.decision !== 'rejected') return { ok: false, error: 'invalid_decision' };
    var motivo = typeof input.motivo === 'string' ? input.motivo.trim() : '';
    if (input.decision === 'rejected') { if (!motivo) return { ok: false, error: 'motivo_required' }; }
    else { motivo = null; }
    var pedidoId = null;
    if (input.pedidoId !== null && input.pedidoId !== undefined && input.pedidoId !== '') {
      if (typeof input.pedidoId !== 'string' || !UUID_PATTERN.test(input.pedidoId)) return { ok: false, error: 'invalid_pedido_id' };
      pedidoId = input.pedidoId;
    }
    var expectedRev = null;
    if (input.expectedActiveRevisionId !== null && input.expectedActiveRevisionId !== undefined) {
      if (typeof input.expectedActiveRevisionId !== 'string' || !UUID_PATTERN.test(input.expectedActiveRevisionId)) return { ok: false, error: 'invalid_expected_active_revision_id' };
      expectedRev = input.expectedActiveRevisionId;
    }
    var expectedDec = null;
    if (input.expectedActiveDecisionId !== null && input.expectedActiveDecisionId !== undefined) {
      if (typeof input.expectedActiveDecisionId !== 'string' || !UUID_PATTERN.test(input.expectedActiveDecisionId)) return { ok: false, error: 'invalid_expected_active_decision_id' };
      expectedDec = input.expectedActiveDecisionId;
    }
    return {
      ok: true, documentId: documentId, decision: input.decision, motivo: motivo,
      pedidoId: pedidoId, opIds: normalizeOpIds(input.opIds),
      expectedActiveRevisionId: expectedRev, expectedActiveDecisionId: expectedDec,
    };
  }

  function samePayload(env, v) {
    return env.documentId === v.documentId &&
      env.decision === v.decision &&
      (env.motivo == null ? null : env.motivo) === (v.motivo == null ? null : v.motivo) &&
      (env.pedidoId || null) === (v.pedidoId || null) &&
      JSON.stringify(env.opIds || []) === JSON.stringify(v.opIds || []) &&
      (env.expectedActiveRevisionId || null) === (v.expectedActiveRevisionId || null) &&
      (env.expectedActiveDecisionId || null) === (v.expectedActiveDecisionId || null);
  }

  function readPending(options) {
    var storage = getStorage(options);
    var raw;
    try { raw = storage.getItem(STORAGE_KEY); } catch (_) { return { ok: false, error: 'storage_unavailable' }; }
    if (raw == null) return { ok: false, error: 'no_pending_command' };
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) { try { storage.removeItem(STORAGE_KEY); } catch (e) {} return { ok: false, error: 'invalid_storage_payload' }; }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== ENVELOPE_VERSION ||
        !UUID_PATTERN.test(parsed.linkCommandId || '') || !UUID_PATTERN.test(parsed.decisionCommandId || '') ||
        !VALID_STATES[parsed.state]) {
      try { storage.removeItem(STORAGE_KEY); } catch (e) {}
      return { ok: false, error: 'invalid_storage_payload' };
    }
    if (typeof parsed.expiresAt === 'number' && getNow(options) >= parsed.expiresAt) {
      try { storage.removeItem(STORAGE_KEY); } catch (e) {}
      return { ok: false, error: 'expired' };
    }
    return { ok: true, envelope: copy(parsed) };
  }

  function writePending(env, options) {
    var storage = getStorage(options);
    try { storage.setItem(STORAGE_KEY, JSON.stringify(env)); return { ok: true }; }
    catch (_) { return { ok: false, error: 'storage_unavailable' }; }
  }

  function removePending(options) {
    var storage = getStorage(options);
    try { storage.removeItem(STORAGE_KEY); return { ok: true }; }
    catch (_) { return { ok: false, error: 'storage_unavailable' }; }
  }

  function transition(commandId, fromStates, toState, options) {
    var r = readPending(options);
    if (!r.ok) return { ok: false, error: r.error };
    var env = r.envelope;
    if (env.linkCommandId !== commandId) return { ok: false, error: 'command_id_mismatch' };
    if (!fromStates[env.state]) return { ok: false, error: 'invalid_transition' };
    env.state = toState;
    var w = writePending(env, options);
    if (!w.ok) return w;
    return { ok: true, envelope: copy(env) };
  }

  ns.documentValidationCommand = {
    // Prepares (or idempotently reuses) the atomic envelope. Same normalized
    // payload -> reuse existing command ids (retry). Different payload ->
    // discard and mint fresh ids.
    prepareCommand: function prepareCommand(input, options) {
      options = options || {};
      var v = validateInput(input);
      if (!v.ok) return v;

      var pending = readPending(options);
      if (pending.ok && VALID_STATES[pending.envelope.state]) {
        if (samePayload(pending.envelope, v)) {
          return { ok: true, envelope: copy(pending.envelope), reused: true };
        }
        removePending(options);
      }

      var crypto = getCrypto(options);
      var linkId = generateUUID(crypto);
      var decisionId = generateUUID(crypto);
      if (!linkId || !decisionId || linkId === decisionId) {
        return { ok: false, error: 'crypto_unavailable' };
      }
      var now = getNow(options);
      var envelope = {
        version: ENVELOPE_VERSION,
        linkCommandId: linkId,
        decisionCommandId: decisionId,
        documentId: v.documentId,
        decision: v.decision,
        motivo: v.motivo,
        pedidoId: v.pedidoId,
        opIds: v.opIds,
        expectedActiveRevisionId: v.expectedActiveRevisionId,
        expectedActiveDecisionId: v.expectedActiveDecisionId,
        state: 'prepared',
        createdAt: now,
        expiresAt: now + getTTL(options),
      };
      var w = writePending(envelope, options);
      if (!w.ok) return w;
      return { ok: true, envelope: copy(envelope), reused: false };
    },

    getPendingCommand: function (options) { return readPending(options || {}); },
    markSubmitting: function (commandId, options) { return transition(commandId, { prepared: true, uncertain: true }, 'submitting', options || {}); },
    markUncertain: function (commandId, options) { return transition(commandId, { submitting: true }, 'uncertain', options || {}); },
    resolveCommand: function (commandId, options) {
      options = options || {};
      var r = readPending(options);
      if (!r.ok) return { ok: false, error: r.error };
      if (r.envelope.linkCommandId !== commandId) return { ok: false, error: 'command_id_mismatch' };
      return removePending(options);
    },
    discardBeforeSend: function (commandId, options) {
      options = options || {};
      var r = readPending(options);
      if (!r.ok) return { ok: false, error: r.error };
      if (r.envelope.linkCommandId !== commandId) return { ok: false, error: 'command_id_mismatch' };
      if (r.envelope.state !== 'prepared') return { ok: false, error: 'invalid_transition' };
      return removePending(options);
    },
    clearPendingCommand: function (options) { return removePending(options || {}); },
  };

  window.RAVATEX_DOCUMENTS = ns;
})(window);
