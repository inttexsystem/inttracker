import type {
  CnpjPartyState,
  CompatibilityIssue,
  DocumentReview,
  DocumentReviewCompatibility,
  EvidenceOrigin,
  HumanDecision,
  HumanDecisionHistoryEntry,
  HumanReviewInput,
  OperationalLinks,
  ReviewReasonCode,
  ReviewSuggestion,
  TechnicalEvidence,
} from '../types/documentReview.js';

// ============================================================================
// composeReviewSuggestion
// Pure composition of the immutable system suggestion from explicit
// technical evidence. The suggestion is never a decision:
//   - requiresHumanReview is a literal true
//   - there is no auto-accept / status / score / confidence / rating
// The function reads upstream observations and emits reason codes;
// it does not invoke or duplicate the classifier, CNPJ
// normalization/validation, entity matching or dedupe.
//
// Registry availability is read from TechnicalEvidence.registryAvailability
// (the discriminated available / unavailable / not_observed field) and is
// independent of DocumentEntityMatchResult.state. A null entityMatch
// produces registry_not_observed, never registry_unavailable.
// ============================================================================

export function composeReviewSuggestion(evidence: TechnicalEvidence): ReviewSuggestion {
  const reasonCodes: ReviewReasonCode[] = [];
  const warnings: string[] = [];
  let allUnavailable = true;

  switch (evidence.xmlObservation.classification) {
    case 'non_xml': reasonCodes.push('xml_non_xml'); allUnavailable = false; break;
    case 'malformed_xml': reasonCodes.push('xml_malformed'); allUnavailable = false; break;
    case 'well_formed_non_nfe': reasonCodes.push('xml_well_formed_non_nfe'); allUnavailable = false; break;
    case 'structural_nfe': reasonCodes.push('xml_structural_nfe'); allUnavailable = false; break;
    case 'unavailable': reasonCodes.push('xml_unavailable'); break;
  }

  switch (evidence.pdfObservation.classification) {
    case 'invalid_signature': reasonCodes.push('pdf_invalid_signature'); allUnavailable = false; break;
    case 'generic_pdf': reasonCodes.push('pdf_generic'); allUnavailable = false; break;
    case 'probable_fiscal_pdf': reasonCodes.push('pdf_probable_fiscal'); allUnavailable = false; break;
    case 'unavailable': reasonCodes.push('pdf_unavailable'); break;
  }

  const emit = evidence.cnpjEmitente;
  const dest = evidence.cnpjDestinatario;
  if (emit.kind === 'unavailable' && dest.kind === 'unavailable') {
    reasonCodes.push('cnpj_both_unavailable');
  } else if (emit.kind === 'missing' && dest.kind === 'missing') {
    reasonCodes.push('cnpj_both_missing');
  } else {
    pushCnpjSide(emit, 'emitente', reasonCodes);
    pushCnpjSide(dest, 'destinatario', reasonCodes);
  }
  if (emit.kind !== 'unavailable' || dest.kind !== 'unavailable') {
    allUnavailable = false;
  }

  if (evidence.mimeExtensionObservation.compatibility === 'unavailable') {
    reasonCodes.push('mime_extension_unavailable');
  } else if (evidence.mimeExtensionObservation.compatibility === 'compatible') {
    reasonCodes.push('mime_extension_compatible');
    allUnavailable = false;
  } else if (evidence.mimeExtensionObservation.compatibility === 'conflict') {
    reasonCodes.push('mime_extension_conflict');
    warnings.push('MIME / extension conflict: human review required.');
    allUnavailable = false;
  } else {
    reasonCodes.push('mime_extension_insufficient_evidence');
    allUnavailable = false;
  }

  if (evidence.directionObservation) {
    const d = evidence.directionObservation;
    if (d.kind === 'entrada') reasonCodes.push('direction_entrada');
    else if (d.kind === 'saida') reasonCodes.push('direction_saida');
    else reasonCodes.push('direction_desconhecida');
    allUnavailable = false;
  }

  switch (evidence.registryAvailability.kind) {
    case 'unavailable':
      if (!reasonCodes.includes('registry_unavailable')) {
        reasonCodes.push('registry_unavailable');
      }
      warnings.push(evidence.registryAvailability.warning);
      allUnavailable = false;
      break;
    case 'not_observed':
      if (!reasonCodes.includes('registry_not_observed')) {
        reasonCodes.push('registry_not_observed');
      }
      break;
    case 'available':
      break;
  }

  if (evidence.entityMatch) {
    const em = evidence.entityMatch;
    if (em.state === 'ambiguous') {
      reasonCodes.push('counterparty_ambiguous');
    } else if (em.state === 'matched') {
      reasonCodes.push('counterparty_matched');
    } else if (
      em.state === 'unmatched' ||
      em.state === 'no_extracted_cnpj' ||
      em.state === 'invalid_extracted_cnpj'
    ) {
      reasonCodes.push('counterparty_unmatched');
    }
    allUnavailable = false;
    if (
      em.state === 'registry_unavailable' &&
      evidence.registryAvailability.kind === 'available'
    ) {
      reasonCodes.push('compatibility_issue');
      warnings.push('Inconsistency: entityMatch.state=registry_unavailable but registryAvailability=available.');
    }
  }

  switch (evidence.duplicateRelation.kind) {
    case 'none': reasonCodes.push('duplicate_none'); break;
    case 'same_attachment': reasonCodes.push('duplicate_same_attachment'); break;
    case 'same_message': reasonCodes.push('duplicate_same_message'); break;
    case 'cross_message_reuse': reasonCodes.push('duplicate_cross_message'); break;
    case 'possible_duplicate': reasonCodes.push('duplicate_possible'); break;
    case 'indeterminate': reasonCodes.push('duplicate_indeterminate'); break;
  }
  if (evidence.duplicateRelation.kind !== 'none') {
    allUnavailable = false;
  }

  if (allUnavailable) {
    reasonCodes.push('legacy_no_observation');
    warnings.push('No technical observation available (legacy / no-evidence path).');
  }

  return {
    requiresHumanReview: true,
    tipoDocumento: evidence.tipoDocumento,
    formato: evidence.formato,
    direcao: evidence.directionObservation?.kind ?? null,
    reasonCodes,
    warnings,
    note: 'system suggestion only; never auto-accept; human review required',
  };
}

