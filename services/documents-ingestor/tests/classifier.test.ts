import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAttachment, lerDirecaoNFe, extrairPartesNFe } from '../src/core/classifier.js';
import type { DocumentEntityMatchInput } from '../src/types/documentEntityMatch.js';
import type { EntityCnpjRegistry, RegisteredEntityCnpj } from '../src/types/entityCnpj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(fixturesDir, name), 'utf-8');
}

const RAVATEX_CNPJ_1 = '59418365146803';
const RAVATEX_CNPJ_2 = '55832866852408';

function makeNFeXml(destCnpj?: string | null, emitCnpj?: string | null, useNsPrefix = false): string {
  const ns = useNsPrefix ? 'nfe:' : '';
  const destBlock = destCnpj
    ? `<${ns}dest><${ns}CNPJ>${destCnpj}</${ns}CNPJ></${ns}dest>`
    : `<${ns}dest><${ns}xNome>Cliente</${ns}xNome></${ns}dest>`;
  const emitBlock = emitCnpj
    ? `<${ns}emit><${ns}CNPJ>${emitCnpj}</${ns}CNPJ></${ns}emit>`
    : `<${ns}emit><${ns}xNome>Fornecedor</${ns}xNome></${ns}emit>`;
  const xmlnsDecl = useNsPrefix
    ? `xmlns:nfe="http://www.portalfiscal.inf.br/nfe"`
    : `xmlns="http://www.portalfiscal.inf.br/nfe"`;
  return `<${ns}nfeProc ${xmlnsDecl}><${ns}NFe><${ns}infNFe>${destBlock}${emitBlock}</${ns}infNFe></${ns}NFe></${ns}nfeProc>`;
}

function fornecedor(id: number, nome: string, cnpj: string, tipo?: string): RegisteredEntityCnpj {
  return { entityType: 'fornecedor', entityId: id, entityName: nome, cnpj, supplierType: tipo };
}

