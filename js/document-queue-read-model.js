'use strict';

var EVIDENCE_STATE = {
  AVAILABLE: 'available',
  MISSING: 'missing',
  INVALID: 'invalid',
  REMOTE_UNAVAILABLE: 'remote_unavailable',
  UNAVAILABLE: 'unavailable',
};

var REVIEW_STATE = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
};

var SOURCE_CAPABILITY = {
  DRIVE_AVAILABLE: 'drive_available',
  UNSUPPORTED: 'unsupported',
  MISSING: 'missing',
};

var PEDIDO_STATE = {
  SUGGESTED_PEDIDO: 'suggested_pedido',
  CONFIRMED_PEDIDO_REFERENCE: 'confirmed_pedido_reference',
  UNAVAILABLE: 'unavailable',
};

var VALIDATION_INDICATION = {
  REVIEW_AVAILABLE: 'review_available',
  REVIEW_PENDING: 'review_pending',
  REVIEW_UNAVAILABLE: 'review_unavailable',
};

var ALERT_CODE = {
  INVALID_EVIDENCE: 'invalid_evidence',
  MISSING_EVIDENCE: 'missing_evidence',
  REMOTE_UNAVAILABLE: 'remote_unavailable',
  UNKNOWN_DOCUMENT_TYPE: 'unknown_document_type',
  LEGACY_FALLBACK: 'legacy_fallback',
  SUGGESTED_PEDIDO: 'suggested_pedido',
  UNSUPPORTED_SOURCE_FILE: 'unsupported_source_file',
};

var ALERT_SEVERITY = {
  WARNING: 'warning',
  INFO: 'info',
};

var VALID_COLLECTION_SOURCES = ['supabase', 'legacy_fallback', 'legacy', 'unknown'];
var VALID_REMOTE_AVAILABILITIES = ['available', 'unavailable', 'not_applicable'];

