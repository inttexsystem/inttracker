// =====================================================================
// === ADMIN USUARIOS AUDIT READ MODEL (Camada 2 — A6.3) ================
// Pure, read-only projection of public.usuarios_eventos rows (db/60,
// db/61) for a SINGLE user into a display-ready audit trail.
//
// Source (attached by js/admin-usuarios-writes.js fetchUsuarioEventos):
//   events = [ {
//     id, tipo_evento, ator_id, payload, criado_em,
//     usuario_id, usuario_email, usuario_nome, usuario_tipo,
//     ator_email, ator_nome        // merged in by the writes module —
//                                  // this pure module never queries.
//   }, ... ]
//   | null | undefined            (read failed / not yet loaded — fail-closed)
//
// Contract (mirrors js/document-link-audit-read-model.js, G28-B8):
//   - Events are append-only, read-only here — no write, no mutation.
//   - Two write paths populate usuarios_eventos (db/60/db/61 design,
//     recorded canonically in PROJECT_STATE.md): the trigger records
//     perfil_alterado for direct-UPDATE admin edits; the five admin
//     Edge Functions (A6.2) record their own action explicitly
//     (usuario_criado/usuario_desativado/usuario_reativado/
//     senha_resetada/usuario_excluido). This model renders all of
//     them uniformly, plus a defensive fallback for any future/
//     unrecognized tipo_evento (never throws on an unknown value).
//   - usuario_id may be NULL (db/61: ON DELETE SET NULL, subject
//     profile permanently deleted) — the identity snapshot columns
//     (usuario_email/usuario_nome/usuario_tipo) keep the event
//     readable in that case; this model annotates it explicitly.
//
// States (explicit, never a silent "no history"):
//   loading      caller signalled data is still loading
//   unavailable  events source not available / read failed (fail-closed)
//   empty        events available, zero rows
//   available    one or more events
//
// No writes, no DOM, no network, no localStorage. Ordered newest-first
// (criado_em desc; ties by id desc).
// =====================================================================

