import { describe, it, expect } from 'vitest';
import {
  composeReviewSuggestion,
  composeOperationalLinks,
  composeDocumentReview,
} from '../src/core/documentReview.js';
import type {
  CnpjPartyState,
  CounterpartyDestinatarioCliente,
  CounterpartyEmitenteFornecedor,
  CounterpartyObservation,
  CounterpartyObservationBase,
  DirectionObservation,
  DocumentReview,
  DuplicateRelation,
  EvidenceOrigin,
  HumanDecision,
  HumanDecisionKind,
  HumanReviewInput,
  MimeExtensionObservation,
  OperationalLinks,
  PdfObservation,
  RegistryAvailability,
  ReviewSuggestion,
  TechnicalEvidence,
  XmlObservation,
} from '../src/types/documentReview.js';
import type { DocumentEntityMatchResult, DocumentPartyMatchState } from '../src/types/documentEntityMatch.js';
import type { RegisteredEntityCnpj } from '../src/types/entityCnpj.js';

const RAVATEX_CNPJ = '03662174000140';
const CNPJ_FORN = '11444777000161';
const CNPJ_CLI = '11222333000181';
const CNPJ_SHARED = '02194703529779';

function forn(id: number, name: string, cnpj = CNPJ_FORN, supplierType?: string): RegisteredEntityCnpj {
  return { entityType: 'fornecedor', entityId: id, entityName: name, cnpj, supplierType };
}
function cli(id: number, name: string, cnpj = CNPJ_CLI): RegisteredEntityCnpj {
  return { entityType: 'cliente', entityId: id, entityName: name, cnpj };
}
function cnpjUnavail(): CnpjPartyState { return { kind: 'unavailable' }; }
function cnpjMissing(): CnpjPartyState { return { kind: 'missing' }; }
function cnpjInvalid(raw = '12345'): CnpjPartyState { return { kind: 'invalid', raw }; }
function cnpjValid(n = CNPJ_FORN): CnpjPartyState { return { kind: 'valid', normalized: n }; }
function xmlObs(c: XmlObservation['classification']): XmlObservation { return { classification: c }; }
function pdfObs(c: PdfObservation['classification']): PdfObservation { return { classification: c, reasons: [] }; }
function pdfFiscal(): PdfObservation {
  return {
    classification: 'probable_fiscal_pdf',
    reasons: [
      { source: 'filename', reasonCode: 'matches_nf_token' },
      { source: 'subject', reasonCode: 'matches_nf_token' },
      { source: 'inspected_content', reasonCode: 'matches_nf_token' },
    ],
  };
}
function mimeObs(c: MimeExtensionObservation['compatibility'], mime: string | null = null, ext: string | null = null): MimeExtensionObservation {
  return { compatibility: c, mimeType: mime, extension: ext };
}
function regAvail(): RegistryAvailability { return { kind: 'available' }; }
function regUnavail(reason = 'registry_load_failed', warning = 'Registry unavailable: document matching limited. Human review required.'): RegistryAvailability {
  return { kind: 'unavailable', reason, warning };
}
function regNotObserved(): RegistryAvailability { return { kind: 'not_observed' }; }
function dirObs(
  d: 'entrada' | 'saida' | 'desconhecida',
  cp: Partial<CounterpartyObservationBase> = {},
  inconsistencies: readonly string[] = [],
): DirectionObservation {
  const base: CounterpartyObservationBase = {
    cnpjState: cp.cnpjState ?? cnpjUnavail(),
    matches: cp.matches ?? [],
    ambiguity: cp.ambiguity ?? 'none',
    registryAvailability: cp.registryAvailability ?? regNotObserved(),
  };
  if (d === 'entrada') {
    const cpEmit: CounterpartyEmitenteFornecedor = { side: 'emitente', expectedEntityType: 'fornecedor', ...base };
    return { kind: 'entrada', ravatexSide: 'destinatario', counterparty: cpEmit, inconsistencies };
  }
  if (d === 'saida') {
    const cpDest: CounterpartyDestinatarioCliente = { side: 'destinatario', expectedEntityType: 'cliente', ...base };
    return { kind: 'saida', ravatexSide: 'emitente', counterparty: cpDest, inconsistencies };
  }
  return { kind: 'desconhecida', ravatexSide: null, counterparty: null, inconsistencies };
}
function em(
  state: DocumentEntityMatchResult['state'],
  emit: RegisteredEntityCnpj[],
  dest: RegisteredEntityCnpj[],
): DocumentEntityMatchResult {
  const ps: DocumentPartyMatchState = state === 'registry_unavailable' ? 'registry_unavailable' : state === 'no_extracted_cnpj' ? 'missing_cnpj' : state === 'invalid_extracted_cnpj' ? 'invalid_cnpj' : state === 'unmatched' ? 'unmatched' : 'matched'; return {
    state,
    emitente: { party: 'emitente', extractedCnpj: emit[0]?.cnpj ?? null, state: ps, matches: emit },
    destinatario: { party: 'destinatario', extractedCnpj: dest[0]?.cnpj ?? null, state: ps, matches: dest },
  };
}
function minimalEvidence(overrides: Partial<TechnicalEvidence> = {}): TechnicalEvidence {
  return {
    tipoDocumento: null, formato: null,
    xmlObservation: xmlObs('unavailable'),
    pdfObservation: pdfObs('unavailable'),
    mimeExtensionObservation: mimeObs('unavailable'),
    cnpjEmitente: cnpjUnavail(),
    cnpjDestinatario: cnpjUnavail(),
    registryAvailability: regNotObserved(),
    directionObservation: null,
    entityMatch: null,
    duplicateRelation: { kind: 'none', detectionBasis: 'no_observation' },
    ...overrides,
  };
}
function origin(version: number): EvidenceOrigin {
  return {
    technical: { source: 'classifier', authorship: 'g28-classifier' },
    suggestion: { source: 'system', authorship: 'g28-documentReview', note: 'never auto-accept; human review required' },
    evidenceVersion: version,
  };
}

