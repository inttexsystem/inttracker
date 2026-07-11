import type { TipoDocumento, FormatoDocumento, DirecaoNF } from '../types/document.js';
import { formatoFromMimeType } from '../types/document.js';
import { config } from '../config.js';
import type { EntityCnpjRegistry } from '../types/entityCnpj.js';
import type { DocumentEntityMatchResult } from '../types/documentEntityMatch.js';
import { matchDocumentEntityCnpjs } from './documentEntityMatch.js';
import { extractValidCnpj } from './cnpj.js';

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
}

export interface ClassifyInput {
  filename: string;
  mimeType: string;
  subject?: string;
  contentSample?: string;
  ravatexCnpjs?: string[];
  entityRegistry?: EntityCnpjRegistry;
}

export function classifyAttachment(input: ClassifyInput): ClassifyOutput {
  const name = input.filename.toLowerCase();
  const subj = (input.subject ?? '').toLowerCase();
  const formato = formatoFromMimeType(input.mimeType);
  const parties = extrairPartesNFe(input.contentSample ?? '');

  if (input.mimeType === 'text/xml' || name.endsWith('.xml')) {
    if (hasNfeStructure(input.contentSample ?? '')) {
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
      };
    }
  }

  if (name.includes('romaneio') || subj.includes('romaneio')) {
    return {
      tipoDocumento: 'romaneio',
      formato,
      direcaoNf: null,
      cnpjEmitente: parties.emitenteCnpj,
      cnpjDestinatario: parties.destinatarioCnpj,
      entityMatch: buildEntityMatch(parties, input.entityRegistry),
    };
  }

  const nfKeywords = ['nf', 'nfe', 'nota', 'danfe'];
  const nameMatch = nfKeywords.some(k => name.includes(k));
  const subjMatch = nfKeywords.some(k => subj.includes(k));

  if (input.mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    if (nameMatch || subjMatch) {
      return {
        tipoDocumento: 'nf',
        formato: 'pdf',
        direcaoNf: null,
        cnpjEmitente: null,
        cnpjDestinatario: null,
        entityMatch: buildEntityMatch({ emitenteCnpj: null, destinatarioCnpj: null }, input.entityRegistry),
      };
    }
  }

  return {
    tipoDocumento: 'desconhecido',
    formato,
    direcaoNf: null,
    cnpjEmitente: null,
    cnpjDestinatario: null,
    entityMatch: buildEntityMatch({ emitenteCnpj: null, destinatarioCnpj: null }, input.entityRegistry),
  };
}

function hasNfeStructure(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes('nfe') || lower.includes('nfe');
}

export function extrairPartesNFe(xmlContent: string): ExtractedNfeParties {
  const rawEmitente = extrairCNPJdeElemento(xmlContent, 'emit');
  const rawDestinatario = extrairCNPJdeElemento(xmlContent, 'dest');

  return {
    emitenteCnpj: extractValidCnpj(rawEmitente),
    destinatarioCnpj: extractValidCnpj(rawDestinatario),
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

function extrairCNPJdeElemento(xml: string, parentElement: string): string | null {
  const parentRegex = new RegExp(
    `<(\\w+:)?${parentElement}(\\s[^>]*)?>[\\s\\S]*?<\\/(\\w+:)?${parentElement}\\s*>`,
    'i'
  );
  const parentMatch = xml.match(parentRegex);
  if (!parentMatch) return null;

  const fieldRegex = /<(\w+:)?CNPJ(\s[^>]*)?>([\d.\/-]*)<\/(\w+:)?CNPJ\s*>/i;
  const fieldMatch = parentMatch[0].match(fieldRegex);
  return fieldMatch ? fieldMatch[3].trim() : null;
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
