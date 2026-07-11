import type { EntityCnpjRegistry, RegisteredEntityCnpj } from '../types/entityCnpj.js';
import type {
  DocumentEntityMatchInput,
  DocumentEntityMatchResult,
  DocumentEntityMatchState,
  DocumentPartyEntityMatch,
  DocumentPartyKind,
  DocumentPartyMatchState,
} from '../types/documentEntityMatch.js';

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '');
}

function matchParty(
  party: DocumentPartyKind,
  rawCnpj: string | null,
  registry: EntityCnpjRegistry,
): DocumentPartyEntityMatch {
  if (!registry.loaded) {
    return {
      party,
      extractedCnpj: null,
      state: 'registry_unavailable',
      matches: [],
    };
  }

  if (rawCnpj == null || rawCnpj === '') {
    return {
      party,
      extractedCnpj: null,
      state: 'missing_cnpj',
      matches: [],
    };
  }

  const normalized = normalizeCnpj(rawCnpj);

  if (normalized.length !== 14) {
    return {
      party,
      extractedCnpj: null,
      state: 'invalid_cnpj',
      matches: [],
    };
  }

  const matches = registry.entries.filter((e) => e.cnpj === normalized);

  const state: DocumentPartyMatchState = matches.length > 0 ? 'matched' : 'unmatched';

  return {
    party,
    extractedCnpj: normalized,
    state,
    matches: matches.length > 0 ? [...matches] : [],
  };
}

function consolidateState(
  emitente: DocumentPartyEntityMatch,
  destinatario: DocumentPartyEntityMatch,
): DocumentEntityMatchState {
  if (emitente.state === 'registry_unavailable' || destinatario.state === 'registry_unavailable') {
    return 'registry_unavailable';
  }

  const hasValidCnpj =
    emitente.state === 'matched' || emitente.state === 'unmatched' ||
    destinatario.state === 'matched' || destinatario.state === 'unmatched';

  const hasMatch = emitente.state === 'matched' || destinatario.state === 'matched';

  const hasInvalid =
    emitente.state === 'invalid_cnpj' || destinatario.state === 'invalid_cnpj';

  if (!hasValidCnpj && !hasInvalid) {
    return 'no_extracted_cnpj';
  }

  if (!hasMatch && hasInvalid && !hasValidCnpj) {
    return 'invalid_extracted_cnpj';
  }

  if (!hasMatch && hasValidCnpj) {
    return 'unmatched';
  }

  if (
    (emitente.state === 'matched' && emitente.matches.length > 1) ||
    (destinatario.state === 'matched' && destinatario.matches.length > 1)
  ) {
    return 'ambiguous';
  }

  return 'matched';
}

export function matchDocumentEntityCnpjs(
  input: DocumentEntityMatchInput,
): DocumentEntityMatchResult {
  const emitente = matchParty('emitente', input.emitenteCnpj, input.registry);
  const destinatario = matchParty('destinatario', input.destinatarioCnpj, input.registry);

  const state = consolidateState(emitente, destinatario);

  return { state, emitente, destinatario };
}