describe('entrada fornecedor (ravatex=destinatario; counterparty=emitente/fornecedor)', () => {
  it('entrada locks ravatex=destinatario; counterparty on emitente expects fornecedor; matched', () => {
    const e = minimalEvidence({
      registryAvailability: regAvail(),
      directionObservation: dirObs('entrada', {
        cnpjState: cnpjValid(CNPJ_FORN),
        matches: [forn(1, 'Conitex')],
        registryAvailability: regAvail(),
      }),
      entityMatch: em('matched', [forn(1, 'Conitex')], []),
      cnpjEmitente: cnpjValid(CNPJ_FORN),
      cnpjDestinatario: cnpjValid(RAVATEX_CNPJ),
    });
    const s = composeReviewSuggestion(e);
    expect(s.direcao).toBe('entrada');
    const d = e.directionObservation!;
    if (d.kind !== 'entrada') throw new Error('expected entrada branch');
    expect(d.ravatexSide).toBe('destinatario');
    expect(d.counterparty.side).toBe('emitente');
    expect(d.counterparty.expectedEntityType).toBe('fornecedor');
    expect(d.counterparty.matches[0].entityType).toBe('fornecedor');
    expect(d.counterparty.cnpjState.kind).toBe('valid');
    expect(d.counterparty.ambiguity).toBe('none');
    expect(d.counterparty.registryAvailability.kind).toBe('available');
    expect(s.reasonCodes).toContain('direction_entrada');
    expect(s.reasonCodes).toContain('counterparty_matched');
    expect(s.reasonCodes).toContain('cnpj_emitente_valid');
    expect(s.requiresHumanReview).toBe(true);
  });
});
describe('saida cliente (ravatex=emitente; counterparty=destinatario/cliente)', () => {
  it('saida locks ravatex=emitente; counterparty on destinatario expects cliente; matched', () => {
    const e = minimalEvidence({
      registryAvailability: regAvail(),
      directionObservation: dirObs('saida', {
        cnpjState: cnpjValid(CNPJ_CLI),
        matches: [cli(1, 'Encanta Lar')],
        registryAvailability: regAvail(),
      }),
      entityMatch: em('matched', [], [cli(1, 'Encanta Lar')]),
      cnpjEmitente: cnpjValid(RAVATEX_CNPJ),
      cnpjDestinatario: cnpjValid(CNPJ_CLI),
    });
    const s = composeReviewSuggestion(e);
    expect(s.direcao).toBe('saida');
    const d = e.directionObservation!;
    if (d.kind !== 'saida') throw new Error('expected saida branch');
    expect(d.ravatexSide).toBe('emitente');
    expect(d.counterparty.side).toBe('destinatario');
    expect(d.counterparty.expectedEntityType).toBe('cliente');
    expect(d.counterparty.matches[0].entityType).toBe('cliente');
    expect(d.counterparty.cnpjState.kind).toBe('valid');
    expect(s.reasonCodes).toContain('direction_saida');
    expect(s.reasonCodes).toContain('counterparty_matched');
    expect(s.reasonCodes).toContain('cnpj_destinatario_valid');
  });
});
describe('desconhecida: no counterparty; ravatexSide null', () => {
  it('desconhecida branch carries counterparty=null and ravatexSide=null', () => {
    const d = dirObs('desconhecida');
    expect(d.kind).toBe('desconhecida');
    expect(d.ravatexSide).toBeNull();
    expect(d.counterparty).toBeNull();
    const s = composeReviewSuggestion(minimalEvidence({ directionObservation: d }));
    expect(s.direcao).toBe('desconhecida');
    expect(s.reasonCodes).toContain('direction_desconhecida');
    expect(s.reasonCodes).not.toContain('counterparty_matched');
  });
});

