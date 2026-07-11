import { describe, it, expect } from 'vitest';
import { matchDocumentEntityCnpjs } from '../src/core/documentEntityMatch.js';
import type { EntityCnpjRegistry, RegisteredEntityCnpj } from '../src/types/entityCnpj.js';
import type {
  DocumentEntityMatchInput,
  DocumentPartyEntityMatch,
} from '../src/types/documentEntityMatch.js';

function cliente(id: number, nome: string, cnpj: string): RegisteredEntityCnpj {
  return { entityType: 'cliente', entityId: id, entityName: nome, cnpj };
}

function fornecedor(id: number, nome: string, cnpj: string, tipo?: string): RegisteredEntityCnpj {
  return { entityType: 'fornecedor', entityId: id, entityName: nome, cnpj, supplierType: tipo };
}

function registry(entries: RegisteredEntityCnpj[]): EntityCnpjRegistry {
  return { loaded: true, loadedAt: new Date().toISOString(), entries, error: null };
}

function unavailableRegistry(): EntityCnpjRegistry {
  return { loaded: false, loadedAt: null, entries: [], error: 'connection failed' };
}

const CNPJ_FORN = '11444777000161';
const CNPJ_CLI = '11222333000181';
const CNPJ_SHARED = '02194703529779';
const CNPJ_NON_MATCH_A = '59418365146803';

