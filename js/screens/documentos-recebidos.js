// =====================================================================
// === SCREENS: DOCUMENTOS RECEBIDOS ==================================
// Tela admin `#/documentos/recebidos` sobre o estado
// `window.RAVATEX_DOCUMENTS_RECEIVED`, populado manualmente via JSONL do
// Documents Ingestor. Mantem o contrato local/read-only: sem Supabase,
// sem rede, sem persistencia do array de documentos e sem consumir
// `RAVATEX_DOCUMENTS_LOADED_EVENTS`.
//
// G16-B: exibe metadata do ultimo import (localStorage) em card
// discreto abaixo do header. O array de documentos continua volatil.
// =====================================================================

(function (window) {
  'use strict';

  var TABLE_GRID = 'minmax(260px,1.45fr) minmax(175px,.9fr) minmax(112px,.7fr) minmax(130px,.75fr) minmax(270px,1.45fr) 148px';
  var TABLE_MIN_WIDTH = '1180px';
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
    collectionSource: 'all',
    technicalEvidence: 'all',
    scanPlaying: true,
    refreshing: false,
    lastRun: null,
    statusOverrides: {},
    mappedTypes: {},
    searchHasFocus: false,
    searchCursorPos: 0,
    autoLoadAttempted: false,
    autoLoadRunning: false,
    sourceLoadAttempted: false,
    sourceLoadRunning: false,
    scanRequest: null,
    scanFeedback: null,
    scanHydrationAttempted: false,
    logoutWrapped: false,
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

  var MAPPED_SCAN_TYPES = [
    { key: 'pdf', label: 'PDF' },
    { key: 'xml', label: 'XML' },
    { key: 'json', label: 'JSON' },
    { key: 'csv', label: 'CSV' },
    { key: 'xls', label: 'XLS' },
    { key: 'doc', label: 'DOC' },
    { key: 'txt', label: 'TXT' },
    { key: 'png', label: 'PNG' },
    { key: 'jpg', label: 'JPG' },
    { key: 'zip', label: 'ZIP' },
  ];

  var SVG_REFRESH = '<polyline points="23 4 23 10 17 10"></polyline>'
    + '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>';
  var SVG_UPLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
    + '<polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>';
  var SVG_SEARCH = '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
  var SVG_MAIL = '<rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m2 7 10 6 10-6"></path>';
  var SVG_EYE = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
  var SVG_DOWNLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
    + '<polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';
  var SVG_CHECK = '<polyline points="20 6 9 17 4 12"></polyline>';
  var SVG_X = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
  var SVG_UNDO = '<path d="M9 14 4 9l5-5"></path><path d="M4 9h10a6 6 0 0 1 0 12h-1"></path>';
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

  function lucideEl(name, inner, size, extraStyle) {
    var s = size || 14;
    var holder = document.createElement('span');
    if (typeof holder.innerHTML !== 'undefined') {
      holder.innerHTML = '<svg class="lucide lucide-' + name + '" data-icon="lucide-' + name + '"'
        + ' width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none"'
        + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
        + ' style="display:block;flex-shrink:0;' + (extraStyle || '') + '">'
        + inner + '</svg>';
      return holder.firstChild || holder.firstElementChild;
    }
    return window.el('span', {
      class: 'lucide lucide-' + name,
      'data-icon': 'lucide-' + name,
      style: 'display:inline-flex;width:' + s + 'px;height:' + s + 'px;flex-shrink:0;' + (extraStyle || ''),
    });
  }

  function getQueueUI() {
    var ns = window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI;
    if (!ns || typeof ns.buildQueue !== 'function' || typeof ns.filterQueue !== 'function') {
      return null;
    }
    return ns;
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

  function emailReceivedAt(doc) {
    return doc && doc.email_received_at || null;
  }

  function processedAt(doc) {
    return doc && (doc.created_at || doc.detected_at || doc.linked_at || doc.accepted_at || doc.rejected_at) || null;
  }

  function decorateDoc(doc, index) {
    var filename = doc && (doc.filename_original || doc.name || doc.filename) ? (doc.filename_original || doc.name || doc.filename) : 'Documento';
    var hasRealId = doc && typeof doc.document_id === 'string' && doc.document_id.length >= 32 && doc.document_id.indexOf('-') >= 0;
    var id = doc && (doc.document_id || doc.id) ? (doc.document_id || doc.id) : 'doc-' + index;
    var formato = inferFormato(doc, filename);
    var tipo = inferTipo(doc, filename);
    var direcao = inferDirecao(doc, filename);
    var isSupabaseSource = !!(doc && doc._ravatex_source === 'supabase');
    var canUndoCloudDecision = !!(doc && doc._ravatex_can_undo_server_decision === true);
    var effective = hasRealId && typeof window.RAVATEX_DOCUMENTS !== 'undefined'
      && typeof window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus === 'function'
      ? window.RAVATEX_DOCUMENTS.getEffectiveDocumentStatus(doc) : null;
    var importedStatus = normalizeStatus(doc && doc.status);
    var status = effective ? effective.effectiveStatus : (ui.statusOverrides[id] || importedStatus);
    var hasLocalDecision = effective ? effective.isLocalDecision : false;
    var isDivergent = effective ? effective.isDivergent : false;
    var emailWhen = emailReceivedAt(doc);
    var processedWhen = processedAt(doc);
    return {
      id: id,
      hasRealId: hasRealId,
      raw: doc || {},
      filename: filename,
      from: doc && (doc.sender_email || doc.gmail_from || doc.from || doc.sender || doc.email_from || doc.origem_email) || '',
      formato: formato,
      tipo: tipo,
      direcao: direcao,
      status: status,
      importedStatus: importedStatus,
      hasLocalDecision: hasLocalDecision,
      isDivergent: isDivergent,
      isSupabaseSource: isSupabaseSource,
      canUndoCloudDecision: canUndoCloudDecision,
      pedido: doc && (doc.pedido_manual || doc.pedido || doc.pedido_key) || '',
      emailReceivedAt: emailWhen,
      processedAt: processedWhen,
      temporalBase: emailWhen ? 'email_received' : 'processed_legacy',
      driveId: doc && doc.drive_file_id ? doc.drive_file_id : '',
      driveLink: doc && doc.drive_web_view_link ? doc.drive_web_view_link : '',
      emailDateParts: fmtDataParts(emailWhen),
      processedDateParts: fmtDataParts(processedWhen),
    };
  }

  function allDocs() {
    var received = getReceived();
    var docs = received.map(decorateDoc);
    var queueUI = getQueueUI();
    if (queueUI) {
      var entries = queueUI.buildQueue();
      var byIndex = {};
      entries.forEach(function (entry) {
        if (entry && typeof entry.index === 'number') byIndex[entry.index] = entry;
      });
      docs.forEach(function (doc, index) {
        doc._queueIndex = index;
        var entry = byIndex[index];
        if (entry) doc.queueItem = entry.queueItem;
      });
    }
    return docs;
  }

  function matchesPeriod(doc) {
    if (ui.periodo === 'todos') return true;
    var d = new Date(doc.emailReceivedAt || doc.processedAt);
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
    var queueUI = getQueueUI();
    if (queueUI && docs.length > 0 && docs[0].queueItem) {
      var entries = docs.map(function (doc) {
        return { index: doc._queueIndex, queueItem: doc.queueItem, raw: null };
      });
      var result = queueUI.filterQueue(entries, {
        search: ui.busca,
        status: ui.tab,
        tipo: ui.tipo,
        periodo: ui.periodo,
        collectionSource: ui.collectionSource,
        technicalEvidence: ui.technicalEvidence,
        pedido: ui.pedido,
      });
      var byIndex = {};
      docs.forEach(function (doc) {
        byIndex[doc._queueIndex] = doc;
      });
      return result.visible.map(function (e) {
        return byIndex[e.index];
      }).filter(Boolean);
    }

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
    var queueUI = getQueueUI();
    if (queueUI && docs.length > 0 && docs[0].queueItem) {
      var entries = docs.map(function (doc) {
        return { index: doc._queueIndex, queueItem: doc.queueItem, raw: null };
      });
      return queueUI.countByStatus(entries);
    }
    var c = { todos: docs.length, pending: 0, assigned: 0, accepted: 0, rejected: 0 };
    docs.forEach(function (doc) {
      if (c[doc.status] != null) {
        c[doc.status]++;
      }
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

  function loadDocumentsPrimaryThenFallback() {
    var docsApi = window.RAVATEX_DOCUMENTS;
    var primary = docsApi && typeof docsApi.loadReceivedDocumentsFromSupabase === 'function'
      ? docsApi.loadReceivedDocumentsFromSupabase()
      : Promise.resolve({ ok: false, source: 'supabase', error: 'reader_unavailable' });

    return primary.then(function (primaryResult) {
      if (primaryResult && primaryResult.ok) {
        window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
        return primaryResult;
      }
      if (!docsApi || typeof docsApi.autoLoadDocuments !== 'function') {
        window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
        return primaryResult || { ok: false, source: 'supabase', error: 'reader_failed' };
      }
      return docsApi.autoLoadDocuments().then(function (fallbackResult) {
        if (fallbackResult && fallbackResult.skipped && fallbackResult.reason === 'supabase-primary') {
          window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'available';
          return {
            ok: true,
            source: 'supabase',
            count: Array.isArray(window.RAVATEX_DOCUMENTS_RECEIVED)
              ? window.RAVATEX_DOCUMENTS_RECEIVED.length : 0,
          };
        }
        if (fallbackResult && fallbackResult.ok) {
          window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
          return {
            ok: true,
            source: 'g22-auto',
            fallback: true,
            count: fallbackResult.count || 0,
            primaryError: primaryResult && primaryResult.error || '',
          };
        }
        window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY = 'unavailable';
        return primaryResult || fallbackResult || { ok: false, source: 'supabase', error: 'reader_failed' };
      });
    });
  }

  function showRefreshResult(result) {
    if (typeof window.toast !== 'function') return;
    if (result && result.ok && result.source === 'supabase') {
      window.toast(result.count ? 'Documentos atualizados pelo Supabase.' : 'Nenhum documento encontrado no Supabase.', 'success');
    } else if (result && result.ok && result.fallback) {
      window.toast('Supabase indisponivel; usando fallback do Ingestor.', 'info');
    } else {
      window.toast('Supabase indisponivel. Importar documentos continua disponivel.', 'info');
    }
  }

  function isAdminUser() {
    return !!(window.CURRENT_USER && window.CURRENT_USER.tipo === 'admin');
  }

  function scanStatusLabel(status) {
    var labels = {
      requested: 'Solicitacao aguardando executor',
      claimed: 'Solicitacao recebida pelo executor',
      running: 'Verificando e-mails',
      completed: 'Verificacao concluida',
      failed: 'Falha na verificacao',
      cancelled: 'Solicitacao cancelada',
    };
    return labels[status] || 'Solicitacao em acompanhamento';
  }

  function scanErrorMessage(error) {
    var labels = {
      admin_required: 'Apenas administradores podem verificar documentos.',
      migration_unavailable: 'A atualizacao de solicitacoes ainda nao foi aplicada.',
      session_expired: 'Sua sessao expirou. Entre novamente para continuar.',
      request_failed: 'A verificacao falhou. Tente novamente mais tarde.',
      timeout: 'O acompanhamento excedeu o tempo limite. Atualize a tela para verificar o status.',
      executor_unavailable: 'O executor de verificacao esta indisponivel no momento.',
    };
    return labels[error] || labels.executor_unavailable;
  }

  function isActiveScanRequest() {
    return !!(ui.scanRequest && (ui.scanRequest.status === 'requested'
      || ui.scanRequest.status === 'claimed' || ui.scanRequest.status === 'running'));
  }

  function setScanFeedback(kind, message) {
    ui.scanFeedback = { kind: kind, message: message };
  }

  function ensureScanLogoutCancellation() {
    if (ui.logoutWrapped || typeof window.logout !== 'function') return;
    var originalLogout = window.logout;
    window.logout = function () {
      if (window.RAVATEX_DOCUMENTS && typeof window.RAVATEX_DOCUMENTS.cancelDocumentScanPolling === 'function') {
        window.RAVATEX_DOCUMENTS.cancelDocumentScanPolling();
      }
      return originalLogout.apply(this, arguments);
    };
    ui.logoutWrapped = true;
  }

  // Handlers de acompanhamento compartilhados entre iniciar (start) e hidratar
  // (resume). Cada sessao tem seu proprio guard `completed`, entao chamar
  // makeScanTrackingHandlers() a cada disparo evita colisao entre uma request
  // concluida e outra retomada. onUpdate NAO escreve feedback: o botao ja
  // exibe scanStatusLabel(status) durante os estados ativos, portanto espelhar
  // o mesmo texto no feedback duplicaria visualmente o status (G24-B5).
  function makeScanTrackingHandlers() {
    var completed = false;
    function onUpdate(request) {
      ui.scanRequest = request;
      ui.scanFeedback = null;
      rerender();
    }
    function onComplete(result) {
      if (completed) return;
      completed = true;
      if (result && result.status === 'completed') {
        ui.scanRequest = result.request || { status: 'completed' };
        setScanFeedback('success', 'Verificacao concluida. Atualizando lista.');
        loadDocumentsPrimaryThenFallback().then(function () {
          ui.scanRequest = null;
          setScanFeedback('success', 'Verificacao concluida. Lista atualizada.');
          if (typeof window.toast === 'function') window.toast('Verificacao concluida. Lista atualizada.', 'success');
          rerender();
        });
        return;
      }
      ui.scanRequest = null;
      if (result && result.status === 'cancelled') {
        setScanFeedback('info', 'Solicitacao cancelada.');
      } else {
        setScanFeedback('error', scanErrorMessage(result && result.error));
      }
      rerender();
    }
    return { onUpdate: onUpdate, onComplete: onComplete };
  }

  function startDocumentScan() {
    if (!isAdminUser()) {
      setScanFeedback('error', 'Sessao expirada. Entre novamente.');
      rerender();
      return;
    }
    if (isActiveScanRequest()) {
      setScanFeedback('info', 'Verificacao ja esta sendo acompanhada.');
      rerender();
      return;
    }
    var docsApi = window.RAVATEX_DOCUMENTS;
    if (!docsApi || typeof docsApi.requestDocumentScan !== 'function') {
      setScanFeedback('error', scanErrorMessage('migration_unavailable'));
      rerender();
      return;
    }
    ui.scanRequest = { status: 'requested', pending: true };
    setScanFeedback('info', 'Solicitacao enviada. Aguardando executor.');
    rerender();
    var handlers = makeScanTrackingHandlers();
    var requestPromise = docsApi.requestDocumentScan({
      onUpdate: handlers.onUpdate,
      onComplete: handlers.onComplete,
    });
    if (requestPromise && typeof requestPromise.then === 'function') {
      requestPromise.then(function (result) {
        if (result && result.error && !result.status) handlers.onComplete(result);
      });
    }
  }

  // Retoma o acompanhamento de uma request ja ativa (requested/claimed/running)
  // via polling puro — NAO chama solicitar_document_scan. Reusa os handlers
  // compartilhados, entao o refresh automatico em completed e o cancelamento
  // por rota/logout continuam valendo. O trigger deduplica polling por id.
  function resumeScanTracking(request) {
    if (!request || !request.id) return;
    var docsApi = window.RAVATEX_DOCUMENTS;
    if (!docsApi || typeof docsApi.pollDocumentScanRequest !== 'function') return;
    ui.scanRequest = request;
    ui.scanFeedback = null;
    rerender();
    var handlers = makeScanTrackingHandlers();
    var pollPromise = docsApi.pollDocumentScanRequest(request.id, {
      onUpdate: handlers.onUpdate,
      onComplete: handlers.onComplete,
    });
    if (pollPromise && typeof pollPromise.then === 'function') {
      pollPromise.then(function (result) {
        if (result && result.error && !result.status) handlers.onComplete(result);
      });
    }
  }

  // Hidratacao (G24-B5): ao abrir/recarregar a tela, consulta a request ativa
  // e retoma o acompanhamento. O flag so e marcado quando ha admin + modulo
  // disponiveis, para nao "queimar" a tentativa antes da sessao carregar. Faz
  // uma unica leitura e, dai, no maximo um polling.
  function hydrateActiveScanRequest() {
    if (ui.scanHydrationAttempted) return;
    if (!isAdminUser()) return;
    var docsApi = window.RAVATEX_DOCUMENTS;
    if (!docsApi || typeof docsApi.getActiveDocumentScanRequest !== 'function') return;
    ui.scanHydrationAttempted = true;
    if (isActiveScanRequest()) return;
    var lookup = docsApi.getActiveDocumentScanRequest('gmail');
    if (!lookup || typeof lookup.then !== 'function') return;
    lookup.then(function (result) {
      if (!result || !result.ok || !result.request) return;
      if (isActiveScanRequest()) return;
      resumeScanTracking(result.request);
    });
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

  function cloudDecisionErrorMessage(error) {
    if (error === 'admin_required') return 'Apenas administradores podem decidir documentos.';
    if (error === 'motivo_required') return 'Rejeição exige um motivo.';
    if (error === 'no_active_decision') return 'A decisão já não está ativa.';
    if (error === 'base_status_unavailable') return 'Não há estado canônico seguro para desfazer esta decisão.';
    if (error === 'document_id_required' || error === 'candidate_not_found') return 'Documento indisponível para desfazer a decisão.';
    if (error === 'supabase_unavailable' || error === 'network') return 'Falha de comunicação.';
    // invalid_status, document_id_required, supabase_error, mensagens
    // PostgREST e qualquer code desconhecido caem numa mensagem
    // controlada generica (nao vaza detalhe tecnico do banco).
    return 'Não foi possível registrar a decisão.';
  }

  // Decisao em nuvem (Supabase). NAO usa localStorage nem statusOverrides:
  // a verdade vem do servidor via reload do reader apos a RPC.
  function runCloudDecision(btn, doc, status, motivo) {
    var api = window.RAVATEX_DOCUMENTS;
    if (!api || typeof api.decideDocumentInCloud !== 'function') {
      if (typeof window.toast === 'function') window.toast('Falha de comunicação.', 'error');
      return;
    }
    if (btn) btn.disabled = true;
    api.decideDocumentInCloud(doc.id, status, motivo).then(function (result) {
      if (result && result.ok) {
        if (typeof window.toast === 'function') {
          window.toast(status === 'accepted' ? 'Documento aceito.' : 'Documento rejeitado.',
            status === 'accepted' ? 'success' : 'info');
        }
        var reload = typeof api.loadReceivedDocumentsFromSupabase === 'function'
          ? api.loadReceivedDocumentsFromSupabase() : null;
        if (reload && typeof reload.then === 'function') {
          reload.then(function () { rerender(); });
        } else {
          rerender();
        }
        return;
      }
      if (btn) btn.disabled = false;
      if (typeof window.toast === 'function') {
        window.toast(cloudDecisionErrorMessage(result && result.error), 'error');
      }
    }).catch(function () {
      if (btn) btn.disabled = false;
      if (typeof window.toast === 'function') window.toast('Falha de comunicação.', 'error');
    });
  }

  function runCloudUndo(btn, doc) {
    var api = window.RAVATEX_DOCUMENTS;
    if (!api || typeof api.undoDocumentDecisionInCloud !== 'function') {
      if (typeof window.toast === 'function') window.toast('Falha de comunicação.', 'error');
      return;
    }
    if (btn) btn.disabled = true;
    api.undoDocumentDecisionInCloud(doc.id, null).then(function (result) {
      if (result && result.ok) {
        if (typeof window.toast === 'function') window.toast('Decisão desfeita.', 'info');
        var reload = typeof api.loadReceivedDocumentsFromSupabase === 'function'
          ? api.loadReceivedDocumentsFromSupabase() : null;
        if (reload && typeof reload.then === 'function') {
          reload.then(function () { rerender(); });
        } else {
          rerender();
        }
        return;
      }
      if (btn) btn.disabled = false;
      if (typeof window.toast === 'function') {
        window.toast(cloudDecisionErrorMessage(result && result.error), 'error');
      }
    }).catch(function () {
      if (btn) btn.disabled = false;
      if (typeof window.toast === 'function') window.toast('Falha de comunicação.', 'error');
    });
  }

  function buildActionButtons(doc) {
    var wrap = window.el('div', {
      style: 'display:flex;align-items:center;justify-content:center;gap:6px;',
    });

    var qi = doc.queueItem;
    var sourceFileState = qi && qi.source_file && qi.source_file.state;

    if (sourceFileState === 'drive_available') {
      if (doc.driveLink) {
        wrap.appendChild(iconButton('Ver', SVG_EYE, function () {
          if (typeof window.open === 'function') {
            window.open(doc.driveLink, '_blank', 'noopener,noreferrer');
          }
        }, '', {
          'data-action': 'ver-documento-drive',
          'data-document-id': doc.id,
        }));
      }
      if (doc.driveId || doc.driveLink) {
        wrap.appendChild(iconButton('Baixar', SVG_DOWNLOAD, function () {
          if (typeof window.open === 'function') {
            window.open(driveDownloadLink(doc), '_blank', 'noopener,noreferrer');
          }
        }, '', {
          'data-action': 'baixar-documento-drive',
          'data-document-id': doc.id,
        }));
      }
    } else if (sourceFileState === 'unsupported' || sourceFileState === 'missing') {
      var q = getQueueUI();
      var sfPres = q ? q.getSourceFilePresentation(qi) : null;
      var label = (sfPres && sfPres.label) || 'Sem link';
      var ariaLabel = (sfPres && sfPres.ariaLabel) || label;
      wrap.appendChild(window.el('span', {
        'data-source-file-state': sourceFileState,
        'data-document-id': doc.id,
        title: ariaLabel,
        'aria-label': ariaLabel,
        style: 'color:#9aa2af;font-size:11px;font-style:italic;white-space:normal;line-height:1.3;text-align:center;max-width:100%;overflow-wrap:break-word;',
      }, label));
    } else {
      wrap.appendChild(window.el('span', {
        'data-action': 'sem-link',
        'data-document-id': doc.id,
        title: 'Ação indisponível',
        'aria-label': 'Ação indisponível',
        style: 'color:#9aa2af;font-size:11.5px;font-style:italic;white-space:nowrap;',
      }, 'Indisponível'));
    }

    if (doc.isSupabaseSource) {
      if (doc.canUndoCloudDecision && doc.hasRealId) {
        var desfazerNuvemBtn;
        desfazerNuvemBtn = iconButton('Desfazer decisão', SVG_UNDO, function () {
          runCloudUndo(desfazerNuvemBtn, doc);
        }, 'color:#687385;border-color:#cfd5dd;', {
          'data-action': 'desfazer-decisao-nuvem',
          'data-document-id': doc.id,
        });
        wrap.appendChild(desfazerNuvemBtn);
      }
      if (doc.status === 'pending' && doc.hasRealId) {
        var rejeitarNuvemBtn;
        rejeitarNuvemBtn = iconButton('Rejeitar', SVG_X, function () {
          var motivo = typeof window.prompt === 'function' ? window.prompt('Motivo da rejeição:') : '';
          if (motivo === null) return;
          if (typeof motivo !== 'string' || !motivo.trim()) {
            if (typeof window.toast === 'function') window.toast('Rejeição exige um motivo.', 'error');
            return;
          }
          runCloudDecision(rejeitarNuvemBtn, doc, 'rejected', motivo);
        }, 'color:#d6403a;border-color:#f0cfcd;', {
          'data-action': 'rejeitar-documento-nuvem',
          'data-document-id': doc.id,
        });
        wrap.appendChild(rejeitarNuvemBtn);

        var aceitarNuvemBtn;
        aceitarNuvemBtn = iconButton('Aceitar', SVG_CHECK, function () {
          runCloudDecision(aceitarNuvemBtn, doc, 'accepted', null);
        }, 'color:#18794a;border-color:#a7d8bd;', {
          'data-action': 'aceitar-documento-nuvem',
          'data-document-id': doc.id,
        });
        wrap.appendChild(aceitarNuvemBtn);
      }
    } else if (doc.status === 'pending' && doc.hasRealId) {
      wrap.appendChild(iconButton('Rejeitar', SVG_X, function () {
        var motivo = typeof window.prompt === 'function' ? window.prompt('Motivo da rejeição:') : '';
        if (motivo === null) return;
        if (typeof motivo !== 'string' || !motivo.trim()) {
          if (typeof window.toast === 'function') window.toast('Rejeição exige um motivo.', 'error');
          return;
        }
        var result = typeof window.RAVATEX_DOCUMENTS !== 'undefined'
          && typeof window.RAVATEX_DOCUMENTS.saveDocumentDecision === 'function'
          ? window.RAVATEX_DOCUMENTS.saveDocumentDecision(doc.id, { status: 'rejected', motivo: motivo })
          : null;
        if (result && result.ok) {
          if (typeof window.toast === 'function') window.toast('Documento rejeitado.', 'info');
        } else {
          ui.statusOverrides[doc.id] = 'rejected';
          if (typeof window.toast === 'function') window.toast('Documento marcado como rejeitado nesta sessao (sem persistencia).', 'info');
        }
        rerender();
      }, 'color:#d6403a;border-color:#f0cfcd;', {
        'data-action': 'rejeitar-documento',
        'data-document-id': doc.id,
      }));
      wrap.appendChild(iconButton('Aceitar', SVG_CHECK, function () {
        var result = typeof window.RAVATEX_DOCUMENTS !== 'undefined'
          && typeof window.RAVATEX_DOCUMENTS.saveDocumentDecision === 'function'
          ? window.RAVATEX_DOCUMENTS.saveDocumentDecision(doc.id, { status: 'accepted' })
          : null;
        if (result && result.ok) {
          if (typeof window.toast === 'function') window.toast('Documento aceito.', 'success');
        } else {
          ui.statusOverrides[doc.id] = 'accepted';
          if (typeof window.toast === 'function') window.toast('Documento marcado como aceito nesta sessao (sem persistencia).', 'success');
        }
        rerender();
      }, 'color:#18794a;border-color:#a7d8bd;', {
        'data-action': 'aceitar-documento',
        'data-document-id': doc.id,
      }));
    }

    if (!doc.isSupabaseSource && doc.hasLocalDecision && doc.hasRealId) {
      wrap.appendChild(iconButton('Desfazer', null, function () {
        if (typeof window.RAVATEX_DOCUMENTS !== 'undefined'
            && typeof window.RAVATEX_DOCUMENTS.removeDocumentDecision === 'function') {
          window.RAVATEX_DOCUMENTS.removeDocumentDecision(doc.id);
        }
        delete ui.statusOverrides[doc.id];
        if (typeof window.toast === 'function') window.toast('Decisão local removida.', 'info');
        rerender();
      }, 'color:#8a93a3;border-color:#d0d3d8;font-size:11px;', {
        'data-action': 'desfazer-decisao-documento',
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
      'aria-label': 'Atualizar agora',
      title: 'Atualizar agora',
      style: BTN_PRIMARY + (ui.refreshing ? 'opacity:.72;cursor:wait;' : ''),
      onclick: function () {
        if (ui.refreshing) return;
        ui.refreshing = true;
        ui.lastRun = new Date();
        rerender();

        loadDocumentsPrimaryThenFallback().then(function (result) {
          ui.refreshing = false;
          ui.lastRun = new Date();
          showRefreshResult(result);
          rerender();
        });
      },
    });
    refreshBtn.appendChild(svgEl(SVG_REFRESH, 14, 'Atualizar', ui.refreshing ? 'animation:rv-doc-spin .8s linear infinite;' : ''));
    refreshBtn.appendChild(document.createTextNode('Atualizar'));
    actions.appendChild(refreshBtn);

    if (isAdminUser()) {
      var scanActive = isActiveScanRequest();
      var scanAttrs = {
        type: 'button',
        'data-action': 'verificar-novos-documentos',
        'aria-label': 'Verificar novos documentos',
        title: 'Verificar novos documentos',
        style: BTN_SECONDARY + (scanActive ? 'opacity:.65;cursor:wait;' : ''),
        onclick: startDocumentScan,
      };
      if (scanActive) scanAttrs.disabled = 'disabled';
      var scanBtn = window.el('button', scanAttrs);
      scanBtn.appendChild(svgEl(SVG_MAIL, 14, 'Verificar novos documentos'));
      scanBtn.appendChild(document.createTextNode(scanActive
        ? scanStatusLabel(ui.scanRequest.status) : 'Verificar'));
      actions.appendChild(scanBtn);
    }

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
      pair.button.title = 'Importar documentos';
      pair.button.setAttribute('aria-label', 'Importar documentos');
      pair.button.textContent = '';
      pair.button.appendChild(svgEl(SVG_UPLOAD, 14, 'Importar documentos'));
      pair.button.appendChild(document.createTextNode('Importar'));
      pair.fileInput.addEventListener('change', function () {
        ui.lastRun = new Date();
        rerenderSoon(80);
        rerenderSoon(260);
      });
      pair.mount(importWrap);
    } else {
      var unavailableImportBtn = window.el('button', {
        type: 'button',
        disabled: 'disabled',
        'aria-label': 'Importar documentos',
        title: 'Importar documentos',
        style: BTN_SECONDARY + 'opacity:.65;cursor:not-allowed;',
      }, 'Importar');
      importWrap.appendChild(unavailableImportBtn);
    }
    actions.appendChild(importWrap);

    return window.el('div', { style: 'display:block;margin-bottom:12px;' },
      window.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:3px;',
      },
        window.el('div', { style: 'font-size:22px;font-weight:800;color:#16203a;letter-spacing:-.01em;white-space:nowrap;' }, 'Documentos Mapeados'),
        actions),
      ui.scanFeedback ? window.el('div', {
        'data-section': 'document-scan-feedback',
        'data-kind': ui.scanFeedback.kind,
        style: 'margin-top:8px;font-size:12.5px;font-weight:600;color:'
          + (ui.scanFeedback.kind === 'error' ? '#b42318' : ui.scanFeedback.kind === 'success' ? '#18794a' : '#2563eb') + ';',
      }, ui.scanFeedback.message) : null,
      window.el('div', {
        style: 'font-size:13px;color:#8a93a3;line-height:1.45;white-space:nowrap;',
      }, 'Importe a lista gerada pelo Documents Ingestor para revisar os documentos mapeados.'));
  }

  function getReceivedMetadata() {
    try {
      if (window.RAVATEX_DOCUMENTS_RECEIVED_METADATA
          && window.RAVATEX_DOCUMENTS_RECEIVED_METADATA.importedAt) {
        return window.RAVATEX_DOCUMENTS_RECEIVED_METADATA;
      }
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem('RAVATEX_DOCUMENTS_RECEIVED_METADATA');
        if (raw) {
          var meta = JSON.parse(raw);
          if (meta && typeof meta.importedAt === 'string') {
            window.RAVATEX_DOCUMENTS_RECEIVED_METADATA = meta;
            return meta;
          }
        }
      }
    } catch (_ignored) {
      // localStorage corrompido ou indisponivel: retornar null.
    }
    return null;
  }

  function buildImportMetadataCard(docs) {
    var meta = getReceivedMetadata();
    if (!meta || !meta.importedAt) return null;

    var now = Date.now();
    var importedMs = new Date(meta.importedAt).getTime();
    var isStale = !isNaN(importedMs) && (now - importedMs) > 24 * 60 * 60 * 1000;

    var when = fmtDataHoraCurta(meta.importedAt);
    var fileName = meta.fileName || '';
    var count = meta.count;
    var hash = meta.hash || '';
    var sc = meta.statusCounts || {};

    var statusPills = [];
    var statusOrder = ['pending', 'assigned', 'accepted', 'rejected', 'unknown'];
    var statusLabelSingle = { pending: 'Pendente', assigned: 'Atribuído', accepted: 'Aceito', rejected: 'Rejeitado', unknown: 'Desconhecido' };
    var statusLabelPlural = { pending: 'Pendentes', assigned: 'Atribuídos', accepted: 'Aceitos', rejected: 'Rejeitados', unknown: 'Desconhecidos' };
    var statusColors = { pending: '#c2610c', assigned: '#2563eb', accepted: '#18794a', rejected: '#d6403a', unknown: '#8a93a3' };
    var statusBg = { pending: '#fff4e6', assigned: '#eaf1fd', accepted: '#e6f4ec', rejected: '#fdecec', unknown: '#f1f3f6' };
    for (var si = 0; si < statusOrder.length; si++) {
      var key = statusOrder[si];
      var val = sc[key];
      if (typeof val !== 'number' || val <= 0) continue;
      statusPills.push(window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;'
          + 'padding:1px 7px;border-radius:3px;white-space:nowrap;'
          + 'background:' + statusBg[key] + ';color:' + statusColors[key] + ';',
      }, String(val) + ' ' + (val === 1 ? statusLabelSingle[key] : statusLabelPlural[key])));
    }

    var chipBg = isStale ? '#fdf0e6' : '#eaf1fd';
    var chipFg = isStale ? '#b65630' : '#2563eb';
    var chipLabel = isStale ? 'Defasado' : 'Atualizado';

    var chip = window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;'
        + 'letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:3px;'
        + 'white-space:nowrap;background:' + chipBg + ';color:' + chipFg + ';',
    }, chipLabel);

    var hashDisplay = hash ? hash.slice(0, 8) : '';
    var hashChip = hashDisplay ? window.el('span', {
      style: 'font-size:10.5px;font-weight:500;color:#9aa2af;white-space:nowrap;font-family:monospace;',
    }, '#' + hashDisplay) : null;

    var fileDisplay = fileName ? window.el('span', {
      style: 'font-size:12px;font-weight:600;color:#3f4757;white-space:nowrap;max-width:260px;'
        + 'overflow:hidden;text-overflow:ellipsis;',
      title: fileName,
    }, fileName) : null;

    var infoRow = window.el('div', {
      style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;',
    },
      window.el('span', {
        style: 'font-size:11.5px;color:#8a93a3;white-space:nowrap;',
      }, window.el('span', { style: 'font-weight:600;color:#5b6472;' }, 'Último import: '), when));

    if (fileDisplay) infoRow.appendChild(fileDisplay);
    if (count != null) infoRow.appendChild(window.el('span', {
      style: 'font-size:12px;color:#5b6472;font-weight:500;white-space:nowrap;',
    }, String(count) + ' documento(s)'));
    infoRow.appendChild(chip);

    var detailRow = null;
    if (statusPills.length || hashChip) {
      detailRow = window.el('div', {
        style: 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px;',
      });
      if (statusPills.length) {
        for (var pi = 0; pi < statusPills.length; pi++) {
          detailRow.appendChild(statusPills[pi]);
        }
        if (hashChip) {
          detailRow.appendChild(window.el('span', { style: 'color:#d8dce2;font-size:10px;' }, '·'));
        }
      }
      if (hashChip) detailRow.appendChild(hashChip);
    }

    var autoSyncSession = window.RAVATEX_DOCUMENTS_AUTO_LOADED_SESSION === true;
    var autoSyncChip = autoSyncSession ? window.el('span', {
      style: 'display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;'
        + 'letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:3px;'
        + 'white-space:nowrap;background:#e6f4ec;color:#18794a;margin-left:6px;',
    }, 'Auto-sync') : null;

    var warningMsg;
    if (autoSyncSession) {
      warningMsg = 'Auto-sincronizado — dados carregados via fetch relativo do Ingestor.';
    } else if (isStale) {
      warningMsg = 'Snapshot manual — este import tem mais de 24h e pode estar defasado. Reimporte para dados atuais.';
    } else {
      warningMsg = 'Snapshot manual — pode estar defasado. Reimporte para dados atuais.';
    }

    var warnColor = autoSyncSession ? '#18794a' : (isStale ? '#b65630' : '#8a93a3');
    var warnBg = autoSyncSession ? '#e6f4ec' : (isStale ? '#fde0ce' : '#f1f3f6');

    var warningRow = window.el('div', {
      style: 'display:flex;align-items:flex-start;gap:4px;margin-top:4px;font-size:11px;'
        + 'color:' + warnColor + ';line-height:1.4;',
    },
      window.el('span', {
        style: 'flex-shrink:0;width:13px;height:13px;display:inline-flex;align-items:center;justify-content:center;'
          + 'border-radius:50%;background:' + warnBg + ';'
          + 'font-size:9px;font-weight:700;color:' + warnColor + ';',
      }, 'i'),
      window.el('span', {}, warningMsg),
      autoSyncChip);

    return window.el('div', {
      'data-section': 'documentos-recebidos-import-metadata',
      style: CARD + 'margin-bottom:10px;padding:10px 14px;'
        + 'font-size:12px;' + (isStale ? 'border-color:#ebc8a6;' : ''),
    }, infoRow, detailRow, warningRow);
  }

  function latestRunLabel(docs) {
    if (ui.lastRun) return fmtDataHoraCurta(ui.lastRun);
    var latest = null;
    docs.forEach(function (doc) {
      var temporalValue = doc.emailReceivedAt || doc.processedAt;
      if (!temporalValue) return;
      var d = new Date(temporalValue);
      if (isNaN(d.getTime())) return;
      if (!latest || d.getTime() > latest.getTime()) latest = d;
    });
    return latest ? fmtDataHoraCurta(latest) : 'Aguardando import';
  }

  function isMappedTypeActive(key) {
    return ui.mappedTypes[key] !== false;
  }

  function mappedTypeButton(type) {
    var active = isMappedTypeActive(type.key);
    var style = 'display:inline-flex;align-items:center;background:transparent;border:none;'
      + 'padding:0 3px;font-family:inherit;font-size:11.5px;font-weight:700;letter-spacing:.04em;'
      + 'cursor:pointer;white-space:nowrap;flex-shrink:0;'
      + 'transition:color .12s ease,opacity .12s ease;'
      + (active
        ? 'color:#3f4757;'
        : 'color:#aeb6c2;opacity:.62;');
    return window.el('button', {
      type: 'button',
      'data-action': 'toggle-tipo-mapeado',
      'data-mapped-type': type.key,
      'aria-pressed': active ? 'true' : 'false',
      title: (active ? 'Desativar mapeamento ' : 'Ativar mapeamento ') + type.label,
      style: style,
      onclick: function () {
        ui.mappedTypes[type.key] = !active;
        rerender();
      },
    }, type.label);
  }

  function buildMappedTypesControls() {
    return window.el('span', {
      'data-section': 'tipos-mapeados',
      style: 'display:inline-flex;align-items:center;gap:6px;min-width:0;flex:0 0 auto;flex-wrap:nowrap;',
    },
      window.el('span', {
        style: 'font-size:12.5px;color:#8a93a3;font-weight:600;white-space:nowrap;',
      }, 'Tipos mapeados:'),
      MAPPED_SCAN_TYPES.map(mappedTypeButton));
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
    playBtn.appendChild(ui.scanPlaying
      ? lucideEl('pause', '<rect x="14" y="3" width="5" height="18" rx="1"></rect><rect x="5" y="3" width="5" height="18" rx="1"></rect>', 15)
      : lucideEl('play', '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>', 15));

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
      style: 'min-height:34px;display:flex;align-items:center;gap:14px;'
        + 'padding:2px 2px 10px;margin-bottom:8px;flex-wrap:nowrap;overflow-x:auto;',
    },
      window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:8px;font-size:13px;'
          + 'font-weight:600;color:#16203a;white-space:nowrap;',
      }, dot, 'Varredura', playBtn),
      divider(),
      buildMappedTypesControls(),
      window.el('span', {
        style: 'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#8a93a3;'
          + 'white-space:nowrap;margin-left:auto;',
      }, 'Origem:',
        window.el('span', {
          style: 'display:inline-flex;align-items:center;gap:5px;background:#f6f7f9;'
            + 'border:1px solid #eceef1;border-radius:4px;padding:2px 8px;'
            + 'font-size:12px;font-weight:600;color:#3f4757;',
        }, svgEl(SVG_MAIL, 12, 'Gmail'), 'Gmail')),
      divider(),
      window.el('span', {
        style: 'font-size:13px;color:#8a93a3;white-space:nowrap;',
      }, 'Última execução: ', window.el('span', {
        style: 'color:#3f4757;font-weight:500;',
      }, latestRunLabel(docs))));
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
    var queueUI = getQueueUI();
    if (queueUI && docs.length > 0 && docs[0].queueItem) {
      var entries = docs.map(function (doc) {
        return { index: doc._queueIndex, queueItem: doc.queueItem, raw: null };
      });
      return queueUI.getPedidoOptions(entries);
    }
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

    var queueUI = getQueueUI();
    var filterOptions = queueUI ? queueUI.getFilterOptions() : null;
    var sourceOptions = filterOptions && filterOptions.collectionSource
      ? filterOptions.collectionSource.map(function (o) { return { value: o.code, label: o.label }; })
      : [
          { value: 'all', label: 'Todas as origens' },
          { value: 'canonical_remote', label: 'Remoto canônico' },
          { value: 'legacy_fallback', label: 'Fallback legado' },
          { value: 'unknown', label: 'Desconhecida' },
        ];
    var evidenceOptions = filterOptions && filterOptions.technicalEvidence
      ? filterOptions.technicalEvidence.map(function (o) { return { value: o.code, label: o.label }; })
      : [
          { value: 'all', label: 'Todas as evidencias' },
          { value: 'available', label: 'Disponível' },
          { value: 'missing', label: 'Ausente' },
          { value: 'invalid', label: 'Inválida' },
          { value: 'remote_unavailable', label: 'Remota indisponível' },
          { value: 'unavailable', label: 'Indisponível' },
        ];

    return window.el('div', {
      style: 'display:flex;align-items:stretch;gap:8px;margin-bottom:16px;flex-wrap:wrap;',
    },
      selectControl('Tipo', ui.tipo, tipoOptions, function (v) { ui.tipo = v; }),
      selectControl('Pedido', ui.pedido, pedidoOptions, function (v) { ui.pedido = v; }),
      selectControl('Período (e-mail; processamento em legado)', ui.periodo, periodoOptions, function (v) { ui.periodo = v; }),
      selectControl('Origem', ui.collectionSource, sourceOptions, function (v) { ui.collectionSource = v; }),
      selectControl('Evidencia tecnica', ui.technicalEvidence, evidenceOptions, function (v) { ui.technicalEvidence = v; }),
      window.el('button', {
        type: 'button',
        'data-action': 'limpar-filtros',
        style: BTN_SECONDARY + 'height:auto;min-height:49px;align-self:stretch;',
        onclick: function () {
          ui.busca = '';
          ui.tipo = 'todos';
          ui.pedido = 'todos';
          ui.periodo = 'todos';
          ui.collectionSource = 'all';
          ui.technicalEvidence = 'all';
          ui.tab = 'todos';
          rerender();
        },
      }, 'Limpar', svgEl(SVG_X, 13, 'Limpar')));
  }

  function buildQueueUIStateBar() {
    var queueUI = getQueueUI();
    if (!queueUI || typeof queueUI.getUIState !== 'function') return null;

    var entries = queueUI.buildQueue();
    var filterResult = queueUI.filterQueue(entries, {
      search: ui.busca,
      status: ui.tab,
      tipo: ui.tipo,
      periodo: ui.periodo,
      collectionSource: ui.collectionSource,
      technicalEvidence: ui.technicalEvidence,
      pedido: ui.pedido,
    });

    var state = queueUI.getUIState(entries, filterResult, {
      loading: ui.refreshing || ui.sourceLoadRunning || ui.autoLoadRunning,
    });

    if (!state) return null;

    var isRemote = state.state.indexOf('remote-unavailable') === 0;
    var isError = state.state === 'remote-unavailable';
    var isWarning = isRemote && !isError;

    var bg = isError ? '#fdecec' : (isWarning ? '#fdf0e6' : (state.state === 'loading' ? '#f1f3f6' : '#eaf1fd'));
    var fg = isError ? '#d6403a' : (isWarning ? '#b65630' : (state.state === 'loading' ? '#5b6472' : '#2563eb'));
    var border = isError ? '#f0cfcd' : (isWarning ? '#ebc8a6' : '#d8dce2');

    return window.el('div', {
      'data-section': 'queue-ui-state',
      'data-marker': state.marker,
      role: 'status',
      'aria-live': 'polite',
      'aria-label': state.ariaLabel,
      style: 'display:flex;align-items:center;gap:8px;padding:8px 14px;margin-bottom:10px;'
        + 'border-radius:6px;font-size:13px;font-weight:500;background:' + bg + ';color:' + fg + ';'
        + 'border:1px solid ' + border + ';',
    },
      state.label);
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
      head('Datas'),
      head('Ações', 'center'));
  }

  function buildDocumentRow(doc, isLast) {
    var q = getQueueUI();
    var pres = null;
    if (q && doc.queueItem) {
      var qi = doc.queueItem;
      pres = {
        evidence: q.getEvidencePresentation(qi),
        review: q.getReviewPresentation(qi),
        pedido: q.getPedidoPresentation(qi),
        source: q.getSourcePresentation(qi),
        alerts: q.getAlertPresentation(qi),
      };
    }

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
        style: 'font-size:11px;color:#9aa2af;margin-top:1px;min-width:0;overflow-wrap:anywhere;',
      }, 'Remetente: ' + doc.from));
    } else {
      nameBlock.appendChild(window.el('div', {
        style: 'font-size:11px;color:#9aa2af;margin-top:1px;overflow-wrap:anywhere;',
      }, 'Remetente: indisponível'));
    }

    function stateSpan(label, ariaLabel, color) {
      return window.el('span', {
        style: 'font-size:10.5px;color:' + (color || '#8a93a3') + ';white-space:nowrap;',
        title: ariaLabel || label,
        'aria-label': ariaLabel || label,
      }, label);
    }

    function toneColor(tone) {
      if (tone === 'warning') return '#b65630';
      if (tone === 'info') return '#2563eb';
      return '#8a93a3';
    }

    var col1 = window.el('div', { style: 'display:flex;flex-direction:column;gap:4px;min-width:0;' },
      window.el('div', { style: 'display:flex;align-items:center;gap:10px;min-width:0;' },
        fileIcon(doc.formato, doc.filename),
        nameBlock));
    if (pres && pres.alerts.length) {
      var alertsEl = window.el('div', { style: 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;' });
      for (var ai = 0; ai < pres.alerts.length; ai++) {
        var a = pres.alerts[ai];
        var alertBg = a.severity === 'warning' ? '#fdf0e6' : '#eaf1fd';
        var alertFg = a.severity === 'warning' ? '#b65630' : '#2563eb';
        alertsEl.appendChild(window.el('span', {
          style: 'display:inline-flex;align-items:center;border-radius:3px;padding:1px 5px;'
            + 'font-size:10px;font-weight:600;white-space:nowrap;'
            + 'background:' + alertBg + ';color:' + alertFg + ';',
          title: a.ariaLabel || a.text,
          'aria-label': a.ariaLabel || a.text,
        }, a.text));
      }
      col1.appendChild(alertsEl);
    }

    var statusCol = window.el('div', { style: 'display:flex;flex-direction:column;gap:2px;' },
      window.el('div', { style: 'display:flex;align-items:center;gap:6px;' },
        statusPill(doc.status),
        doc.isDivergent ? window.el('span', {
          'data-field': 'decisao-local',
          'data-decisao': 'divergente',
          style: 'display:inline-flex;align-items:center;border-radius:3px;padding:1px 6px;'
            + 'font-size:10px;font-weight:700;white-space:nowrap;'
            + 'background:#fef4e6;color:#b65630;letter-spacing:.03em;text-transform:uppercase;',
        }, 'Divergente') : null,
        doc.hasLocalDecision && !doc.isDivergent ? window.el('span', {
          'data-field': 'decisao-local',
          'data-decisao': 'local',
          style: 'display:inline-flex;align-items:center;border-radius:3px;padding:1px 6px;'
            + 'font-size:10px;font-weight:700;white-space:nowrap;'
            + 'background:#eaf1fd;color:#2563eb;letter-spacing:.03em;text-transform:uppercase;',
        }, 'Decisão local') : null));
    if (pres) {
      if (pres.review.label) {
        statusCol.appendChild(stateSpan(pres.review.label, pres.review.ariaLabel, '#5b6472'));
      }
      if (pres.evidence.label) {
        statusCol.appendChild(stateSpan(pres.evidence.label, pres.evidence.ariaLabel, toneColor(pres.evidence.tone)));
      }
      if (q && doc.queueItem) {
        var valPres = q.getValidationPresentation(doc.queueItem);
        if (valPres.label) {
          statusCol.appendChild(stateSpan(valPres.label, valPres.ariaLabel, '#8a93a3'));
        }
      }
    }

    var pedidoCol = window.el('div', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0;' });
    pedidoCol.appendChild(pedidoCell(doc));
    if (pres) {
      if (pres.pedido.label) {
        pedidoCol.appendChild(stateSpan(pres.pedido.label, pres.pedido.ariaLabel, '#8a93a3'));
      }
      if (pres.source.label) {
        pedidoCol.appendChild(stateSpan(pres.source.label, pres.source.ariaLabel, '#9aa2af'));
      }
    }

    var datesCol = window.el('div', { style: 'display:flex;flex-direction:column;gap:3px;min-width:0;' },
      window.el('div', { 'data-field': 'recebido-no-email', style: 'font-size:11.5px;color:#5b6472;white-space:nowrap;' },
        'Recebido: ', doc.emailReceivedAt ? fmtDataHoraCurta(doc.emailReceivedAt) : 'indisponível',
        doc.raw.email_received_at_estimated === true ? window.el('span', {
          'data-badge': 'data-estimada', style: 'margin-left:5px;font-size:10px;font-weight:700;color:#a16207;',
        }, 'data estimada') : null,
        !doc.emailReceivedAt ? window.el('span', {
          'data-badge': 'documento-legado', style: 'margin-left:5px;font-size:10px;font-weight:700;color:#7c3aed;',
        }, 'documento legado') : null),
      window.el('div', { 'data-field': 'processado-pelo-ingestor', style: 'font-size:11.5px;color:#7b8492;white-space:nowrap;' },
        'Processado: ', doc.processedAt ? fmtDataHoraCurta(doc.processedAt) : 'indisponível'));

    return window.el('div', {
      'data-document-id': doc.id,
      'data-row': 'documento-recebido',
      style: 'display:grid;grid-template-columns:' + TABLE_GRID + ';align-items:start;'
        + 'gap:12px;padding:10px 16px;border-bottom:' + (isLast ? 'none' : '1px solid #f1f3f6') + ';',
    },
      col1,
      badges,
      statusCol,
      pedidoCol,
      datesCol,
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
    ensureScanLogoutCancellation();
    var container = window.el('div', {});
    var docs = allDocs();
    var visible = filteredDocs(docs);

    var page = window.el('div', { style: 'width:100%;max-width:1600px;margin:0 auto;' });
    page.appendChild(buildHeader());
    var metaCard = buildImportMetadataCard(docs);
    if (metaCard) page.appendChild(metaCard);
    page.appendChild(buildScanStrip(docs));
    page.appendChild(buildSearchTabs(docs));
    page.appendChild(buildFilters(docs));
    var stateBar = buildQueueUIStateBar();
    if (stateBar) page.appendChild(stateBar);
    page.appendChild(buildTable(docs, visible));

    container.appendChild(page);
    setTimeout(restoreSearchFocus, 0);

    hydrateActiveScanRequest();

    if (!ui.sourceLoadAttempted && window.RAVATEX_DOCUMENTS
        && (window.RAVATEX_SUPABASE_CLIENT || typeof window.fetch === 'function')) {
      ui.sourceLoadAttempted = true;
      setTimeout(function () {
        if (ui.sourceLoadRunning) return;
        ui.sourceLoadRunning = true;
        loadDocumentsPrimaryThenFallback().then(function () {
          ui.sourceLoadRunning = false;
          rerender();
        });
      }, 300);
    }

    return window.shellLayout(window.ADMIN_MENU, container);
  }

  window.RAVATEX_SCREENS = window.RAVATEX_SCREENS || {};
  window.RAVATEX_SCREENS.documentosRecebidos = {
    screenDocumentosRecebidos: screenDocumentosRecebidos,
  };
  window.screenDocumentosRecebidos = screenDocumentosRecebidos;
})(window);
