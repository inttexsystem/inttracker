// =====================================================================
// === js/documents-ingestor-loader.js ==================================
// Loader local/manual para popular window.RAVATEX_DOCUMENTS_LOADED_EVENTS
// a partir de texto JSONL, array de eventos ou URL local controlada.
//
// Fase: RAVATEX-TAPETES-G11-D-DOCUMENTS-LOCAL-LOADER
// Escopo: funcoes explicitas, sem auto-load em producao, sem Supabase,
//   sem Google/Drive, sem persistencia, sem rede automatica.
//
// Depende de js/documents-ingestor.js (window.RAVATEX_DOCUMENTS).
// Carregar via <script src="js/documents-ingestor-loader.js?v=...></script>
// DEPOIS de js/documents-ingestor.js.
//
// Uso explicito (dev/teste):
//   RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromText(jsonlText);
//   RAVATEX_DOCUMENTS.loadDocumentsIngestorEventsFromUrl('/data/fixtures/document-events-sample.jsonl');
//   RAVATEX_DOCUMENTS.setDocumentsIngestorEvents(eventsArray);
//
// Nao carrega nada automaticamente. Nao faz fetch sem chamada explicita.
// Nao persiste nada. Nao chama Supabase nem Google/Drive.
// =====================================================================

(function (window) {
  'use strict';

  var ns = window.RAVATEX_DOCUMENTS;
  if (!ns) {
    return;
  }

  var MAX_EVENTS = 2000;

  // -------------------------------------------------------------------
  // Validacao de array de eventos
  // -------------------------------------------------------------------

  function validateEventsArray(events) {
    if (!Array.isArray(events)) {
      return { valid: false, error: '{input} deve ser um array.' };
    }
    if (events.length > MAX_EVENTS) {
      return { valid: false, error: 'Excedeu o limite maximo de ' + MAX_EVENTS + ' eventos.' };
    }
    for (var i = 0; i < events.length; i++) {
      if (!ns.isValidDocumentEvent(events[i])) {
        return { valid: false, error: 'Evento invalido na posicao ' + i + ' (falta event_type, pedido_manual ou document.document_id).' };
      }
    }
    return { valid: true };
  }

  // -------------------------------------------------------------------
  // Carregar eventos a partir de texto JSONL
  // -------------------------------------------------------------------

  ns.loadDocumentsIngestorEventsFromText = function loadDocumentsIngestorEventsFromText(jsonlText) {
    if (typeof jsonlText !== 'string' || !jsonlText.trim()) {
      return { ok: false, count: 0, error: '{input} deve ser uma string JSONL nao vazia.' };
    }

    var events;
    try {
      events = ns.parseDocumentEventsJsonl(jsonlText);
    } catch (_e) {
      return { ok: false, count: 0, error: 'Falha ao interpretar JSONL como eventos: ' + String(_e) };
    }

    if (!events.length) {
      return { ok: false, count: 0, error: 'Nenhum evento valido encontrado no texto JSONL.' };
    }

    var validation = validateEventsArray(events);
    if (!validation.valid) {
      return { ok: false, count: 0, error: validation.error };
    }

    var deduped = ns.deduplicateEvents(events);
    window.RAVATEX_DOCUMENTS_LOADED_EVENTS = deduped;

    return { ok: true, count: deduped.length };
  };

  // -------------------------------------------------------------------
  // Carregar eventos a partir de URL local controlada (chamada explicita)
  // -------------------------------------------------------------------

  ns.loadDocumentsIngestorEventsFromUrl = function loadDocumentsIngestorEventsFromUrl(url) {
    if (typeof url !== 'string' || !url.trim()) {
      return Promise.resolve({ ok: false, count: 0, error: '{url} deve ser uma string nao vazia.' });
    }

    if (typeof window.fetch !== 'function') {
      return new Promise(function (resolve) {
        resolve({ ok: false, count: 0, error: 'fetch nao esta disponivel neste ambiente.' });
      });
    }

    return window.fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (text) {
        if (typeof text !== 'string' || !text.trim()) {
          return { ok: false, count: 0, error: 'Resposta da URL esta vazia.' };
        }
        return ns.loadDocumentsIngestorEventsFromText(text);
      })
      .catch(function (err) {
        return { ok: false, count: 0, error: 'Erro ao carregar eventos da URL: ' + String(err) };
      });
  };

  // -------------------------------------------------------------------
  // Setar eventos diretamente a partir de array pre-existente
  // -------------------------------------------------------------------

  ns.setDocumentsIngestorEvents = function setDocumentsIngestorEvents(events) {
    if (!Array.isArray(events)) {
      return { ok: false, count: 0, error: '{events} deve ser um array.' };
    }

    if (events.length === 0) {
      window.RAVATEX_DOCUMENTS_LOADED_EVENTS = [];
      return { ok: true, count: 0 };
    }

    var validation = validateEventsArray(events);
    if (!validation.valid) {
      return { ok: false, count: 0, error: validation.error };
    }

    var deduped = ns.deduplicateEvents(events);
    window.RAVATEX_DOCUMENTS_LOADED_EVENTS = deduped;

    return { ok: true, count: deduped.length };
  };

})(window);