describe('missing vs invalid CNPJ (distinct; raw preserved on invalid)', () => {
  it('missing both collapses to cnpj_both_missing (not double-counted)', () => {
    const s = composeReviewSuggestion(minimalEvidence({
      cnpjEmitente: cnpjMissing(), cnpjDestinatario: cnpjMissing(),
    }));
    expect(s.reasonCodes).toContain('cnpj_both_missing');
    expect(s.reasonCodes).not.toContain('cnpj_emitente_missing');
    expect(s.reasonCodes).not.toContain('cnpj_destinatario_missing');
  });
  it('invalid preserves raw and emits per-side invalid codes', () => {
    const inv = cnpjInvalid('11.222.333/0001-XX');
    const s = composeReviewSuggestion(minimalEvidence({
      cnpjEmitente: inv, cnpjDestinatario: cnpjInvalid('abc'),
    }));
    expect(s.reasonCodes).toContain('cnpj_emitente_invalid');
    expect(s.reasonCodes).toContain('cnpj_destinatario_invalid');
    expect(s.reasonCodes).not.toContain('cnpj_both_missing');
    expect(inv.kind === 'invalid' && inv.raw).toBe('11.222.333/0001-XX');
  });
});

describe('malformed XML vs non-NFe (no raw content)', () => {
  it('malformed_xml and well_formed_non_nfe produce distinct reason codes', () => {
    const sM = composeReviewSuggestion(minimalEvidence({ xmlObservation: xmlObs('malformed_xml') }));
    const sN = composeReviewSuggestion(minimalEvidence({ xmlObservation: xmlObs('well_formed_non_nfe') }));
    expect(sM.reasonCodes).toContain('xml_malformed');
    expect(sN.reasonCodes).toContain('xml_well_formed_non_nfe');
    expect(sM.reasonCodes).not.toContain('xml_well_formed_non_nfe');
  });
  it('XmlObservation carries no raw content fields', () => {
    const o: XmlObservation = xmlObs('structural_nfe');
    expect(Object.keys(o)).toEqual(['classification']);
  });
});

