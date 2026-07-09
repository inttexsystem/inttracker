// =====================================================================
// === js/documents-ingestor.js =========================================
// Consumidor read-only de eventos do Documents Ingestor (outbox JSONL).
//
// Fase: RAVATEX-TAPETES-G11-B-DOCUMENTS-CONSUMER-PATCH
// Escopo: parser, normalizador, deduplicacao e consolidacao de eventos
//   do outbox. Nao faz fetch, nao persiste em Supabase, nao chama
//   Google/Drive. Opera sobre JSONL em memoria.
//
// Carregar via <script src="js/documents-ingestor.js?v=...></script>
// DEPOIS de js/ui.js e ANTES dos screens de pedido-detail.
//
// Compatibilidade: expoe window.RAVATEX_DOCUMENTS. Funcoes puras;
// nenhuma dependencia de DOM, Supabase ou rede.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS || {};

  // -------------------------------------------------------------------
  // Constantes de status / badges
  // -------------------------------------------------------------------

  var DOC_STATUS_META = Object.freeze({
    pending_app_acceptance: { bg: '#fff4e6', text: '#c2610c', label: 'Pendente' },
    accepted:              { bg: '#e6f4ec', text: '#18794a', label: 'Aceito' },
    rejected:              { bg: '#fdecec', text: '#a23434', label: 'Rejeitado' },
  });

  var DOC_TIPO_BADGE = Object.freeze({
    nf:       { bg: '#eaf1fd', text: '#2563eb', label: 'NF' },
    romaneio: { bg: '#f3effd', text: '#6a3db8', label: 'Romaneio' },
  });

  var DOC_FORMATO_BADGE = Object.freeze({
    pdf: { bg: '#fdeee6', text: '#b65630', label: 'PDF' },
    xml: { bg: '#e6f1fd', text: '#2563eb', label: 'XML' },
  });

  var DOC_DIRECAO_BADGE = Object.freeze({
    entrada: { bg: '#e6f4ec', text: '#18794a', label: 'Entrada' },
    saida:   { bg: '#fdf0e6', text: '#b65630', label: 'Saida' },
  });

  var DOC_EVENT_LABEL = Object.freeze({
    'document.detected':  'Documento detectado',
    'document.linked':    'Documento vinculado',
    'document.accepted':  'Documento aceito',
    'document.rejected':  'Documento rejeitado',
  });

  // -------------------------------------------------------------------
  // Normalizacao de pedido
  // -------------------------------------------------------------------

  ns.normalizePedidoKey = function normalizePedidoKey(numero, ano) {
    if (numero == null && ano == null) return null;
    if (numero == null) return 'PED-XX-' + String(ano);
    var pad = String(numero).padStart(2, '0');
    var y = ano != null ? String(ano) : 'XXXX';
    return 'PED-' + pad + '-' + y;
  };

  // -------------------------------------------------------------------
  // Parser JSONL
  // -------------------------------------------------------------------

  ns.parseDocumentEventsJsonl = function parseDocumentEventsJsonl(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    var events = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var ev = JSON.parse(line);
        if (ev && typeof ev === 'object' && typeof ev.event_type === 'string') {
          events.push(ev);
        }
      } catch (_e) {
        // Linha malformada ignorada.
      }
    }
    return events;
  };

  // -------------------------------------------------------------------
  // Validacao minima de evento
  // -------------------------------------------------------------------

  ns.isValidDocumentEvent = function isValidDocumentEvent(ev) {
    if (!ev || typeof ev !== 'object') return false;
    if (typeof ev.event_type !== 'string') return false;
    if (typeof ev.pedido_manual !== 'string') return false;
    if (!ev.document || typeof ev.document !== 'object') return false;
    if (typeof ev.document.document_id !== 'string') return false;
    return true;
  };

  // -------------------------------------------------------------------
  // Filtro por pedido
  // -------------------------------------------------------------------

  ns.filterEventsByPedido = function filterEventsByPedido(events, pedidoKey) {
    if (!Array.isArray(events) || !pedidoKey) return [];
    return events.filter(function (ev) {
      return ev.pedido_manual === pedidoKey;
    });
  };

  // -------------------------------------------------------------------
  // Deduplicacao por ingestion_event_id
  // -------------------------------------------------------------------

  ns.deduplicateEvents = function deduplicateEvents(events) {
    if (!Array.isArray(events)) return [];
    var seen = {};
    var deduped = [];
    for (var i = 0; i < events.length; i++) {
      var key = events[i].ingestion_event_id || events[i].event_id;
      if (!seen[key]) {
        seen[key] = true;
        deduped.push(events[i]);
      }
    }
    return deduped;
  };

  // -------------------------------------------------------------------
  // Ordenacao por created_at
  // -------------------------------------------------------------------

  ns.sortEventsByCreatedAt = function sortEventsByCreatedAt(events) {
    if (!Array.isArray(events)) return [];
    return events.slice().sort(function (a, b) {
      var da = typeof a.created_at === 'string' ? a.created_at : '';
      var db = typeof b.created_at === 'string' ? b.created_at : '';
      if (da < db) return -1;
      if (da > db) return 1;
      // Desempate: ingestion_event_id lexicografico
      var ia = a.ingestion_event_id || '';
      var ib = b.ingestion_event_id || '';
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return 0;
    });
  };

  // -------------------------------------------------------------------
  // Consolidacao por document_id
  // -------------------------------------------------------------------

  ns.consolidateDocumentState = function consolidateDocumentState(events) {
    if (!Array.isArray(events)) return [];
    var byDoc = {};
    var docOrder = [];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var docId = ev.document && ev.document.document_id;
      if (!docId) continue;

      if (typeof byDoc[docId] === 'undefined') {
        docOrder.push(docId);
        byDoc[docId] = ev;
      } else {
        // Substitui se o evento for mais recente
        var existing = byDoc[docId];
        var da = typeof existing.created_at === 'string' ? existing.created_at : '';
        var db = typeof ev.created_at === 'string' ? ev.created_at : '';
        if (db > da) {
          byDoc[docId] = ev;
        }
      }
    }

    return docOrder.map(function (docId) { return byDoc[docId]; });
  };

  // -------------------------------------------------------------------
  // Helper: get badge meta para um tipo
  // -------------------------------------------------------------------

  ns.getDocumentStatusBadgeMeta = function getDocumentStatusBadgeMeta(status) {
    return DOC_STATUS_META[status] || DOC_STATUS_META.pending_app_acceptance;
  };

  ns.getDocumentTipoBadgeMeta = function getDocumentTipoBadgeMeta(tipo) {
    return DOC_TIPO_BADGE[tipo] || { bg: '#f1f3f6', text: '#5b6472', label: tipo || 'Doc' };
  };

  ns.getDocumentFormatoBadgeMeta = function getDocumentFormatoBadgeMeta(formato) {
    return DOC_FORMATO_BADGE[formato] || null;
  };

  ns.getDocumentDirecaoBadgeMeta = function getDocumentDirecaoBadgeMeta(direcao) {
    return DOC_DIRECAO_BADGE[direcao] || null;
  };

  ns.getDocumentEventLabel = function getDocumentEventLabel(eventType) {
    return DOC_EVENT_LABEL[eventType] || eventType;
  };

  // -------------------------------------------------------------------
  // Montagem: pipeline completo por pedido
  // -------------------------------------------------------------------

  ns.buildDocumentsForPedido = function buildDocumentsForPedido(events, pedidoKey) {
    if (!Array.isArray(events) || !pedidoKey) {
      return { consolidatedDocuments: [], timeline: [] };
    }

    var filtered = ns.filterEventsByPedido(events, pedidoKey);
    var deduped = ns.deduplicateEvents(filtered);
    var sorted = ns.sortEventsByCreatedAt(deduped);
    var consolidated = ns.consolidateDocumentState(sorted);

    return {
      consolidatedDocuments: consolidated,
      timeline: sorted,
    };
  };

  // -------------------------------------------------------------------
  // Timestamp formatador local (para exibicao na UI)
  // -------------------------------------------------------------------

  ns.fmtTimestamp = function fmtTimestamp(iso) {
    if (!iso) return '-';
    try {
      var d = new Date(iso);
      var day = String(d.getDate()).padStart(2, '0');
      var mon = String(d.getMonth() + 1).padStart(2, '0');
      var hour = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return day + '/' + mon + ' ' + hour + ':' + min;
    } catch (_e) {
      return String(iso).slice(0, 16);
    }
  };

  // -------------------------------------------------------------------
  // Suporte a documentos-recebidos.jsonl (formato flat)
  //
  // O export global do Documents Ingestor (G12-D1) gera um arquivo
  // JSONL com 1 documento por linha, em formato flat (sem wrapper
  // {document: {...}}, sem event_type). Este bloco adiciona
  // parser/validador/auxiliares CONSUMIDORES desse formato, sem
  // tocar nas funcoes de eventos do bloco anterior.
  //
  // O estado populado e window.RAVATEX_DOCUMENTS_RECEIVED (criado
  // pelo loader), nunca window.RAVATEX_DOCUMENTS_LOADED_EVENTS.
  // O Pedido Detail continua consumindo apenas o estado legado.
  // -------------------------------------------------------------------

  ns.isValidReceivedDocument = function isValidReceivedDocument(doc) {
    if (!doc || typeof doc !== 'object') return false;
    if (typeof doc.document_id !== 'string' || !doc.document_id) return false;
    if (doc.filename_original != null && typeof doc.filename_original !== 'string') return false;
    if (doc.tipo_documento != null && typeof doc.tipo_documento !== 'string') return false;
    if (doc.formato != null && typeof doc.formato !== 'string') return false;
    if (doc.direcao_nf != null && typeof doc.direcao_nf !== 'string') return false;
    if (doc.drive_web_view_link != null && typeof doc.drive_web_view_link !== 'string') return false;
    if (doc.created_at != null && typeof doc.created_at !== 'string') return false;
    return true;
  };

  ns.parseReceivedDocumentsJsonl = function parseReceivedDocumentsJsonl(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    var docs = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var obj = JSON.parse(line);
        if (ns.isValidReceivedDocument(obj)) {
          docs.push(obj);
        }
      } catch (_e) {
        // Linha malformada ignorada.
      }
    }
    return docs;
  };

  ns.filterDocumentsWithoutPedido = function filterDocumentsWithoutPedido(docs) {
    if (!Array.isArray(docs)) return [];
    // Recebidos exportados pelo Ingestor G12-D1 ja vem com
    // pedido_manual IS NULL/'' por construcao (estado atual do
    // documento na tabela). Mantemos a funcao para simetria com
    // filterEventsByPedido e como defesa em profundidade caso o
    // payload venha com pedido_manual preenchido.
    return docs.filter(function (d) {
      return !(d && typeof d.pedido_manual === 'string' && d.pedido_manual);
    });
  };

  // -------------------------------------------------------------------
  // G14-B: Bridge flat received doc -> event shape para Pedido Detail
  //
  // Converte um documento do formato flat (window.RAVATEX_DOCUMENTS_RECEIVED,
  // schema_version=1, sem event_type, sem wrapper document{}) para o shape
  // esperado pelo codigo de renderizacao do Pedido Detail:
  //   { document: {...}, status, created_at, event_type, pedido_manual
  //     [, ingestion_event_id] }
  //
  // Regras:
  //   - created_at usa o timestamp mais recente entre:
  //       rejected_at > accepted_at > linked_at > detected_at >
  //       received_at > created_at
  //   - event_type inferido do status:
  //       accepted  -> document.accepted
  //       assigned  -> document.linked
  //       rejected  -> document.rejected
  //       pending/default -> document.detected
  //   - ingestion_event_id selecionado por status (G18-B):
  //       accepted  -> accepted_ingestion_event_id
  //       assigned  -> linked_ingestion_event_id
  //       rejected  -> rejected_ingestion_event_id
  //       pending   -> detected_ingestion_event_id
  //       fallback  -> latest_ingestion_event_id
  //   - NAO inventa ingestion_event_id (null/ausente = campo omisso).
  //   - NAO fabrica event_id.
  //   - Campos parciais sao tolerados (fallback para string vazia).
  // -------------------------------------------------------------------
  ns.pickReceivedDocIngestionEventId = function pickReceivedDocIngestionEventId(receivedDoc, status) {
    if (!receivedDoc || typeof receivedDoc !== 'object') return undefined;
    var id;
    if (status === 'accepted') id = receivedDoc.accepted_ingestion_event_id;
    else if (status === 'assigned') id = receivedDoc.linked_ingestion_event_id;
    else if (status === 'rejected') id = receivedDoc.rejected_ingestion_event_id;
    else id = receivedDoc.detected_ingestion_event_id;
    if (!(typeof id === 'string' && id)) id = receivedDoc.latest_ingestion_event_id;
    return (typeof id === 'string' && id) ? id : undefined;
  };

  ns.mapReceivedDocToEventShape = function mapReceivedDocToEventShape(receivedDoc) {
    if (!receivedDoc || typeof receivedDoc !== 'object') return null;

    var doc = {
      document_id: typeof receivedDoc.document_id === 'string' ? receivedDoc.document_id : '',
      tipo_documento: typeof receivedDoc.tipo_documento === 'string'
        ? receivedDoc.tipo_documento
        : (typeof receivedDoc.tipo === 'string' ? receivedDoc.tipo : ''),
      formato: typeof receivedDoc.formato === 'string' ? receivedDoc.formato : '',
      direcao_nf: typeof receivedDoc.direcao_nf === 'string'
        ? receivedDoc.direcao_nf
        : (typeof receivedDoc.direcao === 'string' ? receivedDoc.direcao : ''),
      filename_original: typeof receivedDoc.filename_original === 'string'
        ? receivedDoc.filename_original
        : (typeof receivedDoc.filename === 'string' ? receivedDoc.filename : 'Documento'),
      drive_web_view_link: typeof receivedDoc.drive_web_view_link === 'string'
        ? receivedDoc.drive_web_view_link : '',
      reason: typeof receivedDoc.rejected_reason === 'string'
        ? receivedDoc.rejected_reason
        : (typeof receivedDoc.reason === 'string' ? receivedDoc.reason : ''),
    };

    var status = typeof receivedDoc.status === 'string'
      ? receivedDoc.status.toLowerCase() : 'pending';

    var eventType;
    if (status === 'accepted' || status === 'aceito') {
      eventType = 'document.accepted';
    } else if (status === 'assigned' || status === 'atrelado' || status === 'vinculado') {
      eventType = 'document.linked';
    } else if (status === 'rejected' || status === 'rejeitado') {
      eventType = 'document.rejected';
    } else {
      eventType = 'document.detected';
    }

    var timestamps = [
      receivedDoc.rejected_at,
      receivedDoc.accepted_at,
      receivedDoc.linked_at,
      receivedDoc.detected_at,
      receivedDoc.received_at,
      receivedDoc.created_at,
    ];
    var bestTs = '';
    for (var ti = 0; ti < timestamps.length; ti++) {
      if (typeof timestamps[ti] === 'string' && timestamps[ti]) {
        if (!bestTs || timestamps[ti] > bestTs) {
          bestTs = timestamps[ti];
        }
      }
    }

    var pickedIngestionId = ns.pickReceivedDocIngestionEventId(receivedDoc, status);

    var result = {
      document: doc,
      status: status,
      created_at: bestTs,
      event_type: eventType,
      pedido_manual: typeof receivedDoc.pedido_manual === 'string'
        ? receivedDoc.pedido_manual : '',
    };

    if (typeof pickedIngestionId === 'string' && pickedIngestionId) {
      result.ingestion_event_id = pickedIngestionId;
    }

    return result;
  };

  // -------------------------------------------------------------------
  // G20-B: Decisão local de documento (aceitar/rejeitar/desfazer)
  // Persistida em localStorage por document_id. O JSONL importado
  // continua sendo snapshot externo — a decisão local vence na UI.
  // -------------------------------------------------------------------

  ns.DECISIONS_KEY = 'RAVATEX_DOCUMENTS_DECISIONS';

  ns.loadDocumentDecisions = function loadDocumentDecisions() {
    try {
      var raw = localStorage.getItem(ns.DECISIONS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      return parsed;
    } catch (_e) {
      return {};
    }
  };

  ns.saveDocumentDecision = function saveDocumentDecision(documentId, decision) {
    if (typeof documentId !== 'string' || !documentId) return { ok: false, error: 'document_id obrigatorio' };
    if (!decision || typeof decision !== 'object') return { ok: false, error: 'decision invalida' };
    var st = decision.status;
    if (st !== 'accepted' && st !== 'rejected') return { ok: false, error: 'status deve ser accepted ou rejected' };
    if (st === 'rejected' && !(typeof decision.motivo === 'string' && decision.motivo.trim())) {
      return { ok: false, error: 'rejeicao exige motivo' };
    }
    var decisions = ns.loadDocumentDecisions();
    decisions[documentId] = {
      status: st,
      motivo: (typeof decision.motivo === 'string' ? decision.motivo.trim() : ''),
      decidedAt: typeof decision.decidedAt === 'string' ? decision.decidedAt : new Date().toISOString(),
      decidedBy: typeof decision.decidedBy === 'string' ? decision.decidedBy : '',
      importHash: typeof decision.importHash === 'string' ? decision.importHash : '',
    };
    try {
      localStorage.setItem(ns.DECISIONS_KEY, JSON.stringify(decisions));
      return { ok: true };
    } catch (_e) {
      return { ok: false, error: 'falha ao salvar localStorage' };
    }
  };

  ns.removeDocumentDecision = function removeDocumentDecision(documentId) {
    if (typeof documentId !== 'string' || !documentId) return { ok: false };
    var decisions = ns.loadDocumentDecisions();
    if (!decisions[documentId]) return { ok: true };
    delete decisions[documentId];
    try {
      localStorage.setItem(ns.DECISIONS_KEY, JSON.stringify(decisions));
      return { ok: true };
    } catch (_e) {
      return { ok: false };
    }
  };

  ns.getDocumentDecision = function getDocumentDecision(documentId) {
    if (typeof documentId !== 'string' || !documentId) return null;
    var decisions = ns.loadDocumentDecisions();
    return decisions[documentId] || null;
  };

  ns.getEffectiveDocumentStatus = function getEffectiveDocumentStatus(docOrId, importedStatus) {
    var docId, impSt;
    if (typeof docOrId === 'string') {
      docId = docOrId;
      impSt = typeof importedStatus === 'string' ? importedStatus.toLowerCase() : 'pending';
    } else if (docOrId && typeof docOrId === 'object') {
      docId = docOrId.document_id || docOrId.id;
      impSt = typeof docOrId.status === 'string' ? docOrId.status.toLowerCase() : 'pending';
    } else {
      return null;
    }
    if (!docId) return null;
    var decision = ns.getDocumentDecision(docId);
    var effSt = decision ? decision.status : impSt;
    return {
      document_id: docId,
      importedStatus: impSt,
      effectiveStatus: effSt,
      decision: decision,
      isLocalDecision: !!decision,
      isDivergent: decision && decision.status !== impSt,
    };
  };

  // -------------------------------------------------------------------
  // Namespace
  // -------------------------------------------------------------------

  window.RAVATEX_DOCUMENTS = ns;
})(window);
