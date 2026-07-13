// =====================================================================
// === SCREENS: DOCUMENTOS RECEBIDOS — QUEUE UI (G28-B4-B2) ===========
// Namespace browser-classic `window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI`.
//
// Escopo: binding coeso entre o estado carregado
// (`window.RAVATEX_DOCUMENTS_RECEIVED`) e o read-model de fila
// (`window.createDocumentQueueItem`). Nao faz Supabase, rede, DOM
// semantic source/storage writes nem RPC.
//
// Regras:
//   - consome `window.createDocumentQueueItem` para cada documento;
//   - infere collectionSource da fonte global/documento;
//   - remoteAvailability e derivado deterministicamente da combinacao
//     do collectionSource com o estado global
//     RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
//   - mantem `raw` apenas para documentos legado (acoes legado inalteradas);
//   - toda filtragem usa campos do queue item;
//   - nao muta entradas nem documentos de origem;
//   - preserva ordenacao e cardinalidade;
//   - opcoes de filtro em portugues com codigos estaveis.
// =====================================================================

(function (window) {
  'use strict';

  var SOURCE_TO_COLLECTION_SOURCE = {
    supabase: 'supabase',
    'g22-auto': 'legacy_fallback',
    manual: 'legacy_fallback',
  };

  var VALID_COLLECTION_SOURCES = ['supabase', 'legacy_fallback', 'legacy', 'unknown'];

  function normalizeKey(value) {
    var s = String(value == null ? '' : value).toLowerCase();
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s;
  }

  function getGlobalSource() {
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE === 'string') {
      return window.RAVATEX_DOCUMENTS_RECEIVED_SOURCE;
    }
    return '';
  }

  function inferCollectionSource(doc, globalSource) {
    var docSource = doc && doc._ravatex_source;
    var raw = typeof docSource === 'string' && docSource ? docSource : globalSource;
    var mapped = SOURCE_TO_COLLECTION_SOURCE[raw];
    if (mapped) return mapped;
    if (VALID_COLLECTION_SOURCES.indexOf(raw) >= 0) return raw;
    return 'unknown';
  }

  function getRemoteAvailabilityGlobal() {
    if (typeof window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY === 'string') {
      return window.RAVATEX_DOCUMENTS_RECEIVED_REMOTE_AVAILABILITY;
    }
    return null;
  }

  function inferRemoteAvailability(collectionSource) {
    var globalAvailability = getRemoteAvailabilityGlobal();
    if (globalAvailability === 'unavailable' && collectionSource === 'supabase') {
      return 'unavailable';
    }
    if (globalAvailability === 'available') return 'available';
    if (collectionSource === 'supabase' && globalAvailability !== 'unavailable') return 'available';
    if (globalAvailability === 'unavailable') return 'unavailable';
    return 'not_applicable';
  }

  function isLegacyCollectionSource(collectionSource) {
    return collectionSource === 'legacy_fallback' || collectionSource === 'legacy';
  }

  function buildQueueEntry(doc, index, createDocumentQueueItem) {
    var collectionSource = inferCollectionSource(doc, getGlobalSource());
    var remoteAvailability = inferRemoteAvailability(collectionSource);
    var ctx = { collectionSource: collectionSource, remoteAvailability: remoteAvailability };
    var queueItem = createDocumentQueueItem(doc, ctx);
    if (!queueItem || typeof queueItem !== 'object') return null;
    return {
      index: index,
      queueItem: queueItem,
      raw: isLegacyCollectionSource(collectionSource) ? doc : null,
    };
  }

  function buildQueue() {
    var createDocumentQueueItem = window.createDocumentQueueItem;
    if (typeof createDocumentQueueItem !== 'function') return [];

    var received = window.RAVATEX_DOCUMENTS_RECEIVED;
    if (!Array.isArray(received)) return [];

    var entries = [];
    for (var i = 0; i < received.length; i += 1) {
      var doc = received[i];
      if (!doc || typeof doc !== 'object') continue;
      var entry = buildQueueEntry(doc, i, createDocumentQueueItem);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  function getFilterOptions() {
    return {
      collectionSource: [
        { code: 'all', label: 'Todas as origens' },
        { code: 'canonical_remote', label: 'Remoto canônico' },
        { code: 'legacy_fallback', label: 'Fallback legado' },
        { code: 'unknown', label: 'Desconhecida' },
      ],
      technicalEvidence: [
        { code: 'all', label: 'Todas as evidências' },
        { code: 'available', label: 'Disponível' },
        { code: 'missing', label: 'Ausente' },
        { code: 'invalid', label: 'Inválida' },
        { code: 'remote_unavailable', label: 'Remota indisponível' },
        { code: 'unavailable', label: 'Indisponível' },
      ],
    };
  }

  function fmtIsoDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function matchesPeriod(entry, periodo) {
    if (periodo === 'todos' || !periodo) return true;
    var queueItem = entry.queueItem;
    var d = fmtIsoDate(queueItem.display && queueItem.display.received_at)
      || fmtIsoDate(queueItem.display && queueItem.display.processed_at);
    if (!d) return false;
    var now = new Date();
    if (periodo === 'hoje') {
      return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    }
    var days = periodo === '7d' ? 7 : 30;
    return (now.getTime() - d.getTime()) <= days * 24 * 60 * 60 * 1000;
  }

  function matchesSearch(entry, termo) {
    if (!termo) return true;
    var q = entry.queueItem;
    var id = q.identity || {};
    var pedido = q.pedido || {};
    var display = q.display || {};
    var pedidoText = pedido.pedido_manual || pedido.pedido_id || '';
    var hay = normalizeKey([
      id.filename_original,
      id.tipo_documento,
      pedidoText,
      display.source_display,
    ].join(' '));
    return hay.indexOf(termo) >= 0;
  }

  function matchesStatus(entry, status) {
    if (status === 'todos' || !status) return true;
    var q = entry.queueItem;
    var hasPedido = q.pedido.state === 'confirmed_pedido_reference'
      || q.pedido.state === 'suggested_pedido';
    if (status === 'pending') return q.review.state === 'pending' && !hasPedido;
    if (status === 'assigned') return q.review.state === 'pending' && hasPedido;
    if (status === 'accepted') return q.review.state === 'accepted';
    if (status === 'rejected') return q.review.state === 'rejected';
    return false;
  }

  function matchesTipo(entry, tipo) {
    if (tipo === 'todos' || !tipo) return true;
    var docTipo = entry.queueItem.identity.tipo_documento || '';
    if (tipo === 'desconhecido') return !docTipo;
    return docTipo === tipo;
  }

  function matchesCollectionSource(entry, source) {
    if (source === 'all' || !source) return true;
    var cs = entry.queueItem.filter_values.collection_source;
    if (source === 'canonical_remote') return cs === 'supabase';
    if (source === 'legacy_fallback') return cs === 'legacy_fallback' || cs === 'legacy';
    if (source === 'unknown') return cs === 'unknown';
    return false;
  }

  function matchesPedido(entry, pedido) {
    if (pedido === 'todos' || !pedido) return true;
    var p = entry.queueItem.pedido;
    var val = p.pedido_manual || p.pedido_id || '';
    return val === pedido;
  }

  function matchesTechnicalEvidence(entry, evidence) {
    if (evidence === 'all' || !evidence) return true;
    return entry.queueItem.filter_values.evidence_state === evidence;
  }

  function filterQueue(entries, criteria) {
    entries = Array.isArray(entries) ? entries : [];
    criteria = criteria || {};
    var termo = normalizeKey(criteria.search);
    var visible = entries.filter(function (entry) {
      if (!matchesStatus(entry, criteria.status)) return false;
      if (!matchesTipo(entry, criteria.tipo)) return false;
      if (!matchesPeriod(entry, criteria.periodo)) return false;
      if (!matchesCollectionSource(entry, criteria.collectionSource)) return false;
      if (!matchesTechnicalEvidence(entry, criteria.technicalEvidence)) return false;
      if (!matchesPedido(entry, criteria.pedido)) return false;
      if (!matchesSearch(entry, termo)) return false;
      return true;
    });
    var sourceEmpty = isSourceEmpty();
    return {
      entries: entries.slice(),
      visible: visible,
      isSourceEmpty: sourceEmpty,
      isFilterEmpty: !sourceEmpty && visible.length === 0,
    };
  }

  function isSourceEmpty() {
    var received = window.RAVATEX_DOCUMENTS_RECEIVED;
    return !Array.isArray(received) || received.length === 0;
  }

  function getPedidoOptions(entries) {
    entries = Array.isArray(entries) ? entries : [];
    var seen = {};
    var out = [];
    entries.forEach(function (entry) {
      var p = entry.queueItem.pedido;
      var val = p.pedido_manual || p.pedido_id || '';
      if (val && !seen[val]) {
        seen[val] = true;
        out.push({ value: val, label: val });
      }
    });
    return out;
  }

  function countByStatus(entries) {
    entries = Array.isArray(entries) ? entries : [];
    var counts = { todos: entries.length, pending: 0, assigned: 0, accepted: 0, rejected: 0 };
    entries.forEach(function (entry) {
      var q = entry.queueItem;
      var hasPedido = q.pedido.state === 'confirmed_pedido_reference'
        || q.pedido.state === 'suggested_pedido';
      if (q.review.state === 'pending' && !hasPedido) counts.pending++;
      else if (q.review.state === 'pending' && hasPedido) counts.assigned++;
      else if (q.review.state === 'accepted') counts.accepted++;
      else if (q.review.state === 'rejected') counts.rejected++;
    });
    return counts;
  }

  function getUIState(queueEntries, filterResult, stateArgs) {
    var args = stateArgs || {};

    if (args.loading) {
      return {
        state: 'loading',
        label: 'Carregando documentos...',
        ariaLabel: 'Status: carregando documentos',
        marker: 'queue-ui-state-loading',
      };
    }

    var result = filterResult || filterQueue(queueEntries || [], {});

    if (result.isSourceEmpty) {
      return {
        state: 'source-empty',
        label: 'Nenhum documento recebido.',
        ariaLabel: 'Status: nenhum documento recebido',
        marker: 'queue-ui-state-source-empty',
      };
    }

    if (result.isFilterEmpty) {
      return {
        state: 'filter-empty',
        label: 'Nenhum documento neste filtro.',
        ariaLabel: 'Status: nenhum documento neste filtro',
        marker: 'queue-ui-state-filter-empty',
      };
    }

    var isRemoteUnavailable = getRemoteAvailabilityGlobal() === 'unavailable';

    if (isRemoteUnavailable) {
      var visibleEntries = Array.isArray(result.visible) ? result.visible : [];
      var hasLegacyVisible = false;
      for (var j = 0; j < visibleEntries.length; j += 1) {
        var cs = visibleEntries[j].queueItem.source.collection_source;
        if (cs === 'legacy_fallback' || cs === 'legacy') {
          hasLegacyVisible = true;
          break;
        }
      }

      if (hasLegacyVisible) {
        return {
          state: 'remote-unavailable-legacy-fallback',
          label: 'Conexão remota indisponível. Exibindo registros de fallback local.',
          ariaLabel: 'Status: conexão remota indisponível, exibindo registros locais',
          marker: 'queue-ui-state-remote-unavailable-legacy-fallback',
        };
      }

      return {
        state: 'remote-unavailable',
        label: 'Conexão remota indisponível.',
        ariaLabel: 'Status: conexão remota indisponível',
        marker: 'queue-ui-state-remote-unavailable',
      };
    }

    return null;
  }

  // ===================================================================
  // G28-B4-B3: Presentation functions — pure semantic state -> PT-BR
  // labels/tones/accessibility. Consume queueItem fields only.
  // ===================================================================

  function getEvidencePresentation(queueItem) {
    var ev = queueItem && queueItem.technical_evidence;
    var state = ev && ev.state;
    if (state === 'available') return { label: 'Evidência disponível', tone: 'neutral', ariaLabel: 'Evidência técnica disponível' };
    if (state === 'missing') return { label: 'Evidência ausente', tone: 'info', ariaLabel: 'Evidência técnica ausente' };
    if (state === 'invalid') return { label: 'Evidência inválida', tone: 'warning', ariaLabel: 'Evidência técnica inválida' };
    if (state === 'remote_unavailable') return { label: 'Consulta indisponível', tone: 'warning', ariaLabel: 'Consulta de evidência remota indisponível' };
    if (state === 'unavailable') return { label: 'Não disponível nesta origem', tone: 'neutral', ariaLabel: 'Evidência não disponível nesta origem' };
    return { label: '', tone: 'neutral', ariaLabel: '' };
  }

  function getReviewPresentation(queueItem) {
    var rv = queueItem && queueItem.review;
    var state = rv && rv.state;
    if (state === 'pending') return { label: 'Pendente de revisão', ariaLabel: 'Revisão pendente' };
    if (state === 'accepted') return { label: 'Aceito', ariaLabel: 'Revisão aceita' };
    if (state === 'rejected') return { label: 'Rejeitado', ariaLabel: 'Revisão rejeitada' };
    if (state === 'unknown') return { label: 'Estado desconhecido', ariaLabel: 'Estado de revisão desconhecido' };
    if (state === 'unavailable') return { label: 'Revisão indisponível', ariaLabel: 'Revisão indisponível' };
    return { label: '', ariaLabel: '' };
  }

  function getPedidoPresentation(queueItem) {
    var ped = queueItem && queueItem.pedido;
    var state = ped && ped.state;
    if (state === 'confirmed_pedido_reference') return { label: 'Pedido referenciado', ariaLabel: 'Pedido referenciado confirmado', pedidoId: (ped && ped.pedido_id) || null };
    if (state === 'suggested_pedido') return { label: 'Pedido sugerido', ariaLabel: 'Pedido sugerido', pedidoId: null };
    if (state === 'no_confirmed_link') return { label: 'Sem vínculo confirmado', ariaLabel: 'Sem vínculo confirmado com pedido', pedidoId: null };
    if (state === 'unavailable') return { label: 'Vínculo indisponível', ariaLabel: 'Vínculo com pedido indisponível', pedidoId: null };
    return { label: '', ariaLabel: '', pedidoId: null };
  }

  function getSourcePresentation(queueItem) {
    var src = queueItem && queueItem.source;
    var cs = src && src.collection_source;
    if (cs === 'supabase') return { label: 'Supabase', ariaLabel: 'Origem: Supabase' };
    if (cs === 'legacy_fallback' || cs === 'legacy') return { label: 'Fallback legado', ariaLabel: 'Origem: fallback legado' };
    if (cs === 'unknown') return { label: 'Origem desconhecida', ariaLabel: 'Origem desconhecida' };
    return { label: '', ariaLabel: '' };
  }

  function getAlertPresentation(queueItem) {
    var alerts = (queueItem && queueItem.alerts) || [];
    var codeMap = {
      invalid_evidence: { text: 'Evidência inválida', severity: 'warning' },
      missing_evidence: { text: 'Evidência ausente', severity: 'info' },
      remote_unavailable: { text: 'Consulta remota indisponível', severity: 'warning' },
      unknown_document_type: { text: 'Tipo de documento desconhecido', severity: 'warning' },
      legacy_fallback: { text: 'Dados de fallback legado', severity: 'info' },
      suggested_pedido: { text: 'Pedido sugerido', severity: 'info' },
      unsupported_source_file: { text: 'Arquivo sem suporte a link', severity: 'info' },
    };
    var seen = {};
    var result = [];
    for (var i = 0; i < alerts.length; i++) {
      var code = alerts[i].code;
      if (seen[code]) continue;
      seen[code] = true;
      var mapping = codeMap[code];
      if (mapping) {
        result.push({ code: code, text: mapping.text, severity: mapping.severity, ariaLabel: mapping.text });
      }
    }
    return result;
  }

  // ===================================================================
  // G28-B4-B4: Source-file and validation presentation helpers.
  // Pure consumption of queueItem source_file.state and
  // validation.review. Never derive or call external APIs.
  // ===================================================================

  function getSourceFilePresentation(queueItem) {
    var sf = queueItem && queueItem.source_file;
    var state = sf && sf.state;
    if (state === 'unsupported') {
      return { label: 'Acesso ao arquivo não suportado nesta origem', ariaLabel: 'Acesso ao arquivo não suportado nesta origem' };
    }
    if (state === 'missing') {
      return { label: 'Arquivo não disponível', ariaLabel: 'Arquivo não disponível' };
    }
    return { label: '', ariaLabel: '' };
  }

  function getValidationPresentation(queueItem) {
    var vl = queueItem && queueItem.validation;
    var review = vl && vl.review;
    if (review === 'review_pending') {
      return { label: 'Revisão pendente', ariaLabel: 'Revisão pendente' };
    }
    if (review === 'review_unavailable') {
      return { label: 'Revisão indisponível', ariaLabel: 'Revisão indisponível' };
    }
    return { label: '', ariaLabel: '' };
  }

  window.RAVATEX_DOCUMENTOS_RECEBIDOS_QUEUE_UI = {
    buildQueue: buildQueue,
    getFilterOptions: getFilterOptions,
    filterQueue: filterQueue,
    isSourceEmpty: isSourceEmpty,
    getPedidoOptions: getPedidoOptions,
    countByStatus: countByStatus,
    getUIState: getUIState,
    getEvidencePresentation: getEvidencePresentation,
    getReviewPresentation: getReviewPresentation,
    getPedidoPresentation: getPedidoPresentation,
    getSourcePresentation: getSourcePresentation,
    getAlertPresentation: getAlertPresentation,
    getSourceFilePresentation: getSourceFilePresentation,
    getValidationPresentation: getValidationPresentation,
  };
})(window);