describe('probable fiscal PDF reasons are preserved', () => {
  it('probable_fiscal_pdf carries reason list (filename / subject / inspected_content)', () => {
    const e = minimalEvidence({ pdfObservation: pdfFiscal() });
    const s = composeReviewSuggestion(e);
    expect(s.reasonCodes).toContain('pdf_probable_fiscal');
    expect(e.pdfObservation.reasons).toHaveLength(3);
    expect(e.pdfObservation.reasons.map((r) => r.source)).toEqual(['filename', 'subject', 'inspected_content']);
  });
});

describe('registry availability separate from matching outcome', () => {
  it('registryAvailability=unavailable => registry_unavailable reason + warning; matches empty', () => {
    const e = minimalEvidence({
      registryAvailability: regUnavail(),
      entityMatch: {
        state: 'registry_unavailable',
        emitente: { party: 'emitente', extractedCnpj: null, state: 'registry_unavailable', matches: [] },
        destinatario: { party: 'destinatario', extractedCnpj: null, state: 'registry_unavailable', matches: [] },
      },
    });
    const s = composeReviewSuggestion(e);
    expect(s.reasonCodes).toContain('registry_unavailable');
    expect(s.reasonCodes).not.toContain('registry_not_observed');
    expect(s.warnings.some((w) => /registry/i.test(w))).toBe(true);
    expect(e.registryAvailability.kind).toBe('unavailable');
    if (e.registryAvailability.kind === 'unavailable') {
      expect(typeof e.registryAvailability.reason).toBe('string');
      expect(typeof e.registryAvailability.warning).toBe('string');
    }
    expect(e.entityMatch!.emitente.matches).toEqual([]);
    expect(e.entityMatch!.destinatario.matches).toEqual([]);
  });
  it('registryAvailability=not_observed (null entityMatch) => registry_not_observed; NOT registry_unavailable', () => {
    const e = minimalEvidence();
    const s = composeReviewSuggestion(e);
    expect(s.reasonCodes).toContain('registry_not_observed');
    expect(s.reasonCodes).not.toContain('registry_unavailable');
    expect(s.warnings.some((w) => /registry/i.test(w))).toBe(false);
    expect(e.entityMatch).toBeNull();
  });
  it('entityMatch.state=registry_unavailable AND registryAvailability=available is an explicit compatibility inconsistency', () => {
    const e = minimalEvidence({
      registryAvailability: regAvail(),
      entityMatch: {
        state: 'registry_unavailable',
        emitente: { party: 'emitente', extractedCnpj: null, state: 'registry_unavailable', matches: [] },
        destinatario: { party: 'destinatario', extractedCnpj: null, state: 'registry_unavailable', matches: [] },
      },
    });
    const s = composeReviewSuggestion(e);
    expect(s.reasonCodes).not.toContain('registry_unavailable');
    expect(s.reasonCodes).toContain('compatibility_issue');
    expect(s.warnings.some((w) => /inconsist/i.test(w))).toBe(true);
  });
});

describe('ambiguous match', () => {
  it('multiple matches on emitente => counterparty_ambiguous', () => {
    const e = minimalEvidence({
      registryAvailability: regAvail(),
      directionObservation: dirObs('entrada', { matches: [forn(1, 'A'), forn(2, 'B')], ambiguity: 'multiple_same_type' }),
      entityMatch: em('ambiguous', [forn(1, 'A'), forn(2, 'B')], []),
    });
    const s = composeReviewSuggestion(e);
    expect(s.reasonCodes).toContain('counterparty_ambiguous');
    expect(e.entityMatch!.emitente.matches).toHaveLength(2);
  });
});

describe('same CNPJ cliente/fornecedor independently preserved', () => {
  it('counterparty keeps both cliente and fornecedor entries for the same CNPJ; ambiguity=mixed_entity_types', () => {
    const matches = [
      cli(1, 'Dual Cliente', CNPJ_SHARED),
      forn(2, 'Dual Fornecedor', CNPJ_SHARED, 'tecelagem'),
    ];
    const e = minimalEvidence({
      registryAvailability: regAvail(),
      directionObservation: dirObs('entrada', { matches, ambiguity: 'mixed_entity_types' }),
      entityMatch: em('ambiguous', matches, []),
    });
    const types = e.entityMatch!.emitente.matches.map((m) => m.entityType).sort();
    expect(types).toEqual(['cliente', 'fornecedor']);
    const c = e.entityMatch!.emitente.matches.find((m) => m.entityType === 'cliente')!;
    const f = e.entityMatch!.emitente.matches.find((m) => m.entityType === 'fornecedor')!;
    expect(c.cnpj).toBe(f.cnpj);
    expect(c.entityId).not.toBe(f.entityId);
    const d = e.directionObservation!;
    if (d.kind !== 'entrada') throw new Error('expected entrada');
    expect(d.counterparty.ambiguity).toBe('mixed_entity_types');
  });
});

