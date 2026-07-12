import type { TipoDocumento, FormatoDocumento, DirecaoNF } from './document.js';
import type { DocumentEntityMatchResult } from './documentEntityMatch.js';
import type { RegisteredEntityCnpj } from './entityCnpj.js';

// ============================================================================
// CNPJ evidence per party
// Discriminated union: unavailable (not observed) distinct from
// missing/invalid/valid. Raw input is preserved on 'invalid' so absence
// cannot masquerade as a technical result.
// ============================================================================

export type CnpjPartyState =
  | { kind: 'unavailable' }
  | { kind: 'missing' }
  | { kind: 'invalid'; raw: string }
  | { kind: 'valid'; normalized: string };

// ============================================================================
// Registry availability
// Modeled separately from the matching outcome. Three explicit states:
//   - available    : registry was consulted and returned data
//   - unavailable  : registry consultation was attempted and failed;
//                    MUST carry a reason and a warning
//   - not_observed : no registry consultation was attempted at all
// null / no observation MUST NOT produce 'unavailable'; it produces
// 'not_observed'. The matching outcome (DocumentEntityMatchResult.state)
// is a separate, parallel concept and no longer the source of the
// registry_unavailable reason code.
// ============================================================================

export type RegistryAvailability =
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: string; warning: string }
  | { kind: 'not_observed' };

// ============================================================================
// XML / PDF / MIME-Extension observations
// Pure, JSON-serializable; classification is the only field. The
// 'unavailable' value is the explicit not-observed signal. No raw content
// is stored on any observation.
// ============================================================================

export type XmlClassification =
  | 'non_xml'
  | 'malformed_xml'
  | 'well_formed_non_nfe'
  | 'structural_nfe'
  | 'unavailable';

export interface XmlObservation {
  classification: XmlClassification;
}

export type PdfClassification =
  | 'invalid_signature'
  | 'generic_pdf'
  | 'probable_fiscal_pdf'
  | 'unavailable';

export type PdfEvidenceSource =
  | 'filename'
  | 'subject'
  | 'inspected_content'
  | 'other';

export interface PdfEvidenceReason {
  source: PdfEvidenceSource;
  reasonCode: string;
}

export interface PdfObservation {
  classification: PdfClassification;
  reasons: readonly PdfEvidenceReason[];
}

export type MimeExtensionCompatibility =
  | 'compatible'
  | 'conflict'
  | 'insufficient_evidence'
  | 'unavailable';

export interface MimeExtensionObservation {
  compatibility: MimeExtensionCompatibility;
  mimeType: string | null;
  extension: string | null;
}

// ============================================================================
// Direction / counterparty (discriminated, structurally-locked per direction)
//   entrada     : ravatex is destinatario; counterparty is the emitente
//                 and is expected to be a fornecedor
//                 (CounterpartyEmitenteFornecedor is the ONLY counterparty
//                 variant accepted in the entrada branch)
//   saida       : ravatex is emitente;     counterparty is the destinatario
//                 and is expected to be a cliente
//                 (CounterpartyDestinatarioCliente is the ONLY counterparty
//                 variant accepted in the saida branch)
//   desconhecida: no counterparty (ravatex side is null; counterparty: null)
//
// side and expectedEntityType are literal types, not parameters, so no
// construction path can synthesize an entrada branch with a cliente
// counterparty or a saida branch with a fornecedor counterparty. The
// base type carries the shared fields (cnpjState, matches, ambiguity,
// registryAvailability). The two locked variants are the only members
// of the CounterpartyObservation union.
// ============================================================================

export type CounterpartySide = 'emitente' | 'destinatario';
export type CounterpartyExpectedEntityType = 'fornecedor' | 'cliente';

export type CounterpartyAmbiguity =
  | 'none'
  | 'multiple_same_type'
  | 'mixed_entity_types';

export interface CounterpartyObservationBase {
  cnpjState: CnpjPartyState;
  matches: readonly RegisteredEntityCnpj[];
  ambiguity: CounterpartyAmbiguity;
  registryAvailability: RegistryAvailability;
}

export interface CounterpartyEmitenteFornecedor extends CounterpartyObservationBase {
  readonly side: 'emitente';
  readonly expectedEntityType: 'fornecedor';
}

