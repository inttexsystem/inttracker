// =====================================================================
// === ADMIN USUARIOS AUDIT PANEL (Camada 2 — A6.3) ======================
// Read-only render for the user audit trail (public.usuarios_eventos,
// db/60/db/61), inside the edit-user modal only (js/screens/
// admin-usuarios-modal.js openUsuarioModal, isEdit branch — no history
// exists yet on create).
//
// Approved mockup (architect, 2026-07-17): panel below a divider in
// the edit modal; one row per event — icon, action label, actor +
// detail line, timestamp; a discreet "somente leitura" label; §7.1
// truncation on the detail line. Shows the 5 most recent events; if
// more exist, a "ver todos" toggle expands a max-height (~280px)
// scrollable list — no pagination, no modal-in-modal.
//
// Failure semantics: a panel load failure must never break the modal.
// On fetch error, renders a discreet "Histórico indisponível" message
// in place of the panel body; the rest of the form (fields, save)
// stays fully usable regardless.
//
// Carregar via <script src="js/screens/admin-usuarios-audit-panel.js"></script>
// no <head>, DEPOIS de js/admin-usuarios-audit-read-model.js e
// js/admin-usuarios-writes.js, ANTES de js/screens/admin-usuarios-modal.js.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.el / window.truncatedCell / window.TRUNCATE_CELL_STYLE (js/ui.js)
//   - window.RAVATEX_ADMIN_USUARIOS_AUDIT (js/admin-usuarios-audit-read-model.js)
//   - window.RAVATEX_ADMIN_USUARIOS_WRITES.fetchUsuarioEventos
//
// Pure read-only: no write, no window.supa call other than the fetch
// already exposed by admin-usuarios-writes.js.
// =====================================================================