describe('duplication does not alter decision', () => {
  it('duplicate reason is emitted but humanDecision stays null', () => {
    const e = minimalEvidence({
      duplicateRelation: {
        kind: 'same_attachment',
        detectionBasis: 'gmail_attachment_id_match',
        canonicalRef: { documentId: 'doc-orig', attachmentId: 'a1', gmailMessageId: 'm1' },
      },
    });
    const s = composeReviewSuggestion(e);
    const review = composeDocumentReview({ documentId: 'd', technicalEvidence: e, origin: origin(1), evidenceVersion: 1 });
    expect(s.reasonCodes).toContain('duplicate_same_attachment');
    expect(review.humanDecision).toBeNull();
    expect(e.duplicateRelation.canonicalRef!.documentId).toBe('doc-orig');
  });
});

describe('legacy no synthetic evidence', () => {
  it('unavailable observations are not synthesized; null entityMatch does NOT produce registry_unavailable', () => {
    const s = composeReviewSuggestion(minimalEvidence());
    expect(s.reasonCodes).toContain('xml_unavailable');
    expect(s.reasonCodes).toContain('pdf_unavailable');
    expect(s.reasonCodes).toContain('mime_extension_unavailable');
    expect(s.reasonCodes).toContain('cnpj_both_unavailable');
    expect(s.reasonCodes).toContain('legacy_no_observation');
    expect(s.reasonCodes).toContain('registry_not_observed');
    expect(s.reasonCodes).not.toContain('registry_unavailable');
    for (const forbidden of ['xml_non_xml', 'pdf_invalid_signature', 'cnpj_emitente_missing', 'mime_extension_compatible']) {
      expect(s.reasonCodes).not.toContain(forbidden);
    }
  });
});

describe('ignore != reject', () => {
  it('all four decision kinds are defined and unique', () => {
    const kinds: HumanDecisionKind[] = ['validate_and_link', 'reject', 'ignore', 'revoke'];
    expect(new Set(kinds).size).toBe(4);
  });
  it('ignore and reject carry different kind values (not collapsed)', () => {
    const ig: HumanDecision = { kind: 'ignore', evidenceVersion: 1 };
    const rj: HumanDecision = { kind: 'reject', evidenceVersion: 1 };
    expect(ig.kind).not.toBe(rj.kind);
    expect(ig.kind).toBe('ignore');
    expect(rj.kind).toBe('reject');
  });
});

describe('revocation retains evidence (and references prior decision)', () => {
  it('revoke decision preserves technicalEvidence; previousDecisionRef points back', () => {
    const e = minimalEvidence({ cnpjEmitente: cnpjValid(CNPJ_FORN) });
    const frozen = JSON.parse(JSON.stringify(e));
    const review = composeDocumentReview({
      documentId: 'd',
      technicalEvidence: e,
      origin: origin(2),
      evidenceVersion: 2,
      humanDecision: { kind: 'revoke', evidenceVersion: 2, previousDecisionRef: 'decision-v1', notes: 'manual reversal' },
      humanDecisionHistory: [
        { decision: { kind: 'validate_and_link', evidenceVersion: 1 }, recordedBy: 'alice', recordedAt: '2025-01-01T00:00:00.000Z' },
      ],
    });
    expect(review.humanDecision!.kind).toBe('revoke');
    expect(review.humanDecision!.previousDecisionRef).toBe('decision-v1');
    expect(review.humanDecisionHistory).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(review.technicalEvidence))).toEqual(frozen);
  });
});

