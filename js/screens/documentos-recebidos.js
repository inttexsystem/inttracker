// =====================================================================
// === SCREENS: DOCUMENTOS RECEBIDOS ==================================
// Tela admin `#/documentos/recebidos` sobre o estado
// `window.RAVATEX_DOCUMENTS_RECEIVED`, populado manualmente via JSONL do
// Documents Ingestor. Mantem o contrato local/read-only: sem Supabase,
// sem rede, sem persistencia e sem consumir `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
// =====================================================================

(function (window) {
  'use strict';

  var TABLE_GRID = 'minmax(280px,1.7fr) minmax(190px,1.05fr) minmax(112px,.75fr) minmax(140px,.85fr) minmax(120px,.75fr) 148px';
  var TABLE_MIN_WIDTH = '1080px';
  var CARD = 'background:#fff;border:1px solid #eceef1;border-radius:6px;';
  var BTN_PRIMARY = 'height:34px;display:inline-flex;align-items:center;gap:7px;'
    + 'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:0 14px;'
    + 'font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;';
  var BTN_SECONDARY = 'height:34px;display:inline-flex;align-items:center;gap:7px;'
    + 'background:#fff;color:#5b6472;border:1px solid #d8dce2;border-radius:4px;'
    + 'padding:0 13px;font-weight:600;font-size:13px;font-family:inherit;'
    + 'cursor:pointer;white-space:nowrap;';
  var ICON_BUTTON = 'width:28px;height:28px;display:inline-flex;align-items:center;'
    + 'justify-content:center;border:1px solid #eceef1;border-radius:4px;'
    + 'background:#fff;color:#8a93a3;cursor:pointer;padding:0;flex-shrink:0;';

  var ui = {
    tab: 'todos',
    busca: '',
    tipo: 'todos',
    pedido: 'todos',
    periodo: 'todos',
    scanPlaying: false,
    refreshing: false,
    lastRun: null,
    statusOverrides: {},
    searchHasFocus: false,
    searchCursorPos: 0,
  };

  var FILE_TYPE_ICONS = [
    { extensions: ['pdf'], kind: 'pdf', icon: 'ti-file-type-pdf' },
    { extensions: ['xml'], kind: 'xml', icon: 'ti-file-type-xml' },
    { extensions: ['json', 'jsonl'], kind: 'json', icon: 'ti-json' },
    { extensions: ['csv'], kind: 'csv', icon: 'ti-file-type-csv' },
    { extensions: ['xls', 'xlsx'], kind: 'xls', icon: 'ti-file-type-xls' },
    { extensions: ['doc', 'docx'], kind: 'doc', icon: 'ti-file-type-doc' },
    { extensions: ['txt'], kind: 'txt', icon: 'ti-file-type-txt' },
    { extensions: ['png'], kind: 'png', icon: 'ti-file-type-png' },
    { extensions: ['jpg', 'jpeg'], kind: 'jpg', icon: 'ti-file-type-jpg' },
    { extensions: ['zip'], kind: 'zip', icon: 'ti-file-type-zip' },
  ];

  var SVG_REFRESH = '<polyline points="23 4 23 10 17 10"></polyline>'
    + '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>';
  var SVG_UPLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
    + '<polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>';
  var SVG_SEARCH = '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
  var SVG_MAIL = '<rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m2 7 10 6 10-6"></path>';
  var SVG_PLAY = '<polygon points="6 4 20 12 6 20 6 4"></polygon>';
  var SVG_PAUSE = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';
  var SVG_EYE = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
  var SVG_DOWNLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
    + '<polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';
  var SVG_CHECK = '<polyline points="20 6 9 17 4 12"></polyline>';
  var SVG_X = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
  var SVG_INBOX = '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>'
    + '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>';
  var SVG_CHEVRON = '<polyline points="6 9 12 15 18 9"></polyline>';

  function ensureStyles() {
    try {
      if (!document || !document.head || !document.createElement) return;
      if (document.getElementById && document.getElementById('rv-documents-screen-style')) return;
      var style = document.createElement('style');
      style.id = 'rv-documents-screen-style';
      style.textContent = '@keyframes rv-doc-spin{to{transform:rotate(360deg)}}'
        + '@keyframes rv-doc-ping{0%{transform:scale(1);opacity:.42}70%,100%{transform:scale(2.5);opacity:0}}';
      document.head.appendChild(style);
    } catch (_e) {
      // Visual enhancement only.
    }
  }

  function svgEl(inner, size, label, extraStyle) {
    var s = size || 14;
    var holder = document.createElement('span');
    if (typeof holder.innerHTML !== 'undefined') {
      holder.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none"'
        + ' stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'
        + ' style="display:block;flex-shrink:0;' + (extraStyle || '') + '">'
        + inner + '</svg>';
      return holder.firstChild || holder.firstElementChild;
    }
    return window.el('span', {
      'data-icon': label || 'svg',
      style: 'display:inline-flex;width:' + s + 'px;height:' + s + 'px;flex-shrink:0;' + (extraStyle || ''),
    });
  }

  function getReceived() {
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED === 'undefined') return [];
    var v = window.RAVATEX_DOCUMENTS_RECEIVED;
    return Array.isArray(v) ? v : [];
  }

  function normalizeKey(value) {
    var s = String(value == null ? '' : value).toLowerCase();
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s;
  }

  function extFromFilename(filename) {
    var m = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function inferFormato(doc, filename) {
    var f = doc && doc.formato ? String(doc.formato).toLowerCase() : '';
    if (f) return f;
    var ext = extFromFilename(filename);
    if (ext === 'jsonl') return 'json';
    return ext || 'desconhecido';
  }

  function fileTypeIconMeta(formato, filename) {
    var ext = extFromFilename(filename);
    var normalizedFormato = String(formato || '').toLowerCase();
    var candidates = [ext, normalizedFormato].filter(function (item) {
      return item && item !== 'desconhecido' && item !== 'unknown';
    });
    for (var i = 0; i < candidates.length; i += 1) {
      for (var j = 0; j < FILE_TYPE_ICONS.length; j += 1) {
        if (FILE_TYPE_ICONS[j].extensions.indexOf(candidates[i]) >= 0) return FILE_TYPE_ICONS[j];
      }
    }
    return { kind: 'file', icon: 'ti-file' };
  }

  function tablerIcon(iconClass, dataIcon, size, extraStyle) {
    return window.el('i', {
      class: 'ti ' + iconClass,
      'data-icon': dataIcon || iconClass,
      'aria-hidden': 'true',
      style: 'font-size:' + (size || 18) + 'px;line-height:1;display:inline-flex;'
        + 'align-items:center;justify-content:center;flex-shrink:0;' + (extraStyle || ''),
    });
  }

  function fileIcon(formato, filename) {
    var meta = fileTypeIconMeta(formato, filename);
    return tablerIcon(meta.icon, 'arquivo-' + meta.kind, 20, 'color:#8a93a3;');
  }

  function inferTipo(doc, filename) {
    var tipo = doc && doc.tipo_documento ? String(doc.tipo_documento).toLowerCase() : '';
    if (tipo === 'nfe') tipo = 'nf';
    if (tipo) return tipo;
    var name = normalizeKey(filename);
    if (name.indexOf('romaneio') >= 0) return 'romaneio';
    if (name.indexOf('nf') >= 0 || name.indexOf('nfe') >= 0) return 'nf';
    return 'desconhecido';
  }

  function inferDirecao(doc, filename) {
    var dir = doc && doc.direcao_nf ? String(doc.direcao_nf).toLowerCase() : '';
    if (dir) return dir;
    var name = normalizeKey(filename);
    if (name.indexOf('entrada') >= 0) return 'entrada';
    if (name.indexOf('saida') >= 0 || name.indexOf('saída') >= 0) return 'saida';
    return '';
  }

  function normalizeStatus(status) {
    var raw = String(status || '').toLowerCase();
    if (raw === 'pending' || raw === 'pendente' || raw === 'pending_app_acceptance' || !raw) return 'pending';
    if (raw === 'assigned' || raw === 'atrelado' || raw === 'vinculado') return 'assigned';
    if (raw === 'accepted' || raw === 'aceito') return 'accepted';
    if (raw === 'rejected' || raw === 'rejeitado') return 'rejected';
    return 'pending';
  }

  function statusMeta(status) {
    var map = {
      pending: { label: 'Pendente', bg: '#fff4e6', fg: '#c2610c', dot: '#e07b39' },
      assigned: { label: 'Atrelado', bg: '#eaf1fd', fg: '#2563eb', dot: '#2563eb' },
      accepted: { label: 'Aceito', bg: '#e6f4ec', fg: '#18794a', dot: '#18794a' },
      rejected: { label: 'Rejeitado', bg: '#fdecec', fg: '#d6403a', dot: '#d6403a' },
    };
    return map[status] || map.pending;
  }

  function tipoMeta(tipo) {
    var map = {
      nf: { label: 'NF-e', bg: '#eaf1fd', fg: '#2563eb' },
      romaneio: { label: 'Romaneio', bg: '#f3effd', fg: '#6a3db8' },
      desconhecido: { label: 'Desconhecido', bg: '#f1f3f6', fg: '#8a93a3' },
    };
    return map[tipo] || { label: tipo || 'Doc', bg: '#f1f3f6', fg: '#5b6472' };
  }

  function direcaoMeta(direcao) {
    if (direcao === 'entrada') return { label: 'Entrada', bg: '#e6f4ec', fg: '#18794a' };
    if (direcao === 'saida') return { label: 'Saida', bg: '#fdf0e6', fg: '#b65630' };
    return null;
  }

  function formatoMeta(formato) {
    if (formato === 'pdf') return { label: 'PDF', bg: '#fdeee6', fg: '#b65630' };
    if (formato === 'xml') return { label: 'XML', bg: '#e6f1fd', fg: '#2563eb' };
    if (formato === 'json') return { label: 'JSONL', bg: '#f1f3f6', fg: '#5b6472' };
    if (formato === 'desconhecido') return null;
    return formato ? { label: String(formato).toUpperCase(), bg: '#f1f3f6', fg: '#5b6472' } : null;
  }

  function fmtDataHoraCurta(isoOrDate) {
    if (!isoOrDate) return '-';
    try {
      var d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
      if (isNaN(d.getTime())) return '-';
      var day = String(d.getDate()).padStart(2, '0');
      var mon = String(d.getMonth() + 1).padStart(2, '0');
      var hour = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return day + '/' + mon + ' ' + hour + ':' + min;
    } catch (_e) {
      return String(isoOrDate).slice(0, 16);
    }
  }

  function fmtDataParts(iso) {
    var full = fmtDataHoraCurta(iso);
    if (full === '-') return { date: '-', time: '' };
    var parts = full.split(' ');
    return { date: parts[0] || full, time: parts[1] || '' };
  }

  function receivedAt(doc) {
    return doc && (doc.received_at || doc.created_at || doc.detected_at || doc.linked_at || doc.accepted_at || doc.rejected_at) || null;
  }

  function decorateDoc(doc, index) {
    var filename = doc && (doc.filename_original || doc.name || doc.filename) ? (doc.filename_original || doc.name || doc.filename) : 'Documento';
    var id = doc && (doc.document_id || doc.id) ? (doc.document_id || doc.id) : 'doc-' + index;
    var formato = inferFormato(doc, filename);
    var tipo = inferTipo(doc, filename);
    var direcao = inferDirecao(doc, filename);
    var status = ui.statusOverrides[id] || normalizeStatus(doc && doc.status);
    var when = receivedAt(doc);
    return {
      id: id,
      raw: doc || {},
      filename: filename,
      from: doc && (doc.gmail_from || doc.from || doc.sender || doc.email_from || doc.origem_email) || '',
      formato: formato,
      tipo: tipo,
      direcao: direcao,
      status: status,
      pedido: doc && (doc.pedido_manual || doc.pedido || doc.pedido_key) || '',
      when: when,
      driveId: doc && doc.drive_file_id ? doc.drive_file_id : '',
      driveLink: doc && doc.drive_web_view_link ? doc.drive_web_view_link : '',
      dateParts: fmtDataParts(when),
    };
  }

  function allDocs() {
    return getReceived().map(decorateDoc);
  }

  function matchesPeriod(doc) {
    if (ui.periodo === 'todos') return true;
    if (!doc.when) return false;
    var d = new Date(doc.when);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    if (ui.periodo === 'hoje') {
      return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    }
    var days = ui.periodo === '7d' ? 7 : 30;
    return (now.getTime() - d.getTime()) <= days * 24 * 60 * 60 * 1000;
  }

  function filteredDocs(docs) {
    var termo = normalizeKey(ui.busca);
    return docs.filter(function (doc) {
      if (ui.tab !== 'todos' && doc.status !== ui.tab) return false;
      if (ui.tipo !== 'todos' && doc.tipo !== ui.tipo) return false;
      if (ui.pedido !== 'todos' && (doc.pedido || '') !== ui.pedido) return false;
      if (!matchesPeriod(doc)) return false;
      if (termo) {
        var hay = normalizeKey([
          doc.filename,
          doc.pedido,
          doc.from,
          tipoMeta(doc.tipo).label,
          statusMeta(doc.status).label,
        ].join(' '));
        if (hay.indexOf(termo) === -1) return false;
      }
      return true;
    });
  }

  function countsByStatus(docs) {
    var c = { todos: docs.length, pending: 0, assigned: 0, accepted: 0, rejected: 0 };
    docs.forEach(function (doc) {
      if (c[doc.status] != null) c[doc.status]++;
    });
    return c;
  }

  function rerender() {
    if (typeof window.setApp !== 'function') return;
    window.setApp(screenDocumentosRecebidos());
  }

  function rerenderSoon(delay) {
    setTimeout(rerender, delay || 0);
  }

  function restoreSearchFocus() {
    if (!ui.searchHasFocus) return;
    try {
      if (!document.getElementById) return;
      var input = document.getElementById('rv-docs-search');
      if (!input || typeof input.focus !== 'function') return;
      input.focus();
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(ui.searchCursorPos, ui.searchCursorPos);
      }
    } catch (_e) {
      // Best effort only.
    }
  }

  function badge(meta) {
    return window.el('span', {
      style: 'display:inline-flex;align-items:center;border-radius:4px;padding:2px 8px;'
        + 'font-size:11px;font-weight:600;white-space:nowrap;background:' + meta.bg + ';color:' + meta.fg + ';',
    }, meta.label);
  }

  function statusPill(status) {
    var meta = statusMeta(status);
    return window.el('span', {
      'data-field': 'status',
      'data-status': status,
      style: 'display:inline-flex;align-items:center;gap:5px;border-radius:4px;padding:2px 8px;'
        + 'font-size:11.5px;font-weight:600;white-space:nowrap;background:' + meta.bg + ';color:' + meta.fg + ';',
    },
      window.el('span', {
        style: 'width:5px;height:5px;border-radius:50%;flex-shrink:0;background:' + meta.dot + ';',
      }),
      meta.label);
  }

  function pedidoCell(doc) {
    if (doc.pedido) {
      return window.el('span', {
        'data-field': 'pedido',
        'data-pedido': doc.pedido,
        style: 'font-size:12.5px;font-weight:700;color:#2563eb;white-space:nowrap;',
      }, doc.pedido);
    }
    return window.el('span', {
      'data-field': 'pedido',
      'data-pedido': '',
      style: 'font-size:12.5px;color:#aab2bf;font-style:italic;white-space:nowrap;',
    }, 'Não mapeado');
  }

  function driveDownloadLink(doc) {
    if (doc.driveId) return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(doc.driveId);
    var match = String(doc.driveLink || '').match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(match[1]);
    return doc.driveLink;
  }

  function iconButton(title, iconMarkup, onclick, extraStyle, attrs) {
    var buttonAttrs = {
      type: 'button',
      title: title,
      'aria-label': title,
      style: ICON_BUTTON + (extraStyle || ''),
      onclick: onclick,
    };
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { buttonAttrs[key] = attrs[key]; });
    }
    var btn = window.el('button', buttonAttrs);
    btn.appendChild(svgEl(iconMarkup, 14, title));
    btn.appendChild(window.el('span', {
      style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;',
    }, title));
    return btn;
  }

  function buildActionButtons(doc) {
    var wrap = window.el('div', {
      style: 'display:flex;align-items:center;justify-content:center;gap:6px;',
    });

    if (doc.driveLink) {
      wrap.appendChild(iconButton('Ver', SVG_EYE, function () {
        if (typeof window.open === 'function') {
          window.open(doc.driveLink, '_blank', 'noopener,noreferrer');
        }
      }, '', {
        'data-action': 'ver-documento-drive',
        'data-document-id': doc.id,
      }));
      wrap.appendChild(iconButton('Baixar', SVG_DOWNLOAD, function () {
        if (typeof window.open === 'function') {
          window.open(driveDownloadLink(doc), '_blank', 'noopener,noreferrer');
        }
      }, '', {
        'data-action': 'baixar-documento-drive',
        'data-document-id': doc.id,
      }));
    } else {
      wrap.appendChild(window.el('span', {
        'data-action': 'sem-link',
        'data-document-id': doc.id,
        style: 'color:#9aa2af;font-size:11.5px;font-style:italic;white-space:nowrap;',
      }, 'Sem link'));
    }

    if (doc.status === 'pending') {
      wrap.appendChild(iconButton('Rejeitar', SVG_X, function () {
        ui.statusOverrides[doc.id] = 'rejected';
        if (typeof window.toast === 'function') window.toast('Documento marcado como rejeitado nesta sessao.', 'info');
        rerender();
      }, 'color:#d6403a;border-color:#f0cfcd;', {
        'data-action': 'rejeitar-documento',
        'data-document-id': doc.id,
      }));
      wrap.appendChild(iconButton('Aceitar', SVG_CHECK, function () {
        ui.statusOverrides[doc.id] = 'accepted';
        if (typeof window.toast === 'function') window.toast('Documento marcado como aceito nesta sessao.', 'success');
        rerender();
      }, 'color:#18794a;border-color:#a7d8bd;', {
        'data-action': 'aceitar-documento',
        'data-document-id': doc.id,
      }));
    }

    return wrap;
  }

  function buildHeader() {
    var actions = window.el('div', {
      style: 'display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;',
    });

    var refreshBtn = window.el('button', {
      type: 'button',
      'data-action': 'atualizar-documentos',
      style: BTN_PRIMARY + (ui.refreshing ? 'opacity:.72;cursor:wait;' : ''),
      onclick: function () {
        if (ui.refreshing) return;
        ui.refreshing = true;
        ui.lastRun = new Date();
        rerender();
        setTimeout(function () {
          ui.refreshing = false;
          ui.lastRun = new Date();
          if (typeof window.toast === 'function') window.toast('Lista de documentos atualizada.', 'success');
          rerender();
        }, 900);
      },
    });
    refreshBtn.appendChild(svgEl(SVG_REFRESH, 14, 'Atualizar', ui.refreshing ? 'animation:rv-doc-spin .8s linear infinite;' : ''));
    refreshBtn.appendChild(document.createTextNode('Atualizar agora'));
    actions.appendChild(refreshBtn);

    var importWrap = window.el('div', {
      'data-section': 'documentos-recebidos-import-action',
      style: 'display:flex;align-items:center;gap:8px;',
    });
    if (window.RAVATEX_DOCUMENTS
        && typeof window.RAVATEX_DOCUMENTS.createReceivedImportButton === 'function') {
      var pair = window.RAVATEX_DOCUMENTS.createReceivedImportButton({
        buttonId: 'rv-docs-received-import-btn-inline',
      });
      pair.button.style.cssText = BTN_SECONDARY;
      pair.button.title = 'Selecionar JSONL exportado do Documents Ingestor';
      pair.button.textContent = '';
      pair.button.appendChild(svgEl(SVG_UPLOAD, 14, 'Importar documentos'));
      pair.button.appendChild(document.createTextNode('Importar documentos'));
      pair.fileInput.addEventListener('change', function () {
        ui.lastRun = new Date();
        rerenderSoon(80);
        rerenderSoon(260);
      });
      pair.mount(importWrap);
    } else {
      importWrap.appendChild(window.el('button', {
        type: 'button',
        disabled: 'disabled',
        style: BTN_SECONDARY + 'opacity:.65;cursor:not-allowed;',
      }, 'Importar documentos'));
    }
    actions.appendChild(importWrap);

    return window.el('div', { style: 'display:block;margin-bottom:12px;' },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:3px;',
      },
        window.el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;white-space:nowrap;' }, 'Documentos Mapeados'),
        actions),
      window.el('div', {
        style: 'font-size:13px;color:#8a93a3;line-height:1.45;white-space:nowrap;',
      }, 'Importe a lista gerada pelo Documents Ingestor para revisar documentos recebidos. '
        + 'A fila mostra documentos mapeados e é compatível com documentos-recebidos.jsonl '
        + 'e documentos-mapeados.jsonl.'));
  }

  function latestRunLabel(docs) {
    if (ui.lastRun) return fmtDataHoraCurta(ui.lastRun);
    var latest = null;
    docs.forEach(function (doc) {
      if (!doc.when) return;
      var d = new Date(doc.when);
      if (isNaN(d.getTime())) return;
      if (!latest || d.getTime() > latest.getTime()) latest = d;
    });
    return latest ? fmtDataHoraCurta(latest) : 'Aguardando import';
  }

  function buildScanStrip(docs) {
    var playBtn = window.el('button', {
      type: 'button',
      'data-action': 'toggle-varredura',
      title: ui.scanPlaying ? 'Pausar varredura' : 'Iniciar varredura',
      style: 'width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;'
        + 'background:transparent;border:none;color:#64748b;padding:0;cursor:pointer;flex-shrink:0;',
      onclick: function () {
        ui.scanPlaying = !ui.scanPlaying;
        rerender();
      },
    });
    playBtn.appendChild(svgEl(ui.scanPlaying ? SVG_PAUSE : SVG_PLAY, 14, 'play-pause'));

    var dot = window.el('span', {
      style: 'position:relative;display:inline-flex;width:8px;height:8px;flex-shrink:0;',
    },
      ui.scanPlaying ? window.el('span', {
        style: 'position:absolute;inset:0;border-radius:50%;background:#1e9e57;'
          + 'animation:rv-doc-ping 1.9s cubic-bezier(0,0,.2,1) infinite;',
      }) : null,
      window.el('span', {
        style: 'position:relative;width:8px;height:8px;border-radius:50%;background:'
          + (ui.scanPlaying ? '#1e9e57' : '#b6bdc8') + ';',
      }));

    var divider = function () {
      return window.el('span', { style: 'width:1px;height:16px;background:#e6e9ee;flex-shrink:0;' });
    };

    return window.el('div', {
      'data-section': 'documentos-scan-strip',
      style: CARD + 'min-height:34px;display:flex;align-items:center;gap:14px;'
        + 'padding:4px 10px;margin-bottom:12px;flex-wrap:wrap;',
    },
      window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:8px;font-size:13px;'
          + 'font-weight:600;color:#16203a;white-space:nowrap;',
      }, dot, 'Varredura ativa', playBtn),
      divider(),
      window.el('span', {
        style: 'font-size:13px;color:#8a93a3;white-space:nowrap;',
      }, 'Última execução ', window.el('span', {
        style: 'color:#3f4757;font-weight:500;',
      }, latestRunLabel(docs))),
      divider(),
      window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#8a93a3;white-space:nowrap;',
      }, 'Origem',
        window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:5px;background:#f6f7f9;'
            + 'border:1px solid #eceef1;border-radius:4px;padding:2px 8px;'
            + 'font-size:12px;font-weight:600;color:#3f4757;',
        }, svgEl(SVG_MAIL, 12, 'Gmail'), 'Gmail')));
  }

  function tabButton(key, label, count) {
    var active = ui.tab === key;
    return window.el('button', {
      type: 'button',
      'data-tab': key,
      style: 'display:inline-flex;align-items:center;gap:6px;border-radius:4px;'
        + 'padding:6px 12px;font-size:13px;cursor:pointer;white-space:nowrap;'
        + 'font-family:inherit;'
        + (active
          ? 'font-weight:600;border:1px solid #2563eb;background:#2563eb;color:#fff;'
          : 'font-weight:500;border:1px solid #d8dce2;background:#fff;color:#5b6472;'),
      onclick: function () {
        ui.tab = key;
        rerender();
      },
    },
      label,
      window.el('span', {
        style: 'border-radius:999px;padding:1px 7px;font-size:11px;font-weight:600;'
          + (active
            ? 'background:rgba(255,255,255,.24);color:#fff;'
            : 'background:#f1f3f6;color:#8a93a3;'),
      }, String(count)));
  }

  function buildSearchTabs(docs) {
    var counts = countsByStatus(docs);
    var searchBox = window.el('div', {
      style: 'flex:1;min-width:260px;display:flex;align-items:center;gap:8px;'
        + 'background:#fff;border:1px solid #d8dce2;border-radius:4px;padding:7px 13px;',
    }, svgEl(SVG_SEARCH, 14, 'Buscar', 'color:#9aa2af;'));

    var input = window.el('input', {
      id: 'rv-docs-search',
      type: 'text',
      placeholder: 'Buscar por nome do arquivo ou pedido...',
      style: 'border:none;outline:none;background:transparent;flex:1;min-width:0;'
        + 'font-size:13px;color:#16203a;font-family:inherit;',
    });
    input.value = ui.busca;
    input.addEventListener('focus', function () { ui.searchHasFocus = true; });
    input.addEventListener('blur', function () { ui.searchHasFocus = false; });
    input.addEventListener('input', function () {
      ui.busca = input.value;
      ui.searchCursorPos = input.selectionStart || 0;
      rerender();
    });
    searchBox.appendChild(input);

    var tabs = window.el('div', {
      style: 'display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;',
    },
      tabButton('todos', 'Todos', counts.todos),
      tabButton('pending', 'Pendentes', counts.pending),
      tabButton('assigned', 'Atrelados', counts.assigned),
      tabButton('accepted', 'Aceitos', counts.accepted),
      tabButton('rejected', 'Rejeitados', counts.rejected));

    return window.el('div', {
      style: 'display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;',
    }, searchBox, tabs);
  }

  function optionNode(value, label, selected) {
    var opt = window.el('option', { value: value }, label);
    if (selected) opt.selected = true;
    return opt;
  }

  function selectControl(label, value, options, onChange) {
    var sel = window.el('select', {
      style: 'width:100%;border:none;outline:none;background:transparent;color:#16203a;'
        + 'font-size:13px;font-family:inherit;font-weight:500;appearance:none;'
        + '-webkit-appearance:none;-moz-appearance:none;cursor:pointer;',
    });
    options.forEach(function (opt) {
      sel.appendChild(optionNode(opt.value, opt.label, opt.value === value));
    });
    sel.value = value;
    sel.addEventListener('change', function () {
      onChange(sel.value);
      rerender();
    });

    return window.el('label', {
      style: 'flex:1;min-width:150px;background:#fff;border:1px solid #d8dce2;'
        + 'border-radius:4px;padding:6px 10px;display:flex;align-items:center;'
        + 'justify-content:space-between;gap:8px;cursor:pointer;',
    },
      window.el('span', { style: 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;' },
        window.el('span', { style: 'font-size:10.5px;font-weight:700;color:#8a93a3;' }, label),
        sel),
      svgEl(SVG_CHEVRON, 13, 'Abrir filtro', 'color:#9aa2af;'));
  }

  function uniquePedidos(docs) {
    var seen = {};
    var out = [];
    docs.forEach(function (doc) {
      if (!doc.pedido || seen[doc.pedido]) return;
      seen[doc.pedido] = true;
      out.push({ value: doc.pedido, label: doc.pedido });
    });
    return out;
  }

  function buildFilters(docs) {
    var tipoOptions = [
      { value: 'todos', label: 'Todos os tipos' },
      { value: 'nf', label: 'NF-e' },
      { value: 'romaneio', label: 'Romaneio' },
      { value: 'desconhecido', label: 'Desconhecido' },
    ];
    var pedidoOptions = [{ value: 'todos', label: 'Todos' }].concat(uniquePedidos(docs));
    var periodoOptions = [
      { value: 'todos', label: 'Todos os periodos' },
      { value: 'hoje', label: 'Hoje' },
      { value: '7d', label: 'Ultimos 7 dias' },
      { value: '30d', label: 'Ultimos 30 dias' },
    ];

    return window.el('div', {
      style: 'display:flex;align-items:stretch;gap:8px;margin-bottom:16px;flex-wrap:wrap;',
    },
      selectControl('Tipo', ui.tipo, tipoOptions, function (v) { ui.tipo = v; }),
      selectControl('Pedido', ui.pedido, pedidoOptions, function (v) { ui.pedido = v; }),
      selectControl('Recebido em', ui.periodo, periodoOptions, function (v) { ui.periodo = v; }),
      window.el('button', {
        type: 'button',
        'data-action': 'limpar-filtros',
        style: BTN_SECONDARY + 'height:auto;min-height:49px;align-self:stretch;',
        onclick: function () {
          ui.busca = '';
          ui.tipo = 'todos';
          ui.pedido = 'todos';
          ui.periodo = 'todos';
          ui.tab = 'todos';
          rerender();
        },
      }, 'Limpar', svgEl(SVG_X, 13, 'Limpar')));
  }

  function buildColumnsLegend() {
    function head(label, align) {
      return window.el('div', {
        style: 'font-size:11px;font-weight:700;color:#8a93a3;letter-spacing:.04em;'
          + 'text-transform:uppercase;' + (align ? 'text-align:' + align + ';' : ''),
      }, label.toUpperCase());
    }
    return window.el('div', {
      'data-section': 'documentos-recebidos-columns',
      style: 'display:grid;grid-template-columns:' + TABLE_GRID + ';align-items:center;'
        + 'gap:12px;padding:9px 16px;background:#f8f9fb;border-bottom:1px solid #eceef1;',
    },
      head('Documento'),
      head('Tipo'),
      head('Status'),
      head('Pedido'),
      head('Recebido em'),
      head('Ações', 'center'));
  }

  function buildDocumentRow(doc, isLast) {
    var badges = window.el('div', {
      style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;',
    });
    badges.appendChild(badge(tipoMeta(doc.tipo)));
    var dir = direcaoMeta(doc.direcao);
    if (dir) badges.appendChild(badge(dir));
    var fmt = formatoMeta(doc.formato);
    if (fmt) badges.appendChild(badge(fmt));

    var nameBlock = window.el('div', { style: 'min-width:0;' },
      window.el('div', {
        style: 'font-size:13.5px;font-weight:600;color:#16203a;white-space:nowrap;'
          + 'overflow:hidden;text-overflow:ellipsis;',
      }, doc.filename));
    if (doc.from) {
      nameBlock.appendChild(window.el('div', {
        style: 'font-size:11px;color:#9aa2af;margin-top:1px;white-space:nowrap;'
          + 'overflow:hidden;text-overflow:ellipsis;',
      }, 'de ' + doc.from));
    }

    return window.el('div', {
      'data-document-id': doc.id,
      'data-row': 'documento-recebido',
      style: 'display:grid;grid-template-columns:' + TABLE_GRID + ';align-items:center;'
        + 'gap:12px;padding:10px 16px;border-bottom:' + (isLast ? 'none' : '1px solid #f1f3f6') + ';',
    },
      window.el('div', { style: 'display:flex;align-items:center;gap:10px;min-width:0;' },
        fileIcon(doc.formato, doc.filename),
        nameBlock),
      badges,
      window.el('div', {}, statusPill(doc.status)),
      window.el('div', {
        style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      }, pedidoCell(doc)),
      window.el('div', {
        'data-field': 'recebido-em',
        style: 'white-space:nowrap;',
      },
        window.el('span', {
          style: 'font-size:12.5px;color:#5b6472;font-weight:500;',
        }, doc.dateParts.date),
        doc.dateParts.time ? window.el('span', {
          style: 'font-size:11.5px;color:#9aa2af;',
        }, ' ' + doc.dateParts.time) : null),
      buildActionButtons(doc));
  }

  function buildEmptyState(total) {
    return window.el('div', {
      style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'gap:9px;padding:52px 18px;text-align:center;',
    },
      window.el('div', {
        style: 'width:46px;height:46px;border-radius:50%;background:#f1f3f6;'
          + 'display:flex;align-items:center;justify-content:center;color:#b6bdc8;',
      }, svgEl(SVG_INBOX, 22, 'Documentos')),
      window.el('div', {
        style: 'font-size:14px;font-weight:600;color:#5b6472;',
      }, total ? 'Nenhum documento neste filtro' : 'Nenhum documento recebido'),
      window.el('div', {
        style: 'font-size:13px;color:#9aa2af;',
      }, total ? 'Ajuste os filtros ou aguarde a próxima varredura.'
        : 'Use o botão Importar documentos acima para carregar o export do Documents Ingestor.'));
  }

  function buildTable(docs, visible) {
    var inner = window.el('div', { style: 'min-width:' + TABLE_MIN_WIDTH + ';' });
    inner.appendChild(buildColumnsLegend());
    if (!visible.length) {
      inner.appendChild(buildEmptyState(docs.length));
    } else {
      visible.forEach(function (doc, index) {
        inner.appendChild(buildDocumentRow(doc, index === visible.length - 1));
      });
    }

    return window.el('div', {
      style: CARD + 'overflow:hidden;',
    },
      window.el('div', { style: 'overflow-x:auto;' }, inner),
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;'
          + 'padding:12px 18px;border-top:1px solid #eceef1;flex-wrap:wrap;',
      },
        window.el('span', {
          style: 'font-size:13px;color:#9aa2af;',
        }, 'Mostrando ' + visible.length + ' de ' + docs.length + ' documento' + (docs.length === 1 ? '' : 's')),
        window.el('span', {
          style: 'font-size:12.5px;color:#b6bdc8;',
        }, 'Sincronizado via Documents Ingestor')));
  }

  function screenDocumentosRecebidos() {
    ensureStyles();
    var container = window.el('div', {});
    var docs = allDocs();
    var visible = filteredDocs(docs);

    var page = window.el('div', { style: 'width:100%;max-width:1600px;margin:0 auto;' });
    page.appendChild(buildHeader());
    page.appendChild(buildScanStrip(docs));
    page.appendChild(buildSearchTabs(docs));
    page.appendChild(buildFilters(docs));
    page.appendChild(buildTable(docs, visible));

    container.appendChild(page);
    setTimeout(restoreSearchFocus, 0);
    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.documentosRecebidos = {
    screenDocumentosRecebidos: screenDocumentosRecebidos,
  };
  window.screenDocumentosRecebidos = screenDocumentosRecebidos;
})(window);