function asString(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeCollectionSource(raw) {
  if (typeof raw === 'string' && VALID_COLLECTION_SOURCES.indexOf(raw) >= 0) {
    return raw;
  }
  return 'unknown';
}

function normalizeRemoteAvailability(raw) {
  if (typeof raw === 'string' && VALID_REMOTE_AVAILABILITIES.indexOf(raw) >= 0) {
    return raw;
  }
  return 'not_applicable';
}

function computeIdentity(documentRecord) {
  var docId = asString(documentRecord.document_id);
  return {
    document_id: docId || '',
    filename_original: asString(documentRecord.filename_original) || '',
    tipo_documento: asString(documentRecord.tipo_documento) || '',
    formato: asString(documentRecord.formato) || '',
    direcao_nf: asString(documentRecord.direcao_nf) || null,
  };
}

function computeSource(collectionSource) {
  return {
    collection_source: collectionSource,
  };
}

function computeReview(documentRecord, collectionSource) {
  if (collectionSource === 'legacy_fallback' || collectionSource === 'legacy') {
    return { state: REVIEW_STATE.UNAVAILABLE };
  }

  var decision = documentRecord._ravatex_server_decision;
  if (decision) {
    if (decision.status === 'accepted') return { state: REVIEW_STATE.ACCEPTED };
    if (decision.status === 'rejected') return { state: REVIEW_STATE.REJECTED };
    return { state: REVIEW_STATE.UNKNOWN };
  }

  var status = asString(documentRecord.status);
  if (status === 'accepted') return { state: REVIEW_STATE.ACCEPTED };
  if (status === 'rejected') return { state: REVIEW_STATE.REJECTED };
  if (status === 'pending') return { state: REVIEW_STATE.PENDING };

  return { state: REVIEW_STATE.UNKNOWN };
}

function computeEvidence(documentRecord, collectionSource, remoteAvailability) {
  if (collectionSource === 'legacy_fallback' || collectionSource === 'legacy') {
    return { state: EVIDENCE_STATE.UNAVAILABLE };
  }

  if (remoteAvailability === 'unavailable') {
    return { state: EVIDENCE_STATE.REMOTE_UNAVAILABLE };
  }

  var evidence = documentRecord._ravatex_technical_evidence;
  if (!evidence || typeof evidence !== 'object') {
    return { state: EVIDENCE_STATE.MISSING };
  }

  if (evidence.state === 'available') {
    return {
      state: EVIDENCE_STATE.AVAILABLE,
      evidenceVersion: typeof evidence.evidenceVersion === 'number' ? evidence.evidenceVersion : null,
      createdAt: asString(evidence.createdAt),
    };
  }

  if (evidence.state === 'invalid') {
    return { state: EVIDENCE_STATE.INVALID };
  }

  if (evidence.state === 'missing') {
    return { state: EVIDENCE_STATE.MISSING };
  }

  return { state: EVIDENCE_STATE.MISSING };
}

function computePedido(documentRecord) {
  var pedidoManual = asString(documentRecord.pedido_manual);
  var pedidoId = asString(documentRecord.pedido_id);

  if (pedidoId) {
    return {
      state: PEDIDO_STATE.CONFIRMED_PEDIDO_REFERENCE,
      pedido_id: pedidoId,
      pedido_manual: pedidoManual || null,
    };
  }

  if (pedidoManual) {
    return {
      state: PEDIDO_STATE.SUGGESTED_PEDIDO,
      pedido_manual: pedidoManual,
      pedido_id: null,
    };
  }

  return {
    state: PEDIDO_STATE.UNAVAILABLE,
    pedido_manual: null,
    pedido_id: null,
  };
}

function computeOP() {
  return { state: 'unavailable' };
}

function computeDuplicate() {
  return { state: 'unavailable' };
}

function computeSourceFileCapability(documentRecord) {
  var driveLink = asString(documentRecord.drive_web_view_link);
  var driveId = asString(documentRecord.drive_file_id);

  if (driveLink || driveId) {
    return { state: SOURCE_CAPABILITY.DRIVE_AVAILABLE };
  }

  var emailId = asString(documentRecord.email_message_id) || asString(documentRecord.gmail_message_id);
  var localPath = asString(documentRecord.local_path);

  if (emailId || localPath) {
    return { state: SOURCE_CAPABILITY.UNSUPPORTED };
  }

  return { state: SOURCE_CAPABILITY.MISSING };
}

function computeAlerts(documentRecord, collectionSource, evidenceState, sourceCapability) {
  var alerts = [];

  if (evidenceState === EVIDENCE_STATE.INVALID) {
    alerts.push({ code: ALERT_CODE.INVALID_EVIDENCE, severity: ALERT_SEVERITY.WARNING });
  }

  if (evidenceState === EVIDENCE_STATE.MISSING) {
    alerts.push({ code: ALERT_CODE.MISSING_EVIDENCE, severity: ALERT_SEVERITY.INFO });
  }

  if (evidenceState === EVIDENCE_STATE.REMOTE_UNAVAILABLE) {
    alerts.push({ code: ALERT_CODE.REMOTE_UNAVAILABLE, severity: ALERT_SEVERITY.WARNING });
  }

  var tipo = asString(documentRecord.tipo_documento);
  if (!tipo && collectionSource !== 'legacy_fallback' && collectionSource !== 'legacy') {
    alerts.push({ code: ALERT_CODE.UNKNOWN_DOCUMENT_TYPE, severity: ALERT_SEVERITY.WARNING });
  }

  if (collectionSource === 'legacy_fallback') {
    alerts.push({ code: ALERT_CODE.LEGACY_FALLBACK, severity: ALERT_SEVERITY.INFO });
  }

  var pedidoManual = asString(documentRecord.pedido_manual);
  var pedidoId = asString(documentRecord.pedido_id);
  if (pedidoManual && !pedidoId) {
    alerts.push({ code: ALERT_CODE.SUGGESTED_PEDIDO, severity: ALERT_SEVERITY.INFO });
  }

  if (sourceCapability === SOURCE_CAPABILITY.UNSUPPORTED || sourceCapability === SOURCE_CAPABILITY.MISSING) {
    alerts.push({ code: ALERT_CODE.UNSUPPORTED_SOURCE_FILE, severity: ALERT_SEVERITY.INFO });
  }

  return alerts;
}

function computeDisplay(documentRecord) {
  return {
    received_at: asString(documentRecord.email_received_at) || asString(documentRecord.received_at) || null,
    processed_at: asString(documentRecord.detected_at) || asString(documentRecord.created_at) || null,
    source_display: asString(documentRecord.sender_email) || asString(documentRecord.from) || null,
  };
}

function computeFilterValues(collectionSource, evidenceState, reviewState, pedidoState, sourceCapability, tipoDocumento, formato, direcaoNf, validationReview) {
  return {
    collection_source: collectionSource,
    evidence_state: evidenceState,
    review_state: reviewState,
    pedido_state: pedidoState,
    source_capability: sourceCapability,
    tipo_documento: tipoDocumento,
    formato: formato,
    direcao_nf: direcaoNf,
    validation_review: validationReview,
  };
}

function computeValidationIndication(collectionSource, remoteAvailability, reviewState) {
  if (collectionSource === 'legacy_fallback' || collectionSource === 'legacy') {
    return { review: VALIDATION_INDICATION.REVIEW_UNAVAILABLE };
  }
  if (remoteAvailability === 'unavailable') {
    return { review: VALIDATION_INDICATION.REVIEW_UNAVAILABLE };
  }
  if (reviewState === REVIEW_STATE.ACCEPTED || reviewState === REVIEW_STATE.REJECTED) {
    return { review: VALIDATION_INDICATION.REVIEW_UNAVAILABLE };
  }
  return { review: VALIDATION_INDICATION.REVIEW_PENDING };
}

function getAuthorizedFilters() {
  return [
    { axis: 'collection_source', values: [].concat(VALID_COLLECTION_SOURCES) },
    { axis: 'evidence_state', values: [
      EVIDENCE_STATE.AVAILABLE,
      EVIDENCE_STATE.MISSING,
      EVIDENCE_STATE.INVALID,
      EVIDENCE_STATE.REMOTE_UNAVAILABLE,
      EVIDENCE_STATE.UNAVAILABLE,
    ] },
    { axis: 'review_state', values: [
      REVIEW_STATE.PENDING,
      REVIEW_STATE.ACCEPTED,
      REVIEW_STATE.REJECTED,
      REVIEW_STATE.UNKNOWN,
      REVIEW_STATE.UNAVAILABLE,
    ] },
    { axis: 'pedido_state', values: [
      PEDIDO_STATE.CONFIRMED_PEDIDO_REFERENCE,
      PEDIDO_STATE.SUGGESTED_PEDIDO,
      PEDIDO_STATE.UNAVAILABLE,
    ] },
    { axis: 'source_capability', values: [
      SOURCE_CAPABILITY.DRIVE_AVAILABLE,
      SOURCE_CAPABILITY.UNSUPPORTED,
      SOURCE_CAPABILITY.MISSING,
    ] },
    { axis: 'tipo_documento', values: ['nf', 'romaneio', 'boleto', 'contrato', 'outros'] },
    { axis: 'formato', values: ['xml', 'pdf', 'csv', 'xlsx', 'jsonl', 'txt', 'png', 'jpeg'] },
    { axis: 'direcao_nf', values: ['entrada', 'saida', null] },
    { axis: 'validation_review', values: [
      VALIDATION_INDICATION.REVIEW_AVAILABLE,
      VALIDATION_INDICATION.REVIEW_PENDING,
      VALIDATION_INDICATION.REVIEW_UNAVAILABLE,
    ] },
  ];
}

function createDocumentQueueItem(documentRecord, context) {
  if (!documentRecord || typeof documentRecord !== 'object') {
    return null;
  }

  var ctx = typeof context === 'object' && context !== null ? context : {};
  var collectionSource = normalizeCollectionSource(ctx.collectionSource);
  var remoteAvailability = normalizeRemoteAvailability(ctx.remoteAvailability);

  var identity = computeIdentity(documentRecord);
  var source = computeSource(collectionSource);
  var review = computeReview(documentRecord, collectionSource);
  var evidence = computeEvidence(documentRecord, collectionSource, remoteAvailability);
  var pedido = computePedido(documentRecord);
  var op = computeOP();
  var duplicate = computeDuplicate();
  var sourceFile = computeSourceFileCapability(documentRecord);
  var alerts = computeAlerts(documentRecord, collectionSource, evidence.state, sourceFile.state);
  var validation = computeValidationIndication(collectionSource, remoteAvailability, review.state);
  var display = computeDisplay(documentRecord);
  var filterValues = computeFilterValues(
    collectionSource,
    evidence.state,
    review.state,
    pedido.state,
    sourceFile.state,
    identity.tipo_documento,
    identity.formato,
    identity.direcao_nf,
    validation.review
  );

  return {
    identity: identity,
    source: source,
    source_file: sourceFile,
    review: review,
    technical_evidence: evidence,
    pedido: pedido,
    op: op,
    duplicate: duplicate,
    alerts: alerts,
    validation: validation,
    display: display,
    filter_values: filterValues,
  };
}

var constants = {
  EVIDENCE_STATE: EVIDENCE_STATE,
  REVIEW_STATE: REVIEW_STATE,
  SOURCE_CAPABILITY: SOURCE_CAPABILITY,
  PEDIDO_STATE: PEDIDO_STATE,
  VALIDATION_INDICATION: VALIDATION_INDICATION,
  ALERT_CODE: ALERT_CODE,
  ALERT_SEVERITY: ALERT_SEVERITY,
  VALID_COLLECTION_SOURCES: VALID_COLLECTION_SOURCES,
  VALID_REMOTE_AVAILABILITIES: VALID_REMOTE_AVAILABILITIES,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createDocumentQueueItem: createDocumentQueueItem,
    getAuthorizedFilters: getAuthorizedFilters,
    constants: constants,
  };
}