describe('explicit Pedido/OP links (no generic target / parceiro)', () => {
  it('OperationalLinks has flat explicit ID arrays, no target_* / parceiro', () => {
    const links: OperationalLinks = composeOperationalLinks({
      suggestedPedidoIds: ['P1'], suggestedOpIds: ['OP1'],
      confirmedPedidoIds: ['P2'], confirmedOpIds: ['OP2'],
      compatibilityIssues: [
        { code: 'pedido_ambiguous', detail: 'multi' },
        { code: 'op_ambiguous', detail: 'multi' },
        { code: 'pedido_op_mismatch', detail: 'inconsistent' },
      ],
    });
    expect(links.suggestedPedidoIds).toEqual(['P1']);
    expect(links.suggestedOpIds).toEqual(['OP1']);
    expect(links.confirmedPedidoIds).toEqual(['P2']);
    expect(links.confirmedOpIds).toEqual(['OP2']);
    expect(links.compatibilityIssues.map((i) => i.code)).toEqual(['pedido_ambiguous', 'op_ambiguous', 'pedido_op_mismatch']);
    for (const k of ['target_type', 'target_id', 'targetType', 'targetId', 'target', 'parceiro', 'parceiroId', 'parceiro_id']) {
      expect(Object.keys(links)).not.toContain(k);
    }
    expect(links.integrity).toBe('deferred to persistence');
  });
});

describe('no autoaccept (suggestion is never a decision)', () => {
  it('ReviewSuggestion.requiresHumanReview is literal true; no auto/accept/status fields', () => {
    const s: ReviewSuggestion = composeReviewSuggestion(minimalEvidence());
    expect(s.requiresHumanReview).toBe(true);
    for (const k of ['autoAccepted', 'autoAccept', 'auto_accept', 'accepted', 'status', 'score', 'confidence', 'rating', 'qualified', 'qualification', 'one_party_matched', 'humanDecision', 'humanReviewInput', 'operationalLinks']) {
      expect(Object.keys(s)).not.toContain(k);
    }
  });
  it('DocumentReview does not auto-decide: humanDecision null by default; humanReviewInput distinct', () => {
    const review: DocumentReview = composeDocumentReview({
      documentId: 'd', technicalEvidence: minimalEvidence(), origin: origin(1), evidenceVersion: 1,
    });
    expect(review.humanDecision).toBeNull();
    expect(review.humanReviewInput).toBeNull();
    expect(review.humanDecisionHistory).toEqual([]);
    const humanInput: HumanReviewInput = { reviewedBy: 'alice', reviewedAt: '2025-01-01T00:00:00.000Z' };
    const review2 = composeDocumentReview({
      documentId: 'd', technicalEvidence: minimalEvidence(), origin: origin(2), evidenceVersion: 2, humanReviewInput: humanInput,
    });
    expect(review2.humanReviewInput).toBe(humanInput);
    expect(review2.humanDecision).toBeNull();
  });
  it('origin / version are required explicit inputs; no defaults invented', () => {
    const review = composeDocumentReview({
      documentId: 'd', technicalEvidence: minimalEvidence(), origin: origin(7), evidenceVersion: 7,
    });
    expect(review.evidenceVersion).toBe(7);
    expect(review.origin.evidenceVersion).toBe(7);
    expect(review.origin.technical.source).toBe('classifier');
    expect(review.origin.suggestion.source).toBe('system');
    expect(review.compatibility.decisionStore).toBe('conceptual_compat_with_document_decisions');
    expect(review.compatibility.ignorePersistence).toBe('deferred_B5');
    expect(review.compatibility.revokeSemantics).toBe('re_opening_or_revocation');
  });
});