(function (root) {
  'use strict';

  var AUDIT_STATE = {
    LOADING: 'loading',
    UNAVAILABLE: 'unavailable',
    EMPTY: 'empty',
    AVAILABLE: 'available',
  };

  // Icon key vocabulary consumed by js/screens/admin-usuarios-audit-panel.js
  // (icon markup/color choice lives there — this module only classifies).
  var ICON_KEY = {
    CREATED: 'created',
    DISABLED: 'disabled',
    REACTIVATED: 'reactivated',
    RESET: 'reset',
    EXCLUDED: 'excluded',
    CHANGED: 'changed',
    UNKNOWN: 'unknown',
  };

  var ACTION_LABEL = {
    usuario_criado: 'Usuário criado',
    usuario_desativado: 'Usuário desativado',
    usuario_reativado: 'Usuário reativado',
    senha_resetada: 'Senha resetada',
    usuario_excluido: 'Usuário excluído',
    perfil_alterado: 'Perfil alterado',
  };

  var ICON_KEY_BY_TIPO = {
    usuario_criado: ICON_KEY.CREATED,
    usuario_desativado: ICON_KEY.DISABLED,
    usuario_reativado: ICON_KEY.REACTIVATED,
    senha_resetada: ICON_KEY.RESET,
    usuario_excluido: ICON_KEY.EXCLUDED,
    perfil_alterado: ICON_KEY.CHANGED,
  };

  function asString(value) {
    return typeof value === 'string' ? value : null;
  }

  function boolLabel(value) {
    return value === true ? 'sim' : (value === false ? 'não' : String(value));
  }

  // Human-readable pt-BR phrase for one {campo: {de, para}} entry.
  function fieldChangePhrase(campo, change) {
    if (!change || typeof change !== 'object') return campo + ': ' + '?';
    var de = change.de;
    var para = change.para;
    if (typeof de === 'boolean' || typeof para === 'boolean') {
      return campo + ': ' + boolLabel(de) + ' → ' + boolLabel(para);
    }
    var deTxt = (de === null || de === undefined) ? '—' : String(de);
    var paraTxt = (para === null || para === undefined) ? '—' : String(para);
    return campo + ': ' + deTxt + ' → ' + paraTxt;
  }

  // Builds the detail line for one event, from tipo_evento + payload.
  // Never throws on a malformed/missing payload — falls back to a
  // generic label rather than a blank line.
  function detailLineFor(tipoEvento, payload) {
    var p = (payload && typeof payload === 'object') ? payload : {};
    switch (tipoEvento) {
      case 'perfil_alterado': {
        var keys = Object.keys(p);
        if (keys.length === 0) return 'alteração de perfil';
        return keys.map(function (k) { return fieldChangePhrase(k, p[k]); }).join('; ');
      }
      case 'usuario_criado': {
        var parts = [];
        if (p.tipo) parts.push('tipo: ' + p.tipo);
        if (p.fornecedor_id !== undefined && p.fornecedor_id !== null) parts.push('fornecedor #' + p.fornecedor_id);
        if (p.cliente_id !== undefined && p.cliente_id !== null) parts.push('cliente #' + p.cliente_id);
        return parts.length ? parts.join('; ') : 'perfil criado';
      }
      case 'usuario_desativado': {
        var d = [];
        if (p.ativo) d.push(fieldChangePhrase('ativo', p.ativo));
        else d.push('ativo: sim → não');
        if (p.motivo) d.push('motivo: ' + p.motivo);
        return d.join('; ');
      }
      case 'usuario_reativado':
        return p.ativo ? fieldChangePhrase('ativo', p.ativo) : 'ativo: não → sim';
      case 'senha_resetada':
        return 'senha temporária gerada';
      case 'usuario_excluido':
        return 'perfil excluído permanentemente';
      default:
        return 'evento não reconhecido (' + (tipoEvento || '—') + ')';
    }
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // dd/MM HH:mm, local time. Returns null on an unparseable timestamp
  // (caller renders a dash — never throws, never shows "Invalid Date").
  function formatTimestamp(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function actorLineFor(event) {
    var email = asString(event.ator_email);
    var nome = asString(event.ator_nome);
    if (!event.ator_id) return 'por sistema';
    if (nome && email) return 'por ' + nome + ' (' + email + ')';
    if (email) return 'por ' + email;
    return 'por administrador (perfil removido)';
  }

  function normalizeEvent(raw) {
    var tipoEvento = asString(raw && raw.tipo_evento) || 'desconhecido';
    var actionLabel = ACTION_LABEL[tipoEvento] || 'Evento desconhecido';
    var iconKey = ICON_KEY_BY_TIPO[tipoEvento] || ICON_KEY.UNKNOWN;
    var subjectOrphaned = !(raw && raw.usuario_id);
    return {
      id: (raw && raw.id) || null,
      tipoEvento: tipoEvento,
      actionLabel: actionLabel,
      iconKey: iconKey,
      actorLine: actorLineFor(raw || {}),
      detailLine: detailLineFor(tipoEvento, raw && raw.payload),
      timestampLabel: formatTimestamp(raw && raw.criado_em),
      criadoEm: asString(raw && raw.criado_em),
      // True when usuario_id is NULL (db/61 ON DELETE SET NULL — the
      // subject profile was permanently deleted after this event was
      // recorded). The identity snapshot (usuario_email/nome/tipo)
      // still describes who the event was about; not otherwise
      // surfaced by this module (the panel already knows the subject
      // it opened for) except as this flag, for defensive rendering.
      subjectOrphaned: subjectOrphaned,
    };
  }

  function orderEvents(records) {
    return records.slice().sort(function (a, b) {
      var ca = a.criadoEm || '';
      var cb = b.criadoEm || '';
      if (ca !== cb) return ca < cb ? 1 : -1;
      var ia = a.id || 0;
      var ib = b.id || 0;
      return ib - ia;
    });
  }

  // events: array of raw usuarios_eventos rows (already merged with
  // ator_email/ator_nome by fetchUsuarioEventos), or null/undefined
  // when unavailable. options.loading === true forces the loading
  // state regardless of `events`.
  function buildUsuarioAuditTrail(events, options) {
    if (options && options.loading === true) {
      return { state: AUDIT_STATE.LOADING, entries: [] };
    }

    if (!Array.isArray(events)) {
      return { state: AUDIT_STATE.UNAVAILABLE, entries: [] };
    }

    if (events.length === 0) {
      return { state: AUDIT_STATE.EMPTY, entries: [] };
    }

    var normalized = events.map(normalizeEvent);
    return { state: AUDIT_STATE.AVAILABLE, entries: orderEvents(normalized) };
  }

  var api = {
    buildUsuarioAuditTrail: buildUsuarioAuditTrail,
    constants: { AUDIT_STATE: AUDIT_STATE, ICON_KEY: ICON_KEY },
  };

  root.RAVATEX_ADMIN_USUARIOS_AUDIT = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