function pushCnpjSide(
  state: CnpjPartyState,
  side: 'emitente' | 'destinatario',
  out: ReviewReasonCode[],
): void {
  switch (state.kind) {
    case 'unavailable': out.push(side === 'emitente' ? 'cnpj_emitente_unavailable' : 'cnpj_destinatario_unavailable'); break;
    case 'missing': out.push(side === 'emitente' ? 'cnpj_emitente_missing' : 'cnpj_destinatario_missing'); break;
    case 'invalid': out.push(side === 'emitente' ? 'cnpj_emitente_invalid' : 'cnpj_destinatario_invalid'); break;
    case 'valid': out.push(side === 'emitente' ? 'cnpj_emitente_valid' : 'cnpj_destinatario_valid'); break;
  }
}

// ============================================================================
// composeOperationalLinks
// Pure composition of explicit Pedido / OP ID arrays. Integrity is
// deferred to persistence. No generic target / parceiro fields.
// ============================================================================

export interface OperationalLinksInput {
  suggestedPedidoIds?: readonly string[];
  suggestedOpIds?: readonly string[];
  confirmedPedidoIds?: readonly string[];
  confirmedOpIds?: readonly string[];
  compatibilityIssues?: readonly CompatibilityIssue[];
}

export function composeOperationalLinks(input: OperationalLinksInput = {}): OperationalLinks {
  return {
    suggestedPedidoIds: [...(input.suggestedPedidoIds ?? [])],
    suggestedOpIds: [...(input.suggestedOpIds ?? [])],
    confirmedPedidoIds: [...(input.confirmedPedidoIds ?? [])],
    confirmedOpIds: [...(input.confirmedOpIds ?? [])],
    compatibilityIssues: [...(input.compatibilityIssues ?? [])],
    integrity: 'deferred to persistence',
  };
}

// ============================================================================
// composeDocumentReview
// Pure composition of the full review from explicit inputs. The
// provenance (EvidenceOrigin) and evidenceVersion are required, not
// defaulted. Human decision persistence is conceptual-compatible with
// the existing document_decisions only; ignore is deferred to B5;
// revoke carries re-opening / revocation semantics.
// ============================================================================

const privateDefaultCompatibility: DocumentReviewCompatibility = {
  decisionStore: 'conceptual_compat_with_document_decisions',
  ignorePersistence: 'deferred_B5',
  revokeSemantics: 're_opening_or_revocation',
};

export interface ComposeDocumentReviewInput {
  documentId: string;
  technicalEvidence: TechnicalEvidence;
  origin: EvidenceOrigin;
  evidenceVersion: number;
  operationalLinks?: OperationalLinks;
  humanReviewInput?: HumanReviewInput | null;
  humanDecision?: HumanDecision | null;
  humanDecisionHistory?: readonly HumanDecisionHistoryEntry[];
}

export function composeDocumentReview(input: ComposeDocumentReviewInput): DocumentReview {
  const systemSuggestion = composeReviewSuggestion(input.technicalEvidence);
  return {
    documentId: input.documentId,
    technicalEvidence: input.technicalEvidence,
    systemSuggestion,
    humanReviewInput: input.humanReviewInput ?? null,
    humanDecision: input.humanDecision ?? null,
    humanDecisionHistory: [...(input.humanDecisionHistory ?? [])],
    operationalLinks: input.operationalLinks ?? composeOperationalLinks(),
    origin: input.origin,
    evidenceVersion: input.evidenceVersion,
    compatibility: { ...privateDefaultCompatibility },
  };
}