describe('MIME compatibility / conflict (required evidence)', () => {
  it('compatible, conflict, insufficient_evidence, unavailable are all distinct', () => {
    const sC = composeReviewSuggestion(minimalEvidence({ mimeExtensionObservation: mimeObs('compatible', 'application/pdf', 'pdf') }));
    const sX = composeReviewSuggestion(minimalEvidence({ mimeExtensionObservation: mimeObs('conflict', 'application/pdf', 'xml') }));
    const sI = composeReviewSuggestion(minimalEvidence({ mimeExtensionObservation: mimeObs('insufficient_evidence', null, null) }));
    const sU = composeReviewSuggestion(minimalEvidence({ mimeExtensionObservation: mimeObs('unavailable') }));
    expect(sC.reasonCodes).toContain('mime_extension_compatible');
    expect(sX.reasonCodes).toContain('mime_extension_conflict');
    expect(sX.warnings.some((w) => /conflict/i.test(w))).toBe(true);
    expect(sI.reasonCodes).toContain('mime_extension_insufficient_evidence');
    expect(sU.reasonCodes).toContain('mime_extension_unavailable');
  });
});

describe('Duplicate relation: detectionBasis at relation level; canonical ref optional', () => {
  it('kind=none still carries detectionBasis even when no canonicalRef', () => {
    const r: DuplicateRelation = { kind: 'none', detectionBasis: 'no_observation' };
    expect(r.detectionBasis).toBe('no_observation');
    expect(r.canonicalRef).toBeUndefined();
  });
  it('canonicalRef carries documentId (canonical document identifier) when known', () => {
    const r: DuplicateRelation = {
      kind: 'cross_message_reuse',
      detectionBasis: 'sha256_reuse_across_messages',
      canonicalRef: { documentId: 'doc-orig', sha256: 'abc', driveFileId: 'drive-1' },
    };
    expect(r.canonicalRef!.documentId).toBe('doc-orig');
    expect(r.canonicalRef!.sha256).toBe('abc');
    expect(r.detectionBasis).toBe('sha256_reuse_across_messages');
  });
});

describe('CNPJ per side independent of registry availability and matches', () => {
  it('cnpjEmitente / cnpjDestinatario are preserved independently of entityMatch.matches', () => {
    const e = minimalEvidence({
      registryAvailability: regUnavail(),
      cnpjEmitente: cnpjValid(CNPJ_FORN),
      cnpjDestinatario: cnpjMissing(),
      entityMatch: em('registry_unavailable', [], []),
    });
    expect(e.cnpjEmitente.kind).toBe('valid');
    expect(e.cnpjDestinatario.kind).toBe('missing');
    if (e.cnpjEmitente.kind === 'valid') expect(e.cnpjEmitente.normalized).toBe(CNPJ_FORN);
    expect(e.entityMatch!.emitente.matches).toEqual([]);
  });
});

describe('DirectionObservation compile-safe construction (no casts/any)', () => {
  it('entrada / saida / desconhecida accept ONLY their locked counterparty variants; no invalid synthesis possible', () => {
    const dE: DirectionObservation = { kind: 'entrada', ravatexSide: 'destinatario', counterparty: { side: 'emitente', expectedEntityType: 'fornecedor', cnpjState: cnpjValid(CNPJ_FORN), matches: [forn(1, 'X')], ambiguity: 'none', registryAvailability: regAvail() }, inconsistencies: [] };
    const dS: DirectionObservation = { kind: 'saida', ravatexSide: 'emitente', counterparty: { side: 'destinatario', expectedEntityType: 'cliente', cnpjState: cnpjValid(CNPJ_CLI), matches: [cli(1, 'X')], ambiguity: 'none', registryAvailability: regAvail() }, inconsistencies: [] };
    const dD: DirectionObservation = { kind: 'desconhecida', ravatexSide: null, counterparty: null, inconsistencies: [] };
    if (dE.kind !== 'entrada' || dS.kind !== 'saida' || dD.kind !== 'desconhecida') throw new Error('branch types');
    expect(dE.counterparty.side === 'emitente' && dE.counterparty.expectedEntityType === 'fornecedor' && dS.counterparty.side === 'destinatario' && dS.counterparty.expectedEntityType === 'cliente' && dD.counterparty === null).toBe(true);
  });
});
