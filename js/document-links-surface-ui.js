// =====================================================================
// === DOCUMENT LINKS SURFACE UI (G28-B7) ==============================
// Pure, dependency-injected DOM builders shared by the OP operational
// surfaces and the link timelines. Renders the CONFIRMED canonical linked
// documents produced by js/document-surface-links-read-model.js.
//
// Nothing here queries Supabase, writes, mutates state, or reads globals
// beyond the injected `el`/`svgEl`. Every builder takes a `deps` object:
//   deps.el(tag, attrs, ...children)  -> element factory (required)
//   deps.svgEl(svg)                   -> optional icon factory
//   deps.svgFile                      -> optional file icon markup
//   deps.openDoc(url)                 -> optional safe opener (window.open)
//
// The builders are DOM-shape agnostic: they work against the app `el` and
// against test mocks, so the OP/timeline surfaces are testable in isolation.
// =====================================================================

(function (window) {
  'use strict';

  var STATUS_LABEL = {
    accepted: 'Aceito',
    rejected: 'Rejeitado',
    pending: 'Pendente',
    assigned: 'Atribuido',
    unknown: 'Sem decisao',
  };

  function statusLabel(status) {
    return STATUS_LABEL[status] || (status ? String(status) : 'Sem decisao');
  }

  function verButton(deps, url) {
    var el = deps.el;
    return el('button', {
      type: 'button',
      style: 'display:inline-flex;align-items:center;gap:5px;background:#fff;color:var(--rv-color-accent);border:1px solid var(--rv-color-accent);border-radius:var(--rv-radius-control);padding:2px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;',
      onclick: function () { if (typeof deps.openDoc === 'function') deps.openDoc(url); },
    }, 'Ver');
  }

  function confirmedRow(deps, doc, opts) {
    var el = deps.el;
    var left = el('div', { style: 'display:flex;align-items:center;gap:7px;min-width:0;' },
      (deps.svgEl && deps.svgFile) ? deps.svgEl(deps.svgFile) : '',
      el('span', {
        style: 'font-size:12.5px;color:var(--rv-color-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      }, doc.filename_original || 'Documento'));

    var right = el('div', { style: 'display:flex;align-items:center;gap:6px;flex-shrink:0;' },
      el('span', {
        style: 'font-size:var(--rv-fs-micro);font-weight:700;color:#18794a;background:#e6f4ec;border-radius:var(--rv-radius-pill);padding:1px 7px;white-space:nowrap;',
      }, 'Vinculo confirmado'));

    right.appendChild(el('span', {
      style: 'font-size:var(--rv-fs-micro);font-weight:600;color:var(--rv-color-accent);background:var(--rv-color-subtle-bg);padding:1px 6px;border-radius:var(--rv-radius-pill);white-space:nowrap;',
    }, statusLabel(doc.status)));

    if (doc.drive_web_view_link) {
      right.appendChild(verButton(deps, doc.drive_web_view_link));
    } else {
      right.appendChild(el('span', { style: 'font-size:10.5px;color:#a2aab6;font-style:italic;' }, 'Link indisponivel'));
    }

    var metaParts = [];
    var badge = [doc.tipo_documento, doc.formato].filter(function (x) { return !!x; }).join(' · ');
    if (badge) metaParts.push(badge.toUpperCase());
    if (typeof doc.link_version === 'number') metaParts.push('Revisao v' + doc.link_version);
    if (opts && opts.showPedido && doc.pedido_id) metaParts.push('Pedido vinculado');

    var row = el('div', { style: 'padding:7px 0;border-top:1px solid var(--rv-color-line-100);' },
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;' }, left, right),
      el('div', { style: 'font-size:11px;color:#9aa2af;margin-top:2px;' }, metaParts.join(' · ')));

    if (doc.target_cancelled) {
      row.appendChild(el('div', {
        style: 'font-size:11px;color:var(--rv-color-danger);margin-top:1px;',
      }, 'Atencao: alvo vinculado esta cancelado.'));
    }
    return row;
  }

  function messageRow(deps, text) {
    return deps.el('div', { style: 'font-size:11.5px;color:#a2aab6;padding:3px 0;' }, text);
  }

  // Build the list of nodes for a canonical "Documentos vinculados" block from
  // a read-model result ({ state, confirmed }). Explicit loading/empty/
  // unavailable states — never a silent "no documents".
  function buildLinkedDocumentNodes(deps, result, opts) {
    opts = opts || {};
    var state = result && result.state;
    var nodes = [];
    if (state === 'available' && result.confirmed && result.confirmed.length > 0) {
      for (var i = 0; i < result.confirmed.length; i++) {
        nodes.push(confirmedRow(deps, result.confirmed[i], opts));
      }
      return { state: 'available', nodes: nodes };
    }
    if (state === 'empty') {
      nodes.push(messageRow(deps, opts.emptyText || 'Nenhum documento vinculado.'));
      return { state: 'empty', nodes: nodes };
    }
    if (state === 'loading') {
      nodes.push(messageRow(deps, 'Carregando vinculos de documentos...'));
      return { state: 'loading', nodes: nodes };
    }
    nodes.push(messageRow(deps, opts.unavailableText || 'Vinculos canonicos de documentos indisponiveis nesta sessao.'));
    return { state: state || 'unavailable', nodes: nodes };
  }

  var KIND_LABEL = {
    linked: 'Documento vinculado',
    replaced: 'Vinculo substituido',
    unlinked: 'Vinculo removido',
  };

  // Build canonical link timeline items from a read-model timeline result
  // ({ state, entries }). Rendered in the generic dot+line trilha shared by
  // the OP Historico surfaces. Confirmed entries are visibly distinct.
  function buildLinkTimelineNodes(deps, timeline, opts) {
    opts = opts || {};
    var el = deps.el;
    var nodes = [];
    var state = timeline && timeline.state;
    if (state !== 'available' || !timeline.entries || timeline.entries.length === 0) {
      if (state === 'empty') return { state: 'empty', nodes: [] };
      if (state === 'loading') return { state: 'loading', nodes: [] };
      // unavailable/invalid: explicit, fail-closed message (caller may skip).
      return { state: state || 'unavailable', nodes: [] };
    }
    timeline.entries.forEach(function (entry, idx) {
      var rev = entry.revision || {};
      var isLast = idx === timeline.entries.length - 1;
      var dotColor = entry.confirmed ? 'var(--rv-color-accent)' : '#cfd5de';
      var trilha = el('div', { style: 'display:flex;flex-direction:column;align-items:center;' },
        el('div', { style: 'width:9px;height:9px;border-radius:var(--rv-radius-pill);background:' + dotColor + ';margin-top:4px;flex-shrink:0;' }),
        isLast ? '' : el('div', { style: 'width:2px;flex:1;background:var(--rv-color-line-200);' }));
      var titleParts = [KIND_LABEL[entry.kind] || 'Documento vinculado'];
      if (typeof rev.version === 'number') titleParts.push('v' + rev.version);
      var conteudo = el('div', { style: 'padding-bottom:' + (isLast ? '0' : '14px') + ';min-width:0;' },
        el('div', { style: 'font-size:11.5px;color:#9aa2af;' }, rev.timestamp || ''),
        el('div', { style: 'font-size:13px;font-weight:600;color:var(--rv-color-title);margin-top:2px;' }, titleParts.join(' · ')),
        el('div', { style: 'font-size:12.5px;color:#7b8494;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' },
          rev.filename_original || rev.document_id || ''));
      if (rev.target_cancelled) {
        conteudo.appendChild(el('div', { style: 'font-size:11px;color:var(--rv-color-danger);margin-top:1px;' }, 'Alvo vinculado cancelado.'));
      }
      nodes.push(el('div', { style: 'display:flex;gap:12px;' }, trilha, conteudo));
    });
    return { state: 'available', nodes: nodes };
  }

  window.RAVATEX_DOCUMENT_LINKS_UI = {
    buildLinkedDocumentNodes: buildLinkedDocumentNodes,
    buildLinkTimelineNodes: buildLinkTimelineNodes,
    statusLabel: statusLabel,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.RAVATEX_DOCUMENT_LINKS_UI;
  }
})(typeof window !== 'undefined' ? window : this);