function cliente(id: number, nome: string, cnpj: string): RegisteredEntityCnpj {
  return { entityType: 'cliente', entityId: id, entityName: nome, cnpj };
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

describe('classifier', () => {
  it('classifies XML with NF-e structure as nf + formato xml', () => {
    const result = classifyAttachment({
      filename: 'nota.xml',
      mimeType: 'text/xml',
      contentSample: '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>11444777000161</CNPJ></dest></infNFe></NFe></nfeProc>',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
  });

  it('classifies PDF with nf in name as nf + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf',
      mimeType: 'application/pdf',
      contentSample: '%PDF-1.4\nNF-e 12345 conteudo',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('classifies PDF with nota in subject as nf + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'Nota Fiscal 123',
      contentSample: '%PDF-1.4\nconteudo generico',
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('classifies PDF with romaneio in filename as romaneio', () => {
    const result = classifyAttachment({
      filename: 'romaneio_carga.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('classifies PDF with romaneio in subject as romaneio', () => {
    const result = classifyAttachment({
      filename: 'anexo.pdf',
      mimeType: 'application/pdf',
      subject: 'Romaneio de entrega',
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
  });

  it('classifies plain PDF without keywords as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'contrato.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('classifies XML without NF-e structure as desconhecido', () => {
    const result = classifyAttachment({
      filename: 'dados.xml',
      mimeType: 'text/xml',
      contentSample: '<root><item>teste</item></root>',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('classifies unknown mime type as desconhecido with formato desconhecido', () => {
    const result = classifyAttachment({
      filename: 'file.bin',
      mimeType: 'application/octet-stream',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('desconhecido');
  });
});

describe('NF direction (XML)', () => {
  const cnpjs = [RAVATEX_CNPJ_1, RAVATEX_CNPJ_2];

  it('XML with dest/CNPJ matching Ravatex CNPJ → entrada', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML with emit/CNPJ matching Ravatex CNPJ → saida', () => {
    const xml = makeNFeXml(CNPJ_CLI, RAVATEX_CNPJ_2);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('saida');
  });

  it('XML without CNPJ matching Ravatex → desconhecida', () => {
    const xml = makeNFeXml(CNPJ_CLI, CNPJ_FORN);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('XML with formatted CNPJ (dots/slashes) works', () => {
    const punctuatedRavatex = `${RAVATEX_CNPJ_1.slice(0,2)}.${RAVATEX_CNPJ_1.slice(2,5)}.${RAVATEX_CNPJ_1.slice(5,8)}/${RAVATEX_CNPJ_1.slice(8,12)}-${RAVATEX_CNPJ_1.slice(12,14)}`;
    const punctuatedOther = `${CNPJ_CLI.slice(0,2)}.${CNPJ_CLI.slice(2,5)}.${CNPJ_CLI.slice(5,8)}/${CNPJ_CLI.slice(8,12)}-${CNPJ_CLI.slice(12,14)}`;
    const xml = makeNFeXml(punctuatedRavatex, punctuatedOther);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1],
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML with namespace prefix works', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_2, CNPJ_CLI, true);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML without dest/emit CNPJ elements → desconhecida', () => {
    const xml = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><dest><xNome>Cliente</xNome></dest><emit><xNome>Fornecedor</xNome></emit></infNFe></NFe></nfeProc>';
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('no RAVATEX_CNPJS config → desconhecida', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: [],
    });
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('dest prioritário: ambos batem → entrada', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, RAVATEX_CNPJ_2);
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('XML inválido não quebra — cai para desconhecido', () => {
    const result = classifyAttachment({
      filename: 'corrupt.xml',
      mimeType: 'text/xml',
      contentSample: 'not even valid <<<xml>>>',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
  });
});

describe('lerDirecaoNFe (unit — via extracted parties)', () => {
  const cnpjs = [RAVATEX_CNPJ_1];

  function partiesFromXml(destCnpj?: string | null, emitCnpj?: string | null) {
    return extrairPartesNFe(makeNFeXml(destCnpj, emitCnpj));
  }

  it('returns entrada when dest matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(RAVATEX_CNPJ_1), cnpjs)).toBe('entrada');
  });

  it('returns saida when emit matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(null, RAVATEX_CNPJ_1), cnpjs)).toBe('saida');
  });

  it('returns desconhecida when neither matches', () => {
    expect(lerDirecaoNFe(partiesFromXml(null, '99999999000199'), cnpjs)).toBe('desconhecida');
  });

  it('empty CNPJ list returns desconhecida', () => {
    expect(lerDirecaoNFe(partiesFromXml(RAVATEX_CNPJ_1), [])).toBe('desconhecida');
  });
});

describe('entity match integration', () => {
  const CNPJ_EMIT = '11444777000161';
  const CNPJ_DEST = '11222333000181';

  it('XML returns cnpjEmitente normalized', () => {
    const xml = makeNFeXml(null, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBe(CNPJ_EMIT);
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('XML returns cnpjDestinatario normalized', () => {
    const xml = makeNFeXml(CNPJ_DEST, null);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBeNull();
    expect(result.cnpjDestinatario).toBe(CNPJ_DEST);
  });

  it('values returned are normalized (no punctuation)', () => {
    const xml = makeNFeXml('11.222.333/0001-81', '11.444.777/0001-61');
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBe('11222333000181');
    expect(result.cnpjEmitente).toBe('11444777000161');
  });

  it('namespace prefix is accepted for extraction', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT, true);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBe(CNPJ_DEST);
    expect(result.cnpjEmitente).toBe(CNPJ_EMIT);
  });

  it('missing emitente returns null', () => {
    const xml = makeNFeXml(CNPJ_DEST, null);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBeNull();
  });

  it('missing destinatario returns null', () => {
    const xml = makeNFeXml(null, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('non-XML document returns both CNPJs as null', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf', mimeType: 'application/pdf',
    });
    expect(result.cnpjEmitente).toBeNull();
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('registry omitted returns entityMatch null', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.entityMatch).toBeNull();
  });

  it('registry with fornecedor in emitente matches', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('matched');
    expect(result.entityMatch!.emitente.matches).toHaveLength(1);
    expect(result.entityMatch!.emitente.matches[0].entityType).toBe('fornecedor');
    expect(result.entityMatch!.emitente.matches[0].entityName).toBe('Conitex');
  });

  it('registry with cliente in destinatario matches', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('matched');
    expect(result.entityMatch!.destinatario.matches).toHaveLength(1);
    expect(result.entityMatch!.destinatario.matches[0].entityType).toBe('cliente');
  });

  it('same CNPJ in cliente and fornecedor returns ambiguous', () => {
    const xml = makeNFeXml(null, CNPJ_SHARED);
    const reg = registry([cliente(1, 'Dual C', CNPJ_SHARED), fornecedor(2, 'Dual F', CNPJ_SHARED)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('ambiguous');
    expect(result.entityMatch!.emitente.matches).toHaveLength(2);
  });

  it('empty registry returns unmatched', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('unmatched');
    expect(result.entityMatch!.emitente.state).toBe('unmatched');
  });

  it('unavailable registry returns registry_unavailable', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = unavailableRegistry();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch).not.toBeNull();
    expect(result.entityMatch!.state).toBe('registry_unavailable');
  });

  it('no association by name', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    expect(result.entityMatch!.destinatario.matches[0].entityName).toBe('Encanta Lar');
  });

  it('matcher preserves found entities', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(2, 'Conitex', CNPJ_FORN, 'latex')]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml, entityRegistry: reg,
    });
    const match = result.entityMatch!.emitente.matches[0];
    expect(match.entityId).toBe(2);
    expect(match.entityName).toBe('Conitex');
    expect(match.supplierType).toBe('latex');
  });

  it('registry does not change direction', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const resultWithReg = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1], entityRegistry: reg,
    });
    const resultWithoutReg = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1],
    });
    expect(resultWithReg.direcaoNf).toBe('entrada');
    expect(resultWithReg.direcaoNf).toBe(resultWithoutReg.direcaoNf);
  });

  it('fornecedor in emitente does NOT imply entrada', () => {
    const xml = makeNFeXml(null, CNPJ_FORN);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_FORN)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.direcaoNf).not.toBe('entrada');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('cliente in destinatario does NOT imply saida', () => {
    const xml = makeNFeXml(CNPJ_CLI, null);
    const reg = registry([cliente(1, 'Encanta Lar', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.direcaoNf).not.toBe('saida');
    expect(result.direcaoNf).toBe('desconhecida');
  });

  it('historical RAVATEX_CNPJS behavior is preserved', () => {
    const xml = makeNFeXml(RAVATEX_CNPJ_1, CNPJ_CLI);
    const reg = registry([fornecedor(1, 'Conitex', CNPJ_CLI)]);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: [RAVATEX_CNPJ_1], entityRegistry: reg,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('extraction occurs from a single source', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const parties = extrairPartesNFe(xml);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    expect(result.cnpjEmitente).toBe(parties.emitenteCnpj);
    expect(result.cnpjDestinatario).toBe(parties.destinatarioCnpj);
  });

  it('output does not contain relevance', () => {
    const xml = makeNFeXml(CNPJ_DEST, CNPJ_EMIT);
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
    });
    const keys = Object.keys(result);
    expect(keys).not.toContain('relevant');
    expect(keys).not.toContain('relevance');
    expect(keys).not.toContain('relevancia');
  });

  it('inputs and registry are not mutated', () => {
    const entries = [cliente(1, 'Encanta Lar', CNPJ_CLI)];
    const reg = registry(entries);
    const frozenEntries = [...entries];
    const xml = makeNFeXml(CNPJ_CLI, null);
    const emitenteCnpj = CNPJ_CLI;

    classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });

    expect(reg.loaded).toBe(true);
    expect(reg.entries).toEqual(frozenEntries);
    expect(emitenteCnpj).toBe(CNPJ_CLI);
  });
});

describe('structural NF-e party extraction (G25-B2-A-R4-B7-R1)', () => {
  const EMIT_CNPJ = '11444777000161';
  const DEST_CNPJ = '11222333000181';

  function multilineXml(overrides?: { emitBlock?: string; destBlock?: string; extra?: string }): string {
    const emitBlock = overrides?.emitBlock ?? `<emit><CNPJ>${EMIT_CNPJ}</CNPJ><xNome>Emit</xNome></emit>`;
    const destBlock = overrides?.destBlock ?? `<dest><CNPJ>${DEST_CNPJ}</CNPJ><xNome>Dest</xNome></dest>`;
    const extra = overrides?.extra ?? '';
    return [
      '<?xml version="1.0"?>',
      '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">',
      '  <NFe>',
      '    <infNFe>',
      `      ${emitBlock}`,
      `      ${destBlock}`,
      `      ${extra}`,
      '    </infNFe>',
      '  </NFe>',
      '</nfeProc>',
    ].join('\n');
  }

  function multilineWithAddresses(): string {
    return loadFixture('nfe-multiline-ender-dest.xml');
  }

  it('extracts emit/CNPJ from multiline NF-e', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('extracts dest/CNPJ when enderDest is present multiline', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('</enderDest> does not end nor replace dest element', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
    expect(r.emitenteCnpj).toBeNull();
  });

  it('<enderEmit> does not interfere with emit extraction', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
  });

  it('does not confuse multiline enderDest with the dest element', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
    expect(r.emitenteCnpj).toBeNull();
  });

  it('accepts nfeProc envelope', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).not.toBeNull();
    expect(r.destinatarioCnpj).not.toBeNull();
  });

  it('accepts XML starting directly with NFe (no nfeProc)', () => {
    const xml = [
      '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">',
      '  <infNFe>',
      `    <emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`,
      `    <dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>`,
      '  </infNFe>',
      '</NFe>',
    ].join('\n');
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('accepts namespace-prefixed elements', () => {
    const xml = loadFixture('nfe-namespace-prefix.xml');
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('accepts default namespace (no prefix)', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('ignores transportadora CNPJ', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('ignores entrega CNPJ block', () => {
    const xml = multilineXml({
      extra: '<entrega><CNPJ>99999999000199</CNPJ></entrega>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('ignores retirada CNPJ block', () => {
    const xml = multilineXml({
      extra: '<retirada><CNPJ>99999999000199</CNPJ></retirada>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('returns null for destinatario with CPF instead of CNPJ', () => {
    const xml = multilineXml({
      destBlock: '<dest><CPF>12345678901</CPF><xNome>Dest</xNome></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('returns null when emitente is absent', () => {
    const xml = multilineXml({ emitBlock: '<emit><xNome>NoCNPJ</xNome></emit>' });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
  });

  it('returns null when destinatario is absent', () => {
    const xml = multilineXml({ destBlock: '<dest><xNome>NoCNPJ</xNome></dest>' });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('malformed XML does not crash the classifier', () => {
    const r = extrairPartesNFe('not even valid <<<xml>>>');
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('malformed XML returns null parts safely', () => {
    const xml = '<nfeProc><dest><CNPJ>12</dest></emit>';
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('short CNPJ value returns null', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>12345</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('punctuated CNPJ is normalized', () => {
    const xml = multilineXml({
      destBlock: `<dest><CNPJ>${DEST_CNPJ.slice(0,2)}.${DEST_CNPJ.slice(2,5)}.${DEST_CNPJ.slice(5,8)}/${DEST_CNPJ.slice(8,12)}-${DEST_CNPJ.slice(12,14)}</CNPJ></dest>`,
      emitBlock: `<emit><CNPJ>${EMIT_CNPJ.slice(0,2)}.${EMIT_CNPJ.slice(2,5)}.${EMIT_CNPJ.slice(5,8)}/${EMIT_CNPJ.slice(8,12)}-${EMIT_CNPJ.slice(12,14)}</CNPJ></emit>`,
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('historical direction behavior is preserved', () => {
    const RAVATEX_CNPJ_1 = '59418365146803';
    const xml = multilineXml({
      destBlock: `<dest><CNPJ>${RAVATEX_CNPJ_1}</CNPJ></dest>`,
      emitBlock: `<emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`,
    });
    const cnpjs = [RAVATEX_CNPJ_1];
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      ravatexCnpjs: cnpjs,
    });
    expect(result.direcaoNf).toBe('entrada');
  });

  it('entityMatch finds fornecedor in emitente structurally', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'fornecedor' as const, entityId: 1, entityName: 'Fornecedor X', cnpj: EMIT_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.emitente.state).toBe('matched');
    expect(result.entityMatch!.emitente.matches[0].entityType).toBe('fornecedor');
  });

  it('entityMatch finds cliente in destinatario structurally', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'cliente' as const, entityId: 2, entityName: 'Cliente Y', cnpj: DEST_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.destinatario.state).toBe('matched');
    expect(result.entityMatch!.destinatario.matches[0].entityType).toBe('cliente');
  });

  it('consolidated result is matched when both are unambiguous', () => {
    const reg = {
      loaded: true, loadedAt: new Date().toISOString(), entries: [
        { entityType: 'fornecedor' as const, entityId: 1, entityName: 'Fornecedor X', cnpj: EMIT_CNPJ },
        { entityType: 'cliente' as const, entityId: 2, entityName: 'Cliente Y', cnpj: DEST_CNPJ },
      ], error: null,
    };
    const xml = multilineXml();
    const result = classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(result.entityMatch!.state).toBe('matched');
  });

  it('does not pick the first global CNPJ', () => {
    const xml = multilineWithAddresses();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('no external access during extraction', () => {
    const xml = multilineXml();
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeDefined();
    expect(r.destinatarioCnpj).toBeDefined();
  });

  it('inputs and registry remain immutable after structural extraction', () => {
    const entries = [
      { entityType: 'fornecedor' as const, entityId: 1, entityName: 'F', cnpj: EMIT_CNPJ },
      { entityType: 'cliente' as const, entityId: 2, entityName: 'C', cnpj: DEST_CNPJ },
    ];
    const reg = { loaded: true, loadedAt: new Date().toISOString(), entries, error: null };
    const frozen = [...entries];
    const xml = multilineWithAddresses();
    classifyAttachment({
      filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml,
      entityRegistry: reg,
    });
    expect(reg.entries).toEqual(frozen);
  });

  it('valid emitente with invalid destinatario (letters) extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>abc</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('invalid emitente (letters) with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>xyz</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('valid emitente with invalid destinatario (bad checksum) extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>22222333000172</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('invalid emitente (bad checksum) with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>11222333000180</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('valid emitente with repeated-sequence destinatario extracts emitente only', () => {
    const xml = multilineXml({
      destBlock: '<dest><CNPJ>00000000000000</CNPJ></dest>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('repeated-sequence emitente with valid destinatario extracts destinatario only', () => {
    const xml = multilineXml({
      emitBlock: '<emit><CNPJ>11111111111111</CNPJ></emit>',
    });
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });
});

describe('B2 structural NF-e validation (fast-xml-parser)', () => {
  const EMIT_CNPJ = '11222333000181';
  const DEST_CNPJ = '11444777000161';

  function nfeProcXml(opts: { emitCnpj?: string | null; destCnpj?: string | null; ns?: 'default' | 'prefix' | 'none'; includeInfNFe?: boolean } = {}): string {
    const ns = opts.ns ?? 'default';
    const includeInf = opts.includeInfNFe !== false;
    const prefix = ns === 'prefix' ? 'nfe:' : '';
    const xmlns = ns === 'default'
      ? ` xmlns="http://www.portalfiscal.inf.br/nfe"`
      : ns === 'prefix'
        ? ` xmlns:nfe="http://www.portalfiscal.inf.br/nfe"`
        : '';
    const emitBlock = includeInf && opts.emitCnpj !== null
      ? `<${prefix}emit><${prefix}CNPJ>${opts.emitCnpj ?? EMIT_CNPJ}</${prefix}CNPJ></${prefix}emit>`
      : '';
    const destBlock = includeInf && opts.destCnpj !== null
      ? `<${prefix}dest><${prefix}CNPJ>${opts.destCnpj ?? DEST_CNPJ}</${prefix}CNPJ></${prefix}dest>`
      : '';
    const infNFeBlock = includeInf ? `<${prefix}infNFe>${emitBlock}${destBlock}</${prefix}infNFe>` : '';
    return `<${prefix}nfeProc${xmlns}><${prefix}NFe>${infNFeBlock}</${prefix}NFe></${prefix}nfeProc>`;
  }

  function nfeRootXml(opts: { emitCnpj?: string | null; destCnpj?: string | null; ns?: 'default' | 'prefix' } = {}): string {
    const ns = opts.ns ?? 'default';
    const prefix = ns === 'prefix' ? 'nfe:' : '';
    const xmlns = ns === 'default'
      ? ` xmlns="http://www.portalfiscal.inf.br/nfe"`
      : ` xmlns:nfe="http://www.portalfiscal.inf.br/nfe"`;
    const emitBlock = opts.emitCnpj !== null
      ? `<${prefix}emit><${prefix}CNPJ>${opts.emitCnpj ?? EMIT_CNPJ}</${prefix}CNPJ></${prefix}emit>`
      : '';
    const destBlock = opts.destCnpj !== null
      ? `<${prefix}dest><${prefix}CNPJ>${opts.destCnpj ?? DEST_CNPJ}</${prefix}CNPJ></${prefix}dest>`
      : '';
    return `<${prefix}NFe${xmlns}><${prefix}infNFe>${emitBlock}${destBlock}</${prefix}infNFe></${prefix}NFe>`;
  }

  it('valid nfeProc with infNFe and default namespace is classified as nf + formato xml', () => {
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: nfeProcXml(),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.cnpjEmitente).toBe(EMIT_CNPJ);
    expect(result.cnpjDestinatario).toBe(DEST_CNPJ);
  });

  it('valid NFe (no nfeProc envelope) with infNFe is classified as nf + formato xml', () => {
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: nfeRootXml(),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
    expect(result.cnpjEmitente).toBe(EMIT_CNPJ);
    expect(result.cnpjDestinatario).toBe(DEST_CNPJ);
  });

  it('valid nfeProc with default namespace (xmlns) extracts CNPJs from infNFe only', () => {
    const r = extrairPartesNFe(nfeProcXml({ ns: 'default' }));
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('valid nfeProc with prefixed namespace (nfe:) extracts CNPJs via removeNSPrefix', () => {
    const r = extrairPartesNFe(nfeProcXml({ ns: 'prefix' }));
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('malformed XML does not throw and returns null parts', () => {
    expect(() => extrairPartesNFe('not even valid <<<xml>>>')).not.toThrow();
    const r = extrairPartesNFe('not even valid <<<xml>>>');
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('malformed XML is classified as desconhecido + formato xml', () => {
    const result = classifyAttachment({
      filename: 'corrupt.xml',
      mimeType: 'text/xml',
      contentSample: 'not even valid <<<xml>>>',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('HTML content renamed to .xml is unknown (root is html, not NFe/nfeProc)', () => {
    const html = '<!DOCTYPE html><html><head><title>nfe</title></head><body>nfeProc</body></html>';
    const result = classifyAttachment({
      filename: 'trick.html.xml',
      mimeType: 'text/xml',
      contentSample: html,
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
    expect(result.cnpjEmitente).toBeNull();
    expect(result.cnpjDestinatario).toBeNull();
  });

  it('generic XML with nfeEvento root (fiscal event, not NF-e) is unknown', () => {
    const eventXml = '<nfeEvento xmlns="http://www.portalfiscal.inf.br/nfe"><evento><CNPJ>11222333000181</CNPJ></evento></nfeEvento>';
    const result = classifyAttachment({
      filename: 'evento.xml',
      mimeType: 'text/xml',
      contentSample: eventXml,
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('nfeProc without infNFe is unknown', () => {
    const noInf = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><other/></NFe></nfeProc>';
    const result = classifyAttachment({
      filename: 'broken.xml',
      mimeType: 'text/xml',
      contentSample: noInf,
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('NFe without infNFe is unknown', () => {
    const noInf = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><other/></NFe>';
    const result = classifyAttachment({
      filename: 'broken.xml',
      mimeType: 'text/xml',
      contentSample: noInf,
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('xml');
  });

  it('extracts valid CNPJ and returns null for invalid CNPJ in infNFe', () => {
    const r = extrairPartesNFe(nfeProcXml({ emitCnpj: EMIT_CNPJ, destCnpj: 'abc' }));
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('extracts null when both CNPJs are invalid in infNFe', () => {
    const r = extrairPartesNFe(nfeProcXml({ emitCnpj: 'abc', destCnpj: '12' }));
    expect(r.emitenteCnpj).toBeNull();
    expect(r.destinatarioCnpj).toBeNull();
  });

  it('CNPJ with leading zeros in infNFe is normalized', () => {
    const r = extrairPartesNFe(nfeProcXml({ destCnpj: '02194703529779' }));
    expect(r.destinatarioCnpj).toBe('02194703529779');
  });

  it('CNPJ with punctuation in infNFe is normalized to 14 digits', () => {
    const r = extrairPartesNFe(nfeProcXml({ destCnpj: '11.444.777/0001-61' }));
    expect(r.destinatarioCnpj).toBe('11444777000161');
  });

  it('CNPJ value comes from infNFe (not from sibling blocks like transporta)', () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">',
      '  <NFe>',
      '    <infNFe>',
      `      <emit><CNPJ>${EMIT_CNPJ}</CNPJ></emit>`,
      `      <dest><CNPJ>${DEST_CNPJ}</CNPJ></dest>`,
      '    </infNFe>',
      '    <transp><transporta><CNPJ>99999999000199</CNPJ></transporta></transp>',
      '  </NFe>',
      '</nfeProc>',
    ].join('\n');
    const r = extrairPartesNFe(xml);
    expect(r.emitenteCnpj).toBe(EMIT_CNPJ);
    expect(r.destinatarioCnpj).toBe(DEST_CNPJ);
  });

  it('MIME generic (application/octet-stream) with .xml extension produces formato xml', () => {
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'application/octet-stream',
      contentSample: nfeProcXml(),
    });
    expect(result.formato).toBe('xml');
    expect(result.tipoDocumento).toBe('nf');
  });

  it('MIME text/xml with .pdf extension produces formato xml (MIME wins) and not nf without infNFe', () => {
    const result = classifyAttachment({
      filename: 'nota.pdf',
      mimeType: 'text/xml',
      contentSample: nfeProcXml(),
    });
    expect(result.formato).toBe('xml');
    expect(result.tipoDocumento).toBe('nf');
  });

  it('preserves extrairPartesNFe public API: returns ExtractedNfeParties with emitenteCnpj/destinatarioCnpj keys', () => {
    const r = extrairPartesNFe(nfeProcXml());
    expect(Object.keys(r).sort()).toEqual(['destinatarioCnpj', 'emitenteCnpj']);
  });

  it('does not persist parsed XML tree or payload via classifier API', () => {
    const src = String(extrairPartesNFe);
    expect(src).not.toMatch(/writeFile|writeFileSync|appendFile/);
  });
});

describe('B2-R1 large XML handling (>2048 bytes)', () => {
  const EMIT_CNPJ = '11222333000181';
  const DEST_CNPJ = '11444777000161';

  function buildLargeNfe(opts: {
    root?: 'nfeProc' | 'NFe';
    ns?: 'default' | 'prefix';
    padBeforeEmit?: boolean;
    padBeforeDest?: boolean;
    padBeforeRoot?: boolean;
    emitCnpj?: string | null;
    destCnpj?: string | null;
    malformed?: boolean;
  } = {}): string {
    const root = opts.root ?? 'nfeProc';
    const ns = opts.ns ?? 'default';
    const prefix = ns === 'prefix' ? 'nfe:' : '';
    const xmlns = ns === 'default'
      ? ' xmlns="http://www.portalfiscal.inf.br/nfe"'
      : ' xmlns:nfe="http://www.portalfiscal.inf.br/nfe"';
    const emitCnpj = opts.emitCnpj ?? EMIT_CNPJ;
    const destCnpj = opts.destCnpj ?? DEST_CNPJ;
    const padEl = `<${prefix}obs>${'X'.repeat(2200)}</${prefix}obs>`;

    let emitBlock = '';
    if (emitCnpj !== null) {
      emitBlock = `<${prefix}emit><${prefix}CNPJ>${emitCnpj}</${prefix}CNPJ></${prefix}emit>`;
    }
    let destBlock = '';
    if (destCnpj !== null) {
      destBlock = `<${prefix}dest><${prefix}CNPJ>${destCnpj}</${prefix}CNPJ></${prefix}dest>`;
    }

    if (opts.malformed) {
      const inner = `<${prefix}infNFe>${padEl}<${prefix}emit><${prefix}CNPJ>${emitCnpj}`;
      return `<?xml version="1.0"?><${prefix}${root}${xmlns}>${inner}`;
    }

    let inner = '';
    if (opts.padBeforeEmit) {
      inner += padEl + emitBlock + destBlock;
    } else if (opts.padBeforeDest) {
      inner += emitBlock + padEl + destBlock;
    } else {
      inner += emitBlock + destBlock + padEl;
    }

    let xml: string;
    if (root === 'nfeProc') {
      xml = `<${prefix}nfeProc${xmlns}><${prefix}NFe><${prefix}infNFe>${inner}</${prefix}infNFe></${prefix}NFe></${prefix}nfeProc>`;
    } else {
      xml = `<${prefix}NFe${xmlns}><${prefix}infNFe>${inner}</${prefix}infNFe></${prefix}NFe>`;
    }

    if (opts.padBeforeRoot) {
      xml = `<!-- ${'Y'.repeat(2100)} -->` + xml;
    }

    return xml;
  }

  it('classifies large NFe (>2048) with nfeProc root as nf + xml', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', padBeforeEmit: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
    expect(r.formato).toBe('xml');
    expect(r.cnpjEmitente).toBe(EMIT_CNPJ);
    expect(r.cnpjDestinatario).toBe(DEST_CNPJ);
  });

  it('classifies large NFe (>2048) with NFe root (no nfeProc envelope) as nf + xml', () => {
    const xml = buildLargeNfe({ root: 'NFe', padBeforeEmit: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
    expect(r.formato).toBe('xml');
  });

  it('classifies large NFe where infNFe starts after 2048 bytes', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', padBeforeRoot: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const xmlBytes = Buffer.byteLength(xml, 'utf-8');
    const infNFeIdx = xml.indexOf('<infNFe');
    expect(infNFeIdx).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
    expect(r.formato).toBe('xml');
  });

  it('extracts emit CNPJ from large XML where emit/CNPJ is beyond 2048 bytes', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', padBeforeEmit: true });
    const emitIdx = xml.indexOf('<emit>');
    expect(emitIdx).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.cnpjEmitente).toBe(EMIT_CNPJ);
  });

  it('extracts dest CNPJ from large XML where dest/CNPJ is beyond 2048 bytes', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', padBeforeDest: true });
    const destIdx = xml.indexOf('<dest>');
    expect(destIdx).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.cnpjDestinatario).toBe(DEST_CNPJ);
  });

  it('large NFe with closing tags only near end of file > 2048 classified as nf', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', padBeforeEmit: true });
    const closeIdx = xml.lastIndexOf('</nfeProc>');
    expect(closeIdx).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
  });

  it('large NFe with default namespace classified as nf + xml', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', ns: 'default', padBeforeEmit: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
    expect(r.cnpjEmitente).toBe(EMIT_CNPJ);
  });

  it('large NFe with prefixed namespace (nfe:) classified as nf + xml', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', ns: 'prefix', padBeforeEmit: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('nf');
    expect(r.cnpjEmitente).toBe(EMIT_CNPJ);
  });

  it('large malformed XML (>2048) → desconhecido + formato xml', () => {
    const xml = buildLargeNfe({ root: 'nfeProc', malformed: true, padBeforeEmit: true });
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'nfe.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('desconhecido');
    expect(r.formato).toBe('xml');
    expect(r.cnpjEmitente).toBeNull();
    expect(r.cnpjDestinatario).toBeNull();
  });

  it('large generic XML (>2048) with "nfe" text but no NFe structure → desconhecido', () => {
    const xml = `<root><item>${'A'.repeat(1500)}nfe${'B'.repeat(1500)}</item></root>`;
    expect(Buffer.byteLength(xml, 'utf-8')).toBeGreaterThan(2048);
    const r = classifyAttachment({ filename: 'generic.xml', mimeType: 'text/xml', contentSample: xml });
    expect(r.tipoDocumento).toBe('desconhecido');
    expect(r.formato).toBe('xml');
  });
});

describe('B3 PDF recognition safety (G27-B3)', () => {
  const PDF_SIG = '%PDF-1.4\n';
  const PDF_END = '\n%%EOF\n';

  function pdfWithContent(text: string): string {
    return `${PDF_SIG}${text}${PDF_END}`;
  }

  it('PDF real DANFE → nf + formato pdf + direcao null', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('PDF real nota fiscal → nf + formato pdf + direcao null', () => {
    const result = classifyAttachment({
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('NOTA FISCAL 12345 - FORNECEDOR X'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('PDF real com NFe no conteúdo → nf + formato pdf + direcao null', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('NFe: 000123 Serie 1'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('info.pdf sem token NF → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'info.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('Informativo generico do fornecedor'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('conferencia.pdf sem token NF → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'conferencia.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('Conferencia interna do estoque'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('informativo.pdf sem token NF → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'informativo.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('Memorando informativo mensal'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('NF-123.pdf com %PDF- → nf + formato pdf + direcao null', () => {
    const result = classifyAttachment({
      filename: 'NF-123.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
    expect(result.direcaoNf).toBeNull();
  });

  it('NF123.pdf (NF seguido de dígito) com %PDF- → nf', () => {
    const result = classifyAttachment({
      filename: 'NF123.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('NFe-001.pdf (NFe token) com %PDF- → nf', () => {
    const result = classifyAttachment({
      filename: 'NFe-001.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('NF-e no subject com %PDF- → nf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'NF-e 12345 - Fornecedor X',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('PDF com MIME generic + signature válida → formato pdf + nf se tokens', () => {
    const result = classifyAttachment({
      filename: 'doc.pdf',
      mimeType: 'application/octet-stream',
      contentSample: pdfWithContent('DANFE documento'),
    });
    expect(result.formato).toBe('pdf');
    expect(result.tipoDocumento).toBe('nf');
  });

  it('PDF com MIME generic + assinatura inválida → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'NF-123.pdf',
      mimeType: 'application/octet-stream',
      contentSample: 'NOT a real PDF\nrandom content\n',
    });
    expect(result.formato).toBe('pdf');
    expect(result.tipoDocumento).toBe('desconhecido');
  });

  it('MIME PDF com conteúdo HTML (sem %PDF-) → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      contentSample: '<!DOCTYPE html><html><body>DANFE documento</body></html>',
    });
    expect(result.formato).toBe('pdf');
    expect(result.tipoDocumento).toBe('desconhecido');
  });

  it('MIME PDF sem %PDF- em contentSample → desconhecido + formato pdf (mesmo com NF no nome)', () => {
    const result = classifyAttachment({
      filename: 'NF-123.pdf',
      mimeType: 'application/pdf',
      contentSample: 'not a real PDF\nrandom content\n',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('romaneio por nome prevalece sem contentSample', () => {
    const result = classifyAttachment({
      filename: 'romaneio_carga.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
  });

  it('romaneio por nome com contentSample válido → romaneio (precedência mantida)', () => {
    const result = classifyAttachment({
      filename: 'romaneio_2024.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('DANFE documento'),
    });
    expect(result.tipoDocumento).toBe('romaneio');
    expect(result.formato).toBe('pdf');
  });

  it('romaneio apenas no conteúdo (sem nome/subject) não é implementado → desconhecido', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('romaneio de entrega interno'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('nota fiscal no subject com separador hífen → nf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'nota-fiscal 12345 - Fornecedor X',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('nota fiscal no subject com separador underscore → nf', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'nota_fiscal 12345 - Fornecedor X',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('pdf');
  });

  it('notafiscal sem separador → não é NF', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      subject: 'notafiscal 12345 - Fornecedor X',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('INFORME.pdf (incidental) → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'INFORME.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('CONFERENCIA.pdf (incidental) → desconhecido + formato pdf', () => {
    const result = classifyAttachment({
      filename: 'CONFERENCIA.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('conteudo generico'),
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('PDF sem contentSample → desconhecido (sem promoção por nome/subject)', () => {
    const result = classifyAttachment({
      filename: 'NF-12345.pdf',
      mimeType: 'application/pdf',
      subject: 'NF-e 12345',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });

  it('PDF real não cria autoaceite (status permanece pending via realScan downstream)', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      contentSample: pdfWithContent('DANFE documento'),
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.direcaoNf).toBeNull();
  });

  it('conteúdo com lixo antes de %PDF- e token DANFE → desconhecido (assinatura deve ser prefixo inicial)', () => {
    const result = classifyAttachment({
      filename: 'documento.pdf',
      mimeType: 'application/pdf',
      contentSample: '<html>debug output\n%PDF-1.4\nDANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA\n%%EOF',
    });
    expect(result.tipoDocumento).toBe('desconhecido');
    expect(result.formato).toBe('pdf');
  });
});

describe('G27 entity expansion disabled (security regression)', () => {
  const DEST_CNPJ = '11444777000161';

  function nfeWithEntity(processedAs?: 'expanded' | 'literal'): string {
    switch (processedAs) {
      case 'expanded':
        return `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>${DEST_CNPJ}</CNPJ></dest></infNFe></NFe></nfeProc>`;
      case 'literal':
      default:
        return `<?xml version="1.0"?>
<!DOCTYPE nfeProc [
  <!ENTITY cnpjEnt "11222333000181">
]>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><emit><CNPJ>&cnpjEnt;</CNPJ></emit><dest><CNPJ>${DEST_CNPJ}</CNPJ></dest></infNFe></NFe></nfeProc>`;
    }
  }

  it('NF-e with internal entity used as CNPJ still has valid NFe structure', () => {
    const xml = nfeWithEntity('literal');
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
    });
    expect(result.tipoDocumento).toBe('nf');
    expect(result.formato).toBe('xml');
  });

  it('internal entity used as emitente CNPJ does not expand (fail-closed → null)', () => {
    const xml = nfeWithEntity('literal');
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
    });
    expect(result.cnpjEmitente).toBeNull();
  });

  it('literal CNPJ in destinatario is still extracted correctly alongside entity emitente', () => {
    const xml = nfeWithEntity('literal');
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
    });
    expect(result.cnpjDestinatario).toBe(DEST_CNPJ);
  });

  it('same NF-e without entity (control) extracts both CNPJs', () => {
    const xml = nfeWithEntity('expanded');
    const result = classifyAttachment({
      filename: 'nfe.xml',
      mimeType: 'text/xml',
      contentSample: xml,
    });
    expect(result.cnpjEmitente).toBe('11222333000181');
    expect(result.cnpjDestinatario).toBe(DEST_CNPJ);
  });
});
