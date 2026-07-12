import type { TipoDocumento, FormatoDocumento, DirecaoNF } from '../types/document.js';
import { config } from '../config.js';
import type { EntityCnpjRegistry } from '../types/entityCnpj.js';
import type { DocumentEntityMatchResult } from '../types/documentEntityMatch.js';
import { matchDocumentEntityCnpjs } from './documentEntityMatch.js';
import { extractValidCnpj } from './cnpj.js';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type {
  CnpjPartyState,
  MimeExtensionObservation,
  PdfEvidenceReason,
  PdfObservation,
  XmlObservation,
} from '../types/documentReview.js';

export interface ExtractedNfeParties {
  emitenteCnpj: string | null;
  destinatarioCnpj: string | null;
}

export interface ClassifyOutput {
  tipoDocumento: TipoDocumento;
  formato: FormatoDocumento;
  direcaoNf: DirecaoNF | null;
  cnpjEmitente: string | null;
  cnpjDestinatario: string | null;
  entityMatch: DocumentEntityMatchResult | null;
  technicalObservations: TechnicalObservations;
}

export interface TechnicalObservations {
  xml: XmlObservation;
  pdf: PdfObservation;
  mimeExtension: MimeExtensionObservation;
  cnpjEmitente: CnpjPartyState;
  cnpjDestinatario: CnpjPartyState;
}

export interface ClassifyInput {
  filename: string;
  mimeType: string;
  subject?: string;
  contentSample?: string;
  ravatexCnpjs?: string[];
  entityRegistry?: EntityCnpjRegistry;
}

const nfeParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
  processEntities: false,
  htmlEntities: false,
});

const PDF_SAMPLE_CAP_BYTES = 2048;
const PDF_SIGNATURE = '%PDF-';

interface XmlParseResult {
  classification: XmlObservation['classification'];
  rawEmitCnpj: string | null;
  rawDestCnpj: string | null;
  validEmitCnpj: string | null;
  validDestCnpj: string | null;
}

function computeFormato(mimeType: string, filenameLower: string): FormatoDocumento {
  if (mimeType === 'text/xml' || mimeType === 'application/xml') return 'xml';
  if (mimeType === 'application/pdf') return 'pdf';
  if (filenameLower.endsWith('.xml')) return 'xml';
  if (filenameLower.endsWith('.pdf')) return 'pdf';
  return 'desconhecido';
}

function isXmlCandidate(mimeType: string, filenameLower: string): boolean {
  if (mimeType === 'text/xml' || mimeType === 'application/xml') return true;
  if (filenameLower.endsWith('.xml')) return true;
  return false;
}

function isPdfCandidate(mimeType: string, filenameLower: string): boolean {
  if (mimeType === 'application/pdf') return true;
  if (filenameLower.endsWith('.pdf')) return true;
  return false;
}

function hasPdfSignature(contentSample: string | undefined): boolean {
  if (!contentSample || typeof contentSample !== 'string') return false;
  return contentSample.startsWith(PDF_SIGNATURE);
}

function validateXmlWellFormed(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const result = XMLValidator.validate(content);
  return result === true;
}

function looksLikeXmlContent(content: string): boolean {
  if (!content) return false;
  return content.indexOf('<') !== -1;
}

interface InfNFeContainer {
  emit?: { CNPJ?: unknown };
  dest?: { CNPJ?: unknown };
}

function findInfNFeNode(parsed: unknown): InfNFeContainer | null {
  if (!parsed || typeof parsed !== 'object' || parsed === null) return null;
  const root = parsed as Record<string, unknown>;
  if (root.nfeProc && typeof root.nfeProc === 'object' && root.nfeProc !== null) {
    const proc = root.nfeProc as Record<string, unknown>;
    if (proc.NFe && typeof proc.NFe === 'object' && proc.NFe !== null) {
      const nfe = proc.NFe as Record<string, unknown>;
      if (nfe.infNFe && typeof nfe.infNFe === 'object' && nfe.infNFe !== null) {
        return nfe.infNFe as InfNFeContainer;
      }
    }
  }
  if (root.NFe && typeof root.NFe === 'object' && root.NFe !== null) {
    const nfe = root.NFe as Record<string, unknown>;
    if (nfe.infNFe && typeof nfe.infNFe === 'object' && nfe.infNFe !== null) {
      return nfe.infNFe as InfNFeContainer;
    }
  }
  return null;
}

function readRawCnpj(side: { CNPJ?: unknown } | undefined): string | null {
  if (!side || typeof side !== 'object') return null;
  const v = (side as { CNPJ?: unknown }).CNPJ;
  if (typeof v !== 'string') return null;
  return v;
}