describe('matchDocumentEntityCnpjs', () => {
  it('emitente matches one fornecedor', () => {
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.matches).toHaveLength(1);
    expect(result.emitente.matches[0].entityType).toBe('fornecedor');
    expect(result.emitente.matches[0].entityName).toBe('Conitex');
    expect(result.destinatario.state).toBe('missing_cnpj');
  });

  it('emitente matches one cliente', () => {
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.matches[0].entityType).toBe('cliente');
  });

  it('destinatario matches one cliente', () => {
    const reg = registry([cliente(2, 'Felipe Grandi', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: null, destinatarioCnpj: CNPJ_CLI, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.destinatario.state).toBe('matched');
    expect(result.destinatario.matches[0].entityType).toBe('cliente');
  });

  it('destinatario matches one fornecedor', () => {
    const reg = registry([fornecedor(3, 'TPX', CNPJ_FORN, 'latex')]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: null, destinatarioCnpj: CNPJ_FORN, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.destinatario.state).toBe('matched');
    expect(result.destinatario.matches[0].entityType).toBe('fornecedor');
  });

  it('same CNPJ as cliente and fornecedor preserves both entries', () => {
    const reg = registry([cliente(1, 'Dual Cliente', CNPJ_SHARED), fornecedor(2, 'Dual Fornecedor', CNPJ_SHARED, 'tecelagem')]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_SHARED, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('ambiguous');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.matches).toHaveLength(2);
    expect(result.emitente.matches.map(e => e.entityType).sort()).toEqual(['cliente', 'fornecedor']);
  });

  it('same CNPJ repeated in same category preserves all entries', () => {
    const reg = registry([cliente(1, 'Cliente A', CNPJ_CLI), cliente(2, 'Cliente B', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('ambiguous');
    expect(result.emitente.matches).toHaveLength(2);
  });

  it('emitente and destinatario match different entities', () => {
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN), cliente(2, 'Encanta Lar', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: CNPJ_CLI, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.matches[0].entityName).toBe('Conitex');
    expect(result.destinatario.state).toBe('matched');
    expect(result.destinatario.matches[0].entityName).toBe('Encanta Lar');
  });

  it('emitente and destinatario match the same entity', () => {
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: CNPJ_FORN, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.matches).toHaveLength(1);
    expect(result.destinatario.matches).toHaveLength(1);
    expect(result.emitente.matches[0].entityName).toBe('Conitex');
    expect(result.destinatario.matches[0].entityName).toBe('Conitex');
  });

  it('no match with valid CNPJ', () => {
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_NON_MATCH_A, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('unmatched');
    expect(result.emitente.state).toBe('unmatched');
    expect(result.emitente.matches).toHaveLength(0);
    expect(result.emitente.extractedCnpj).toBe(CNPJ_NON_MATCH_A);
  });

  it('registry empty and loaded', () => {
    const reg = registry([]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('unmatched');
    expect(result.emitente.state).toBe('unmatched');
    expect(result.emitente.matches).toHaveLength(0);
  });

  it('registry unavailable', () => {
    const reg = unavailableRegistry();
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: CNPJ_CLI, registry: reg });

    expect(result.state).toBe('registry_unavailable');
    expect(result.emitente.state).toBe('registry_unavailable');
    expect(result.destinatario.state).toBe('registry_unavailable');
    expect(result.emitente.matches).toHaveLength(0);
    expect(result.destinatario.matches).toHaveLength(0);
    expect(result.emitente.extractedCnpj).toBeNull();
  });

  it('emitente missing', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: null, destinatarioCnpj: CNPJ_CLI, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('missing_cnpj');
    expect(result.emitente.extractedCnpj).toBeNull();
    expect(result.destinatario.state).toBe('matched');
  });

  it('destinatario missing', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.destinatario.state).toBe('missing_cnpj');
    expect(result.emitente.state).toBe('matched');
  });

  it('both missing', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: null, destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('no_extracted_cnpj');
    expect(result.emitente.state).toBe('missing_cnpj');
    expect(result.destinatario.state).toBe('missing_cnpj');
  });

  it('both missing with empty strings', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: '', destinatarioCnpj: '', registry: reg });

    expect(result.state).toBe('no_extracted_cnpj');
    expect(result.emitente.state).toBe('missing_cnpj');
    expect(result.destinatario.state).toBe('missing_cnpj');
  });

  it('punctuated CNPJ is normalized', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: '11.222.333/0001-81', destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.extractedCnpj).toBe('11222333000181');
  });

  it('short CNPJ is invalid', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: '12345', destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('invalid_extracted_cnpj');
    expect(result.emitente.state).toBe('invalid_cnpj');
    expect(result.emitente.extractedCnpj).toBeNull();
    expect(result.emitente.matches).toHaveLength(0);
  });

  it('long CNPJ is invalid', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: '12345678901234567890', destinatarioCnpj: null, registry: reg });

    expect(result.state).toBe('invalid_extracted_cnpj');
    expect(result.emitente.state).toBe('invalid_cnpj');
  });

  it('one party invalid and one party matched', () => {
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_FORN, destinatarioCnpj: 'abc', registry: reg });

    expect(result.state).toBe('matched');
    expect(result.emitente.state).toBe('matched');
    expect(result.emitente.matches).toHaveLength(1);
    expect(result.destinatario.state).toBe('invalid_cnpj');
  });

  it('no association by name', () => {
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_NON_MATCH_A)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_NON_MATCH_A, destinatarioCnpj: null, registry: reg });

    expect(result.emitente.matches).toHaveLength(1);
    expect(result.emitente.matches[0].entityName).toBe('Encanta Lar');
  });

  it('function does not mutate registry', () => {
    const entries = [cliente(1, 'Felipe', CNPJ_CLI), fornecedor(2, 'Conitex', CNPJ_FORN)];
    const reg = registry(entries);
    const frozenEntries = [...entries];

    matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg });

    expect(reg.entries).toHaveLength(2);
    expect(reg.loaded).toBe(true);
    expect(reg.entries[0].entityName).toBe('Felipe');
    expect(reg.entries[1].entityName).toBe('Conitex');
    expect(reg.entries).toEqual(frozenEntries);
  });

  it('function does not mutate input objects', () => {
    const entries = [cliente(1, 'Felipe', CNPJ_CLI)];
    const reg = registry(entries);
    const input: DocumentEntityMatchInput = { emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg };

    const frozenEmitente = input.emitenteCnpj;
    const frozenDestinatario = input.destinatarioCnpj;

    matchDocumentEntityCnpjs(input);

    expect(input.emitenteCnpj).toBe(frozenEmitente);
    expect(input.destinatarioCnpj).toBe(frozenDestinatario);
    expect(input.registry).toBe(reg);
  });

  it('no external IO calls', () => {
    const reg = registry([cliente(1, 'Felipe', CNPJ_CLI)]);
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: reg });
    expect(result).toBeDefined();
  });

  it('no direction in result structure', () => {
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: registry([cliente(1, 'A', CNPJ_CLI)]) });

    const keys = Object.keys(result);
    expect(keys).not.toContain('direction');
    expect(keys).not.toContain('direcao');
    expect(keys).not.toContain('direcao_nf');
    expect(keys).not.toContain('entrada');
    expect(keys).not.toContain('saida');
  });

  it('no relevance in result structure', () => {
    const result = matchDocumentEntityCnpjs({ emitenteCnpj: CNPJ_CLI, destinatarioCnpj: null, registry: registry([cliente(1, 'A', CNPJ_CLI)]) });

    const keys = Object.keys(result);
    expect(keys).not.toContain('relevant');
    expect(keys).not.toContain('relevance');
    expect(keys).not.toContain('relevancia');
    expect(keys).not.toContain('irrelevant');
  });

  it('no RAVATEX_CNPJS dependency', () => {
    const source = matchDocumentEntityCnpjs.toString();
    expect(source).not.toMatch(/RAVATEX_CNPJS/i);
    expect(source).not.toMatch(/ravatexCnpjs/i);
  });

  it('no parceiros reference', () => {
    const source = matchDocumentEntityCnpjs.toString();
    expect(source).not.toMatch(/parceir/i);
  });
});
