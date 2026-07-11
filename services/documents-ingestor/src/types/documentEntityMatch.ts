import type { EntityCnpjRegistry, RegisteredEntityCnpj } from './entityCnpj.js';

export type DocumentPartyKind = 'emitente' | 'destinatario';

export type DocumentPartyMatchState =
  | 'matched'
  | 'unmatched'
  | 'missing_cnpj'
  | 'invalid_cnpj'
  | 'registry_unavailable';

export interface DocumentPartyEntityMatch {
  party: DocumentPartyKind;
  extractedCnpj: string | null;
  state: DocumentPartyMatchState;
  matches: readonly RegisteredEntityCnpj[];
}

export type DocumentEntityMatchState =
  | 'matched'
  | 'ambiguous'
  | 'unmatched'
  | 'no_extracted_cnpj'
  | 'invalid_extracted_cnpj'
  | 'registry_unavailable';

export interface DocumentEntityMatchResult {
  state: DocumentEntityMatchState;
  emitente: DocumentPartyEntityMatch;
  destinatario: DocumentPartyEntityMatch;
}

export interface DocumentEntityMatchInput {
  emitenteCnpj: string | null;
  destinatarioCnpj: string | null;
  registry: EntityCnpjRegistry;
}