(function (window) {
  'use strict';

  var VISIBLE_LIMIT = 5;
  var FETCH_LIMIT = 50;
  var EXPANDED_MAX_HEIGHT = '280px';

  function svgIcon(markup) {
    var tmp = document.createElement('div');
    tmp.innerHTML = markup.trim();
    return tmp.firstChild;
  }

  // Icon vocabulary — local to this module (same precedent as
  // js/screens/admin-usuarios.js's own local svgIcon/ICON_* constants;
  // screen modules are IIFEs that do not expose internals to window.*,
  // per admin-usuarios-modal.js's header comment). Colors per the
  // approved mockup: green for created, red for disabled; refresh/key
  // neutral. usuario_excluido (trash) and perfil_alterado (pencil) are
  // not named in the mockup's four called-out examples, but the panel
  // must render all six possible tipo_evento values without ever
  // throwing — reuses the same trash/pencil icons already established
  // for those actions elsewhere in this screen (admin-usuarios.js).
  var ICON_MARKUP = {
    created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18794a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="16" y1="11" x2="22" y2="11"></line></svg>',
    disabled: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d6403a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M5.7 5.7l12.6 12.6"></path></svg>',
    reactivated: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
    reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
    excluded: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d6403a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
    changed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path></svg>',
    unknown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a93a3" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="13"></line><circle cx="12" cy="16.5" r="0.6" fill="#8a93a3"></circle></svg>',
  };

  function iconFor(iconKey) {
    var markup = ICON_MARKUP[iconKey] || ICON_MARKUP.unknown;
    return svgIcon(markup);
  }

  function eventRow(entry) {
    var iconCol = window.el('div', {
      style: 'flex:0 0 auto; width:16px; height:16px; display:flex; align-items:center; justify-content:center;',
    });
    var icon = iconFor(entry.iconKey);
    if (icon) iconCol.appendChild(icon);

    var actionLine = window.el('div', {
      style: 'font-size:13px; font-weight:600; color:#1f2937; line-height:1.35;',
    }, entry.actionLabel);

    var detailText = entry.actorLine + (entry.detailLine ? ' — ' + entry.detailLine : '');
    var detailEl = window.truncatedCell(detailText, detailText, 'font-size:12px; color:#5b6472; line-height:1.35;');
    if (entry.subjectOrphaned) {
      var orphanNote = window.el('span', {
        style: 'font-size:11px; color:#b06a6a; margin-left:6px;',
        title: 'O perfil deste usuário foi excluído; este evento sobrevive apenas com o registro de identidade.',
      }, '(perfil removido)');
      detailEl.appendChild(orphanNote);
    }

    var textCol = window.el('div', {
      style: 'flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px;',
    }, actionLine, detailEl);

    var timeCol = window.el('div', {
      style: 'flex:0 0 auto; font-size:11px; color:#9aa2af; white-space:nowrap; padding-top:1px;',
    }, entry.timestampLabel || '—');

    return window.el('div', {
      style: 'display:flex; align-items:flex-start; gap:10px; padding:8px 0; border-bottom:1px solid #f1f3f6;',
      'data-audit-row': entry.tipoEvento,
    }, iconCol, textCol, timeCol);
  }

  function emptyState() {
    return window.el('p', {
      style: 'margin:6px 0 0; font-size:12.5px; color:#9aa2af; font-style:italic;',
    }, 'Nenhum evento registrado');
  }

  function unavailableState() {
    return window.el('p', {
      style: 'margin:6px 0 0; font-size:12.5px; color:#9aa2af; font-style:italic;',
    }, 'Histórico indisponível');
  }

  function loadingState() {
    return window.el('p', {
      style: 'margin:6px 0 0; font-size:12.5px; color:#9aa2af;',
    }, 'Carregando histórico…');
  }

  function header(count) {
    var title = window.el('span', {
      style: 'font-size:13px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:#5b6472;',
    }, 'Histórico');
    var badge = window.el('span', {
      style: 'font-size:11px; font-weight:700; color:#8a93a3; background:#f1f3f6; border-radius:10px; padding:1px 8px;',
    }, String(count));
    var readonly = window.el('span', {
      style: 'font-size:11px; color:#9aa2af; font-style:italic;',
    }, 'somente leitura');
    return window.el('div', {
      style: 'display:flex; align-items:center; gap:8px; margin-bottom:6px;',
    }, title, badge, readonly);
  }

  function buildBody(entries) {
    var body = window.el('div', {});
    var visible = entries.slice(0, VISIBLE_LIMIT);
    var rest = entries.slice(VISIBLE_LIMIT);

    var list = window.el('div', {});
    visible.forEach(function (entry) { list.appendChild(eventRow(entry)); });
    body.appendChild(list);

    if (rest.length > 0) {
      var expandedList = window.el('div', {
        style: 'display:none; max-height:' + EXPANDED_MAX_HEIGHT + '; overflow-y:auto;',
      });
      rest.forEach(function (entry) { expandedList.appendChild(eventRow(entry)); });
      body.appendChild(expandedList);

      var toggle = window.el('button', {
        type: 'button',
        style: 'margin-top:8px; padding:0; border:none; background:none; color:#2563eb; font-size:12.5px; font-weight:600; font-family:inherit; cursor:pointer;',
        onclick: function () {
          var expanded = expandedList.style.display !== 'none';
          expandedList.style.display = expanded ? 'none' : 'block';
          toggle.textContent = expanded ? 'ver todos (' + rest.length + ' mais)' : 'ver menos';
        },
      }, 'ver todos (' + rest.length + ' mais)');
      body.appendChild(toggle);
    }

    return body;
  }

  // Returns a DOM element (divider + header + async-loaded body). The
  // element is returned immediately (empty/loading), then populated
  // once the fetch resolves — matches the modal's synchronous
  // body-assembly pattern (js/screens/admin-usuarios-modal.js
  // openUsuarioModal builds `body` synchronously and appends it).
  function renderUsuarioAuditPanel(userId) {
    var W = window.RAVATEX_ADMIN_USUARIOS_WRITES;
    var readModel = window.RAVATEX_ADMIN_USUARIOS_AUDIT;

    var divider = window.el('div', {
      style: 'border-top:1px solid #edf1f5; margin:6px 0 2px;',
    });

    var bodySlot = window.el('div', { style: 'min-height:20px;' }, loadingState());

    var wrap = window.el('div', {
      style: 'display:flex; flex-direction:column; gap:2px;',
    }, header(0), bodySlot);

    var container = window.el('div', {}, divider, wrap);

    if (!W || typeof W.fetchUsuarioEventos !== 'function' || !readModel || typeof readModel.buildUsuarioAuditTrail !== 'function') {
      replaceBody(wrap, bodySlot, 0, unavailableState());
      return container;
    }

    W.fetchUsuarioEventos(userId, FETCH_LIMIT).then(function (res) {
      if (res && res.error) {
        console.error('admin-usuarios-audit-panel: fetchUsuarioEventos falhou', res.error);
        replaceBody(wrap, bodySlot, 0, unavailableState());
        return;
      }
      var trail = readModel.buildUsuarioAuditTrail(res && res.data);
      if (trail.state === readModel.constants.AUDIT_STATE.EMPTY) {
        replaceBody(wrap, bodySlot, 0, emptyState());
      } else if (trail.state === readModel.constants.AUDIT_STATE.AVAILABLE) {
        replaceBody(wrap, bodySlot, trail.entries.length, buildBody(trail.entries));
      } else {
        replaceBody(wrap, bodySlot, 0, unavailableState());
      }
    }).catch(function (err) {
      console.error('admin-usuarios-audit-panel: falha inesperada ao carregar histórico', err);
      replaceBody(wrap, bodySlot, 0, unavailableState());
    });

    return container;
  }

  // Swaps the header count + body content in place, preserving the
  // outer wrap/divider structure already appended to the modal DOM.
  function replaceBody(wrap, bodySlot, count, newBodyContent) {
    var newHeader = header(count);
    if (wrap.firstChild) wrap.replaceChild(newHeader, wrap.firstChild);
    if (typeof bodySlot.replaceChildren === 'function') bodySlot.replaceChildren();
    else bodySlot.innerHTML = '';
    bodySlot.appendChild(newBodyContent);
  }

  window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL = window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL || {};
  window.RAVATEX_ADMIN_USUARIOS_AUDIT_PANEL.renderUsuarioAuditPanel = renderUsuarioAuditPanel;
})(window);