export interface CounterpartyDestinatarioCliente extends CounterpartyObservationBase {
  readonly side: 'destinatario';
  readonly expectedEntityType: 'cliente';
}

export type CounterpartyObservation =
  | CounterpartyEmitenteFornecedor
  | CounterpartyDestinatarioCliente;

export type DirectionObservation =
  | {
      kind: 'entrada';
      ravatexSide: 'destinatario';
      counterparty: CounterpartyEmitenteFornecedor;
      inconsistencies: readonly string[];
    }
  | {
      kind: 'saida';
      ravatexSide: 'emitente';
      counterparty: CounterpartyDestinatarioCliente;
      inconsistencies: readonly string[];
    }
  | {
      kind: 'desconhecida';
      ravatexSide: null;
      counterparty: null;
      inconsistencies: readonly string[];
    };

// ============================================================================
// Duplicate relation
// detectionBasis lives at the relation level and is required even when
// no canonical reference is available. canonicalRef is optional and may
// carry the canonical document identifier (documentId) and any of the
// upstream identifiers (gmail, drive, sha256, filename).
// ============================================================================

export type DuplicateRelationKind =
  | 'none'
  | 'same_attachment'
  | 'same_message'
  | 'cross_message_reuse'
  | 'possible_duplicate'
  | 'indeterminate';

export interface DuplicateCanonicalRef {
  documentId?: string;
  gmailMessageId?: string;
  attachmentId?: string;
  driveFileId?: string;
  sha256?: string;
  filenameOriginal?: string;
}

export interface DuplicateRelation {
  kind: DuplicateRelationKind;
  detectionBasis: string;
  canonicalRef?: DuplicateCanonicalRef;
}

// ============================================================================
// Operational links
// Flat, explicit ID arrays; integrity is deferred to persistence.
// No generic target / parceiro fields.
// ============================================================================

export type CompatibilityIssueCode =
  | 'pedido_ambiguous'
  | 'op_ambiguous'
  | 'pedido_op_mismatch'
  | 'pedido_unknown'
  | 'op_unknown';

export interface CompatibilityIssue {
  code: CompatibilityIssueCode;
  detail: string;
}

export interface OperationalLinks {
  suggestedPedidoIds: readonly string[];
  suggestedOpIds: readonly string[];
  confirmedPedidoIds: readonly string[];
  confirmedOpIds: readonly string[];
  compatibilityIssues: readonly CompatibilityIssue[];
  readonly integrity: 'deferred to persistence';
}

// ============================================================================
// Provenance / origin (explicit input; no defaults invented)
// ============================================================================

export interface TechnicalEvidenceOrigin {
  source: string;
  authorship: string;
}

export interface ReviewSuggestionOrigin {
  source: 'system';
  authorship: string;
  note: string;
}

export interface HumanReviewInput {
  reviewedBy: string;
  reviewedAt: string;
  notes?: string;
}

export interface HumanDecisionHistoryEntry {
  decision: HumanDecision;
  recordedBy: string;
  recordedAt: string;
  notes?: string;
}

export interface EvidenceOrigin {
  technical: TechnicalEvidenceOrigin;
  suggestion: ReviewSuggestionOrigin;
  evidenceVersion: number;
}

// ============================================================================
// Review reason codes (closed union)
// registry_unavailable and registry_not_observed are now distinct:
//   - registry_unavailable  : registryAvailability.kind === 'unavailable'
//                             (consultation attempted, failed; carries
//                             a reason and a warning)
//   - registry_not_observed : registryAvailability.kind === 'not_observed'
//                             (no consultation was even attempted)
// ============================================================================