function classifyAndExtractXml(sample: string | undefined): XmlParseResult {
  if (sample === undefined || sample === null) {
    return { classification: 'unavailable', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  }
  if (sample === '' || !looksLikeXmlContent(sample)) {
    return { classification: 'non_xml', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  }
  if (!validateXmlWellFormed(sample)) {
    return { classification: 'malformed_xml', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  }
  let parsed: unknown;
  try {
    parsed = nfeParser.parse(sample);
  } catch {
    return { classification: 'malformed_xml', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  }
  const infNFe = findInfNFeNode(parsed);
  if (!infNFe) {
    return { classification: 'well_formed_non_nfe', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  }
  const rawEmitCnpj = readRawCnpj(infNFe.emit);
  const rawDestCnpj = readRawCnpj(infNFe.dest);
  return {
    classification: 'structural_nfe',
    rawEmitCnpj,
    rawDestCnpj,
    validEmitCnpj: extractValidCnpj(rawEmitCnpj),
    validDestCnpj: extractValidCnpj(rawDestCnpj),
  };
}

export function extrairPartesNFe(xmlContent: string): ExtractedNfeParties {
  const r = classifyAndExtractXml(xmlContent);
  if (r.classification !== 'structural_nfe') {
    return { emitenteCnpj: null, destinatarioCnpj: null };
  }
  return {
    emitenteCnpj: r.validEmitCnpj,
    destinatarioCnpj: r.validDestCnpj,
  };
}

function hasNfToken(text: string): boolean {
  if (!text) return false;
  if (/\bDANFE\b/i.test(text)) return true;
  if (/\bnota[\s\-_]fiscal\b/i.test(text)) return true;
  if (/\bNF-e\b/i.test(text)) return true;
  if (/\bNFe\b/i.test(text)) return true;
  if (/(?:^|[^a-zA-Z0-9])NF(?:[-_]|[-_]?\d)/i.test(text)) return true;
  if (/(?:^|[^a-zA-Z0-9])NF\b/i.test(text)) return true;
  return false;
}

// ============================================================================
// Technical observation builders (G28-B2-B3-A)
// All observations are pure, JSON-serializable and carry NO raw content
// (no content sample, no buffer, no PDF binary). Reasons are source+code only.
// ============================================================================

const XML_SPECIFIC_MIMES: ReadonlySet<string> = new Set(['text/xml', 'application/xml']);
const PDF_SPECIFIC_MIMES: ReadonlySet<string> = new Set(['application/pdf']);
const GENERIC_MIMES: ReadonlySet<string> = new Set(['application/octet-stream']);

function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 0) return null;
  if (lastDot === filename.length - 1) return null;
  const ext = filename.slice(lastDot + 1);
  if (ext.length === 0) return null;
  return ext;
}

function buildMimeExtensionObservation(
  mimeType: string,
  filename: string,
): MimeExtensionObservation {
  const extension = getExtension(filename);
  const mime = mimeType && mimeType.length > 0 ? mimeType : null;
  const extensionLower = extension !== null ? extension.toLowerCase() : null;
  const mimeIsXml = mime !== null && XML_SPECIFIC_MIMES.has(mime);
  const mimeIsPdf = mime !== null && PDF_SPECIFIC_MIMES.has(mime);
  const mimeIsGeneric = mime !== null && GENERIC_MIMES.has(mime);
  const extIsXml = extensionLower === 'xml';
  const extIsPdf = extensionLower === 'pdf';

  let compatibility: MimeExtensionObservation['compatibility'];
  if (mimeIsXml && extIsXml) compatibility = 'compatible';
  else if (mimeIsPdf && extIsPdf) compatibility = 'compatible';
  else if (mimeIsXml && extIsPdf) compatibility = 'conflict';
  else if (mimeIsPdf && extIsXml) compatibility = 'conflict';
  else if (mime === null && extension === null) compatibility = 'unavailable';
  else if (mimeIsGeneric || extension === null) compatibility = 'insufficient_evidence';
  else compatibility = 'insufficient_evidence';

  return { compatibility, mimeType: mime, extension };
}

function buildPdfObservation(
  input: ClassifyInput,
  filenameLower: string,
  subj: string,
  pdfCandidate: boolean,
): PdfObservation {
  if (!pdfCandidate) {
    return { classification: 'unavailable', reasons: [] };
  }
  const sample = input.contentSample;
  if (sample === undefined || sample === null) {
    return { classification: 'unavailable', reasons: [] };
  }
  if (typeof sample !== 'string' || !hasPdfSignature(sample)) {
    const reasons: PdfEvidenceReason[] = [
      { source: 'inspected_content', reasonCode: 'missing_pdf_signature' },
    ];
    return { classification: 'invalid_signature', reasons };
  }
  const reasons: PdfEvidenceReason[] = [];
  if (hasNfToken(filenameLower)) {
    reasons.push({ source: 'filename', reasonCode: 'matches_nf_token' });
  }
  if (subj && hasNfToken(subj)) {
    reasons.push({ source: 'subject', reasonCode: 'matches_nf_token' });
  }
  if (hasNfToken(sample)) {
    reasons.push({ source: 'inspected_content', reasonCode: 'matches_nf_token' });
  }
  if (reasons.length > 0) {
    return { classification: 'probable_fiscal_pdf', reasons };
  }
  return {
    classification: 'generic_pdf',
    reasons: [{ source: 'inspected_content', reasonCode: 'no_fiscal_signal' }],
  };
}

function buildCnpjPartyState(
  xmlClassification: XmlObservation['classification'],
  rawCnpj: string | null,
  validCnpj: string | null,
): CnpjPartyState {
  if (xmlClassification !== 'structural_nfe') {
    return { kind: 'unavailable' };
  }
  if (rawCnpj === null) {
    return { kind: 'missing' };
  }
  if (validCnpj !== null) {
    return { kind: 'valid', normalized: validCnpj };
  }
  return { kind: 'invalid', raw: rawCnpj };
}

export function classifyAttachment(input: ClassifyInput): ClassifyOutput {
  const name = input.filename.toLowerCase();
  const subj = (input.subject ?? '').toLowerCase();
  const formato = computeFormato(input.mimeType, name);
  const mimeExt = buildMimeExtensionObservation(input.mimeType, input.filename);
  const pdfCandidate = isPdfCandidate(input.mimeType, name);
  const pdfObs = buildPdfObservation(input, name, subj, pdfCandidate);

  const xmlCandidate = isXmlCandidate(input.mimeType, name);
  const xmlResult: XmlParseResult = xmlCandidate
    ? classifyAndExtractXml(input.contentSample)
    : { classification: 'unavailable', rawEmitCnpj: null, rawDestCnpj: null, validEmitCnpj: null, validDestCnpj: null };
  const xmlObs: XmlObservation = { classification: xmlResult.classification };
  const cnpjEmitenteObs = buildCnpjPartyState(xmlResult.classification, xmlResult.rawEmitCnpj, xmlResult.validEmitCnpj);
  const cnpjDestinatarioObs = buildCnpjPartyState(xmlResult.classification, xmlResult.rawDestCnpj, xmlResult.validDestCnpj);
  const technicalObservations: TechnicalObservations = {
    xml: xmlObs,
    pdf: pdfObs,
    mimeExtension: mimeExt,
    cnpjEmitente: cnpjEmitenteObs,
    cnpjDestinatario: cnpjDestinatarioObs,
  };

  if (xmlResult.classification === 'structural_nfe') {
    const parties: ExtractedNfeParties = {
      emitenteCnpj: xmlResult.validEmitCnpj,
      destinatarioCnpj: xmlResult.validDestCnpj,
    };
    const cnpjs = input.ravatexCnpjs ?? config.ravatexCnpjs;
    const direcao = lerDirecaoNFe(parties, cnpjs);
    const entityMatch = buildEntityMatch(parties, input.entityRegistry);
    return {
      tipoDocumento: 'nf',
      formato: 'xml',
      direcaoNf: direcao,
      cnpjEmitente: parties.emitenteCnpj,
      cnpjDestinatario: parties.destinatarioCnpj,
      entityMatch,
      technicalObservations,
    };
  }

  if (name.includes('romaneio') || subj.includes('romaneio')) {
    return {
      tipoDocumento: 'romaneio',
      formato,
      direcaoNf: null,
      cnpjEmitente: null,
      cnpjDestinatario: null,
      entityMatch: buildEntityMatch({ emitenteCnpj: null, destinatarioCnpj: null }, input.entityRegistry),
      technicalObservations,
    };
  }

  if (pdfCandidate) {
    const isFiscalPdf = pdfObs.classification === 'probable_fiscal_pdf';
    return {
      tipoDocumento: isFiscalPdf ? 'nf' : 'desconhecido',
      formato: 'pdf',
      direcaoNf: null,
      cnpjEmitente: null,
      cnpjDestinatario: null,
      entityMatch: buildEntityMatch({ emitenteCnpj: null, destinatarioCnpj: null }, input.entityRegistry),
      technicalObservations,
    };
  }

  return {
    tipoDocumento: 'desconhecido',
    formato,
    direcaoNf: null,
    cnpjEmitente: null,
    cnpjDestinatario: null,
    entityMatch: buildEntityMatch({ emitenteCnpj: null, destinatarioCnpj: null }, input.entityRegistry),
    technicalObservations,
  };
}

export function lerDirecaoNFe(parties: ExtractedNfeParties, ravatexCnpjs: string[]): DirecaoNF {
  if (parties.destinatarioCnpj) {
    if (ravatexCnpjs.some(c => c === parties.destinatarioCnpj)) return 'entrada';
  }

  if (parties.emitenteCnpj) {
    if (ravatexCnpjs.some(c => c === parties.emitenteCnpj)) return 'saida';
  }

  return 'desconhecida';
}

function buildEntityMatch(
  parties: ExtractedNfeParties,
  entityRegistry: EntityCnpjRegistry | undefined,
): DocumentEntityMatchResult | null {
  if (!entityRegistry) return null;
  return matchDocumentEntityCnpjs({
    emitenteCnpj: parties.emitenteCnpj,
    destinatarioCnpj: parties.destinatarioCnpj,
    registry: entityRegistry,
  });
}