export type ReviewReasonCode =
  | 'xml_unavailable'
  | 'xml_non_xml'
  | 'xml_malformed'
  | 'xml_well_formed_non_nfe'
  | 'xml_structural_nfe'
  | 'pdf_unavailable'
  | 'pdf_invalid_signature'
  | 'pdf_generic'
  | 'pdf_probable_fiscal'
  | 'cnpj_emitente_unavailable'
  | 'cnpj_emitente_missing'
  | 'cnpj_emitente_invalid'
  | 'cnpj_emitente_valid'
  | 'cnpj_destinatario_unavailable'
  | 'cnpj_destinatario_missing'
  | 'cnpj_destinatario_invalid'
  | 'cnpj_destinatario_valid'
  | 'cnpj_both_unavailable'
  | 'cnpj_both_missing'
  | 'registry_unavailable'
  | 'registry_not_observed'
  | 'direction_entrada'
  | 'direction_saida'
  | 'direction_desconhecida'
  | 'counterparty_matched'
  | 'counterparty_unmatched'
  | 'counterparty_ambiguous'
  | 'duplicate_none'
  | 'duplicate_same_attachment'
  | 'duplicate_same_message'
  | 'duplicate_cross_message'
  | 'duplicate_possible'
  | 'duplicate_indeterminate'
  | 'legacy_no_observation'
  | 'mime_extension_unavailable'
  | 'mime_extension_compatible'
  | 'mime_extension_conflict'
  | 'mime_extension_insufficient_evidence'
  | 'compatibility_issue';

// ============================================================================
// ReviewSuggestion
// Only a suggestion. requiresHumanReview is a literal true.
// No autoAccepted / accepted / status / score / confidence / rating /
// qualified / autoAccept / qualification fields.
// ============================================================================

export interface ReviewSuggestion {
  readonly requiresHumanReview: true;
  tipoDocumento: TipoDocumento | null;
  formato: FormatoDocumento | null;
  direcao: DirecaoNF | null;
  reasonCodes: readonly ReviewReasonCode[];
  warnings: readonly string[];
  note: string;
}

// ============================================================================
// HumanDecision
// Four distinct kinds. Conceptual compatibility with the existing
// document_decisions only:
//   - validate_and_link  <-> accepted
//   - reject             <-> rejected
//   - ignore             (persistence deferred to B5)
//   - revoke             (re-opening / revocation semantics)
// HumanDecision is distinct from HumanReviewInput (review vs decision).
// ============================================================================

export type HumanDecisionKind =
  | 'validate_and_link'
  | 'reject'
  | 'ignore'
  | 'revoke';

export interface HumanDecision {
  kind: HumanDecisionKind;
  evidenceVersion: number;
  notes?: string;
  previousDecisionRef?: string;
}

// ============================================================================
// TechnicalEvidence
// Pure, JSON-serializable object of upstream observations. The core does
// not invoke or duplicate the classifier, CNPJ normalization/validation,
// entity matching or dedupe. Registry availability is its own field
// (separate from DocumentEntityMatchResult.state). CNPJ per side, XML /
// PDF / MIME observations, direction/counterparty and duplicates are all
// preserved independently.
// ============================================================================

export interface TechnicalEvidence {
  tipoDocumento: TipoDocumento | null;
  formato: FormatoDocumento | null;
  xmlObservation: XmlObservation;
  pdfObservation: PdfObservation;
  mimeExtensionObservation: MimeExtensionObservation;
  cnpjEmitente: CnpjPartyState;
  cnpjDestinatario: CnpjPartyState;
  registryAvailability: RegistryAvailability;
  directionObservation: DirectionObservation | null;
  entityMatch: DocumentEntityMatchResult | null;
  duplicateRelation: DuplicateRelation;
}

// ============================================================================
// DocumentReviewCompatibility
// No parallel decision store. Decision compatibility is conceptual-only
// with the existing document_decisions; ignore persistence is deferred to
// B5; revoke carries re-opening / revocation semantics.
// ============================================================================

export interface DocumentReviewCompatibility {
  readonly decisionStore: 'conceptual_compat_with_document_decisions';
  readonly ignorePersistence: 'deferred_B5';
  readonly revokeSemantics: 're_opening_or_revocation';
}

// ============================================================================
// DocumentReview
// Full immutable composition of technical evidence, system suggestion,
// human review, human decision and operational links. Provenance and
// evidence version are explicit inputs (never defaulted).
// ============================================================================

export interface DocumentReview {
  documentId: string;
  technicalEvidence: TechnicalEvidence;
  systemSuggestion: ReviewSuggestion;
  humanReviewInput: HumanReviewInput | null;
  humanDecision: HumanDecision | null;
  humanDecisionHistory: readonly HumanDecisionHistoryEntry[];
  operationalLinks: OperationalLinks;
  origin: EvidenceOrigin;
  evidenceVersion: number;
  compatibility: DocumentReviewCompatibility;
}
